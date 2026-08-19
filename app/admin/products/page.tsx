/* /admin/products — the four scents, and the state of each.
 *
 * The single entry point for everything the client can change about a product: price,
 * availability and the pictures at the top of its page (client, 2026-08-12 — this replaced
 * a separate /admin/prices table). The list itself is a status board; the editing is one
 * click in, on the product's own screen.
 */

import { asc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { productImage, productVariant } from "@/db/schema";
import { PRODUCTS, formatPrice } from "@/app/_sections/products-data";
import { requireAdminPage } from "@/lib/admin-session";
import { checkCatalogueParity, paiseToRupees } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdminPage("owner");

  const [imageRows, variants, parity] = await Promise.all([
    db
      .select()
      .from(productImage)
      .orderBy(asc(productImage.productSlug), asc(productImage.sortOrder)),
    db.select().from(productVariant).orderBy(asc(productVariant.sizeMl)),
    /* Kept from the old prices page: a scent added in code with no price row would
       otherwise be unbuyable and nobody would know until someone tried. */
    checkCatalogueParity(),
  ]);

  /* First uploaded image per product — the one its page opens on. */
  const leadFor = new Map<string, string>();
  const countFor = new Map<string, number>();
  for (const row of imageRows) {
    if (!leadFor.has(row.productSlug)) leadFor.set(row.productSlug, row.path);
    countFor.set(row.productSlug, (countFor.get(row.productSlug) ?? 0) + 1);
  }

  return (
    <main className="adm__main">
      <h1 className="adm__h1">Products</h1>
      <p className="adm__sub">
        Prices, availability, and the pictures at the top of each product page. Changes go live
        within a few seconds.
      </p>

      {parity.missingInDb.length > 0 && (
        <p className="adm__error" role="alert">
          These sizes exist in the site&rsquo;s catalogue but have no price row:{" "}
          {parity.missingInDb.join(", ")}. Restart the app to create them, or tell your developer.
        </p>
      )}

      <section className="adm__panel">
        <div className="adm__scroll">
          <table className="adm__table">
            <thead>
              <tr>
                <th style={{ width: 76 }}>
                  <span className="sr-only">Preview</span>
                </th>
                <th>Product</th>
                <th>Price</th>
                <th>Pictures</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((p) => {
                const n = countFor.get(p.slug) ?? 0;
                const lead = leadFor.get(p.slug) ?? p.gallery[0]?.src;
                const mine = variants.filter((v) => v.productSlug === p.slug);
                const hidden = mine.filter((v) => v.status !== "active");

                return (
                  <tr key={p.slug}>
                    <td>
                      {lead && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead}
                          alt=""
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "cover",
                            border: "1px solid var(--adm-line)",
                          }}
                        />
                      )}
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                      <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>{p.slug}</div>
                    </td>
                    <td>
                      {mine.length === 0 ? (
                        <span style={{ color: "var(--adm-muted)" }}>—</span>
                      ) : (
                        mine.map((v) => (
                          <div key={v.sku} style={{ whiteSpace: "nowrap" }}>
                            <span style={{ color: "var(--adm-muted)", fontSize: 12 }}>
                              {v.sizeLabel}{" "}
                            </span>
                            {formatPrice(v.priceMinor == null ? null : paiseToRupees(v.priceMinor))}
                          </div>
                        ))
                      )}
                      {hidden.length > 0 && (
                        <div style={{ color: "#8a6a2a", fontSize: 12 }}>
                          {hidden.map((v) => `${v.sizeLabel} ${v.status.replace("_", " ")}`).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td>
                      {n > 0 ? (
                        <>
                          <span className="adm__tag adm__tag--confirmed">Yours</span>
                          <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>
                            {n} image{n === 1 ? "" : "s"}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="adm__tag">Original</span>
                          <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>
                            {p.gallery.length} from the build
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      <a className="adm__btn adm__btn--ghost" href={`/admin/products/${p.slug}`}>
                        Open
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="adm__note">
        A product page shows either its original pictures or yours &mdash; never a mix. Upload
        one and it switches over; remove them all and it goes back on its own.
      </p>
    </main>
  );
}
