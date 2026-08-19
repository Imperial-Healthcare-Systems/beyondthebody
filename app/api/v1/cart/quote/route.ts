/* POST /api/v1/cart/quote — what this bag actually costs, decided by the server.
 *
 * The browser sends SKUs, quantities, and the prices it last showed. It gets back lines
 * priced from the database, a total, and a list of anything that changed underneath the
 * customer. The prices it sends are used only to raise a warning, never to compute money.
 *
 * Public and unauthenticated, because a bag belongs to nobody until checkout. */

import { z } from "zod";
import { apiRoute, clientIp, hashIp, readJson } from "@/lib/http";
import { enforce, RULES } from "@/lib/ratelimit";
import { INDIAN_STATES } from "@/lib/address";
import { quoteCart } from "@/lib/pricing";
import { publicQuote } from "@/lib/orders";
import { MAX_LINES, MAX_QTY_PER_LINE } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const Body = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(40),
        qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
        /* Advisory: what the browser displayed, in paise. */
        expectedPriceMinor: z.number().int().min(0).max(100_000_000).nullish(),
      })
    )
    .max(MAX_LINES),
  paymentMethod: z.enum(["prepaid", "cod"]).optional(),
  /* Only for GST place of supply. Optional — the bag is quotable before an address. */
  state: z.enum(INDIAN_STATES).optional(),
});

export const POST = apiRoute("cart.quote", async ({ req }) => {
  /* Its own bucket, not checkout's: an ordinary visit quotes several times, and behind
     carrier NAT one bucket is shared by many real customers. Still limited, because this
     is also the easiest way to scrape live pricing and stock. */
  await enforce(RULES.quoteIp, await hashIp(clientIp(req)));

  const body = await readJson(req, Body);

  const quote = await quoteCart(body.items, {
    paymentMethod: body.paymentMethod,
    state: body.state ?? null,
  });

  return publicQuote(quote);
});
