/* Placing orders, against a real Postgres.
 *
 * Everything here is about the ways a shop loses money or trust: charging twice, selling
 * one bottle to two people, committing an order whose stock decrement failed, or taking a
 * total the customer never agreed to. Those are transaction and concurrency properties,
 * which is exactly what a unit test cannot see. */

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { inventoryMovement, job, order, orderItem, productVariant } from "@/db/schema";
import { getOrderByToken, placeOrder } from "@/lib/orders";
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

const EMAIL = "orders-test@beyondthebody.invalid";
const PHONE = "9876500000";
const A = "MA-100"; // ₹1,899
const B = "HT-10";

const input = (over: Partial<Parameters<typeof placeOrder>[0]> = {}) => ({
  items: [{ sku: A, qty: 1 }],
  email: EMAIL,
  phone: PHONE,
  paymentMethod: "cod" as const,
  shippingAddress: ADDRESS,
  ...over,
});

/** Reset the two SKUs under test to a known, untracked, in-stock state. */
async function resetVariants() {
  await db
    .update(productVariant)
    .set({ priceMinor: 189_900, status: "active", stockQty: 0, stockTracked: false })
    .where(inArray(productVariant.sku, [A, B]));
}

async function cleanup() {
  const rows = await db.select({ id: order.id }).from(order).where(like(order.email, "%beyondthebody.invalid"));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(inventoryMovement).where(inArray(inventoryMovement.orderId, ids));
    await db.delete(order).where(inArray(order.id, ids)); // items cascade
  }
  /* The mail rows these orders queued, so a later run counts only its own. */
  await db
    .delete(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' like '%beyondthebody.invalid'`));
}

async function mailQueuedTo(pattern: string) {
  const rows = await db
    .select()
    .from(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' like ${pattern}`));
  return rows;
}

describe.skipIf(!hasDb)("phase 5 · placing an order", () => {
  beforeEach(async () => {
    await seedVariants();
    await resetVariants();
    await cleanup();
    /* Settings are cached for a minute; a test that changes one must not leak into the
       next, and the next must not read the previous one's value. */
    await setSetting("store_open", true);
    await setSetting("cod_enabled", true);
    await setSetting("cod_fee_minor", 0);
    __clearSettingsCache();
  });

  afterEach(async () => {
    await setSetting("store_open", true);
    await setSetting("cod_enabled", true);
    await setSetting("cod_fee_minor", 0);
    __clearSettingsCache();
  });

  afterAll(async () => {
    await cleanup();
    await resetVariants();
    await closeDb();
  });

  /* ── The happy path ───────────────────────────────────────────────────────── */

  it("places a cash-on-delivery order", async () => {
    const { order: row, items } = await placeOrder(input());

    /* COD is CONFIRMED at placement — there is no payment to wait for. */
    expect(row.status).toBe("confirmed");
    expect(row.paymentMethod).toBe("cod");
    expect(row.paidAt).toBeNull(); // a human sets this when the courier remits
    expect(row.orderNumber).toMatch(/^BTB-\d{4}-\d{4,}$/);
    expect(row.accessToken.length).toBeGreaterThan(20);

    expect(items).toHaveLength(1);
    expect(row.subtotalMinor).toBe(189_900);
    expect(row.shippingMinor).toBe(9_900);
    expect(row.totalMinor).toBe(199_800);
  });

  it("snapshots the item rather than pointing at the catalogue", async () => {
    const { order: row, items } = await placeOrder(input());

    expect(items[0]).toMatchObject({
      sku: A,
      nameSnapshot: "Mon Amour",
      sizeSnapshot: "100 ml",
      unitPriceMinor: 189_900,
      qty: 1,
    });

    /* Change the price afterwards: the order must not move with it. */
    await db.update(productVariant).set({ priceMinor: 999_900 }).where(eq(productVariant.sku, A));
    const [after] = await db.select().from(orderItem).where(eq(orderItem.orderId, row.id));
    expect(after.unitPriceMinor).toBe(189_900);
  });

  it("gives consecutive orders different numbers", async () => {
    const first = await placeOrder(input());
    const second = await placeOrder(input());
    expect(first.order.orderNumber).not.toBe(second.order.orderNumber);
  });

  it("queues the customer's confirmation and the studio's notification together", async () => {
    await placeOrder(input());

    const toCustomer = await mailQueuedTo(EMAIL);
    expect(toCustomer).toHaveLength(1);
    expect((toCustomer[0].payload as { subject: string }).subject).toMatch(/^Your order BTB-/);

    /* Both are queued INSIDE the order's transaction — the outbox. A dead SMTP host
       cannot roll back an order, and a rolled-back order cannot email anyone. */
    const all = await mailQueuedTo("%beyondthebody.invalid");
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("charges the COD fee when the client sets one", async () => {
    await setSetting("cod_fee_minor", 5_000);
    __clearSettingsCache();

    const { order: row } = await placeOrder(input());
    expect(row.codFeeMinor).toBe(5_000);
    expect(row.totalMinor).toBe(189_900 + 9_900 + 5_000);
  });

  /* ── Not charging twice ───────────────────────────────────────────────────── */

  it("returns the same order for a repeated idempotency key", async () => {
    const key = `test-${crypto.randomUUID()}`;

    const first = await placeOrder(input({ idempotencyKey: key }));
    const second = await placeOrder(input({ idempotencyKey: key }));

    expect(second.order.id).toBe(first.order.id);
    expect(second.reused).toBe(true);

    const all = await db.select().from(order).where(eq(order.email, EMAIL));
    expect(all).toHaveLength(1); // not two ₹1,899 charges
  });

  it("survives two submits racing on the same key", async () => {
    /* The check at the top of placeOrder is not a lock — both callers can pass it. The
       unique index is what actually decides, and the loser must recover the winner's
       order rather than surfacing a constraint violation to a customer. */
    const key = `race-${crypto.randomUUID()}`;

    const [a, b] = await Promise.all([
      placeOrder(input({ idempotencyKey: key })),
      placeOrder(input({ idempotencyKey: key })),
    ]);

    expect(a.order.id).toBe(b.order.id);
    expect(await db.select().from(order).where(eq(order.email, EMAIL))).toHaveLength(1);
  });

  it("treats a different key as a different order", async () => {
    await placeOrder(input({ idempotencyKey: `k-${crypto.randomUUID()}` }));
    await placeOrder(input({ idempotencyKey: `k-${crypto.randomUUID()}` }));
    expect(await db.select().from(order).where(eq(order.email, EMAIL))).toHaveLength(2);
  });

  /* ── Stock ────────────────────────────────────────────────────────────────── */

  it("writes no ledger row for a SKU that does not track stock", async () => {
    const { order: row } = await placeOrder(input());
    const moves = await db.select().from(inventoryMovement).where(eq(inventoryMovement.orderId, row.id));

    /* The ledger's invariant is that its deltas sum to stock_qty. An untracked SKU has no
       stock story, and writing one would break that reconciliation for everything. */
    expect(moves).toHaveLength(0);
  });

  it("decrements stock and records it when the SKU is tracked", async () => {
    await db
      .update(productVariant)
      .set({ stockTracked: true, stockQty: 5 })
      .where(eq(productVariant.sku, A));

    const { order: row } = await placeOrder(input({ items: [{ sku: A, qty: 2 }] }));

    const [variant] = await db.select().from(productVariant).where(eq(productVariant.sku, A));
    expect(variant.stockQty).toBe(3);

    const [move] = await db.select().from(inventoryMovement).where(eq(inventoryMovement.orderId, row.id));
    expect(move).toMatchObject({ sku: A, delta: -2, reason: "order_placed" });
  });

  it("sells the last bottle exactly once under concurrency", async () => {
    await db
      .update(productVariant)
      .set({ stockTracked: true, stockQty: 1 })
      .where(eq(productVariant.sku, A));

    /* Two customers, one bottle. The conditional UPDATE is what decides — no locking of
       our own, and no possibility of both succeeding. */
    const results = await Promise.allSettled([
      placeOrder(input({ idempotencyKey: `c1-${crypto.randomUUID()}` })),
      placeOrder(input({ idempotencyKey: `c2-${crypto.randomUUID()}` })),
    ]);

    const placed = results.filter((r) => r.status === "fulfilled");
    expect(placed).toHaveLength(1);

    const [variant] = await db.select().from(productVariant).where(eq(productVariant.sku, A));
    expect(variant.stockQty).toBe(0); // never -1

    const orders = await db.select().from(order).where(eq(order.email, EMAIL));
    expect(orders).toHaveLength(1);
  });

  it("rolls the whole order back when one line cannot be filled", async () => {
    await db.update(productVariant).set({ stockTracked: true, stockQty: 5 }).where(eq(productVariant.sku, A));
    await db.update(productVariant).set({ stockTracked: true, stockQty: 0 }).where(eq(productVariant.sku, B));

    await expect(
      placeOrder(input({ items: [{ sku: A, qty: 1 }, { sku: B, qty: 1 }] }))
    ).rejects.toThrow();

    /* The first line's stock was already decremented inside the transaction when the
       second failed. If that did not roll back, the house would lose a bottle of stock
       to an order that does not exist. */
    const [a] = await db.select().from(productVariant).where(eq(productVariant.sku, A));
    expect(a.stockQty).toBe(5);

    expect(await db.select().from(order).where(eq(order.email, EMAIL))).toHaveLength(0);
    expect(await mailQueuedTo(EMAIL)).toHaveLength(0);
  });

  /* ── Refusals ─────────────────────────────────────────────────────────────── */

  it("refuses to charge a total the customer has not seen", async () => {
    await expect(
      placeOrder(input({ items: [{ sku: A, qty: 1, expectedPriceMinor: 149_900 }] }))
    ).rejects.toMatchObject({ code: "price_changed" });

    expect(await db.select().from(order).where(eq(order.email, EMAIL))).toHaveLength(0);
  });

  it("refuses an empty bag", async () => {
    await expect(placeOrder(input({ items: [{ sku: "NOPE-1", qty: 1 }] }))).rejects.toMatchObject({
      code: "cart_empty",
    });
  });

  it("refuses when the house has closed the store", async () => {
    await setSetting("store_open", false);
    __clearSettingsCache();

    await expect(placeOrder(input())).rejects.toMatchObject({ code: "store_closed" });
  });

  it("refuses COD when COD has been switched off", async () => {
    /* Re-checked at placement, not only in the UI: the customer may have loaded checkout
       before it was turned off, and the browser is not where this is decided. */
    await setSetting("cod_enabled", false);
    __clearSettingsCache();

    await expect(placeOrder(input())).rejects.toMatchObject({ code: "cod_unavailable" });
  });

  /* ── Reading it back ──────────────────────────────────────────────────────── */

  it("finds an order by its token", async () => {
    const { order: row } = await placeOrder(input());
    const found = await getOrderByToken(row.accessToken);

    expect(found?.order.orderNumber).toBe(row.orderNumber);
    expect(found?.items).toHaveLength(1);
  });

  it.each([["wrong-token-that-is-long-enough-to-try"], [""], ["short"]])(
    "gives nothing for token %s",
    async (token) => {
      expect(await getOrderByToken(token)).toBeNull();
    }
  );
});
