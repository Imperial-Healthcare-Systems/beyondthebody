/* Running an order after it exists, against a real Postgres.
 *
 * The stakes here are inventory and cash. A cancellation that forgets to restock loses a
 * sale that could have been made; one that restocks twice sells a bottle that does not
 * exist. Marking cash collected twice would double the day's takings on paper. All three
 * are properties of transactions and conditional updates, which is why they are tested
 * against the database rather than a mock. */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { inventoryMovement, job, order, orderItem, productVariant } from "@/db/schema";
import type { Address } from "@/lib/address";
import { seedVariants } from "@/lib/catalogue";
import {
  canTransition,
  markCodCollected,
  transitionOrder,
  undoOrderStatus,
  listOrders,
  orderCounts,
} from "@/lib/fulfilment";
import { auditInventory } from "@/lib/inventory";
import { placeOrder } from "@/lib/orders";
import { __clearSettingsCache, setSetting } from "@/lib/settings";

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

const EMAIL = "fulfilment-test@beyondthebody.invalid";
const SKU = "MA-100";

/* The COD rate limit is three orders per phone per day and these tests place several, so
   each fixture gets its own number. */
const phone = () => `98765${String(Math.floor(Math.random() * 100_000)).padStart(5, "0")}`;

const ACTOR = { id: "00000000-0000-4000-8000-0000000000f7", email: "owner@beyondthebody.invalid" };

async function stock(sku = SKU) {
  const [row] = await db
    .select({ qty: productVariant.stockQty })
    .from(productVariant)
    .where(eq(productVariant.sku, sku));
  return row!.qty;
}

async function movements(orderId: string) {
  return db.select().from(inventoryMovement).where(eq(inventoryMovement.orderId, orderId));
}

/** A COD order for one unit of a stock-tracked SKU, already at `confirmed`. */
async function placeTracked(qty = 1) {
  const placed = await placeOrder({
    items: [{ sku: SKU, qty }],
    email: EMAIL,
    phone: phone(),
    paymentMethod: "cod",
    shippingAddress: ADDRESS,
  });
  return placed.order;
}

async function cleanup() {
  const rows = await db.select({ id: order.id }).from(order).where(like(order.email, "%beyondthebody.invalid"));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(inventoryMovement).where(inArray(inventoryMovement.orderId, ids));
    await db.delete(order).where(inArray(order.id, ids)); // items cascade
  }
  await db
    .delete(job)
    .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' like '%beyondthebody.invalid'`));
}

describe.skipIf(!hasDb)("phase 7 · running an order", () => {
  beforeEach(async () => {
    await seedVariants();
    await cleanup();
    /* Ten in stock and genuinely counted, because everything below is about the count. */
    await db
      .update(productVariant)
      .set({ priceMinor: 189_900, status: "active", stockQty: 10, stockTracked: true })
      .where(eq(productVariant.sku, SKU));

    await setSetting("store_open", true);
    await setSetting("cod_enabled", true);
    await setSetting("cod_fee_minor", 0);
    __clearSettingsCache();
  });

  afterAll(async () => {
    await cleanup();
    await db
      .update(productVariant)
      .set({ stockQty: 0, stockTracked: false })
      .where(eq(productVariant.sku, SKU));
    await closeDb();
  });

  /* ── Moving through the states ───────────────────────────────────────────────── */

  it("walks a cash order from confirmed to delivered", async () => {
    const placed = await placeTracked();
    expect(placed.status).toBe("confirmed");

    await transitionOrder(placed.id, "processing", ACTOR);
    const shipped = await transitionOrder(placed.id, "shipped", ACTOR, {
      courier: "Delhivery",
      trackingNumber: "TRK-123",
    });

    expect(shipped.status).toBe("shipped");
    expect(shipped.shippedAt).toBeInstanceOf(Date);
    expect(shipped.courier).toBe("Delhivery");

    const delivered = await transitionOrder(placed.id, "delivered", ACTOR);
    expect(delivered.deliveredAt).toBeInstanceOf(Date);

    /* Nine of ten, and it stays nine: a delivered order is a sale. */
    expect(await stock()).toBe(9);
    expect(await movements(placed.id)).toHaveLength(1);
  });

  it("refuses a move the table doesn't allow", async () => {
    const placed = await placeTracked();
    /* confirmed → shipped became legal on 2026-08-12 (the house packs and hands over in
       one go), so this case now uses a move that is still genuinely impossible: a parcel
       cannot come back before it has gone out. */
    expect(canTransition("confirmed", "rto_returned")).toBe(false);

    await expect(transitionOrder(placed.id, "rto_returned", ACTOR)).rejects.toThrow(
      /can't be marked/i
    );

    /* And the refusal changed nothing. */
    const [row] = await db.select().from(order).where(eq(order.id, placed.id));
    expect(row!.status).toBe("confirmed");
    expect(row!.shippedAt).toBeNull();
  });

  it("takes back a delivery that was marked by mistake", async () => {
    /* THE case this exists for: `delivered` sits next to `came back to us` in a row of
       buttons, and before 2026-08-12 pressing the wrong one left the order stuck delivered
       for good. */
    const placed = await placeTracked();
    await transitionOrder(placed.id, "shipped", ACTOR, { trackingNumber: "TRK-UNDO" });
    const delivered = await transitionOrder(placed.id, "delivered", ACTOR);
    expect(delivered.deliveredAt).toBeInstanceOf(Date);

    const back = await undoOrderStatus(placed.id, "shipped", ACTOR, { note: "wrong row" });

    expect(back.status).toBe("shipped");
    /* The stamp goes with the status. A delivery date left on an undelivered parcel would
       show the customer a date for something still in transit. */
    expect(back.deliveredAt).toBeNull();
    /* But the parcel really did ship, so that stamp and its tracking stay. */
    expect(back.shippedAt).toBeInstanceOf(Date);
    expect(back.trackingNumber).toBe("TRK-UNDO");
    expect(back.notes).toMatch(/wrong row/);
  });

  it("moves no stock when a status is corrected", async () => {
    const placed = await placeTracked();
    const before = await stock();

    await transitionOrder(placed.id, "shipped", ACTOR);
    await transitionOrder(placed.id, "delivered", ACTOR);
    await undoOrderStatus(placed.id, "shipped", ACTOR);
    await undoOrderStatus(placed.id, "processing", ACTOR);

    /* An undo is a correction to a record, not an event in the warehouse. */
    expect(await stock()).toBe(before);
    expect(await movements(placed.id)).toHaveLength(1);
  });

  it("re-arms the tracking email if a shipment is undone and really ships later", async () => {
    /* Counted the same way the email test below does — one query shape for "mail queued to
       this customer", rather than two that could drift apart. */
    const mailTo = async (email: string) =>
      (
        await db
          .select()
          .from(job)
          .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${email}`))
      ).length;

    const placed = await placeTracked();
    await transitionOrder(placed.id, "shipped", ACTOR);
    const afterFirst = await mailTo(placed.email);

    await undoOrderStatus(placed.id, "processing", ACTOR);
    await transitionOrder(placed.id, "shipped", ACTOR);

    /* Undoing clears shipped_at, so the second departure is a genuine first arrival as far
       as the customer is concerned, and they are told about it. */
    expect(await mailTo(placed.email)).toBe(afterFirst + 1);
  });

  it("refuses to undo out of a status that already restocked", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "cancelled", ACTOR);

    /* Reversing a restock could oversell, so there is deliberately no way back. */
    await expect(undoOrderStatus(placed.id, "processing", ACTOR)).rejects.toThrow(
      /can't be put back/i
    );
  });

  it("emails the customer when the parcel goes out, and only then", async () => {
    const placed = await placeTracked();

    const before = await db
      .select()
      .from(job)
      .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${placed.email}`));

    await transitionOrder(placed.id, "processing", ACTOR);

    const midway = await db
      .select()
      .from(job)
      .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${placed.email}`));
    expect(midway).toHaveLength(before.length);

    await transitionOrder(placed.id, "shipped", ACTOR, { trackingNumber: "TRK-9" });

    const after = await db
      .select()
      .from(job)
      .where(and(eq(job.kind, "mail:send"), sql`${job.payload}->>'to' = ${placed.email}`));
    expect(after).toHaveLength(before.length + 1);
  });

  /* ── Stock coming back ───────────────────────────────────────────────────────── */

  it("puts the stock back when an order is cancelled", async () => {
    const placed = await placeTracked(2);
    expect(await stock()).toBe(8);

    await transitionOrder(placed.id, "cancelled", ACTOR, { note: "customer changed their mind" });

    expect(await stock()).toBe(10);
    const ledger = await movements(placed.id);
    expect(ledger.map((m) => m.delta).sort()).toEqual([-2, 2]);
    expect(ledger.find((m) => m.delta > 0)!.reason).toBe("order_cancelled");
    expect(ledger.find((m) => m.delta > 0)!.actor).toBe(ACTOR.email);
  });

  it("puts the stock back when a parcel comes home", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "processing", ACTOR);
    await transitionOrder(placed.id, "shipped", ACTOR);
    expect(await stock()).toBe(9);

    await transitionOrder(placed.id, "rto_returned", ACTOR);

    expect(await stock()).toBe(10);
    expect((await movements(placed.id)).find((m) => m.delta > 0)!.reason).toBe("rto_returned");
  });

  it("restocks once when two people cancel the same order at once", async () => {
    const placed = await placeTracked(3);
    expect(await stock()).toBe(7);

    /* The conditional update on the prior status is the whole defence: both callers pass
       the read, and exactly one may apply the effects. */
    const results = await Promise.allSettled([
      transitionOrder(placed.id, "cancelled", ACTOR),
      transitionOrder(placed.id, "cancelled", ACTOR),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stock()).toBe(10);
    expect((await movements(placed.id)).filter((m) => m.delta > 0)).toHaveLength(1);
  });

  /* ── Cash ────────────────────────────────────────────────────────────────────── */

  it("records cash without pretending to know where the parcel is", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "processing", ACTOR);

    const count = await markCodCollected([placed.id], ACTOR);
    expect(count).toBe(1);

    const [row] = await db.select().from(order).where(eq(order.id, placed.id));
    expect(row!.paidAt).toBeInstanceOf(Date);
    expect(row!.status).toBe("processing"); // unchanged, deliberately
  });

  it("counts a second collection of the same order as nothing", async () => {
    const placed = await placeTracked();
    expect(await markCodCollected([placed.id], ACTOR)).toBe(1);
    expect(await markCodCollected([placed.id], ACTOR)).toBe(0);
  });

  it("never records cash for an order that was cancelled", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "cancelled", ACTOR);

    expect(await markCodCollected([placed.id], ACTOR)).toBe(0);
    const [row] = await db.select().from(order).where(eq(order.id, placed.id));
    expect(row!.paidAt).toBeNull();
  });

  it("collects a courier's whole batch in one call", async () => {
    const a = await placeTracked();
    const b = await placeTracked();
    const c = await placeTracked();
    await transitionOrder(c.id, "cancelled", ACTOR);

    /* Three asked for, one of them ineligible — the count is what actually moved. */
    expect(await markCodCollected([a.id, b.id, c.id], ACTOR)).toBe(2);
  });

  /* ── Reading ─────────────────────────────────────────────────────────────────── */

  it("shows the work first and finds an order by any handle", async () => {
    const placed = await placeTracked();

    const worklist = await listOrders();
    expect(worklist.map((o) => o.id)).toContain(placed.id);

    await transitionOrder(placed.id, "processing", ACTOR);
    await transitionOrder(placed.id, "shipped", ACTOR, { trackingNumber: "FINDME-42" });

    /* Shipped is somebody else's problem now, so it leaves the worklist… */
    const after = await listOrders();
    expect(after.map((o) => o.id)).not.toContain(placed.id);

    /* …but is still findable by the things a person has to hand. */
    for (const q of [placed.orderNumber, placed.phone, "FINDME-42"]) {
      const found = await listOrders({ status: "all", q });
      expect(found.map((o) => o.id), `searching ${q}`).toContain(placed.id);
    }
  });

  it("counts the cash the client is owed", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "processing", ACTOR);

    const before = await orderCounts();
    expect(before.awaitingCash).toBeGreaterThanOrEqual(1);
    expect(before.awaitingCashMinor).toBeGreaterThanOrEqual(placed.totalMinor);

    await markCodCollected([placed.id], ACTOR);

    const after = await orderCounts();
    expect(after.awaitingCash).toBe(before.awaitingCash - 1);
    expect(after.awaitingCashMinor).toBe(before.awaitingCashMinor - placed.totalMinor);
  });

  /* ── The audit ───────────────────────────────────────────────────────────────── */

  it("finds no drift when the ledger has been kept honestly", async () => {
    const sold = await placeTracked(2);
    const returned = await placeTracked();
    await transitionOrder(returned.id, "cancelled", ACTOR);

    const result = await auditInventory();
    const ours = result.drift.filter((d) => d.orderId === sold.id || d.orderId === returned.id);

    expect(ours).toEqual([]);
    expect(result.negative).toEqual([]);
  });

  it("notices a sale the ledger never recorded", async () => {
    const placed = await placeTracked();

    /* Exactly the shape of the bug worth catching: the counter moved, the ledger did not.
       Deleting the row is how that looks after the fact. */
    await db.delete(inventoryMovement).where(eq(inventoryMovement.orderId, placed.id));

    const result = await auditInventory();
    const drift = result.drift.find((d) => d.orderId === placed.id);

    expect(drift).toBeDefined();
    expect(drift!.expected).toBe(-1);
    expect(drift!.net).toBe(0);
  });

  it("notices stock given back twice", async () => {
    const placed = await placeTracked();
    await transitionOrder(placed.id, "cancelled", ACTOR);

    /* A second restock, as a lost retry would have written it. */
    const [item] = await db.select().from(orderItem).where(eq(orderItem.orderId, placed.id));
    await db.insert(inventoryMovement).values({
      sku: item!.sku,
      delta: item!.qty,
      reason: "order_cancelled",
      orderId: placed.id,
    });

    const drift = (await auditInventory()).drift.find((d) => d.orderId === placed.id);
    expect(drift).toBeDefined();
    expect(drift!.net).toBe(1);
    expect(drift!.expected).toBe(0);
  });
});
