/* Payments — Razorpay.
 *
 * The rule that shapes this file: WE ARE NOT THE SOURCE OF TRUTH ABOUT MONEY. Razorpay
 * is. Everything here is a local record of what the gateway told us, kept so that an
 * order can explain itself years later without an API call, and so that a duplicate
 * notification cannot be mistaken for a second payment.
 *
 * Two independent paths report a successful payment — the browser returning from
 * checkout, and a webhook — and either can arrive first, twice, or never. The unique
 * constraints below are what make that safe rather than the order in which they run. */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { order } from "./commerce";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const paymentStatus = pgEnum("payment_status", [
  "created", // our order exists at the gateway; nobody has paid yet
  "authorized", // money held, not yet taken
  "captured", // money taken — the only status that means paid
  "failed",
  "refunded",
]);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),

    provider: text("provider").notNull().default("razorpay"),

    /* Razorpay's own order id (`order_...`), created when checkout opens. This is the key
       the webhook arrives with, so it is how an incoming notification finds our order. */
    providerOrderId: text("provider_order_id"),
    /* Razorpay's payment id (`pay_...`). Unique: the same payment must never be recorded
       twice, whichever of the two paths reports it first. */
    providerPaymentId: text("provider_payment_id"),

    status: paymentStatus("status").notNull().default("created"),
    amountMinor: integer("amount_minor").notNull(),
    method: text("method"), // upi | card | netbanking | wallet

    /* False until we have checked the HMAC ourselves. An unverified success report is
       just a claim — anyone can POST our callback URL. */
    signatureVerified: boolean("signature_verified").notNull().default(false),

    errorCode: text("error_code"),
    errorDescription: text("error_description"),

    /* The gateway's own payload, kept whole. When a payment is disputed months later,
       what Razorpay actually said is the only thing worth arguing from. */
    raw: jsonb("raw"),

    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payment_order_idx").on(t.orderId),

    /* ONE ROW PER ATTEMPT, so `provider_order_id` is deliberately NOT unique.
       A customer whose card is declined and who then pays with UPI produces two payments
       against the same gateway order, and both belong in the record — the failure is
       half the story when someone writes in asking what happened. */
    index("payment_provider_order_idx").on(t.providerOrderId),

    /* `provider_payment_id` IS unique. Postgres allows many NULLs in a unique index, so
       rows that have not reached a payment yet cost nothing — but once an id exists it
       can only belong to one row. That is what stops the browser callback and the
       webhook, racing, from recording the same payment twice. */
    uniqueIndex("payment_provider_payment_idx").on(t.providerPaymentId),

    /* At most one OPEN gateway order per order of ours. Without this, two concurrent
       checkout submits would each create a Razorpay order and the customer could be
       shown a payment sheet for one while paying the other. */
    uniqueIndex("payment_open_gateway_order_idx")
      .on(t.orderId)
      .where(sql`status = 'created'`),
  ]
);

/* The idempotency ledger.
 *
 * Razorpay retries delivery until it gets a 2xx, and will deliver duplicates even when it
 * does. Every event is written here first, and the unique constraint on the provider's own
 * event id is what makes a replayed webhook a no-op rather than a second state change.
 * Kept forever: it is the record of what we were told and when. */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("razorpay"),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type"),
    payload: jsonb("payload"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    error: text("error"),
  },
  (t) => [
    /* THE constraint this table exists for. A replayed delivery collides here and is
       recognised as a duplicate instead of transitioning an order a second time. */
    uniqueIndex("webhook_event_unique_idx").on(t.provider, t.providerEventId),
    index("webhook_event_type_idx").on(t.eventType, t.receivedAt),
  ]
);

export const refund = pgTable(
  "refund",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id"),
    amountMinor: integer("amount_minor").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("created"),
    /* Who authorised it. A refund is always a human decision. */
    createdBy: uuid("created_by"),
    createdByEmail: text("created_by_email"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("refund_payment_idx").on(t.paymentId)]
);

export type Payment = typeof payment.$inferSelect;
export type WebhookEvent = typeof webhookEvent.$inferSelect;
export type Refund = typeof refund.$inferSelect;
