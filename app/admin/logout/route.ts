/* POST /admin/logout
 *
 * POST, not GET: a GET sign-out can be triggered by any page that embeds the URL as an
 * image or link, which is a small but pointless annoyance to leave open. The session row
 * is revoked server-side as well as the cookie cleared, so a copied cookie dies too. */

import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, readSessionToken } from "@/lib/admin-session";
import { revokeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await readSessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();

  return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin), {
    /* 303 so the browser follows with GET after a POST. */
    status: 303,
  });
}
