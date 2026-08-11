/* Integration suite — runs against a REAL Postgres, skipped when DATABASE_URL is absent
 * so a clean checkout still passes `npm test`.
 *
 * These cover the things a unit test cannot: that the migration actually applies, that
 * the partial unique index really does stop duplicate recurring jobs, that job claiming
 * is genuinely atomic under concurrency, and that the rate-limit upsert cannot double-count.
 * All four were unverified when phase 0 was first written. */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { job, rateLimit, setting } from "@/db/schema";
import {
  enqueue,
  registerJobHandler,
  runPendingJobsOnce,
} from "@/lib/jobs";
import { consume } from "@/lib/ratelimit";
import { DEFAULT_SETTINGS, getSettings, seedSettings, setSetting, __clearSettingsCache } from "@/lib/settings";

const hasDb = Boolean(process.env.DATABASE_URL);

/* Everything this suite creates is prefixed so cleanup can never touch real rows. */
const P = "test:phase0";

describe.skipIf(!hasDb)("phase 0 · platform integration", () => {
  beforeAll(async () => {
    await db.delete(job).where(like(job.kind, `${P}%`));
    await db.delete(rateLimit).where(like(rateLimit.bucket, `${P}%`));

    /* These specs drain the queue with a small batch and then assert that THEIR jobs ran.
       Claiming is ordered by run_after, so any older due row — the recurring
       maintenance:cleanup singleton, or mail queued by another suite — is claimed first
       and eats the batch. The specs then fail for reasons that have nothing to do with
       what they test. Park everything foreign in the future for the duration; nothing is
       deleted, and the worker picks it up again afterwards. */
    await db
      .update(job)
      .set({ runAfter: new Date(Date.now() + 3_600_000) })
      .where(
        and(
          sql`${job.kind} not like ${`${P}%`}`,
          sql`${job.doneAt} is null`,
          sql`${job.failedAt} is null`
        )
      );
  });

  afterAll(async () => {
    await db.delete(job).where(like(job.kind, `${P}%`));
    await db.delete(rateLimit).where(like(rateLimit.bucket, `${P}%`));
    /* Hand the parked rows back — run_after is a schedule, not a state. */
    await db
      .update(job)
      .set({ runAfter: new Date() })
      .where(and(sql`${job.kind} not like ${`${P}%`}`, sql`${job.doneAt} is null`, sql`${job.failedAt} is null`));
    await closeDb();
  });

  it("applied the migration — all 7 platform tables exist", async () => {
    const rows = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `);
    const names = rows.rows.map((r) => r.table_name);

    for (const t of [
      "admin_session", "admin_user", "audit_log",
      "job", "login_token", "rate_limit", "setting",
    ]) {
      expect(names, `missing table ${t}`).toContain(t);
    }
  });

  it("created both partial indexes (the SQL drizzle generated is not just plausible)", async () => {
    const rows = await db.execute<{ indexname: string; indexdef: string }>(sql`
      select indexname, indexdef from pg_indexes
      where schemaname = 'public' and indexname in ('job_singleton_kind_idx', 'job_pending_idx')
    `);
    const byName = Object.fromEntries(rows.rows.map((r) => [r.indexname, r.indexdef]));

    expect(byName["job_singleton_kind_idx"]).toBeDefined();
    expect(byName["job_singleton_kind_idx"]).toMatch(/UNIQUE/i);
    expect(byName["job_singleton_kind_idx"]).toMatch(/WHERE/i);
    expect(byName["job_pending_idx"]).toMatch(/WHERE/i);
  });

  it("enqueues and runs a job, marking it done", async () => {
    const kind = `${P}:ok`;
    let ran = 0;
    registerJobHandler(kind, async (payload) => {
      ran += 1;
      expect(payload.hello).toBe("world");
    });

    const id = await enqueue(kind, { hello: "world" });
    expect(id).toBeTruthy();

    await runPendingJobsOnce();

    expect(ran).toBe(1);
    const [row] = await db.select().from(job).where(eq(job.id, id!));
    expect(row.doneAt).not.toBeNull();
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBeNull();
  });

  it("retries a failing job with backoff instead of losing it", async () => {
    const kind = `${P}:fail`;
    registerJobHandler(kind, async () => {
      throw new Error("intentional failure");
    });

    const id = await enqueue(kind, {}, { maxAttempts: 3 });
    await runPendingJobsOnce();

    const [row] = await db.select().from(job).where(eq(job.id, id!));
    expect(row.doneAt).toBeNull();
    expect(row.failedAt).toBeNull();          // not given up yet
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("intentional failure");
    expect(row.lockedAt).toBeNull();          // lock released so it can be retried
    expect(row.runAfter.getTime()).toBeGreaterThan(Date.now()); // backed off
  });

  it("parks a job whose handler does not exist rather than burning its attempts", async () => {
    const id = await enqueue(`${P}:nohandler`, {});
    await runPendingJobsOnce();

    const [row] = await db.select().from(job).where(eq(job.id, id!));
    expect(row.failedAt).not.toBeNull();
    expect(row.lastError).toMatch(/No handler registered/);
  });

  it("refuses a duplicate singleton — this is what replaces leader election", async () => {
    const kind = `${P}:recurring`;

    const first = await enqueue(kind, {}, { singleton: true });
    const second = await enqueue(kind, {}, { singleton: true });

    expect(first).toBeTruthy();
    expect(second).toBeNull(); // the partial unique index rejected it, silently and correctly

    const rows = await db.select().from(job).where(eq(job.kind, kind));
    expect(rows).toHaveLength(1);
  });

  it("allows a new singleton once the previous one is done", async () => {
    const kind = `${P}:recurring2`;
    const first = await enqueue(kind, {}, { singleton: true });
    await db.update(job).set({ doneAt: new Date() }).where(eq(job.id, first!));

    const second = await enqueue(kind, {}, { singleton: true });
    expect(second).toBeTruthy(); // index only constrains LIVE rows
  });

  it("never hands the same job to two concurrent workers (FOR UPDATE SKIP LOCKED)", async () => {
    const kind = `${P}:concurrent`;
    const runs: string[] = [];
    registerJobHandler(kind, async (_p, row) => {
      runs.push(row.id);
      await new Promise((r) => setTimeout(r, 50));
    });

    const ids = await Promise.all(
      Array.from({ length: 8 }, () => enqueue(kind, {}))
    );

    // Four "workers" draining at once — the failure mode is a job running twice.
    await Promise.all([
      runPendingJobsOnce(10),
      runPendingJobsOnce(10),
      runPendingJobsOnce(10),
      runPendingJobsOnce(10),
    ]);

    expect(new Set(runs).size).toBe(runs.length); // no id processed twice
    const rows = await db
      .select()
      .from(job)
      .where(and(inArray(job.id, ids.filter(Boolean) as string[])));
    expect(rows.every((r) => r.doneAt !== null)).toBe(true);
    expect(rows.every((r) => r.attempts === 1)).toBe(true);
  });

  it("counts rate-limit hits atomically under concurrency", async () => {
    const rule = { name: `${P}:rl`, limit: 5, windowSec: 60 };

    // 20 simultaneous hits. A read-then-write implementation would lose increments here
    // and report duplicate counts — which is exactly how a limiter gets bypassed.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consume(rule, "1.2.3.4"))
    );

    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(results.filter((r) => r.ok)).toHaveLength(5); // exactly `limit` allowed
  });

  it("separates buckets per identifier", async () => {
    const rule = { name: `${P}:rl2`, limit: 2, windowSec: 60 };
    expect((await consume(rule, "a")).ok).toBe(true);
    expect((await consume(rule, "a")).ok).toBe(true);
    expect((await consume(rule, "a")).ok).toBe(false); // a is done
    expect((await consume(rule, "b")).ok).toBe(true);  // b is untouched
  });

  it("seeds settings idempotently and round-trips a write", async () => {
    await seedSettings();
    const again = await seedSettings();
    expect(again).toBe(0); // second run inserts nothing

    __clearSettingsCache();
    const settings = await getSettings(true);
    expect(settings.cod_enabled).toBe(DEFAULT_SETTINGS.cod_enabled);
    expect(settings.tax_rate_bp).toBe(0); // tax-ready, switched off until the client's CA confirms

    await setSetting("shipping_flat_minor", 12_500);
    expect((await getSettings(true)).shipping_flat_minor).toBe(12_500);

    await setSetting("shipping_flat_minor", DEFAULT_SETTINGS.shipping_flat_minor);
    const [row] = await db.select().from(setting).where(eq(setting.key, "shipping_flat_minor"));
    expect(row.value).toBe(DEFAULT_SETTINGS.shipping_flat_minor);
  });

  it("rejects a setting value of the wrong shape before it reaches the database", async () => {
    // @ts-expect-error deliberately wrong type — admin must not be able to store this
    await expect(setSetting("cod_enabled", "yes")).rejects.toThrow();
  });
});
