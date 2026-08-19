/* GET /api/v1/catalogue — live price and availability for every SKU.
 *
 * Public and read-only. The storefront pages do NOT use this — they read the database
 * directly at render time and stay prerendered, which is the whole point of the design.
 * This exists for the cart: a bag persisted in localStorage can be weeks old, so the
 * drawer needs a way to notice that a price moved or a size went away before the customer
 * reaches checkout.
 *
 * Returns rupees, matching the existing view model. Checkout re-prices from paise on the
 * server regardless — nothing a browser sends about price is ever trusted. */

import { db } from "@/db/client";
import { productVariant } from "@/db/schema";
import { apiRoute, json } from "@/lib/http";
import { paiseToRupees } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export const GET = apiRoute("catalogue", async () => {
  const rows = await db.select().from(productVariant);

  return json({
    currency: "INR",
    variants: rows
      /* Hidden and discontinued variants are omitted rather than flagged: a bag holding
         one should be told the item is unavailable, and that is what a missing SKU
         already means to the client. */
      .filter((r) => r.status === "active" || r.status === "sold_out")
      .map((r) => ({
        sku: r.sku,
        slug: r.productSlug,
        size: r.sizeLabel,
        ml: r.sizeMl,
        price: r.priceMinor == null ? null : paiseToRupees(r.priceMinor),
        available: r.status === "active" && (!r.stockTracked || r.stockQty > 0),
      })),
  });
});
