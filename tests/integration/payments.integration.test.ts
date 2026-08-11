/* The payment state machine, against a real Postgres.
 *
 * Razorpay itself is never called here — these are the transitions that happen AFTER the
 * gateway has spoken, and they are the ones that decide whether a customer who paid gets
 * their order, whether one who paid twice is charged twice, and whether stock held by an
 * abandoned checkout ever comes back.
 *
 * The recurring theme: every transition is attempted more than once in real life, so
 * every test here attempts it more than once too. */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import {
  inventoryMovement,
  job,
  order,
  payment,
  productVariant,
  webhookEvent,
} from "@/db/schema";
import { placeOrder } from "@/lib/orders";
import {
  expireStaleOrders,
  markOrderPaid,
  recordFailedPayment,
  releaseOrder,
} from "@/lib/payments";
import { seedVariants } from "@/lib/catalogue";
import { __clearSettingsCache, setSetting } from "@/lib/settings";
import type { Address } from "@/lib/address";

const hasDb = Boolean(process.env.DATABASE_URL);

const ADDRESS: Address = {
  name: "A Test Person",
  line1: "12 Some Street",
  line2: "",
  landmark: "",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "IN",
};

const EMAIL = "payments-test@beyondthebody.invalid";
const A = "MA-100";
let counter = 0;

const place = (method: "prepaid" | "cod" = "prepaid", qty = 1) =>
  placeOrder({
    items: [{ sku: A, qty }],
    email: EMAIL,
    phone: "9876500100",
    paymentMethod: method,
    shippingAddress: ADDRESS,
    idempotencyKey: `pay-test-${Date.now()}-${counter++}`,
  });

async function resetVariants() {
  await db
    .update(productVariant)
    .set({ priceMinor: 189_900, status: "active", stockQty: 0, stockTracked: false })
    .where(eq(productVariant.sku, A));
}

async function cleanup() {
  const rows = await db.select({ id: order.id }).from(order).where(like(order.email, "%beyondthebody.invalid"));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(inventoryMovement).where(inArray(inventoryMovement.orderId, ids));
    await db.delete(order).where(inArray(order.id, ids)); // payments and items cascade
  }
  await db
    .delete(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' like '%beyondthebody.invalid'`));
  await db.delete(webhookEvent).where(like(webhookEvent.providerEventId, "test:%"));
}

const mailFor = async (email: string) =>
  db
    .select()
    .from(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${email}`));

const stockOf = async (sku: string) =>
  (await db.select().from(productVariant).where(eq(productVariant.sku, sku)))[0].stockQty;

describe.skipIf(!hasDb)("phase 6 · payments", () => {
  beforeEach(async () => {
    await seedVariants();
    await resetVariants();
    await cleanup();
    await setSetting("store_open", true);
    await setSetting("cod_enabled", true);
    __clearSettingsCache();
  });

  afterAll(async () => {
    await cleanup();
    await resetVariants();
    await closeDb();
  });

  /* ── A prepaid order before anyone has paid ───────────────────────────────── */

  it("starts a prepaid order awaiting payment", async () => {
    const { order: row } = await place("prepaid");

    expect(row.status).toBe("pending_payment");
    expect(row.paidAt).toBeNull();

    /* No confirmation email yet: nothing has been bought until it is paid for, and a
       "thank you for your order" before payment is a lie the customer will act on. */
    expect(await mailFor(EMAIL)).toHaveLength(0);
  });

  it("holds stock while payment is pending", async () => {
    await db.update(productVariant).set({ stockTracked: true, stockQty: 5 }).where(eq(productVariant.sku, A));

    await place("prepaid", 2);

    /* Reserved, not merely intended. Otherwise two customers can both reach the payment
       sheet for the last bottle and one of them is disappointed after paying. */
    expect(await stockOf(A)).toBe(3);
  });

  /* ── Being paid ───────────────────────────────────────────────────────────── */

  const paidInput = (orderId: string, amountMinor: number, over = {}) => ({
    orderId,
    providerOrderId: "order_test_1",
    providerPaymentId: `pay_test_${counter++}`,
    amountMinor,
    method: "upi",
    signatureVerified: true,
    source: "webhook" as const,
    ...over,
  });

  it("marks an order paid and tells the customer", async () => {
    const { order: row } = await place("prepaid");
    const result = await markOrderPaid(paidInput(row.id, row.totalMinor));

    expect(result.ok && result.alreadyPaid).toBe(false);

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("paid");
    expect(after.paidAt).toBeInstanceOf(Date);

    const mail = await mailFor(EMAIL);
    expect(mail).toHaveLength(1);
    expect((mail[0].payload as { subject: string }).subject).toMatch(/^Your order BTB-/);
  });

  it("is a no-op the second time, however it arrives", async () => {
    /* The ordinary case, not an edge case: the browser callback and the webhook BOTH
       report a successful payment, and the customer must be emailed once. */
    const { order: row } = await place("prepaid");
    const input = paidInput(row.id, row.totalMinor);

    const first = await markOrderPaid(input);
    const second = await markOrderPaid({ ...input, source: "callback" });

    expect(first.ok && first.alreadyPaid).toBe(false);
    expect(second.ok && second.alreadyPaid).toBe(true);

    expect(await mailFor(EMAIL)).toHaveLength(1); // not two
    expect(await db.select().from(payment).where(eq(payment.orderId, row.id))).toHaveLength(1);
  });

  it("survives both paths racing", async () => {
    const { order: row } = await place("prepaid");
    const input = paidInput(row.id, row.totalMinor);

    const results = await Promise.allSettled([
      markOrderPaid(input),
      markOrderPaid({ ...input, source: "callback" }),
    ]);

    /* Neither call may fail, and between them they must produce exactly one paid order
       and one confirmation email. */
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await mailFor(EMAIL)).toHaveLength(1);

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("paid");
  });

  it("never records a verified payment as unverified afterwards", async () => {
    const { order: row } = await place("prepaid");
    const input = paidInput(row.id, row.totalMinor);

    await markOrderPaid(input);
    await markOrderPaid({ ...input, signatureVerified: false, source: "reconciliation" });

    const [record] = await db.select().from(payment).where(eq(payment.orderId, row.id));
    /* We checked the HMAC ourselves once. A later unsigned report about the same payment
       must not erase the evidence that we did. */
    expect(record.signatureVerified).toBe(true);
  });

  /* ── Refusals ─────────────────────────────────────────────────────────────── */

  it("refuses a payment for the wrong amount and leaves the order unpaid", async () => {
    const { order: row } = await place("prepaid");

    const result = await markOrderPaid(paidInput(row.id, row.totalMinor - 100));
    expect(result).toMatchObject({ ok: false, reason: "amount_mismatch" });

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    /* Never auto-fulfilled. Under-payment is the obvious attack; over-payment is usually
       our own bug. Both need a human, and neither should ship a bottle. */
    expect(after.status).toBe("pending_payment");
    expect(await mailFor(EMAIL)).toHaveLength(0);

    const [record] = await db.select().from(payment).where(eq(payment.orderId, row.id));
    expect(record.status).toBe("failed");
    expect(record.errorCode).toBe("amount_mismatch");
  });

  it("does not revive an order that was already released", async () => {
    const { order: row } = await place("prepaid");
    await releaseOrder(row.id, "expired", "test");

    /* A webhook arriving after expiry: the stock is already back on the shelf, so paying
       the order now would sell something we may no longer have. */
    const result = await markOrderPaid(paidInput(row.id, row.totalMinor));
    expect(result).toMatchObject({ ok: false, reason: "not_payable" });

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("expired");
  });

  it("leaves the order payable after a failed attempt", async () => {
    const { order: row } = await place("prepaid");

    await recordFailedPayment({
      orderId: row.id,
      providerOrderId: "order_test_1",
      providerPaymentId: `pay_failed_${counter++}`,
      amountMinor: row.totalMinor,
      errorCode: "BAD_REQUEST_ERROR",
      errorDescription: "Card declined",
    });

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    /* A declined card is not the end of the order — the customer reaches for another one. */
    expect(after.status).toBe("pending_payment");

    const result = await markOrderPaid(paidInput(row.id, row.totalMinor));
    expect(result.ok).toBe(true);
  });

  /* ── Releasing ────────────────────────────────────────────────────────────── */

  it("puts stock back when an order is released", async () => {
    await db.update(productVariant).set({ stockTracked: true, stockQty: 5 }).where(eq(productVariant.sku, A));
    const { order: row } = await place("prepaid", 2);
    expect(await stockOf(A)).toBe(3);

    expect(await releaseOrder(row.id, "expired", "test")).toBe(true);
    expect(await stockOf(A)).toBe(5);

    const moves = await db.select().from(inventoryMovement).where(eq(inventoryMovement.orderId, row.id));
    /* Both directions recorded: the ledger has to explain the number, not just match it. */
    expect(moves.map((m) => m.delta).sort()).toEqual([-2, 2]);
  });

  it("cannot restock the same order twice", async () => {
    await db.update(productVariant).set({ stockTracked: true, stockQty: 5 }).where(eq(productVariant.sku, A));
    const { order: row } = await place("prepaid", 2);

    expect(await releaseOrder(row.id, "expired", "first")).toBe(true);
    /* Two workers expiring the same order would otherwise inflate inventory — the
       conditional UPDATE on status is what makes the second a no-op. */
    expect(await releaseOrder(row.id, "cancelled", "second")).toBe(false);

    expect(await stockOf(A)).toBe(5); // not 7
  });

  it("does not restock an untracked SKU", async () => {
    const { order: row } = await place("prepaid");
    await releaseOrder(row.id, "expired", "test");

    const moves = await db.select().from(inventoryMovement).where(eq(inventoryMovement.orderId, row.id));
    expect(moves).toHaveLength(0);
  });

  /* ── Expiry ───────────────────────────────────────────────────────────────── */

  it("expires an unpaid prepaid order and frees its stock", async () => {
    await db.update(productVariant).set({ stockTracked: true, stockQty: 5 }).where(eq(productVariant.sku, A));
    const { order: row } = await place("prepaid", 2);

    /* Backdate it past the TTL rather than waiting half an hour. */
    await db
      .update(order)
      .set({ placedAt: new Date(Date.now() - 90 * 60_000) })
      .where(eq(order.id, row.id));

    expect(await expireStaleOrders()).toBeGreaterThanOrEqual(1);

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("expired");
    expect(await stockOf(A)).toBe(5);
  });

  it("NEVER expires a cash-on-delivery order", async () => {
    /* A COD order is legitimately unpaid for days. Sweeping it away would cancel real
       orders that are already out with a courier. It is safe because `pending_payment` is
       a status only prepaid ever holds — a property of the vocabulary, not a special
       case, because a special case is something a later change forgets. */
    const { order: row } = await place("cod");
    await db
      .update(order)
      .set({ placedAt: new Date(Date.now() - 30 * 24 * 3_600_000) })
      .where(eq(order.id, row.id));

    await expireStaleOrders();

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("confirmed");
  });

  it("leaves a young order alone", async () => {
    const { order: row } = await place("prepaid");
    await expireStaleOrders();

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("pending_payment");
  });

  it("does not expire an order that was paid", async () => {
    const { order: row } = await place("prepaid");
    await markOrderPaid(paidInput(row.id, row.totalMinor));
    await db
      .update(order)
      .set({ placedAt: new Date(Date.now() - 90 * 60_000) })
      .where(eq(order.id, row.id));

    await expireStaleOrders();

    const [after] = await db.select().from(order).where(eq(order.id, row.id));
    expect(after.status).toBe("paid");
  });

  /* ── Webhook idempotency ──────────────────────────────────────────────────── */

  it("accepts a webhook event once", async () => {
    const eventId = `test:payment.captured:${counter++}`;

    const first = await db
      .insert(webhookEvent)
      .values({ providerEventId: eventId, eventType: "payment.captured" })
      .onConflictDoNothing({ target: [webhookEvent.provider, webhookEvent.providerEventId] })
      .returning({ id: webhookEvent.id });

    const second = await db
      .insert(webhookEvent)
      .values({ providerEventId: eventId, eventType: "payment.captured" })
      .onConflictDoNothing({ target: [webhookEvent.provider, webhookEvent.providerEventId] })
      .returning({ id: webhookEvent.id });

    /* Razorpay retries until it gets a 2xx and delivers duplicates regardless. The unique
       index is what turns a replay into a no-op instead of a second state change. */
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});
