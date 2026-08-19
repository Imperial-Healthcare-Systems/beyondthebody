/* POST /api/v1/orders/lookup
 *
 * The bar at the bottom of the bag: order number + email in, the customer's own order page
 * out. It exists because the only other way back to /order/[token] is the confirmation
 * email, and people lose those.
 *
 * Two properties this endpoint must hold, and both are about the same thing — order numbers
 * are SEQUENTIAL, so the number alone is an identifier, never a credential:
 *
 *   1. The failure response is identical for every kind of miss — malformed number, no such
 *      order, right order and wrong email. Any variation turns a public form into a way to
 *      test whether a given person bought something, and the answer to that question is
 *      somebody's home address.
 *   2. Guessing is rate limited from both ends (lib/ratelimit.ts → orderLookup*). Unlike the
 *      newsletter, the 429 here is honest rather than disguised: being told to slow down
 *      reveals nothing about any order, and a customer typing carefully deserves to know
 *      why the form stopped answering.
 */

import { z } from "zod";
import { apiRoute, clientIp, hashIp, json, readJson } from "@/lib/http";
import { consume, RULES } from "@/lib/ratelimit";
import { rateLimited } from "@/lib/errors";
import { findOrderTokenByNumberAndEmail, normaliseOrderNumber } from "@/lib/orders";
import { normaliseEmail } from "@/lib/tokens";
import { maskEmail } from "@/lib/logger";

const Body = z.object({
  /* Deliberately loose — normaliseOrderNumber decides what is really an order number, and
     a customer who types a stray space should not meet a validation error. */
  orderNumber: z.string().trim().min(1, "Enter your order number.").max(40),
  email: z.email("Enter the email you ordered with.").max(254),
});

/** One message for every miss. See (1) above. */
const NOT_FOUND = {
  ok: false as const,
  message: "We couldn't find that order. Check the number and the email you ordered with.",
};

export const POST = apiRoute("orders.lookup", async ({ req, log }) => {
  const body = await readJson(req, Body);
  const email = normaliseEmail(body.email);
  const number = normaliseOrderNumber(body.orderNumber);
  const ipHash = await hashIp(clientIp(req));

  /* The IP bucket is consumed even when the number is unparseable: otherwise typing
     rubbish would be a free probe, and a script would simply never send a valid-looking
     number until it had a real one. The per-number bucket needs a number to key on. */
  const byIp = await consume(RULES.orderLookupIp, ipHash);
  const byNumber = number ? await consume(RULES.orderLookupNumber, number) : null;

  if (!byIp.ok || (byNumber && !byNumber.ok)) {
    log.warn("orders.lookup.rate_limited", {
      ipHash,
      limit: !byIp.ok ? "ip" : "number",
    });
    throw rateLimited(Math.max(byIp.retryAfterSec, byNumber?.retryAfterSec ?? 0));
  }

  if (!number) return json(NOT_FOUND);

  const token = await findOrderTokenByNumberAndEmail(number, email);
  if (!token) {
    /* Logged with the number but a masked email: enough to see somebody walking the
       sequence, not enough to rebuild a customer list from the log. */
    log.warn("orders.lookup.miss", { ipHash, orderNumber: number, email: maskEmail(email) });
    return json(NOT_FOUND);
  }

  log.info("orders.lookup.hit", { orderNumber: number });
  /* The token goes to the browser because at this point the browser has proved it belongs
     to whoever placed the order. json() already sets no-store, which matters here more
     than anywhere: a shared cache holding this response would hand one visitor another
     visitor's order. */
  return json({ ok: true, url: `/order/${token}` });
});
