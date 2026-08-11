/* Background jobs + transactional outbox, on Postgres.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED`, so two workers never take the same row and a
 * slow job never blocks a fast one. That is what makes this safe if the client's team
 * runs several app instances, and correct if they run exactly one — which is why no
 * decision about the server shape was needed to write it.
 *
 * Delivery is AT LEAST ONCE. Handlers must be idempotent: assume any job may run twice. */

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { job } from "@/db/schema";
import { logger } from "./logger";
import { env } from "./env";

export type JobRow = typeof job.$inferSelect;
export type JobHandler = (payload: Record<string, unknown>, row: JobRow) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(kind: string, handler: JobHandler) {
  if (handlers.has(kind)) throw new Error(`Duplicate job handler for "${kind}"`);
  handlers.set(kind, handler);
}

/** Recurring work. Each entry is re-queued after every run, so one pending row per kind
 *  walks forward forever — no cron daemon, no scheduler service. */
export type RecurringJob = { kind: string; everySec: number };
const recurring: RecurringJob[] = [];

export function registerRecurringJob(kind: string, everySec: number, handler: JobHandler) {
  registerJobHandler(kind, handler);
  recurring.push({ kind, everySec });
}

/**
 * Queue a job. Pass the caller's transaction as `exec` to make the side effect atomic
 * with the state change that caused it — the outbox pattern. An order confirmation
 * queued this way cannot be lost, and a dead SMTP host cannot roll back a payment.
 */
export async function enqueue(
  kind: string,
  payload: Record<string, unknown> = {},
  opts: { exec?: Executor; runAfter?: Date; singleton?: boolean; maxAttempts?: number } = {}
) {
  const exec = opts.exec ?? db;
  const values = {
    kind,
    payload,
    singleton: opts.singleton ?? false,
    /* "Run now" must mean the DATABASE's now, not this process's. Omitting run_after
       lets the column default (now()) stamp it server-side.

       Stamping it with a JS `new Date()` compares an app-server clock against the
       database's in `run_after <= now()`, so any forward skew makes a freshly queued job
       invisible until the skew elapses — and on a badly skewed host, forever. Caught in
       integration against Neon, where the app clock ran ~1s ahead and every job stalled.
       Only an explicitly requested future time is sent from here. */
    ...(opts.runAfter ? { runAfter: opts.runAfter } : {}),
    ...(opts.maxAttempts === undefined ? {} : { maxAttempts: opts.maxAttempts }),
  };

  /* Singletons collide by design against the partial unique index — a duplicate means
     the work is already queued, which is success, not an error. */
  const rows = opts.singleton
    ? await exec.insert(job).values(values).onConflictDoNothing().returning({ id: job.id })
    : await exec.insert(job).values(values).returning({ id: job.id });

  return rows[0]?.id ?? null;
}

/** Exponential backoff with a ceiling: ~2s, 4s, 8s … capped at 10 minutes. */
function backoffSeconds(attempts: number): number {
  return Math.min(2 ** Math.min(attempts, 9), 600);
}

/** Atomically claim up to `batch` due jobs for this worker. */
async function claim(workerId: string, batch: number): Promise<JobRow[]> {
  const staleLock = new Date(Date.now() - 5 * 60_000);

  const rows = await db
    .update(job)
    .set({ lockedAt: new Date(), lockedBy: workerId, attempts: sql`${job.attempts} + 1` })
    .where(
      sql`${job.id} in (
        select ${job.id} from ${job}
        where ${job.doneAt} is null
          and ${job.failedAt} is null
          and ${job.runAfter} <= now()
          and (${job.lockedAt} is null or ${job.lockedAt} < ${staleLock})
        order by ${job.runAfter}
        limit ${batch}
        for update skip locked
      )`
    )
    .returning();

  return rows;
}

async function runOne(row: JobRow) {
  const log = logger.child({ jobId: row.id, kind: row.kind, attempt: row.attempts });
  const handler = handlers.get(row.kind);

  if (!handler) {
    /* An unknown kind is a deploy problem, not a transient fault — retrying cannot fix
       it. Park the row so it stays visible instead of burning through its attempts. */
    log.error("job.no_handler");
    await db
      .update(job)
      .set({ failedAt: new Date(), lastError: `No handler registered for "${row.kind}"` })
      .where(eq(job.id, row.id));
    return;
  }

  try {
    await handler((row.payload ?? {}) as Record<string, unknown>, row);
    await db.update(job).set({ doneAt: new Date(), lastError: null }).where(eq(job.id, row.id));
    log.info("job.done");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = row.attempts >= row.maxAttempts;

    await db
      .update(job)
      .set({
        lastError: message.slice(0, 2_000),
        lockedAt: null,
        lockedBy: null,
        ...(exhausted
          ? { failedAt: new Date() }
          : { runAfter: new Date(Date.now() + backoffSeconds(row.attempts) * 1000) }),
      })
      .where(eq(job.id, row.id));

    if (exhausted) log.error("job.exhausted", { err });
    else log.warn("job.retry", { err, inSec: backoffSeconds(row.attempts) });
  }
}

/** Ensure exactly one pending row exists for each recurring kind. Safe to call from
 *  every instance at boot — the partial unique index resolves the race. */
export async function ensureRecurringJobs() {
  for (const r of recurring) {
    await enqueue(r.kind, { everySec: r.everySec }, { singleton: true });
  }
}

/** Re-queue a recurring job for its next run. Called after each successful execution. */
async function rescheduleIfRecurring(row: JobRow) {
  const def = recurring.find((r) => r.kind === row.kind);
  if (!def) return;
  await enqueue(
    def.kind,
    { everySec: def.everySec },
    { singleton: true, runAfter: new Date(Date.now() + def.everySec * 1000) }
  );
}

let running = false;
let timer: NodeJS.Timeout | null = null;

/** Start polling. Idempotent — a second call is ignored. */
export function startWorker() {
  if (running) return;
  running = true;

  const workerId = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  const log = logger.child({ workerId });
  log.info("worker.started", { pollMs: env.WORKER_POLL_MS, batch: env.WORKER_BATCH });

  const tick = async () => {
    if (!running) return;
    try {
      const rows = await claim(workerId, env.WORKER_BATCH);
      for (const row of rows) {
        await runOne(row);
        /* Reschedule AFTER the run so a recurring job's period is measured from
           completion — a slow job cannot pile copies of itself up behind it. */
        await rescheduleIfRecurring(row);
      }
    } catch (err) {
      /* Almost always the database being briefly unavailable. Keep polling. */
      log.error("worker.tick_failed", { err });
    } finally {
      if (running) timer = setTimeout(tick, env.WORKER_POLL_MS);
    }
  };

  timer = setTimeout(tick, env.WORKER_POLL_MS);
}

export function stopWorker() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Test/CLI helper: drain the queue once instead of polling. Returns jobs processed. */
export async function runPendingJobsOnce(batch = 25): Promise<number> {
  const rows = await claim(`oneshot-${process.pid}`, batch);
  for (const row of rows) {
    await runOne(row);
    await rescheduleIfRecurring(row);
  }
  return rows.length;
}

/* ── Built-in maintenance ──────────────────────────────────────────────────────── */

/** Sweep spent rate-limit windows and finished jobs. Registering it here means the job
 *  machinery has a real user from day one rather than shipping untested. */
export function registerMaintenanceJobs() {
  registerRecurringJob("maintenance:cleanup", 3_600, async () => {
    const { rateLimit } = await import("@/db/schema");
    const cutoff = new Date(Date.now() - 24 * 3_600 * 1000);

    await db.delete(rateLimit).where(lte(rateLimit.windowStart, cutoff));

    /* Keep failures forever — they are evidence. Only completed rows are swept. */
    const jobCutoff = new Date(Date.now() - 7 * 24 * 3_600 * 1000);
    await db
      .delete(job)
      .where(and(sql`${job.doneAt} is not null`, lte(job.doneAt, jobCutoff)));

    logger.info("maintenance.cleanup.done");
  });
}

/** Jobs stuck behind a crashed worker, for the health endpoint and ops checks. */
export async function queueDepth() {
  const rows = await db
    .select({
      pending: sql<number>`count(*) filter (where ${job.doneAt} is null and ${job.failedAt} is null)`,
      failed: sql<number>`count(*) filter (where ${job.failedAt} is not null)`,
      due: sql<number>`count(*) filter (where ${job.doneAt} is null and ${job.failedAt} is null and ${job.runAfter} <= now())`,
    })
    .from(job)
    .where(or(isNull(job.doneAt), sql`${job.failedAt} is not null`));

  return rows[0] ?? { pending: 0, failed: 0, due: 0 };
}
