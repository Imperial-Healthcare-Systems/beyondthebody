/* The cookie half of staff auth, plus the guard every admin surface calls.
 *
 * Separated from lib/auth.ts because this reaches for `next/headers`, which only exists
 * inside a request — keeping the database logic free of it lets scripts/create-admin.mjs
 * and the tests use it directly.
 *
 * AUTHORISATION IS ENFORCED HERE, PER REQUEST — never in proxy.ts. Next's own docs are
 * explicit that Proxy "should not be used as a full session management or authorization
 * solution"; treating a middleware redirect as the gate is a recurring source of real
 * bypasses, because anything that reaches a handler by another path is then unguarded. */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { forbidden, unauthenticated } from "./errors";
import { isProduction } from "./env";
import { validateSession, type AdminRole, type AdminUser } from "./auth";

/* The `__Host-` prefix is the strongest cookie guarantee available: the browser refuses
   it unless it is Secure, Path=/ and has no Domain, which means a subdomain cannot set or
   overwrite it. It requires HTTPS, so development (plain http) uses an unprefixed name. */
export const SESSION_COOKIE = isProduction() ? "__Host-btb_admin" : "btb_admin";

const baseCookie = {
  httpOnly: true, // never readable from JavaScript, so XSS cannot exfiltrate it
  sameSite: "lax" as const, // survives following a magic link from an email client
  secure: isProduction(),
  path: "/",
};

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...baseCookie, expires: expiresAt });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...baseCookie, maxAge: 0 });
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** The current staff user, or null. Safe to call anywhere. */
export async function getAdmin(): Promise<AdminUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSession(token);
}

const RANK: Record<AdminRole, number> = { editor: 1, owner: 2 };

/** For pages: redirect to sign-in when not authorised. */
export async function requireAdminPage(minRole: AdminRole = "editor"): Promise<AdminUser> {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  if (RANK[user.role] < RANK[minRole]) redirect("/admin?denied=1");
  return user;
}

/** For route handlers and actions: throw the standard 401/403 instead of redirecting. */
export async function requireAdminApi(minRole: AdminRole = "editor"): Promise<AdminUser> {
  const user = await getAdmin();
  if (!user) throw unauthenticated();
  if (RANK[user.role] < RANK[minRole]) throw forbidden();
  return user;
}
