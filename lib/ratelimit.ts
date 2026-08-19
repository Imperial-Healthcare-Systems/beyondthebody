/* Rate limiting on Postgres — fixed windows, one atomic upsert per request.
 *
 * Why not Redis: the deployment topology is undecided, and this is correct under all of
 * them. The upsert is atomic, so two processes incrementing the same bucket cannot both
 * read "1". At this traffic (a four-SKU house) the write cost is irrelevant; Redis would
 * be the right answer two orders of magnitude from here.
 *
 * Fixed windows, not sliding: a caller can burst up to 2× the limit across a window
 * boundary. That is a known and accepted property — these limits exist to stop scripted
 * abuse, not to meter a paid API. */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { rateLimited } from "./errors";
import { logger } from "./logger";

export type RateLimitResult = {
  ok: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
};

export type RateLimitRule = {
  /** Stable prefix identifying what is limited, e.g. "newsletter:ip". */
  name: string;
  limit: number;
  windowSec: number;
};

/** Floor `now` to the start of its window so every process agrees on the bucket. */
function windowStart(windowSec: number, now = Date.now()): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now / ms) * ms);
}

/**
 * Count one hit against `rule` for `identifier`.
 *
 * Fails OPEN on a database error: if Postgres is unreachable the newsletter form should
 * still work rather than the site presenting itself as broken. The trade is deliberate —
 * an outage briefly removes throttling, but no endpoint behind a limiter is destructive
 * on its own (each has its own validation and, where money is involved, idempotency).
 */
export async function consume(
  rule: RateLimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const start = windowStart(rule.windowSec);
  const bucket = `${rule.name}:${identifier}`;
  const resetAt = new Date(start.getTime() + rule.windowSec * 1000);
  const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  try {
    const rows = await db
      .insert(rateLimit)
      .values({ bucket, windowStart: start, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimit.bucket, rateLimit.windowStart],
        set: { count: sql`${rateLimit.count} + 1` },
      })
      .returning({ count: rateLimit.count });

    const count = rows[0]?.count ?? 1;
    return {
      ok: count <= rule.limit,
      count,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      retryAfterSec,
    };
  } catch (err) {
    logger.error("ratelimit.unavailable", { err, rule: rule.name });
    return {
      ok: true,
      count: 0,
      limit: rule.limit,
      remaining: rule.limit,
      resetAt,
      retryAfterSec,
    };
  }
}

/** Consume and throw the standard 429 if the limit is exceeded. */
export async function enforce(rule: RateLimitRule, identifier: string): Promise<void> {
  const result = await consume(rule, identifier);
  if (!result.ok) {
    logger.warn("ratelimit.blocked", { rule: rule.name, count: result.count });
    throw rateLimited(result.retryAfterSec);
  }
}

/* Defined centrally so every limit is visible in one place and reviewable as a set.
 * IP rules degrade to a shared "unknown" bucket when TRUSTED_PROXY_HOPS is unset — the
 * safe direction (over-restrictive), never a bypass. See lib/http.ts → clientIp. */
export const RULES = {
  newsletterIp: { name: "newsletter:ip", limit: 5, windowSec: 3_600 },
  newsletterEmail: { name: "newsletter:email", limit: 3, windowSec: 86_400 },
  adminLogin: { name: "admin-login:email", limit: 5, windowSec: 900 },
  /* Password sign-in: unlike the link, a wrong password is free to retry, so brute
     force is the failure mode. Keyed both ways — per account so one address cannot be
     hammered from many IPs, per IP so one machine cannot walk a list of addresses. */
  adminPasswordEmail: { name: "admin-password:email", limit: 8, windowSec: 900 },
  adminPasswordIp: { name: "admin-password:ip", limit: 20, windowSec: 3_600 },

  /* Quoting is read-only and happens several times in one ordinary visit — opening
     checkout, changing a quantity, picking a state. It gets its own, generous bucket.
     Sharing one with order placement was a mistake worth naming: Indian mobile carriers
     NAT heavily, so a single bucket keyed by IP is shared by many real customers, and a
     tight limit locks people out of checkout for the crime of looking at their bag. */
  quoteIp: { name: "quote:ip", limit: 60, windowSec: 3_600 },

  /* Placing orders is the expensive one, and stays tight. The real anti-abuse control
     for COD is codPhone below — an IP is free to change, a working phone number is not. */
  checkoutIp: { name: "checkout:ip", limit: 10, windowSec: 3_600 },
  /* COD commits stock with no money at risk to the attacker — the cheapest way to empty
     an eight-SKU inventory. Tighter than prepaid on purpose. */
  codPhone: { name: "cod:phone", limit: 3, windowSec: 86_400 },

  /* Order lookup (the bar at the bottom of the bag). Order numbers are sequential, so
     BTB-2026-0507 hands you BTB-2026-0508 for free; the email beside it is what makes the
     pair a credential, and a credential that can be tried without limit is not one. Two
     buckets doing different jobs: per-IP stops one source walking the sequence, per-number
     stops a single known order being paired with guessed addresses from anywhere.
     Looser per IP than adminLogin because Indian carriers NAT heavily and this is a form
     a real customer, standing over a parcel, may well fumble twice. */
  orderLookupIp: { name: "order-lookup:ip", limit: 20, windowSec: 3_600 },
  orderLookupNumber: { name: "order-lookup:number", limit: 8, windowSec: 3_600 },
} as const satisfies Record<string, RateLimitRule>;
