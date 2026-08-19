/* GET /admin/demo-access?key=… — TEMPORARY demo sign-in (2026-08-19).
 *
 * Exists for one reason: the demo deployment has no SMTP, so the magic-link email the
 * real sign-in depends on is logged rather than sent, and the client cannot get in at
 * all. This route trades the email round-trip for a single shared secret: the right
 * `key` signs the visitor in as a synthetic demo OWNER account.
 *
 * The safety of this is the env var, and nothing else:
 *   - DEMO_ADMIN_KEY unset (the default, and the required state for real hosting)
 *     → this route answers 404 to everything. The feature does not exist.
 *   - Set, it must be ≥32 chars (enforced by lib/env.ts), compared in constant time,
 *     and every successful use is logged loudly.
 *
 * The demo account is a real admin_user row ("demo-owner@beyondthebody.demo" — an
 * address that cannot receive mail, so the normal magic-link path can never target
 * it), created on first use and re-activated if someone disabled it. Delete the row
 * and unset the var to retire the whole arrangement. */

import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUser } from "@/db/schema";
import { createSession, SESSION_IDLE_HOURS } from "@/lib/auth";
import { setSessionCookie } from "@/lib/admin-session";
import { clientIp, hashIp } from "@/lib/http";
import { loadEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo-owner@beyondthebody.demo";

/* Hash both sides before comparing: timingSafeEqual demands equal lengths, and hashing
   is the standard way to get that without leaking the key's length by early-returning. */
function keyMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const expected = loadEnv().DEMO_ADMIN_KEY;
  /* 404, not 403 — with the var unset this route must be indistinguishable from a
     route that was never deployed. Same answer for a wrong key, so probing reveals
     nothing about whether demo access is configured. */
  if (!expected) return new NextResponse(null, { status: 404 });

  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!keyMatches(given, expected)) {
    logger.warn("admin.demo_access_rejected", { ipHash: await hashIp(clientIp(req)) });
    return new NextResponse(null, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(adminUser)
    .where(eq(adminUser.email, DEMO_EMAIL))
    .limit(1);

  let user = existing;
  if (!user) {
    [user] = await db
      .insert(adminUser)
      .values({ email: DEMO_EMAIL, name: "Demo Owner (temporary)", role: "owner" })
      .returning();
  } else if (user.status !== "active") {
    [user] = await db
      .update(adminUser)
      .set({ status: "active" })
      .where(eq(adminUser.id, user.id))
      .returning();
  }

  const sessionToken = await createSession(user.id, {
    ipHash: await hashIp(clientIp(req)),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await setSessionCookie(
    sessionToken,
    new Date(Date.now() + SESSION_IDLE_HOURS * 3_600_000)
  );

  logger.warn("admin.demo_access_used", { ipHash: await hashIp(clientIp(req)) });

  /* Same clean landing as the real sign-in: no key left in the address bar. */
  return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
}
