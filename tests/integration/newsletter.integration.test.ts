/* Newsletter double opt-in, end to end against a real Postgres.
 *
 * The confirm/unsubscribe tokens are deliberately never returned by any function — they
 * exist only inside the queued email. So these tests read the token back out of the
 * `mail:send` job payload, which is exactly the path a real subscriber takes and proves
 * the link we actually send is the link that works. */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { job, subscriber } from "@/db/schema";
import { confirmSubscription, subscribe, unsubscribe } from "@/lib/newsletter";

const hasDb = Boolean(process.env.DATABASE_URL);
const EMAIL = "reader@test.beyondthebody.invalid";

/** Pull the newest queued email for an address and extract its token, as a subscriber
 *  would by clicking the link. */
async function tokenFromLatestMail(email: string, path: string): Promise<string | null> {
  const [row] = await db
    .select({ payload: job.payload })
    .from(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${email}`))
    .orderBy(desc(job.createdAt))
    .limit(1);

  if (!row) return null;
  const text = (row.payload as { text?: string }).text ?? "";
  const match = text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`));
  return match?.[1] ?? null;
}

async function mailCount(email: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${email}`));
  return Number(row?.n ?? 0);
}

async function wipe() {
  await db.delete(job).where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' like ${"%test.beyondthebody.invalid"}`));
  await db.delete(subscriber).where(like(subscriber.email, "%test.beyondthebody.invalid"));
}

describe.skipIf(!hasDb)("phase 1 · newsletter double opt-in", () => {
  beforeEach(wipe);
  afterAll(async () => {
    await wipe();
    await closeDb();
  });

  it("records a pending subscriber and queues a confirmation email", async () => {
    await subscribe({ email: EMAIL });

    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.status).toBe("pending");
    expect(row.confirmedAt).toBeNull();
    expect(row.confirmTokenHash).toBeTruthy();
    /* The consent wording is stored so it can be proven later. */
    expect(row.consentText).toContain("Notes from the studio");

    expect(await mailCount(EMAIL)).toBe(1);
  });

  it("stores only a HASH — the raw token never reaches the database", async () => {
    await subscribe({ email: EMAIL });
    const token = await tokenFromLatestMail(EMAIL, "/newsletter/confirm");
    expect(token).toBeTruthy();

    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.confirmTokenHash).not.toBe(token);
    expect(row.confirmTokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("normalises case and whitespace so one person cannot become two rows", async () => {
    await subscribe({ email: "  Reader@Test.BeyondTheBody.Invalid  " });
    const rows = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(rows).toHaveLength(1);
  });

  it("confirms with the emailed token and queues the welcome mail", async () => {
    await subscribe({ email: EMAIL });
    const token = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;

    const result = await confirmSubscription(token);
    expect(result).toEqual({ ok: true, alreadyConfirmed: false });

    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.status).toBe("confirmed");
    expect(row.confirmedAt).not.toBeNull();
    expect(row.confirmTokenHash).toBeNull(); // consumed
    expect(await mailCount(EMAIL)).toBe(2);  // confirm + welcome
  });

  it("makes a confirmation link single-use", async () => {
    await subscribe({ email: EMAIL });
    const token = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;

    await confirmSubscription(token);
    // Replaying the same link must not work — the hash was cleared on use.
    expect(await confirmSubscription(token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired confirmation link", async () => {
    await subscribe({ email: EMAIL });
    const token = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;

    await db
      .update(subscriber)
      .set({ confirmExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(subscriber.email, EMAIL));

    expect(await confirmSubscription(token)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a made-up token", async () => {
    expect(await confirmSubscription("not-a-real-token")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("does NOTHING when an already-confirmed address re-subscribes", async () => {
    await subscribe({ email: EMAIL });
    const token = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;
    await confirmSubscription(token);

    const before = await mailCount(EMAIL);
    await subscribe({ email: EMAIL });

    // No new mail: otherwise the public form becomes a way to repeatedly email someone.
    expect(await mailCount(EMAIL)).toBe(before);
    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.status).toBe("confirmed");
  });

  it("re-issues a fresh token when a pending address subscribes again", async () => {
    await subscribe({ email: EMAIL });
    const first = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;

    await subscribe({ email: EMAIL });
    const second = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;

    expect(second).not.toBe(first);
    // The superseded link must be dead, not merely unused.
    expect(await confirmSubscription(first)).toEqual({ ok: false, reason: "invalid" });
    expect(await confirmSubscription(second)).toEqual({ ok: true, alreadyConfirmed: false });
  });

  it("unsubscribes, and stays idempotent on a second click", async () => {
    await subscribe({ email: EMAIL });
    const confirmToken = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;
    await confirmSubscription(confirmToken);

    const unsubToken = (await tokenFromLatestMail(EMAIL, "/newsletter/unsubscribe"))!;

    expect(await unsubscribe(unsubToken)).toEqual({ ok: true });
    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.status).toBe("unsubscribed");
    expect(row.unsubscribedAt).not.toBeNull();

    /* A years-old link must keep working: a second click reports success, not an error. */
    expect(await unsubscribe(unsubToken)).toEqual({ ok: true });
  });

  it("reports an unknown unsubscribe token as not-found without throwing", async () => {
    expect(await unsubscribe("nonsense-token-value")).toEqual({ ok: false });
  });

  it("requires an unsubscribed address to re-consent rather than silently reinstating", async () => {
    await subscribe({ email: EMAIL });
    const t1 = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;
    await confirmSubscription(t1);
    const unsubToken = (await tokenFromLatestMail(EMAIL, "/newsletter/unsubscribe"))!;
    await unsubscribe(unsubToken);

    await subscribe({ email: EMAIL });

    const [row] = await db.select().from(subscriber).where(eq(subscriber.email, EMAIL));
    expect(row.status).toBe("pending"); // NOT straight back to confirmed
    expect(row.unsubscribedAt).toBeNull();

    const t2 = (await tokenFromLatestMail(EMAIL, "/newsletter/confirm"))!;
    expect(await confirmSubscription(t2)).toEqual({ ok: true, alreadyConfirmed: false });
  });
});
