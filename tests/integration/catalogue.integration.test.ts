/* Live prices, against a real Postgres.
 *
 * The property that matters most here is the FALLBACK: every read must degrade to the
 * price compiled into products-data.ts rather than throw, because `next build` runs on
 * machines with no database and a database blip must not take the storefront down. */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { auditLog, priceChange, productVariant } from "@/db/schema";
import {
  applyOverlay,
  checkCatalogueParity,
  codeVariants,
  getOverlay,
  getResolvedProduct,
  paiseToRupees,
  rupeesToPaise,
  seedVariants,
  updateVariant,
} from "@/lib/catalogue";
import { PRODUCTS } from "@/app/_sections/products-data";

const hasDb = Boolean(process.env.DATABASE_URL);
const ACTOR = { id: "00000000-0000-0000-0000-000000000000", email: "test@beyondthebody.invalid" };
const SKU = "MA-100";

describe.skipIf(!hasDb)("phase 3 · live prices", () => {
  beforeEach(async () => {
    await seedVariants();
    /* Reset the SKU under test to its seeded value so cases cannot leak into each other. */
    await db
      .update(productVariant)
      .set({ priceMinor: 189_900, status: "active" })
      .where(eq(productVariant.sku, SKU));
    await db.delete(priceChange).where(eq(priceChange.sku, SKU));
  });

  afterAll(async () => {
    await db.delete(priceChange).where(eq(priceChange.sku, SKU));
    await db.delete(auditLog).where(eq(auditLog.entityId, SKU));
    await db
      .update(productVariant)
      .set({ priceMinor: 189_900, status: "active" })
      .where(eq(productVariant.sku, SKU));
    await closeDb();
  });

  it("seeds a row for every SKU declared in code", async () => {
    const parity = await checkCatalogueParity();
    expect(parity.missingInDb).toEqual([]);
  });

  it("seeds idempotently", async () => {
    expect(await seedVariants()).toBe(0); // already seeded by beforeEach
  });

  it("covers all four scents at both sizes", () => {
    expect(codeVariants()).toHaveLength(PRODUCTS.length * 2);
  });

  it("converts money without floating-point drift", () => {
    expect(rupeesToPaise(1899)).toBe(189_900);
    expect(rupeesToPaise(1899.5)).toBe(189_950);
    /* 0.1 + 0.2 territory: the reason money is stored as an integer at all. */
    expect(rupeesToPaise(1899.1)).toBe(189_910);
    expect(paiseToRupees(189_900)).toBe(1899);
  });

  it("layers the live price over the product from code", async () => {
    await updateVariant(SKU, { priceMinor: 249_900 }, ACTOR);

    const product = await getResolvedProduct("mon-amour");
    const size = product!.sizes.find((s) => s.sku === SKU)!;
    expect(size.price).toBe(2499);

    /* Editorial content is untouched — it comes from the repo, not the database. */
    expect(product!.tagline).toBe("Love, remembered.");
  });

  it("never mutates the shared PRODUCTS array", async () => {
    const before = PRODUCTS.find((p) => p.slug === "mon-amour")!.sizes.find((s) => s.sku === SKU)!.price;
    await updateVariant(SKU, { priceMinor: 999_900 }, ACTOR);
    await getResolvedProduct("mon-amour");

    /* PRODUCTS is module-level state shared by every request in a long-lived server —
       mutating it would leak one request's prices into the next. */
    const after = PRODUCTS.find((p) => p.slug === "mon-amour")!.sizes.find((s) => s.sku === SKU)!.price;
    expect(after).toBe(before);
  });

  it("renders 'price on request' when the price is cleared", async () => {
    await updateVariant(SKU, { priceMinor: null }, ACTOR);
    const product = await getResolvedProduct("mon-amour");
    expect(product!.sizes.find((s) => s.sku === SKU)!.price).toBeNull();
  });

  it("falls back to the code price when the database gives nothing", () => {
    /* Exactly what getOverlay() returns on a connection failure. The storefront must
       still render — this is what keeps `next build` working with no database. */
    const product = PRODUCTS.find((p) => p.slug === "mon-amour")!;
    const resolved = applyOverlay(product, new Map());
    expect(resolved.sizes[0].price).toBe(product.sizes[0].price);
    expect(resolved).toEqual(product);
  });

  it("leaves a SKU alone if it has no row", async () => {
    const overlay = await getOverlay();
    overlay.delete(SKU);
    const product = applyOverlay(PRODUCTS.find((p) => p.slug === "mon-amour")!, overlay);
    expect(product.sizes.find((s) => s.sku === SKU)!.price).toBe(1899);
  });

  it("removes a hidden size from the storefront view", async () => {
    await updateVariant(SKU, { status: "hidden" }, ACTOR);
    const product = await getResolvedProduct("mon-amour");

    /* The PDP size toggle renders product.sizes verbatim, so hiding must happen here —
       checkout and /api/v1/catalogue already refuse the SKU, but the button must go too. */
    expect(product!.sizes.find((s) => s.sku === SKU)).toBeUndefined();
    expect(product!.sizes.length).toBeGreaterThan(0); // the other size is untouched
  });

  it("keeps a sold-out size visible", async () => {
    /* sold_out is "shown, not buyable" (db/schema/catalogue.ts) — only hidden and
       discontinued disappear. */
    await updateVariant(SKU, { status: "sold_out" }, ACTOR);
    const product = await getResolvedProduct("mon-amour");
    expect(product!.sizes.find((s) => s.sku === SKU)).toBeDefined();
  });

  it("records a price change with the old and new value", async () => {
    await updateVariant(SKU, { priceMinor: 210_000 }, ACTOR, { note: "client update" });

    const [row] = await db.select().from(priceChange).where(eq(priceChange.sku, SKU));
    expect(row.oldPriceMinor).toBe(189_900);
    expect(row.newPriceMinor).toBe(210_000);
    expect(row.changedByEmail).toBe(ACTOR.email);
    expect(row.note).toBe("client update");
  });

  it("does not record history when the price did not move", async () => {
    await updateVariant(SKU, { priceMinor: 189_900, status: "sold_out" }, ACTOR);
    const rows = await db.select().from(priceChange).where(eq(priceChange.sku, SKU));
    expect(rows).toHaveLength(0); // status changed, price did not
  });

  it("writes an audit row for every edit", async () => {
    await updateVariant(SKU, { status: "hidden" }, ACTOR);
    const rows = await db.select().from(auditLog).where(eq(auditLog.entityId, SKU));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[rows.length - 1].action).toBe("variant.update");
  });

  it("rejects an unknown SKU instead of silently doing nothing", async () => {
    await expect(updateVariant("NOPE-1", { priceMinor: 1 }, ACTOR)).rejects.toThrow(/Unknown SKU/);
  });

  it("rolls the whole edit back if any part fails", async () => {
    const before = await db.select().from(productVariant).where(eq(productVariant.sku, SKU));

    await expect(
      db.transaction(async (tx) => {
        await updateVariant(SKU, { priceMinor: 500_000 }, ACTOR, { exec: tx });
        throw new Error("simulated failure after the update");
      })
    ).rejects.toThrow("simulated failure");

    const after = await db.select().from(productVariant).where(eq(productVariant.sku, SKU));
    expect(after[0].priceMinor).toBe(before[0].priceMinor);
  });
});
