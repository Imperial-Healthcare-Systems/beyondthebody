/* /admin/products/[slug] — everything about one scent that the client can change.
 *
 * One screen per PRODUCT, not one screen per kind-of-field (client, 2026-08-12). Price and
 * availability used to live on their own page at /admin/prices; splitting a product across
 * two screens meant "put Desir up to ₹2,400 and swap its lead photograph" was two
 * navigations and two mental models. Both halves are here now, in the order the client
 * thinks about them: what it looks like, then what it costs.
 *
 * What is NOT here is as deliberate: names, taglines, stories and pyramids stay in the
 * repo, reviewed and versioned with the design. Only the two things that move on the
 * house's own schedule — photography and money — are editable.
 */

import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { productImage, productVariant } from "@/db/schema";
import { productBySlug } from "@/app/_sections/products-data";
import { requireAdminPage } from "@/lib/admin-session";
import { paiseToRupees } from "@/lib/catalogue";
import { env } from "@/lib/env";
import GalleryEditor from "./GalleryEditor";
import PriceRow from "../PriceRow";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminPage("owner");

  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const [images, variants] = await Promise.all([
    db
      .select()
      .from(productImage)
      .where(eq(productImage.productSlug, slug))
      .orderBy(asc(productImage.sortOrder)),
    db
      .select()
      .from(productVariant)
      .where(eq(productVariant.productSlug, slug))
      /* Largest first — the 100ml is the one they think of as "the price". */
      .orderBy(asc(productVariant.sizeMl)),
  ]);

  return (
    <main className="adm__main">
      <p style={{ marginBottom: 8 }}>
        <a href="/admin/products" style={{ color: "var(--adm-muted)", fontSize: 12 }}>
          ← All products
        </a>
      </p>

      <h1 className="adm__h1">{product.name}</h1>
      <p className="adm__sub">
        {product.tagline} ·{" "}
        <a href={`/fragrance/${slug}`} target="_blank" rel="noopener noreferrer">
          see the live page ↗
        </a>
      </p>

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 6 }}>
          Price and availability
        </p>
        <p className="adm__note" style={{ margin: "0 0 14px" }}>
          Leave a price blank to show &ldquo;Price on request&rdquo;. Every change is recorded
          with who made it and what it was before, and orders keep the price they were placed
          at.
        </p>

        {variants.length === 0 ? (
          <p className="adm__error" role="alert">
            This scent has no price rows yet. Restart the app to create them, or tell your
            developer.
          </p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Size</th>
                  <th colSpan={3}>Price (₹) · availability · reason</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <PriceRow
                    key={v.sku}
                    sku={v.sku}
                    productName={product.name}
                    sizeLabel={v.sizeLabel}
                    priceRupees={v.priceMinor == null ? "" : String(paiseToRupees(v.priceMinor))}
                    status={v.status}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <GalleryEditor
        slug={slug}
        productName={product.name}
        images={images.map((i) => ({
          id: i.id,
          path: i.path,
          alt: i.alt,
          width: i.width,
          height: i.height,
          bytes: i.bytes,
        }))}
        fallback={product.gallery.map((g) => ({ src: g.src, alt: g.alt }))}
        maxMb={env.UPLOAD_MAX_MB}
      />
    </main>
  );
}
