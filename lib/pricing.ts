/* The quote engine — the single place a total is decided.
 *
 * THE BROWSER'S PRICES ARE NEVER TRUSTED. The cart lives in localStorage and can be weeks
 * old, hand-edited, or simply stale after an admin price change. Every line here is
 * re-priced from the database, and what the customer last saw is used for exactly one
 * thing: deciding whether to warn them that it moved.
 *
 * Checkout calls this too, with the same code path, so the total that is charged is the
 * total that was quoted. A separate "checkout pricing" function is how the two drift.
 *
 * Money is integer paise throughout. */

import { PRODUCTS } from "@/app/_sections/products-data";
import { getOverlay, type Overlay } from "./catalogue";
import { getSettings, type Settings } from "./settings";

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 20;

export type QuoteItem = {
  sku: string;
  qty: number;
  /** What the browser last showed, in paise. Advisory only — used to raise a warning. */
  expectedPriceMinor?: number | null;
};

export type LineIssueCode = "price_changed" | "qty_reduced" | "low_stock";
export type DropReason = "unknown_sku" | "unavailable" | "out_of_stock" | "price_unset";

export type QuoteLine = {
  sku: string;
  productSlug: string;
  name: string;
  size: string;
  unitPriceMinor: number;
  qty: number;
  lineTotalMinor: number;
  taxMinor: number;
  taxRateBp: number;
  hsnCode: string | null;
  /** Whether this SKU tracked stock at quote time — decides if placing the order writes
   *  an inventory ledger row. Internal; never sent to the browser. */
  stockTrackedAtQuote: boolean;
  issues: { code: LineIssueCode; message: string; previousPriceMinor?: number }[];
};

export type DroppedLine = { sku: string; reason: DropReason; message: string };

export type TaxBreakup =
  | { kind: "cgst_sgst"; cgstMinor: number; sgstMinor: number }
  | { kind: "igst"; igstMinor: number }
  | null;

export type Quote = {
  currency: "INR";
  lines: QuoteLine[];
  dropped: DroppedLine[];
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxInclusive: boolean;
  taxBreakup: TaxBreakup;
  placeOfSupply: string | null;
  codAvailable: boolean;
  storeOpen: boolean;
  /** True if anything changed under the customer since they filled their bag. */
  needsReview: boolean;
};

/* ── The SKU index: editorial copy from the repo, commerce from the database ────── */

export type SkuRow = {
  sku: string;
  productSlug: string;
  name: string;
  sizeLabel: string;
  priceMinor: number | null;
  status: string;
  stockQty: number;
  stockTracked: boolean;
  hsnCode: string | null;
};

/** Join the two halves of the catalogue by SKU. The editorial side is authoritative for
 *  names and sizes; the database side for price, availability and stock. */
export function buildSkuIndex(overlay: Overlay): Map<string, SkuRow> {
  const index = new Map<string, SkuRow>();

  for (const product of PRODUCTS) {
    for (const size of product.sizes) {
      const row = overlay.get(size.sku);
      index.set(size.sku, {
        sku: size.sku,
        productSlug: product.slug,
        name: product.name,
        sizeLabel: size.label,
        /* No row means the database is unreachable or unseeded — fall back to the price
           compiled into products-data.ts, exactly as the product pages do. A storefront
           that cannot quote is worse than one quoting a price that is correct in the
           repo; the startup parity assertion is what stops the two drifting. */
        priceMinor: row ? row.priceMinor : size.price === null ? null : Math.round(size.price * 100),
        status: row?.status ?? "active",
        stockQty: row?.stockQty ?? 0,
        stockTracked: row?.stockTracked ?? false,
        hsnCode: row?.hsnCode ?? null,
      });
    }
  }

  return index;
}

/* ── Tax ───────────────────────────────────────────────────────────────────────────
 *
 * Written in full and switched off. `tax_rate_bp` is 0 until the client's accountant
 * supplies a figure — per the calibration ledger, regulated numbers are the client's
 * authority and are never inferred here. Turning GST on is then a settings edit, not a
 * migration or a code change.
 *
 * Shipping is left untaxed: whether a delivery charge attracts GST at the goods' rate is
 * a question for their CA, and guessing it would be inventing a regulated figure. */

/** Tax contained in (inclusive) or due on (exclusive) an amount. */
export function taxForAmount(amountMinor: number, rateBp: number, inclusive: boolean): number {
  if (rateBp <= 0 || amountMinor <= 0) return 0;
  return inclusive
    ? Math.round((amountMinor * rateBp) / (10_000 + rateBp))
    : Math.round((amountMinor * rateBp) / 10_000);
}

/** CGST+SGST when the buyer is in the seller's own state, IGST when they are not.
 *  Null until both a rate and the seller's state exist. */
export function splitTax(
  taxMinor: number,
  sellerState: string | null,
  placeOfSupply: string | null
): TaxBreakup {
  if (taxMinor <= 0 || !sellerState || !placeOfSupply) return null;

  if (sellerState.trim().toLowerCase() === placeOfSupply.trim().toLowerCase()) {
    /* The odd paisa goes to CGST so the two halves always sum to the whole. */
    const cgst = Math.ceil(taxMinor / 2);
    return { kind: "cgst_sgst", cgstMinor: cgst, sgstMinor: taxMinor - cgst };
  }
  return { kind: "igst", igstMinor: taxMinor };
}

/* ── The quote ─────────────────────────────────────────────────────────────────────── */

export type QuoteOptions = {
  paymentMethod?: "prepaid" | "cod";
  /** Shipping state, for GST place of supply. */
  state?: string | null;
};

export function priceCart(
  items: QuoteItem[],
  index: Map<string, SkuRow>,
  settings: Settings,
  opts: QuoteOptions = {}
): Quote {
  const lines: QuoteLine[] = [];
  const dropped: DroppedLine[] = [];
  const placeOfSupply = opts.state?.trim() || null;

  /* Merge duplicate SKUs before pricing: two entries for the same SKU are one line with
     a combined quantity, or the per-line cap can be walked straight past. */
  const merged = new Map<string, QuoteItem>();
  for (const item of items.slice(0, MAX_LINES)) {
    const existing = merged.get(item.sku);
    if (existing) existing.qty += item.qty;
    else merged.set(item.sku, { ...item });
  }

  for (const item of merged.values()) {
    const row = index.get(item.sku);

    if (!row) {
      /* An unknown SKU is a stale bag, not an attack: the legacy static site used nine
         SKUs that no longer exist. Drop the line and say so plainly. */
      dropped.push({
        sku: item.sku,
        reason: "unknown_sku",
        message: "This item is no longer part of the collection.",
      });
      continue;
    }

    if (row.status !== "active") {
      dropped.push({
        sku: item.sku,
        reason: row.status === "sold_out" ? "out_of_stock" : "unavailable",
        message:
          row.status === "sold_out"
            ? `${row.name} · ${row.sizeLabel} is sold out.`
            : `${row.name} · ${row.sizeLabel} is no longer available.`,
      });
      continue;
    }

    if (row.priceMinor === null) {
      /* "Price on request" is a legitimate display state, but it cannot be charged. */
      dropped.push({
        sku: item.sku,
        reason: "price_unset",
        message: `${row.name} · ${row.sizeLabel} is not on sale yet.`,
      });
      continue;
    }

    const issues: QuoteLine["issues"] = [];
    let qty = Math.min(Math.max(1, Math.floor(item.qty)), MAX_QTY_PER_LINE);
    if (qty < item.qty) {
      issues.push({
        code: "qty_reduced",
        message: `We can send up to ${MAX_QTY_PER_LINE} of this per order.`,
      });
    }

    if (row.stockTracked) {
      if (row.stockQty <= 0) {
        dropped.push({
          sku: item.sku,
          reason: "out_of_stock",
          message: `${row.name} · ${row.sizeLabel} is out of stock.`,
        });
        continue;
      }
      if (row.stockQty < qty) {
        qty = row.stockQty;
        issues.push({
          code: "qty_reduced",
          message: `Only ${row.stockQty} left — the quantity has been adjusted.`,
        });
      }
    }

    if (
      item.expectedPriceMinor != null &&
      item.expectedPriceMinor > 0 &&
      item.expectedPriceMinor !== row.priceMinor
    ) {
      /* Shown BEFORE payment, never after. A bag can be weeks old and the customer is
         entitled to see that the figure moved before they commit to it. */
      issues.push({
        code: "price_changed",
        message: "The price of this has changed since you added it.",
        previousPriceMinor: item.expectedPriceMinor,
      });
    }

    const lineTotalMinor = row.priceMinor * qty;

    lines.push({
      sku: row.sku,
      productSlug: row.productSlug,
      name: row.name,
      size: row.sizeLabel,
      unitPriceMinor: row.priceMinor,
      qty,
      lineTotalMinor,
      taxMinor: taxForAmount(lineTotalMinor, settings.tax_rate_bp, settings.tax_inclusive),
      taxRateBp: settings.tax_rate_bp,
      hsnCode: row.hsnCode,
      stockTrackedAtQuote: row.stockTracked,
      issues,
    });
  }

  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const taxMinor = lines.reduce((sum, l) => sum + l.taxMinor, 0);

  const freeAbove = settings.shipping_free_above_minor;
  const shippingMinor =
    lines.length === 0 ? 0 : freeAbove !== null && subtotalMinor >= freeAbove ? 0 : settings.shipping_flat_minor;

  const codAvailable = settings.cod_enabled;
  const codFeeMinor = opts.paymentMethod === "cod" && codAvailable ? settings.cod_fee_minor : 0;

  /* Inclusive: tax is already inside the subtotal and must not be added again. Exclusive:
     it is added on top. Getting this backwards overcharges every customer by the rate. */
  const totalMinor =
    subtotalMinor + shippingMinor + codFeeMinor + (settings.tax_inclusive ? 0 : taxMinor);

  return {
    currency: "INR",
    lines,
    dropped,
    subtotalMinor,
    shippingMinor,
    codFeeMinor,
    taxMinor,
    totalMinor,
    taxInclusive: settings.tax_inclusive,
    taxBreakup: splitTax(taxMinor, settings.seller_state, placeOfSupply),
    placeOfSupply,
    codAvailable,
    storeOpen: settings.store_open,
    needsReview: dropped.length > 0 || lines.some((l) => l.issues.length > 0),
  };
}

/** The quote as the API and checkout both use it: read the live catalogue, then price. */
export async function quoteCart(items: QuoteItem[], opts: QuoteOptions = {}): Promise<Quote> {
  const [overlay, settings] = await Promise.all([getOverlay(), getSettings()]);
  return priceCart(items, buildSkuIndex(overlay), settings, opts);
}
