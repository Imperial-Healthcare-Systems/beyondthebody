/* Environment contract — the single place any process.env value is read.
 *
 * Parsed LAZILY and memoised. Lazy matters: `next build` prerenders pages without a
 * database or SMTP host present, and an eager parse at import time would fail the build
 * for pages that never touch the backend. The real fail-fast happens at server startup
 * (lib/startup.ts, via instrumentation.ts) where a missing var genuinely is fatal.
 *
 * Rule: nothing outside this file reads process.env. If you need a new value, add it to
 * the schema and to .env.example in the same commit. */

import { z } from "zod";

/* Env values are always strings, so booleans need parsing.
 *
 * The default goes on the ENUM, before the transform — not on the finished pipe. Zod 4's
 * `.default()` short-circuits: when the input is undefined it returns the default AS-IS
 * without running the rest of the chain, so `.transform(...).default("true")` yields the
 * string "true" rather than boolean true. Caught by tests/env.test.ts; the ordering here
 * is load-bearing, not stylistic. */
const booleanish = (fallback: "true" | "false") =>
  z
    .enum(["true", "false", "1", "0"])
    .default(fallback)
    .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /* Postgres. The app opens one small pool; see lib/db/client.ts. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: booleanish("false"),
  /* Escape hatch for a self-signed / internal CA certificate, which a self-hosted
     Postgres often has. Turns OFF certificate verification, so the connection is
     encrypted but no longer proves who is on the other end. Never set this against a
     managed provider — they all present a publicly trusted certificate. */
  DATABASE_SSL_INSECURE: booleanish("false"),

  /* Absolute public origin, no trailing slash. Used to build links in email
     (confirm, unsubscribe, magic-link, order status) — these are sent to humans and
     cannot be relative, so this must be right in production. */
  APP_URL: z.url(),

  /* >=32 bytes of randomness. Signs order-access tokens and hashes session tokens.
     Rotating it invalidates every live session and every emailed order link. */
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  /* Number of reverse proxies in front of the app. Decides how many entries to trust
     from the right of X-Forwarded-For. 0 = read the socket address only.
     Getting this wrong makes rate limiting trivially bypassable — see lib/http.ts. */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /* Background worker. Off during builds and in one-shot scripts; on in a running
     server. Set false on any instance that should not process jobs. */
  WORKER_ENABLED: booleanish("true"),
  WORKER_POLL_MS: z.coerce.number().int().min(200).max(60_000).default(2_000),
  WORKER_BATCH: z.coerce.number().int().min(1).max(100).default(5),

  /* ── Email (company SMTP, per client decision) ─────────────────────────────────
     All optional: with no SMTP_HOST the app logs messages instead of sending them, so
     development and tests need no mail server. startup.ts warns loudly if this is the
     case in production, because a silently-unsent order confirmation reads to the
     customer as a failed order. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  /* true only for implicit TLS on port 465. Port 587 uses STARTTLS and must stay false. */
  SMTP_SECURE: booleanish("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /* RFC 5322 address the house sends as, e.g. `Beyond The Body <hello@…>`. Must be on a
     domain whose SPF/DKIM authorise this server, or mail lands in spam. */
  MAIL_FROM: z.string().default("Beyond The Body <no-reply@beyondthebody.com>"),
  /* Where the house is told an order arrived. Until the admin order list exists this is
     the ONLY notification, so it falls back to the MAIL_FROM address rather than nowhere.
     A monitored mailbox someone actually reads in the morning. */
  ORDERS_EMAIL: z.email().optional(),

  /* ── Razorpay ──────────────────────────────────────────────────────────────────
     All three optional, and all three required TOGETHER: with any of them missing the
     gateway reports itself unconfigured and prepaid checkout stays closed behind a plain
     message. That is the state the site ships in until the client's account exists —
     adding these three values turns card and UPI on, with no code change and no
     migration. Half-configured fails closed rather than half-working.

     KEY_SECRET signs the browser's return from checkout; WEBHOOK_SECRET signs webhook
     deliveries. They are different secrets and are not interchangeable. */
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /* Optional. Absent = no error reporting beyond structured logs. */
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Parse and memoise. Throws a readable, aggregated error listing every bad var. */
export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n\n` +
        `See .env.example for the full contract.`
    );
  }

  cached = parsed.data;
  return cached;
}

/** Ergonomic accessor: `env.DATABASE_URL`. Parses on first property read. */
export const env = new Proxy({} as Env, {
  get: (_t, prop: string) => loadEnv()[prop as keyof Env],
  has: (_t, prop: string) => prop in loadEnv(),
  ownKeys: () => Reflect.ownKeys(loadEnv()),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export const isProduction = () => loadEnv().NODE_ENV === "production";

/** Test-only. Lets a suite swap the environment between cases. */
export function __resetEnvCache() {
  cached = null;
}
