/* Platform tables — the machinery every later phase sits on: settings, background jobs,
 * rate limiting, audit trail, and staff authentication.
 *
 * Deliberately no Redis and no cron daemon. Both jobs and rate limiting are Postgres
 * tables because the deployment topology is not yet known: `FOR UPDATE SKIP LOCKED` and
 * an atomic upsert are correct whether the app runs as one process or twelve, and are
 * simpler than the Redis equivalents at this scale rather than a compromise.
 *
 * Convention: emails are stored lowercased by the application (no citext extension, so
 * the schema stays portable to any managed Postgres the client's team picks). */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ── Settings ────────────────────────────────────────────────────────────────────
   The escape hatch that keeps undecided client inputs out of migrations: shipping
   rates, COD fee, GST rate and GSTIN all live here, editable in admin. Adding a new
   knob is an INSERT, not a schema change. Defaults are seeded in db/seed/settings.ts. */
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  /* Nullable on purpose. Several settings are legitimately null until the client
     supplies them (gstin, seller_state, shipping_free_above_minor), and a JS null
     written to a jsonb column becomes SQL NULL — not JSON null — so NOT NULL rejected
     the seed outright. Absent row and null value both mean "unset", which is the same
     thing here; lib/settings.ts models it as `.nullable()`. */
  value: jsonb("value"),
  description: text("description"),
  updatedBy: uuid("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ── Background jobs ─────────────────────────────────────────────────────────────
   Doubles as the transactional outbox. A row inserted in the SAME transaction as a
   state change guarantees the side effect is never lost and, more importantly, that a
   failing SMTP server can never roll back a captured payment.

   `singleton` marks recurring work (cleanups, reconciliation). The partial unique index
   below makes it impossible to queue two of the same recurring kind at once, which is
   what replaces leader election if the app is ever run multi-instance. */
export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    singleton: boolean("singleton").notNull().default(false),

    runAfter: ts("run_after").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),

    lockedAt: ts("locked_at"),
    lockedBy: text("locked_by"),
    doneAt: ts("done_at"),
    failedAt: ts("failed_at"),
    lastError: text("last_error"),

    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    /* The worker's claim query: pending work, oldest first. */
    index("job_pending_idx")
      .on(t.runAfter)
      .where(sql`${t.doneAt} is null and ${t.failedAt} is null`),
    /* At most one live row per recurring kind, enforced by the database rather than by
       hoping only one scheduler is running. */
    uniqueIndex("job_singleton_kind_idx")
      .on(t.kind)
      .where(sql`${t.singleton} and ${t.doneAt} is null and ${t.failedAt} is null`),
    index("job_kind_idx").on(t.kind),
  ]
);

/* ── Rate limiting ───────────────────────────────────────────────────────────────
   Fixed-window counters. One upsert per limited request; old windows are swept by the
   `rate_limit:cleanup` recurring job. */
export const rateLimit = pgTable(
  "rate_limit",
  {
    bucket: text("bucket").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("rate_limit_pk").on(t.bucket, t.windowStart),
    index("rate_limit_sweep_idx").on(t.windowStart),
  ]
);

/* ── Audit ───────────────────────────────────────────────────────────────────────
   Every money-affecting or content-publishing action writes one row. `actorEmail` is
   snapshotted so the trail stays readable after a staff account is removed. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipHash: text("ip_hash"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_at_idx").on(t.at)]
);

/* ── Staff authentication ────────────────────────────────────────────────────────
   Magic link only. No password column exists anywhere, by design: with two or three
   staff accounts, password storage, reset flows and reuse are all risk without benefit. */
export const adminRole = pgEnum("admin_role", ["owner", "editor"]);
export const adminStatus = pgEnum("admin_status", ["active", "disabled"]);

export const adminUser = pgTable(
  "admin_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    role: adminRole("role").notNull().default("editor"),
    status: adminStatus("status").notNull().default("active"),
    /* Nullable BY DESIGN (added 2026-08-19, client request): password sign-in is
       opt-in per account, set only by scripts/set-admin-password.mjs. Null keeps the
       original contract — that account signs in by emailed link alone. The format and
       verification live in lib/auth.ts (scrypt, constant-time). */
    passwordHash: text("password_hash"),
    lastLoginAt: ts("last_login_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_user_email_idx").on(t.email)]
);

/* Only the SHA-256 of a session token is stored: a database dump cannot be replayed as
   a live session. Same rule for login tokens below. */
export const adminSession = pgTable(
  "admin_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_session_token_idx").on(t.tokenHash),
    index("admin_session_user_idx").on(t.adminUserId),
  ]
);

export const loginToken = pgTable(
  "login_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    ipHash: text("ip_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("login_token_hash_idx").on(t.tokenHash),
    index("login_token_email_idx").on(t.email),
  ]
);
