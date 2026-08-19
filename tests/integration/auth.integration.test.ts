/* Staff authentication, end to end against a real Postgres.
 *
 * This is the highest-risk surface in the backend: everything behind /admin trusts it,
 * and from phase 7 that includes marking COD orders paid and issuing refunds. The tests
 * are written around the ways it could be WRONG rather than the happy path — replayed
 * links, expired links, revoked sessions, disabled accounts, and privilege checks. */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { adminSession, adminUser, loginToken } from "@/db/schema";
import {
  consumeLoginToken,
  createSession,
  issueLoginToken,
  purgeExpiredAuth,
  revokeAllSessions,
  revokeSession,
  validateSession,
  SESSION_ABSOLUTE_DAYS,
} from "@/lib/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const OWNER = "owner@test.beyondthebody.invalid";
const EDITOR = "editor@test.beyondthebody.invalid";

async function wipe() {
  await db.delete(loginToken).where(like(loginToken.email, "%test.beyondthebody.invalid"));
  const users = await db
    .select({ id: adminUser.id })
    .from(adminUser)
    .where(like(adminUser.email, "%test.beyondthebody.invalid"));
  for (const u of users) await db.delete(adminSession).where(eq(adminSession.adminUserId, u.id));
  await db.delete(adminUser).where(like(adminUser.email, "%test.beyondthebody.invalid"));
}

async function seedUsers() {
  await db.insert(adminUser).values([
    { email: OWNER, role: "owner", status: "active" },
    { email: EDITOR, role: "editor", status: "active" },
  ]);
}

describe.skipIf(!hasDb)("phase 2 · staff authentication", () => {
  beforeEach(async () => {
    await wipe();
    await seedUsers();
  });

  afterAll(async () => {
    await wipe();
    await closeDb();
  });

  it("issues a sign-in token for a known active account", async () => {
    const issued = await issueLoginToken(OWNER);
    expect(issued?.user.email).toBe(OWNER);
    expect(issued?.token).toBeTruthy();
  });

  it("returns null for an unknown address — the caller must not be able to tell", async () => {
    expect(await issueLoginToken("stranger@test.beyondthebody.invalid")).toBeNull();
  });

  it("refuses a disabled account", async () => {
    await db.update(adminUser).set({ status: "disabled" }).where(eq(adminUser.email, EDITOR));
    expect(await issueLoginToken(EDITOR)).toBeNull();
  });

  it("stores only a hash of the sign-in token", async () => {
    const { token } = (await issueLoginToken(OWNER))!;
    const [row] = await db.select().from(loginToken).where(eq(loginToken.email, OWNER));
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exchanges a token for a working session", async () => {
    const { token } = (await issueLoginToken(OWNER))!;
    const result = await consumeLoginToken(token);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await validateSession(result.sessionToken);
    expect(user?.email).toBe(OWNER);
    expect(user?.role).toBe("owner");
  });

  it("makes a sign-in link SINGLE USE", async () => {
    const { token } = (await issueLoginToken(OWNER))!;
    expect((await consumeLoginToken(token)).ok).toBe(true);
    // A replayed link — from browser history, or a mail scanner that already fetched it.
    expect(await consumeLoginToken(token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("yields exactly one session when a link is opened twice at once", async () => {
    const { token } = (await issueLoginToken(OWNER))!;

    /* The claim is a conditional UPDATE, so concurrent uses cannot both succeed. */
    const results = await Promise.all([
      consumeLoginToken(token),
      consumeLoginToken(token),
      consumeLoginToken(token),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("rejects an expired sign-in link", async () => {
    const { token } = (await issueLoginToken(OWNER))!;
    await db
      .update(loginToken)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(loginToken.email, OWNER));

    expect(await consumeLoginToken(token)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a link whose account was disabled after it was sent", async () => {
    const { token } = (await issueLoginToken(EDITOR))!;
    await db.update(adminUser).set({ status: "disabled" }).where(eq(adminUser.email, EDITOR));

    expect(await consumeLoginToken(token)).toEqual({ ok: false, reason: "disabled" });
  });

  it("rejects a made-up session token", async () => {
    expect(await validateSession("not-a-session")).toBeNull();
    expect(await validateSession("")).toBeNull();
  });

  it("stops accepting a session once revoked", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const token = await createSession(user.id);

    expect(await validateSession(token)).not.toBeNull();
    await revokeSession(token);
    expect(await validateSession(token)).toBeNull();
  });

  it("revokes every session at once", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const a = await createSession(user.id);
    const b = await createSession(user.id);

    expect(await revokeAllSessions(user.id)).toBe(2);
    expect(await validateSession(a)).toBeNull();
    expect(await validateSession(b)).toBeNull();
  });

  it("stops accepting a session the moment the account is disabled", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, EDITOR));
    const token = await createSession(user.id);
    expect(await validateSession(token)).not.toBeNull();

    /* Removing access must take effect on the next request, not whenever the cookie
       happens to expire. */
    await db.update(adminUser).set({ status: "disabled" }).where(eq(adminUser.id, user.id));
    expect(await validateSession(token)).toBeNull();
  });

  it("expires an idle session", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const token = await createSession(user.id);

    await db
      .update(adminSession)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(adminSession.adminUserId, user.id));

    expect(await validateSession(token)).toBeNull();
  });

  it("enforces the absolute lifetime however active the session is", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const token = await createSession(user.id);

    /* Created beyond the hard ceiling but with a future idle window — a stolen cookie
       kept warm by use must still die. */
    await db
      .update(adminSession)
      .set({
        createdAt: new Date(Date.now() - (SESSION_ABSOLUTE_DAYS + 1) * 86_400_000),
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .where(eq(adminSession.adminUserId, user.id));

    expect(await validateSession(token)).toBeNull();
  });

  it("slides the idle window on use", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const token = await createSession(user.id);

    const near = new Date(Date.now() + 60_000);
    await db.update(adminSession).set({ expiresAt: near }).where(eq(adminSession.adminUserId, user.id));

    await validateSession(token);

    const [row] = await db.select().from(adminSession).where(eq(adminSession.adminUserId, user.id));
    expect(row.expiresAt.getTime()).toBeGreaterThan(near.getTime());
  });

  it("purges spent tokens without touching live sessions", async () => {
    const [user] = await db.select().from(adminUser).where(eq(adminUser.email, OWNER));
    const live = await createSession(user.id);

    const { token } = (await issueLoginToken(OWNER))!;
    await consumeLoginToken(token); // now consumed

    await purgeExpiredAuth();

    const tokens = await db.select().from(loginToken).where(eq(loginToken.email, OWNER));
    expect(tokens).toHaveLength(0);
    expect(await validateSession(live)).not.toBeNull();
  });
});
