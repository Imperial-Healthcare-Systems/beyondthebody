/* The payment state machine.
 *
 * Two independent paths report that an order was paid — the browser returning from
 * Razorpay Checkout, and a webhook from Razorpay itself. Either can arrive first, both
 * can arrive, and either can be missing entirely (a closed tab; a webhook that never got
 * through). The design assumption is therefore: EVERY TRANSITION IS ATTEMPTED MORE THAN
 * ONCE, and the second attempt must be a no-op rather than a second effect.
 *
 * That is enforced in one place — `markOrderPaid` — by a conditional UPDATE that only
 * matches an order still awaiting payment. Not by checking-then-writing, which is a race,
 * and not by trusting the caller to have checked.
 *
 * The webhook is AUTHORITATIVE. The browser callback is advisory: it exists so the
 * customer sees "thank you" immediately, and nothing that costs money depends on it. */

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import {
  inventoryMovement,
  order,
  orderItem,
  payment,
  webhookEvent,
  type Order,
} from "@/db/schema";
import { logger } from "./logger";
import { queueMail, orderConfirmationEmail, newOrderNotificationEmail } from "./mail";
import { env } from "./env";
import { fetchOrderPayments, isRazorpayConfigured } from "./razorpay";
import { registerRecurringJob } from "./jobs";

/** How long an unpaid prepaid order holds its stock. Long enough for a slow UPI approval
 *  or a customer fetching their card; short enough that abandoned checkouts do not keep
 *  inventory off the shelf overnight. */
const PENDING_PAYMENT_TTL_MIN = 30;

/* ── Marking an order paid ─────────────────────────────────────────────────────── */

export type MarkPaidInput = {
  orderId: string;
  providerPaymentId: string;
  providerOrderId?: string | null;
  amountMinor: number;
  method?: string | null;
  signatureVerified: boolean;
  raw?: unknown;
  /** Which path reported it — for the log, not for the logic. */
  source: "webhook" | "callback" | "reconciliation";
};

export type MarkPaidResult =
  | { ok: true; alreadyPaid: boolean; order: Order }
  | { ok: false; reason: "not_found" | "amount_mismatch" | "not_payable" };

/**
 * Record a captured payment and move the order to `paid`.
 *
 * Idempotent by construction: the UPDATE matches only an order still in
 * `pending_payment`, so whichever path arrives second changes nothing and reports
 * `alreadyPaid`.
 */
export async function markOrderPaid(input: MarkPaidInput): Promise<MarkPaidResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(order).where(eq(order.id, input.orderId)).limit(1);
    if (!existing) return { ok: false, reason: "not_found" };

    /* The amount must match to the paisa. A payment for a different figure than the order
       is never auto-fulfilled: it is recorded, flagged, and left for a human. Under-payment
       is the obvious attack; over-payment is usually our own bug, and both need eyes. */
    if (input.amountMinor !== existing.totalMinor) {
      logger.error("payment.amount_mismatch", {
        orderNumber: existing.orderNumber,
        expectedMinor: existing.totalMinor,
        receivedMinor: input.amountMinor,
        providerPaymentId: input.providerPaymentId,
        source: input.source,
      });
      await recordPayment(tx, input, "failed", "amount_mismatch");
      return { ok: false, reason: "amount_mismatch" };
    }

    await recordPayment(tx, input, "captured");

    /* Only a pending_payment order can become paid. A cancelled or expired one must not
       be revived by a late webhook — its stock has already gone back on the shelf. */
    const [updated] = await tx
      .update(order)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(order.id, input.orderId), eq(order.status, "pending_payment")))
      .returning();

    if (!updated) {
      /* Either it was already paid — the ordinary case when both paths arrive — or it is
         in a state that cannot be paid, which is worth knowing about. */
      const alreadyPaid = existing.status === "paid";
      if (!alreadyPaid) {
        logger.warn("payment.not_payable", {
          orderNumber: existing.orderNumber,
          status: existing.status,
          source: input.source,
        });
        return { ok: false, reason: "not_payable" };
      }
      return { ok: true, alreadyPaid: true, order: existing };
    }

    /* Queued in the same transaction as the transition — the outbox again. The customer
       is told once, by whichever path won the race, and never twice. */
    const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, updated.id));
    const statusUrl = `${env.APP_URL}/order/${updated.accessToken}`;
    await queueMail({ to: updated.email, ...orderConfirmationEmail(updated, items, statusUrl) }, tx);
    await queueMail({ to: ordersInbox(), ...newOrderNotificationEmail(updated, items) }, tx);

    logger.info("order.paid", {
      orderNumber: updated.orderNumber,
      totalMinor: updated.totalMinor,
      method: input.method,
      source: input.source,
    });

    return { ok: true, alreadyPaid: false, order: updated };
  });
}

function ordersInbox(): string {
  if (env.ORDERS_EMAIL) return env.ORDERS_EMAIL;
  const match = env.MAIL_FROM.match(/<([^>]+)>/);
  return match ? match[1] : env.MAIL_FROM;
}

/** Upsert the payment row. The unique index on the provider's payment id is what makes a
 *  replay land on the same row instead of creating a second one. */
async function recordPayment(
  tx: Executor,
  input: MarkPaidInput,
  status: "captured" | "failed",
  errorCode?: string
) {
  await tx
    .insert(payment)
    .values({
      orderId: input.orderId,
      providerOrderId: input.providerOrderId ?? null,
      providerPaymentId: input.providerPaymentId,
      status,
      amountMinor: input.amountMinor,
      method: input.method ?? null,
      signatureVerified: input.signatureVerified,
      errorCode: errorCode ?? null,
      raw: (input.raw ?? null) as object | null,
    })
    .onConflictDoUpdate({
      target: payment.providerPaymentId,
      set: {
        status,
        method: input.method ?? null,
        /* Never downgrade a verified record to unverified: a later unsigned report about
           a payment we already checked ourselves must not erase that we checked it. */
        signatureVerified: sql`${payment.signatureVerified} or ${input.signatureVerified}`,
        raw: (input.raw ?? null) as object | null,
        updatedAt: new Date(),
      },
    });
}

/** Record a failed attempt without touching the order. A customer whose card is declined
 *  must be able to try again, so the order stays payable. */
export async function recordFailedPayment(input: {
  orderId: string;
  providerOrderId?: string | null;
  providerPaymentId: string;
  amountMinor: number;
  method?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  raw?: unknown;
}) {
  await db
    .insert(payment)
    .values({
      orderId: input.orderId,
      providerOrderId: input.providerOrderId ?? null,
      providerPaymentId: input.providerPaymentId,
      status: "failed",
      amountMinor: input.amountMinor,
      method: input.method ?? null,
      errorCode: input.errorCode ?? null,
      errorDescription: input.errorDescription ?? null,
      raw: (input.raw ?? null) as object | null,
    })
    .onConflictDoNothing({ target: payment.providerPaymentId });

  logger.warn("payment.failed", {
    orderId: input.orderId,
    code: input.errorCode,
    description: input.errorDescription,
  });
}

/* ── Releasing an order ────────────────────────────────────────────────────────── */

/**
 * Cancel or expire an order and put its stock back.
 *
 * The stock restore is conditional on the order actually leaving a live state, in the
 * same statement — so two callers racing to expire the same order cannot both restock it
 * and inflate inventory.
 */
export async function releaseOrder(
  orderId: string,
  to: "cancelled" | "expired",
  reason: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [released] = await tx
      .update(order)
      .set({
        status: to,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        notes: sql`coalesce(${order.notes} || ' · ', '') || ${reason}`,
      })
      /* Only from a state that is holding stock and has taken no money. */
      .where(and(eq(order.id, orderId), sql`${order.status} in ('pending_payment', 'confirmed')`))
      .returning();

    if (!released) return false;

    const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, orderId));

    for (const item of items) {
      /* Mirror of the decrement in placeOrder: only tracked SKUs move, so the ledger's
         sum and stock_qty stay reconcilable. */
      const restored = await tx.execute(sql`
        update product_variant
           set stock_qty = stock_qty + ${item.qty}
         where sku = ${item.sku} and stock_tracked
        returning sku
      `);

      if (restored.rows.length > 0) {
        await tx.insert(inventoryMovement).values({
          sku: item.sku,
          delta: item.qty,
          reason: to === "expired" ? "order_expired" : "order_cancelled",
          orderId,
        });
      }
    }

    logger.info("order.released", { orderId, to, reason, lines: items.length });
    return true;
  });
}

/* ── Background work ───────────────────────────────────────────────────────────── */

/**
 * Expire prepaid orders nobody paid for, and put the stock back.
 *
 * The filter is `status = 'pending_payment'`, which ONLY a prepaid order ever has. That
 * is what keeps a COD order — legitimately unpaid, and confirmed — from being swept away
 * by this job. It is a property of the status vocabulary rather than a special case, and
 * that is deliberate: a special case is something a later change can forget.
 */
export async function expireStaleOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MIN * 60_000);

  const stale = await db
    .select({ id: order.id })
    .from(order)
    .where(and(eq(order.status, "pending_payment"), lt(order.placedAt, cutoff)))
    .limit(100);

  let expired = 0;
  for (const row of stale) {
    if (await releaseOrder(row.id, "expired", "payment not completed")) expired += 1;
  }

  if (expired > 0) logger.info("orders.expired", { count: expired });
  return expired;
}

/**
 * The safety net for a webhook that never arrived.
 *
 * Without this, a customer whose payment succeeded but whose webhook was lost has taken
 * money out of their account for an order that reads unpaid — and nobody would know until
 * they wrote in. Asks Razorpay directly about anything still pending.
 */
export async function reconcilePendingPayments(): Promise<number> {
  if (!isRazorpayConfigured()) return 0;

  /* Old enough that a webhook would normally have arrived, young enough not to have been
     expired yet. */
  const from = new Date(Date.now() - PENDING_PAYMENT_TTL_MIN * 60_000);
  const to = new Date(Date.now() - 3 * 60_000);

  const pending = await db
    .select({ orderId: payment.orderId, providerOrderId: payment.providerOrderId })
    .from(payment)
    .innerJoin(order, eq(order.id, payment.orderId))
    .where(
      and(
        eq(order.status, "pending_payment"),
        lt(order.placedAt, to),
        sql`${order.placedAt} > ${from}`,
        sql`${payment.providerOrderId} is not null`
      )
    )
    .limit(25);

  let recovered = 0;

  for (const row of pending) {
    if (!row.providerOrderId) continue;
    try {
      const attempts = await fetchOrderPayments(row.providerOrderId);
      const captured = attempts.find((p) => p.status === "captured");
      if (!captured) continue;

      const result = await markOrderPaid({
        orderId: row.orderId,
        providerOrderId: row.providerOrderId,
        providerPaymentId: captured.id,
        amountMinor: captured.amount,
        method: captured.method ?? null,
        /* Not signature-verified, and honestly recorded as such — but it came from asking
           Razorpay directly over an authenticated connection, which is stronger evidence
           than a signature on something a browser handed us. */
        signatureVerified: false,
        raw: captured,
        source: "reconciliation",
      });

      if (result.ok && !result.alreadyPaid) {
        recovered += 1;
        logger.warn("payment.recovered_by_reconciliation", {
          orderId: row.orderId,
          detail: "Payment succeeded but no webhook arrived. Check the Razorpay webhook configuration.",
        });
      }
    } catch (err) {
      logger.error("payment.reconcile_failed", { err, orderId: row.orderId });
    }
  }

  return recovered;
}

/** Sweep webhook rows we accepted but never finished processing. Visibility only — the
 *  reconciliation job above is what actually repairs the state. */
export async function unprocessedWebhookCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(webhookEvent)
    .where(isNull(webhookEvent.processedAt));
  return Number(row?.n ?? 0);
}

export function registerPaymentJobs() {
  registerRecurringJob("orders:expire", 5 * 60, async () => {
    await expireStaleOrders();
  });

  registerRecurringJob("payments:reconcile", 10 * 60, async () => {
    await reconcilePendingPayments();
  });
}

export { PENDING_PAYMENT_TTL_MIN };
