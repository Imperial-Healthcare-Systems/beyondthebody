/* GET /admin/auth?token=… — the destination of the sign-in email.
 *
 * A GET that creates a session, which needs justifying: the token is single-use and
 * consumed by a conditional UPDATE, so a mail scanner following the link burns it and the
 * real person simply requests another. The alternative — an interstitial button — costs
 * every sign-in an extra click to defend against an actor who already has the recipient's
 * inbox, and would therefore have the link anyway.
 *
 * Redirects rather than rendering, so the token never survives in the address bar. */

import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken, SESSION_IDLE_HOURS } from "@/lib/auth";
import { setSessionCookie } from "@/lib/admin-session";
import { clientIp, hashIp } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const failed = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/login?error=${reason}`, req.nextUrl.origin));

  if (!token) return failed("missing");

  const result = await consumeLoginToken(token, {
    ipHash: await hashIp(clientIp(req)),
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result.ok) {
    logger.warn("admin.auth.rejected", { reason: result.reason });
    return failed(result.reason);
  }

  await setSessionCookie(
    result.sessionToken,
    new Date(Date.now() + SESSION_IDLE_HOURS * 3_600_000)
  );

  /* Land on /admin with no token in the URL — browser history, referrer headers and
     shoulder-surfing all see a clean address. */
  return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
}
