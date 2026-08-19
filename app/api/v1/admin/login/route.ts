/* POST /api/v1/admin/login — request a sign-in link.
 *
 * Answers identically whether or not the address belongs to a staff account. Anything
 * else (a different message, a different status, a visibly different response time)
 * turns this into a way to enumerate who has administrative access to the site — which
 * is the first thing worth knowing before attacking one of them.
 *
 * Rate limited per email so the endpoint cannot be used to flood a staff member's inbox. */

import { z } from "zod";
import { apiRoute, clientIp, hashIp, json, readJson } from "@/lib/http";
import { consume, RULES } from "@/lib/ratelimit";
import { issueLoginToken, LOGIN_TOKEN_TTL_MIN } from "@/lib/auth";
import { adminSignInEmail, queueMail } from "@/lib/mail";
import { env } from "@/lib/env";
import { normaliseEmail } from "@/lib/tokens";
import { maskEmail } from "@/lib/logger";

const Body = z.object({ email: z.email().max(254) });

const NEUTRAL = {
  ok: true,
  message: "If that address has access, a sign-in link is on its way.",
};

export const POST = apiRoute("admin.login", async ({ req, log }) => {
  const { email } = await readJson(req, Body);
  const normalised = normaliseEmail(email);
  const ipHash = await hashIp(clientIp(req));

  const limited = await consume(RULES.adminLogin, normalised);
  if (!limited.ok) {
    log.warn("admin.login.rate_limited", { email: maskEmail(normalised) });
    return json(NEUTRAL);
  }

  const issued = await issueLoginToken(normalised, ipHash);

  /* Unknown or disabled account: stop here, but return the same body. */
  if (issued) {
    const url = `${env.APP_URL}/admin/auth?token=${encodeURIComponent(issued.token)}`;
    const mail = adminSignInEmail(url, LOGIN_TOKEN_TTL_MIN);
    await queueMail({ to: normalised, ...mail });
  }

  return json(NEUTRAL);
});
