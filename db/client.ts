/* The database handle.
 *
 * Created LAZILY, on first query. This is not a micro-optimisation: `next build`
 * imports every route module to collect page data, so a pool constructed at import time
 * makes DATABASE_URL a build-time requirement and fails the build on any machine
 * without a database. The 24 prerendered pages must keep building with no backend
 * present. (Found by running the build — see the phase 0 notes.)
 *
 * One pool per process, cached across dev hot-reloads. Without the globalThis cache,
 * every HMR cycle opens a fresh pool and leaks the previous one until Postgres refuses
 * connections — a slow failure that looks like a database problem. */

import { Pool, types } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normaliseConnectionString } from "@/lib/pg-url";

/* node-postgres returns int8 (bigint) as a string by default to avoid precision loss.
 * Every count/sum here is far inside Number.MAX_SAFE_INTEGER, and a silent string where
 * a number is expected is the worse bug. Money is int4 paise and is unaffected either
 * way — integer minor units exist precisely so floating point never touches a price. */
types.setTypeParser(types.builtins.INT8, (v) => Number.parseInt(v, 10));

declare global {
  var __btbPool: Pool | undefined;
  var __btbDb: NodePgDatabase<typeof schema> | undefined;
}

function createPool(): Pool {
  const { connectionString, urlWantedSsl, strippedSslMode } = normaliseConnectionString(
    env.DATABASE_URL
  );

  /* TLS is decided here and only here — see lib/pg-url.ts for why `sslmode` is removed
     from the URL first. Verification is on by default: `rejectUnauthorized: false`
     encrypts the connection but stops proving who is on the other end, so it must be
     opted into rather than enabled just because a provider requires TLS. */
  const useSsl = env.DATABASE_SSL || urlWantedSsl;

  if (strippedSslMode && !env.DATABASE_SSL) {
    /* The URL asked for TLS but the environment did not. We honour the URL rather than
       silently downgrading to plaintext, and say so — the two should agree. */
    logger.warn("db.ssl_from_url", {
      detail:
        "DATABASE_URL contained sslmode but DATABASE_SSL is false. Connecting WITH TLS " +
        "based on the URL. Set DATABASE_SSL=true so the configuration is explicit.",
    });
  }

  const pool = new Pool({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    ssl: useSsl ? (env.DATABASE_SSL_INSECURE ? { rejectUnauthorized: false } : true) : undefined,
    /* Release idle connections so a restarted database doesn't leave the app holding
       dead sockets, and fail fast rather than hanging a request forever. */
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  /* An idle client erroring (database restarted, network blip) emits on the pool.
     Unhandled, that is an uncaught exception which takes the whole server down. */
  pool.on("error", (err) => logger.error("db.pool.error", { err }));

  return pool;
}

export function getPool(): Pool {
  if (!globalThis.__btbPool) globalThis.__btbPool = createPool();
  return globalThis.__btbPool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__btbDb) globalThis.__btbDb = drizzle(getPool(), { schema });
  return globalThis.__btbDb;
}

/* Proxy so call sites stay `db.select()…` while construction is deferred to first use.
   Methods are bound to the real instance — drizzle's builders rely on `this`. */
export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop, receiver) {
      const real = getDb();
      const value = Reflect.get(real as object, prop, receiver);
      return typeof value === "function" ? value.bind(real) : value;
    },
  }
);

/** Close the pool — for scripts and tests, so the process can exit. */
export async function closeDb(): Promise<void> {
  if (globalThis.__btbPool) {
    await globalThis.__btbPool.end();
    globalThis.__btbPool = undefined;
    globalThis.__btbDb = undefined;
  }
}

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle. Accept `Executor` in helpers that must compose into a caller's
 *  transaction — enqueueing a job alongside the state change that caused it depends on it. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;

export { schema };
