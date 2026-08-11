/* Live prices, layered over the catalogue that lives in code.
 *
 * The join between the two halves of the catalogue: editorial content stays in
 * app/_sections/products-data.ts (frozen, gated per beat, a developer's to change) and
 * the commercial fields come from the database (the client's to change, no deploy).
 *
 * UNITS. The database stores integer PAISE, which is the only safe representation for
 * money. The existing view model — `Product.sizes[].price` and `formatPrice()` — is in
 * RUPEES, and that boundary is crossed exactly here, in paiseToRupees(), so the rest of
 * the app keeps working unchanged. When checkout arrives it re-prices from paise and
 * never trusts the rupee figure the browser saw.
 *
 * FAILING SOFT IS DELIBERATE. Every read falls back to the price compiled into
 * products-data.ts if the database is unreachable. Two things depend on it: `next build`
 * must work on a machine with no database (all 24 editorial pages are prerendered), and a
 * database blip must not take the storefront down — a slightly stale price is far better
 * than a 500 on a product page. */

import { eq } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { priceChange, productVariant, type ProductVariant } from "@/db/schema";
import { PRODUCTS, type Product } from "@/app/_sections/products-data";
import { logger } from "./logger";
import { audit } from "./audit";
import type { AdminUser } from "./auth";

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => paise / 100;

/** Every SKU the code declares, flattened out of the editorial catalogue. */
export function codeVariants() {
  return PRODUCTS.flatMap((p) =>
    p.sizes.map((s) => ({
      sku: s.sku,
      productSlug: p.slug,
      sizeLabel: s.label,
      sizeMl: s.ml,
      /* The ₹1,899 in products-data.ts is a placeholder on the client's own direction
         (2026-07-16). It seeds the row; from then on the database is authoritative. */
      priceMinor: s.price == null ? null : rupeesToPaise(s.price),
    }))
  );
}

/** Insert any SKU that has no row yet. Idempotent; never overwrites a price the client
 *  has set, because `onConflictDoNothing` is the whole point. */
export async function seedVariants(): Promise<number> {
  const rows = codeVariants();
  if (rows.length === 0) return 0;

  const inserted = await db
    .insert(productVariant)
    .values(rows)
    .onConflictDoNothing({ target: productVariant.sku })
    .returning({ sku: productVariant.sku });

  return inserted.length;
}

/**
 * Compare the SKUs in code against the SKUs in the database.
 *
 * The failure this exists to catch: a developer adds a scent to products-data.ts, ships
 * it, and it appears on the site with no row here — so it has no price, no stock and no
 * HSN code, and nobody notices until someone tries to buy it.
 */
export async function checkCatalogueParity(): Promise<{
  missingInDb: string[];
  orphanedInDb: string[];
}> {
  const codeSkus = new Set(codeVariants().map((v) => v.sku));
  const dbRows = await db.select({ sku: productVariant.sku }).from(productVariant);
  const dbSkus = new Set(dbRows.map((r) => r.sku));

  return {
    missingInDb: [...codeSkus].filter((s) => !dbSkus.has(s)),
    /* Not an error: a discontinued scent keeps its row so historical orders still
       resolve. Reported so it is a decision rather than a surprise. */
    orphanedInDb: [...dbSkus].filter((s) => !codeSkus.has(s)),
  };
}

export type Overlay = Map<string, ProductVariant>;

/* One noisy report per process, then quiet. A build prerenders every page, so an
   unreachable database would otherwise print the same stack trace once per page and bury
   whatever the real problem was. */
let overlayFailureReported = false;

/** Commercial fields for every SKU. Returns an EMPTY map on failure — see the header. */
export async function getOverlay(): Promise<Overlay> {
  try {
    const rows = await db.select().from(productVariant);
    overlayFailureReported = false;
    return new Map(rows.map((r) => [r.sku, r]));
  } catch (err) {
    if (!overlayFailureReported) {
      overlayFailureReported = true;
      logger.error("catalogue.overlay_unavailable", {
        err,
        detail:
          "Falling back to the prices compiled into products-data.ts. Further occurrences " +
          "are logged at debug until it recovers.",
      });
    } else {
      logger.debug("catalogue.overlay_unavailable.repeat");
    }
    return new Map();
  }
}

/** Apply live prices to one product. Returns a copy; the module-level PRODUCTS array is
 *  never mutated (it is shared across every request in a long-lived server process). */
export function applyOverlay(product: Product, overlay: Overlay): Product {
  if (overlay.size === 0) return product;

  return {
    ...product,
    sizes: product.sizes.map((size) => {
      const row = overlay.get(size.sku);
      if (!row) return size;
      return {
        ...size,
        price: row.priceMinor == null ? null : paiseToRupees(row.priceMinor),
      };
    }),
  };
}

/** The catalogue as the pages should render it. */
export async function getResolvedProducts(): Promise<Product[]> {
  const overlay = await getOverlay();
  return PRODUCTS.map((p) => applyOverlay(p, overlay));
}

export async function getResolvedProduct(slug: string): Promise<Product | undefined> {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return undefined;
  return applyOverlay(product, await getOverlay());
}

export type VariantPatch = {
  priceMinor?: number | null;
  status?: ProductVariant["status"];
  stockQty?: number;
  stockTracked?: boolean;
  hsnCode?: string | null;
};

/**
 * Update one variant, recording the price movement and an audit row in the same
 * transaction — so a price can never change without leaving a trail.
 */
export async function updateVariant(
  sku: string,
  patch: VariantPatch,
  actor: Pick<AdminUser, "id" | "email">,
  opts: { note?: string; ipHash?: string; exec?: Executor } = {}
): Promise<ProductVariant> {
  const run = async (tx: Executor) => {
    const [before] = await tx
      .select()
      .from(productVariant)
      .where(eq(productVariant.sku, sku))
      .limit(1);

    if (!before) throw new Error(`Unknown SKU: ${sku}`);

    const [after] = await tx
      .update(productVariant)
      .set({ ...patch, updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(productVariant.sku, sku))
      .returning();

    /* Only when the number actually moved — an edit that saves the same price should not
       fill the history with noise. */
    if (patch.priceMinor !== undefined && patch.priceMinor !== before.priceMinor) {
      await tx.insert(priceChange).values({
        sku,
        oldPriceMinor: before.priceMinor,
        newPriceMinor: patch.priceMinor,
        changedBy: actor.id,
        changedByEmail: actor.email,
        note: opts.note,
      });
    }

    await audit({
      actor,
      action: "variant.update",
      entity: "product_variant",
      entityId: sku,
      before: { priceMinor: before.priceMinor, status: before.status, stockQty: before.stockQty },
      after: { priceMinor: after.priceMinor, status: after.status, stockQty: after.stockQty },
      ipHash: opts.ipHash,
      exec: tx,
    });

    return after;
  };

  return opts.exec ? run(opts.exec) : db.transaction(run);
}

export async function priceHistory(sku: string, limit = 20) {
  return db
    .select()
    .from(priceChange)
    .where(eq(priceChange.sku, sku))
    .orderBy(priceChange.changedAt)
    .limit(limit);
}
