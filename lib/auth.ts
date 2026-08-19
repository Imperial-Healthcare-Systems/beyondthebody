/* Staff authentication — magic link, database-backed sessions.
 *
 * No password column exists anywhere in this schema, deliberately. With two or three
 * staff accounts, passwords are pure liability: storage, reset flows, reuse across sites,
 * and a credential-stuffing surface, in exchange for nothing a mailed link does not give.
 *
 * Everything here is pure database work with no access to cookies or the request, so it
 * can also be driven from a CLI script (see scripts/create-admin.mjs). The cookie layer
 * lives in lib/admin-session.ts. */

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminSession, adminUser, loginToken } from "@/db/schema";
import { generateToken, hashToken, normaliseEmail } from "./tokens";
import { logger, maskEmail } from "./logger";

export type AdminUser = typeof adminUser.$inferSelect;
export type AdminRole = AdminUser["role"];

/** Sign-in links are short-lived: they sit in an inbox, which is a less protected place
 *  than a session cookie. Long enough to fetch from a phone, short enough to matter. */
export const LOGIN_TOKEN_TTL_MIN = 15;
/** Sliding: any authenticated request pushes it out. A laptop left open overnight is
 *  signed out by morning. */
export const SESSION_IDLE_HOURS = 8;
/** Hard ceiling regardless of activity, so a stolen cookie cannot live forever. */
export const SESSION_ABSOLUTE_DAYS = 30;

/**
 * Issue a sign-in token for an email address.
 *
 * Returns null when the address is not an active staff account. **The caller must
 * respond identically either way** — a different message or timing would let anyone
 * enumerate who has admin access.
 */
export async function issueLoginToken(
  email: string,
  ipHash?: string
): Promise<{ token: string; user: AdminUser } | null> {
  const normalised = normaliseEmail(email);

  const [user] = await db
    .select()
    .from(adminUser)
    .where(and(eq(adminUser.email, normalised), eq(adminUser.status, "active")))
    .limit(1);

  if (!user) {
    logger.info("auth.login_requested_unknown", { email: maskEmail(normalised) });
    return null;
  }

  const token = generateToken();

  await db.insert(loginToken).values({
    email: normalised,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MIN * 60_000),
    ipHash,
  });

  logger.info("auth.login_token_issued", { email: maskEmail(normalised) });
  return { token, user };
}

export type ConsumeResult =
  | { ok: true; user: AdminUser; sessionToken: string }
  | { ok: false; reason: "invalid" | "expired" | "disabled" };

/**
 * Exchange a sign-in token for a session. Single use: the token is marked consumed in the
 * same statement that claims it, so two simultaneous uses cannot both succeed.
 */
export async function consumeLoginToken(
  token: string,
  meta: { ipHash?: string; userAgent?: string } = {}
): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);

  /* Conditional UPDATE rather than select-then-update: claiming and marking consumed is
     one atomic step, so a link opened twice at once yields exactly one session. */
  const claimed = await db
    .update(loginToken)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginToken.tokenHash, tokenHash), isNull(loginToken.consumedAt)))
    .returning();

  if (claimed.length === 0) return { ok: false, reason: "invalid" };

  const row = claimed[0];
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const [user] = await db
    .select()
    .from(adminUser)
    .where(eq(adminUser.email, row.email))
    .limit(1);

  /* Access revoked between the link being sent and followed. */
  if (!user || user.status !== "active") return { ok: false, reason: "disabled" };

  const sessionToken = await createSession(user.id, meta);
  await db
    .update(adminUser)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUser.id, user.id));

  logger.info("auth.signed_in", { email: maskEmail(user.email), role: user.role });
  return { ok: true, user, sessionToken };
}

export async function createSession(
  adminUserId: string,
  meta: { ipHash?: string; userAgent?: string } = {}
): Promise<string> {
  const token = generateToken();

  await db.insert(adminSession).values({
    adminUserId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_IDLE_HOURS * 3_600_000),
    ipHash: meta.ipHash,
    userAgent: meta.userAgent?.slice(0, 500),
  });

  return token;
}

/**
 * Resolve a session cookie to a user, or null.
 *
 * Enforces three things at once: the session exists and is unrevoked, it is inside both
 * the idle and absolute windows, and the account is still active — so disabling a staff
 * member takes effect on their next request rather than whenever their cookie expires.
 */
export async function validateSession(token: string): Promise<AdminUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const absoluteCutoff = new Date(now.getTime() - SESSION_ABSOLUTE_DAYS * 86_400_000);

  const [row] = await db
    .select({ session: adminSession, user: adminUser })
    .from(adminSession)
    .innerJoin(adminUser, eq(adminSession.adminUserId, adminUser.id))
    .where(
      and(
        eq(adminSession.tokenHash, tokenHash),
        isNull(adminSession.revokedAt),
        gt(adminSession.expiresAt, now),
        gt(adminSession.createdAt, absoluteCutoff),
        eq(adminUser.status, "active")
      )
    )
    .limit(1);

  if (!row) return null;

  /* Slide the idle window. Written on every authenticated request, which is acceptable
     at this volume — a handful of staff, not a public session store. */
  await db
    .update(adminSession)
    .set({
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_HOURS * 3_600_000),
    })
    .where(eq(adminSession.id, row.session.id));

  return row.user;
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(adminSession)
    .set({ revokedAt: new Date() })
    .where(eq(adminSession.tokenHash, hashToken(token)));
}

/** Sign a user out everywhere — for a lost laptop, or when removing someone's access. */
export async function revokeAllSessions(adminUserId: string): Promise<number> {
  const rows = await db
    .update(adminSession)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSession.adminUserId, adminUserId), isNull(adminSession.revokedAt)))
    .returning({ id: adminSession.id });
  return rows.length;
}

/** Sweep spent login tokens and dead sessions. Registered as a recurring job. */
export async function purgeExpiredAuth(): Promise<void> {
  const now = new Date();
  await db
    .delete(loginToken)
    .where(or(lt(loginToken.expiresAt, now), sql`${loginToken.consumedAt} is not null`));

  await db
    .delete(adminSession)
    .where(
      or(
        lt(adminSession.expiresAt, new Date(now.getTime() - 7 * 86_400_000)),
        sql`${adminSession.revokedAt} < ${new Date(now.getTime() - 7 * 86_400_000)}`
      )
    );
}
