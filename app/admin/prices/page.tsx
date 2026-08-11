/* /admin/prices — the client's price and availability editor.
 *
 * Owner-only. Every row here is the commercial half of a scent whose editorial half lives
 * in the repo; the two are joined by SKU. Saving a price revalidates the storefront, so
 * the change is live in seconds without a deploy. */

import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { productVariant } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin-session";
import { checkCatalogueParity, paiseToRupees } from "@/lib/catalogue";
import { PRODUCTS } from "@/app/_sections/products-data";
import PriceRow from "./PriceRow";

export const dynamic = "force-dynamic";

const nameFor = (slug: string) => PRODUCTS.find((p) => p.slug === slug)?.name ?? slug;

export default async function PricesPage() {
  await requireAdminPage("owner");

  const [rows, parity] = await Promise.all([
    db
      .select()
      .from(productVariant)
      .orderBy(asc(productVariant.productSlug), asc(productVariant.sizeMl)),
    checkCatalogueParity(),
  ]);

  return (
    <main className="adm__main">
      <h1 className="adm__h1">Prices</h1>
      <p className="adm__sub">
        Changes go live within a few seconds. Leave a price blank to show &ldquo;Price on
        request&rdquo;.
      </p>

      {parity.missingInDb.length > 0 && (
        <p className="adm__error" role="alert">
          These SKUs exist in the site&rsquo;s catalogue but have no price row:{" "}
          {parity.missingInDb.join(", ")}. Restart the app to create them, or tell your developer.
        </p>
      )}

      <section className="adm__panel">
        <div className="adm__scroll">
          <table className="adm__table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Product</th>
                <th colSpan={3}>Price (₹) · availability · reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PriceRow
                  key={r.sku}
                  sku={r.sku}
                  productName={nameFor(r.productSlug)}
                  sizeLabel={r.sizeLabel}
                  priceRupees={r.priceMinor == null ? "" : String(paiseToRupees(r.priceMinor))}
                  status={r.status}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="adm__note">
        Every change is recorded with who made it and what it was before. Orders keep the price
        they were placed at, so editing here never alters an order that already exists.
      </p>
    </main>
  );
}
