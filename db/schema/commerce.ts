/* Orders, order lines, and the inventory ledger.
 *
 * Two rules govern this file, and most of its oddities follow from them.
 *
 * 1. AN ORDER IS A SNAPSHOT, NOT A SET OF POINTERS. Names, sizes, prices, addresses and
 *    tax rates are copied onto the order at placement. A price edit in admin, a renamed
 *    scent, or a customer moving house must never rewrite what someone bought in 2026.
 *    That is why there is no foreign key from an order line to product_variant, and why
 *    addresses are jsonb rather than a table.
 *
 * 2. MONEY IS INTEGER PAISE. 189900 = ₹1,899.00. Never a float, anywhere.
 *
 * There is no `customer` table: with guest checkout only, the email on the order carries
 * the same information. If accounts are ever wanted, that is an additive migration. */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const paymentMethod = pgEnum("payment_method", ["prepaid", "cod"]);

/* The two payment methods do not share a lifecycle, so this enum is the union of both:
 *
 *   prepaid  pending_payment → paid → processing → shipped → delivered
 *                    └──────→ failed | expired          (stock released)
 *   cod      confirmed ─────────────→ processing → shipped → delivered
 *                                                     └────→ rto_returned
 *   both     → cancelled     → refunded (prepaid only)
 *
 * `rto_returned` is a first-class outcome, not an error: in Indian COD it is a routine
 * and expected end state that restores stock and records the loss. */
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "failed",
  "expired",
  "rto_returned",
]);

/* Order numbers come from a sequence rather than a count, because a count is a race:
 * two orders placed in the same second would read the same value and collide.
 *
 * It does NOT reset each year. BTB-2026-0001 … BTB-2026-0087, then BTB-2027-0088. The
 * year is when it was placed; the number is simply unique and increasing. A resetting
 * counter buys a prettier January and costs a whole class of collision bug. */
export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1, increment: 1 });

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /* What a customer quotes on the phone. Human-readable, unguessable-adjacent but NOT
       a secret — accessToken is the secret. */
    orderNumber: text("order_number").notNull(),

    /* Lowercased on the way in (lib/tokens.ts → normaliseEmail), so `text` is enough and
       no citext extension is needed. */
    email: text("email").notNull(),
    /* REQUIRED, including for prepaid: a courier cannot deliver anything without it, and
       a COD order without a phone number is undeliverable by definition. */
    phone: text("phone").notNull(),

    paymentMethod: paymentMethod("payment_method").notNull(),
    status: orderStatus("status").notNull(),

    subtotalMinor: integer("subtotal_minor").notNull(),
    shippingMinor: integer("shipping_minor").notNull().default(0),
    codFeeMinor: integer("cod_fee_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull().default("INR"),

    /* Snapshots of the tax configuration at placement. If the client turns GST on next
       year, last year's orders must still describe themselves correctly. */
    taxInclusive: boolean("tax_inclusive").notNull().default(true),
    taxBreakup: jsonb("tax_breakup"),
    placeOfSupply: text("place_of_supply"),

    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    notes: text("notes"),

    /* The customer's key to their own order status page. Stored in plaintext for the same
       reason as the newsletter unsubscribe token: it must be reproducible in every email
       we send about this order, which a one-way hash cannot do. It is high-entropy,
       single-purpose, and grants read-only access to one order. */
    accessToken: text("access_token").notNull(),

    /* Kills the double-submit. A retried POST with the same key returns the SAME order
       rather than placing a second one — the difference between a duplicated ₹1,899 and
       a correct one. */
    idempotencyKey: text("idempotency_key"),

    /* Despatch. Columns rather than a `shipment` table: this house sends one parcel per
       order, and a table would model a partial-shipment case that does not exist for four
       fragrances. If it ever does, that is an additive migration — whereas a join table
       nobody needs is a permanent tax on every query that touches an order. */
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),

    placedAt: ts("placed_at").notNull().defaultNow(),
    /* For COD this is stamped by a HUMAN in admin when the courier remits — there is no
       webhook for cash. For prepaid the gateway decides it. */
    paidAt: ts("paid_at"),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    cancelledAt: ts("cancelled_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_number_idx").on(t.orderNumber),
    uniqueIndex("order_access_token_idx").on(t.accessToken),
    uniqueIndex("order_idempotency_idx").on(t.idempotencyKey),
    index("order_email_idx").on(t.email, t.placedAt),
    index("order_status_idx").on(t.status, t.placedAt),
    index("order_phone_idx").on(t.phone),
  ]
);

export const orderItem = pgTable(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),

    /* Deliberately NOT a foreign key to product_variant. A discontinued SKU must not be
       undeletable because of an order from three years ago, and an order must render
       identically even if the variant row is gone. */
    sku: text("sku").notNull(),
    productSlug: text("product_slug").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    sizeSnapshot: text("size_snapshot").notNull(),

    unitPriceMinor: integer("unit_price_minor").notNull(),
    qty: integer("qty").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),

    /* Snapshotted so a later rate change never rewrites a historical invoice. Both are
       zero/null until the client's accountant supplies real figures. */
    hsnSnapshot: text("hsn_snapshot"),
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
  },
  (t) => [index("order_item_order_idx").on(t.orderId)]
);

/* Stock as a LEDGER, not a mutable counter.
 *
 * product_variant.stock_qty is the fast read; this is the record that explains it. When
 * the two disagree — and eventually they will, through a manual correction or a bug —
 * this is the only thing that can say which is wrong and when it happened.
 *
 * Rows are written only for SKUs with stock_tracked = true, so that the ledger's sum and
 * stock_qty are genuinely reconcilable. An untracked SKU has no stock story to tell. */
export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    /* Negative for a sale, positive for a restock or a return. */
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // order_placed | order_cancelled | rto_returned | restock | correction | shrinkage
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    actor: text("actor"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("inventory_movement_sku_idx").on(t.sku, t.createdAt),
    index("inventory_movement_order_idx").on(t.orderId),
  ]
);

export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type InventoryMovement = typeof inventoryMovement.$inferSelect;
