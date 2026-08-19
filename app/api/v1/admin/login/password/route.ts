/* POST /api/v1/admin/login/password — sign in with email + password.
 *
 * The password alternative to the magic link (added 2026-08-19, client request) — for
 * accounts that have opted in via scripts/set-admin-password.mjs; every other account
 * still signs in by emailed link only.
 *
 * Every failure answers identically — same status, same body, and (via the dummy-hash
 * verify in lib/auth.ts) the same response time — whether the address is unknown,
 * disabled, link-only, or the password is simply wrong. Anything else lets a caller
 * enumerate who has administrative access. The 429 is honest, like order lookup's: being
 * told to slow down reveals nothing about any account.
 *
 * On success the session cookie is set right here (route handlers may write cookies),
 * so the client's only job is to navigate to /admin. */

import { z } from "zod";
import { apiRoute, clientIp, hashIp, json, readJson } from "@/lib/http";
import { consume, RULES } from "@/lib/ratelimit";
import { rateLimited } from "@/lib/errors";
import { authenticateWithPassword, SESSION_IDLE_HOURS } from "@/lib/auth";
import { setSessionCookie } from "@/lib/admin-session";
import { normaliseEmail } from "@/lib/tokens";
import { maskEmail } from "@/lib/logger";

const Body = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

const REJECTED = {
  ok: false,
  message: "That email and password combination doesn't work.",
};

export const POST = apiRoute("admin.login.password", async ({ req, log }) => {
  const { email, password } = await readJson(req, Body);
  const normalised = normaliseEmail(email);
  const ipHash = await hashIp(clientIp(req));

  const byEmail = await consume(RULES.adminPasswordEmail, normalised);
  const byIp = await consume(RULES.adminPasswordIp, ipHash);
  if (!byEmail.ok || !byIp.ok) {
    log.warn("admin.login.password.rate_limited", { email: maskEmail(normalised) });
    throw rateLimited(Math.max(byEmail.retryAfterSec, byIp.retryAfterSec));
  }

  const result = await authenticateWithPassword(normalised, password, {
    ipHash,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result) return json(REJECTED, 401);

  await setSessionCookie(
    result.sessionToken,
    new Date(Date.now() + SESSION_IDLE_HOURS * 3_600_000)
  );

  return json({ ok: true });
});
