/* POST /api/v1/newsletter/subscribe
 *
 * Replaces the placeholder handler in Footer.tsx, which showed "You're on the list" and
 * recorded nothing anywhere.
 *
 * The response is IDENTICAL whatever happens — new address, already confirmed, previously
 * unsubscribed, even rate-limited-by-email. Any variation would turn a public form into a
 * way to test whether a given person is a customer. */

import { z } from "zod";
import { apiRoute, clientIp, hashIp, json, readJson } from "@/lib/http";
import { consume, RULES } from "@/lib/ratelimit";
import { subscribe } from "@/lib/newsletter";
import { normaliseEmail } from "@/lib/tokens";
import { maskEmail } from "@/lib/logger";

const Body = z.object({
  email: z.email("Please enter a valid email address.").max(254),
  /* Honeypot: a field no human sees or fills. Bots complete every input they find, so a
     value here is a bot. Answer normally and discard — telling it it was detected only
     teaches whoever wrote it to stop filling the field. */
  company: z.string().max(0).optional().or(z.string().optional()),
});

/* One message for every outcome. */
const NEUTRAL = {
  ok: true,
  message: "Check your inbox to confirm your place on the list.",
};

export const POST = apiRoute("newsletter.subscribe", async ({ req, log }) => {
  const body = await readJson(req, Body);
  const email = normaliseEmail(body.email);

  const ip = clientIp(req);
  const ipHash = await hashIp(ip);

  if (body.company) {
    log.info("newsletter.honeypot", { ipHash });
    return json(NEUTRAL);
  }

  /* Two limits doing different jobs: per-IP stops one source flooding signups, per-email
     stops the form being used to repeatedly mail one person (a real abuse pattern for
     any unauthenticated "we'll email you" endpoint). Both return the neutral response
     rather than a 429, so neither can be used to probe the list. */
  const byIp = await consume(RULES.newsletterIp, ipHash);
  const byEmail = await consume(RULES.newsletterEmail, email);

  if (!byIp.ok || !byEmail.ok) {
    log.warn("newsletter.rate_limited", {
      ipHash,
      email: maskEmail(email),
      limit: !byIp.ok ? "ip" : "email",
    });
    return json(NEUTRAL);
  }

  await subscribe({
    email,
    ipHash,
    userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? undefined,
    source: "footer",
  });

  return json(NEUTRAL);
});
