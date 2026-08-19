/* Commercial overlay on the catalogue.
 *
 * The editorial catalogue — names, taglines, pyramids, story, imagery — stays in
 * app/_sections/products-data.ts, in the repo, gated per beat. It is part of the visual
 * system and is a developer's to change (client decision, 2026-08-11).
 *
 * This table holds ONLY what must change at runtime without a deploy: price, availability
 * and stock. It is keyed by the SKUs already declared in that file (`MA-100`, `HT-10`, …),
 * so the two halves are joined by a value a human can read rather than a synthetic id.
 *
 * Money is integer PAISE. 189900 = ₹1,899.00. Never a float — a price is not a quantity
 * you want binary rounding anywhere near. */

import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const variantStatus = pgEnum("variant_status", [
  "active", // buyable
  "hidden", // not shown, not buyable — for a scent being reworked
  "sold_out", // shown, not buyable
  "discontinued", // gone for good; kept so historical orders still resolve
]);

export const productVariant = pgTable(
  "product_variant",
  {
    /* Matches SIZES() in products-data.ts. A startup assertion fails loudly if the two
       ever disagree, so adding a scent in code and forgetting its price cannot ship. */
    sku: text("sku").primaryKey(),
    productSlug: text("product_slug").notNull(),
    sizeLabel: text("size_label").notNull(),
    sizeMl: integer("size_ml").notNull(),

    /* NULL = "Price on request" — the existing UI already renders that state, so an
       unpriced product degrades gracefully instead of showing ₹0. */
    priceMinor: integer("price_minor"),
    currency: text("currency").notNull().default("INR"),

    status: variantStatus("status").notNull().default("active"),

    stockQty: integer("stock_qty").notNull().default(0),
    /* False = always buyable, ignore stock_qty. The right default while the house fulfils
       by hand and has not counted anything into the system yet: tracking stock from day
       one would make every SKU read sold-out the moment commerce goes live. */
    stockTracked: boolean("stock_tracked").notNull().default(false),

    /* For the GST invoice. Null until the client's accountant supplies it — deliberately
       not inferred (regulated figures are the client's authority). */
    hsnCode: text("hsn_code"),
    weightGrams: integer("weight_grams"),

    updatedAt: ts("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (t) => [index("product_variant_slug_idx").on(t.productSlug)]
);

/* Every price movement, kept forever. Money changes are never silent: this is the record
   that answers "what was it on the day that order was placed", which the order's own
   snapshot also answers but from the other direction. */
export const priceChange = pgTable(
  "price_change",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    oldPriceMinor: integer("old_price_minor"),
    newPriceMinor: integer("new_price_minor"),
    changedBy: uuid("changed_by"),
    /* Snapshotted so the trail stays readable after a staff account is removed. */
    changedByEmail: text("changed_by_email"),
    note: text("note"),
    changedAt: ts("changed_at").notNull().defaultNow(),
  },
  (t) => [index("price_change_sku_idx").on(t.sku, t.changedAt)]
);

/* The PDP's top gallery — the scrollable images at the head of a product page.
 *
 * This is a NARROW exception to the rule in this file's header, and the narrowness is the
 * point. Editorial copy — names, taglines, pyramids, story — stays in products-data.ts,
 * where it is reviewed and versioned with the design (reaffirmed by the client 2026-08-12).
 * Photography is different: it is reshot on the house's own schedule, and needing a
 * developer and a deploy to swap a product image is the kind of friction that leaves a
 * stale render on a live page for weeks.
 *
 * ABSENCE IS THE DEFAULT. A product with no rows here renders `gallery` from
 * products-data.ts exactly as before — the code array is never read from or written to,
 * and "reset to the original images" is implemented as deleting rows. There is no state in
 * which the two halves have to be reconciled.
 *
 * Dimensions are stored, not typed by a person. `Product.gallery[].ratio` is a required
 * field of the view model, the collection index still selects a card image by it, and the
 * admin shows it back so the client can see what they uploaded. All of that is a fact about
 * the file, so the file is asked — the upload route measures the encoded image. Asking the
 * client for "1915 / 821" would be asking them to be the measuring instrument.
 *
 * Note that the PDP hero frame is a FIXED square (pdphero.css: a frame that resized per
 * image made the whole page jump on every thumbnail click) and letterboxes with
 * object-fit: contain. So these numbers do not drive that frame — an upload of any shape
 * displays whole, and a roughly square one simply fills more of it.
 */
export const productImage = pgTable(
  "product_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Slug, not SKU: the gallery belongs to the scent, not to the 10ml/100ml variant. */
    productSlug: text("product_slug").notNull(),

    /* Served path, e.g. /media/products/don-amour/a1b2c3.webp. NOT a /public path —
       uploads live outside the build output so a redeploy cannot delete them. */
    path: text("path").notNull(),
    alt: text("alt").notNull().default(""),

    /* Real pixel dimensions, measured on upload. `ratio` is rendered as `${w} / ${h}`. */
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes"),

    /* Gap-friendly ordering (10, 20, 30…) so a reorder is an UPDATE of one row rather than
       a renumber of all of them. */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [index("product_image_slug_idx").on(t.productSlug, t.sortOrder)]
);

export type ProductVariant = typeof productVariant.$inferSelect;
export type ProductImage = typeof productImage.$inferSelect;
