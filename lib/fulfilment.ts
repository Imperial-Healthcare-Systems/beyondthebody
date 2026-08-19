/* Running the business — the operations a human performs on an order after it exists.
 *
 * The centre of this file is ALLOWED_TRANSITIONS. Every order movement goes through one
 * function that consults it, rather than each admin button deciding for itself what is
 * legal. That matters because the illegal moves are the expensive ones: shipping a
 * cancelled order, restocking the same RTO twice, cancelling something already delivered.
 * A table of what may follow what is a thing a person can read and check; a dozen
 * scattered `if (status === ...)` checks is not.
 *
 * Everything here is owner-only and audited. These are the actions that move money and
 * inventory, and "who marked this collected?" must have an answer months later. */

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { order, orderItem, payment, refund, type Order } from "@/db/schema";
import { audit } from "./audit";
import type { AdminUser } from "./auth";
import { AppError, ErrorCode } from "./errors";
import { env } from "./env";
import { logger } from "./logger";
import { orderShippedEmail, queueMail } from "./mail";
import { restockOrderItems } from "./payments";
import { createRefund, isRazorpayConfigured } from "./razorpay";

export type OrderStatus = Order["status"];

/**
 * What may follow what.
 *
 * `pending_payment` and `paid` belong to prepaid; `confirmed` to COD. Both converge on
 * `processing` — from there the two are the same parcel and the same work.
 *
 * `rto_returned` is reachable only from `shipped`, because a parcel cannot come back
 * before it goes out. It is a routine outcome of Indian cash on delivery, not an error
 * state, and it restores stock exactly as a cancellation does.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["cancelled", "expired"],
  /* `shipped` direct from paid/confirmed (2026-08-12): the house packs and hands over in
     one sitting, and requiring "start packing" first made the common case two clicks and
     two page loads. `processing` remains for the day a parcel is packed but not collected —
     it is a real state, just not a mandatory one. */
  paid: ["processing", "shipped", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "rto_returned"],
  /* Not terminal any more (2026-08-12). `delivered` is a human's assertion about the
     physical world, made by pressing a button next to another button, and there was no way
     back from a misclick — the order was stuck delivered forever. See UNDO_TRANSITIONS:
     the way back is a separate, explicitly-labelled move, not a forward one. */
  delivered: [],
  cancelled: [],
  refunded: [],
  failed: [],
  expired: [],
  rto_returned: [],
};

/**
 * Corrections — moves BACKWARD, for when the wrong button was pressed.
 *
 * Deliberately a second table rather than extra entries in the first. They are different
 * kinds of act: a forward transition asserts something happened in the world, an undo
 * asserts the previous assertion was a mistake. Keeping them apart means the admin can
 * label them differently, confirm them differently, and audit them under their own action
 * name — and it means a correction can never be reached by accident from the normal row of
 * buttons, which is how the original misclick happened.
 *
 * Only ever one step back, and only while the order is still live. Undoing all the way out
 * of a cancellation or an RTO is NOT here: both put stock back, so reversing them means
 * taking stock out again and possibly overselling. Those are re-orders, not undos.
 */
export const UNDO_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  delivered: ["shipped"],
  shipped: ["processing"],
  processing: ["paid", "confirmed"],
};

/** Which undos are legal for this order, given how it was paid for. */
export function undosFor(row: Pick<Order, "status" | "paymentMethod">): OrderStatus[] {
  const candidates = UNDO_TRANSITIONS[row.status] ?? [];
  /* `processing` came from `paid` on a prepaid order and `confirmed` on a COD one; offering
     both would let a COD order be walked into a prepaid-only status. */
  return candidates.filter((to) => {
    if (to === "paid") return row.paymentMethod === "prepaid";
    if (to === "confirmed") return row.paymentMethod === "cod";
    return true;
  });
}

export function canUndo(row: Pick<Order, "status" | "paymentMethod">, to: OrderStatus): boolean {
  return undosFor(row).includes(to);
}

/** Statuses whose stock is still committed — moving OUT of one puts the items back. */
const HOLDS_STOCK: OrderStatus[] = ["pending_payment", "paid", "confirmed", "processing", "shipped"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/* ── Moving an order ───────────────────────────────────────────────────────────── */

export type TransitionOptions = {
  courier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  note?: string | null;
};

/**
 * Move an order to a new status, with whatever that implies.
 *
 * The status change is a CONDITIONAL update on the current status, so two people pressing
 * the same button at once cannot both apply the effects — the second finds nothing to
 * update and is told the order already moved. Stock restoration, emails and the audit row
 * all happen in that same transaction.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: Pick<AdminUser, "id" | "email">,
  opts: TransitionOptions = {}
): Promise<Order> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(order).where(eq(order.id, orderId)).limit(1);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND, "No such order.");

    if (!canTransition(before.status, to)) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `An order that is ${readable(before.status)} can't be marked ${readable(to)}.`,
        { logContext: { orderId, from: before.status, to } }
      );
    }

    const now = new Date();
    const [moved] = await tx
      .update(order)
      .set({
        status: to,
        updatedAt: now,
        ...(to === "shipped" && { shippedAt: now }),
        ...(to === "delivered" && { deliveredAt: now }),
        ...(to === "cancelled" && { cancelledAt: now }),
        ...(opts.courier !== undefined && { courier: opts.courier }),
        ...(opts.trackingNumber !== undefined && { trackingNumber: opts.trackingNumber }),
        ...(opts.trackingUrl !== undefined && { trackingUrl: opts.trackingUrl }),
        ...(opts.note
          ? { notes: sql`coalesce(${order.notes} || ' · ', '') || ${opts.note}` }
          : {}),
      })
      /* The guard, not the check above: two admins clicking at once both pass the read,
         and only one may apply the effects. */
      .where(and(eq(order.id, orderId), eq(order.status, before.status)))
      .returning();

    if (!moved) {
      throw new AppError(ErrorCode.CONFLICT, "That order just changed. Reload and try again.");
    }

    /* Anything leaving a stock-holding status for a dead end puts the items back. */
    const unsold = (to === "cancelled" || to === "rto_returned" || to === "expired") &&
      HOLDS_STOCK.includes(before.status);

    if (unsold) {
      await restockOrderItems(
        tx,
        orderId,
        to === "rto_returned" ? "rto_returned" : to === "expired" ? "order_expired" : "order_cancelled",
        actor.email
      );
    }

    if (to === "shipped") {
      const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, orderId));
      await queueMail(
        {
          to: moved.email,
          ...orderShippedEmail(moved, items, `${env.APP_URL}/order/${moved.accessToken}`),
        },
        tx
      );
    }

    await audit({
      actor,
      action: `order.${to}`,
      entity: "order",
      entityId: orderId,
      before: { status: before.status },
      after: { status: to, ...(opts.trackingNumber ? { trackingNumber: opts.trackingNumber } : {}) },
      exec: tx,
    });

    logger.info("order.transitioned", {
      orderNumber: moved.orderNumber,
      from: before.status,
      to,
      restocked: unsold,
      by: actor.email,
    });

    return moved;
  });
}

/**
 * Undo the last status move, because the wrong button was pressed.
 *
 * Separate from transitionOrder rather than an extra edge in it, and the differences are
 * the reason:
 *   · it consults UNDO_TRANSITIONS, so a correction can never be reached from the ordinary
 *     row of forward buttons — which is how the misclick happened in the first place;
 *   · it CLEARS the timestamp the undone status set. Leaving `delivered_at` on an order
 *     that is no longer delivered would put a delivery date in front of the customer for a
 *     parcel still in transit, and would quietly corrupt any future report that counts
 *     deliveries by date;
 *   · it sends nothing. The customer was already told the parcel shipped; telling them it
 *     un-delivered is noise about a mistake that was ours.
 *
 * No stock moves. None of the undo edges cross the restock boundary — that only happens on
 * the way into cancelled/rto_returned/expired, and there is deliberately no way back out of
 * those (see UNDO_TRANSITIONS). Reversing a restock could oversell.
 *
 * Audited under its own action name so `order.undo.shipped` is distinguishable from
 * `order.shipped` months later — "was this parcel shipped twice, or corrected once?" needs
 * an answer the trail can actually give.
 */
export async function undoOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: Pick<AdminUser, "id" | "email">,
  opts: { note?: string | null } = {}
): Promise<Order> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(order).where(eq(order.id, orderId)).limit(1);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND, "No such order.");

    if (!canUndo(before, to)) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `An order that is ${readable(before.status)} can't be put back to ${readable(to)}.`,
        { logContext: { orderId, from: before.status, to } }
      );
    }

    const now = new Date();
    const [moved] = await tx
      .update(order)
      .set({
        status: to,
        updatedAt: now,
        /* Clear what the status being undone had stamped. Undoing `shipped` also clears the
           shipped date, which is what re-arms the tracking email if the parcel really does
           go out later — transitionOrder sends on the way INTO shipped, and this makes that
           a genuine first arrival again. Courier and tracking number are deliberately kept:
           they are usually still correct, and retyping them is friction for no gain. */
        ...(before.status === "delivered" && { deliveredAt: null }),
        ...(before.status === "shipped" && { shippedAt: null }),
        ...(opts.note ? { notes: sql`coalesce(${order.notes} || ' · ', '') || ${opts.note}` } : {}),
      })
      /* Same conditional guard as the forward move: two people correcting at once must not
         both apply. */
      .where(and(eq(order.id, orderId), eq(order.status, before.status)))
      .returning();

    if (!moved) {
      throw new AppError(ErrorCode.CONFLICT, "That order just changed. Reload and try again.");
    }

    await audit({
      actor,
      action: `order.undo.${before.status}`,
      entity: "order",
      entityId: orderId,
      before: { status: before.status },
      after: { status: to, corrected: true },
      exec: tx,
    });

    logger.info("order.undone", {
      orderNumber: moved.orderNumber,
      from: before.status,
      to,
      by: actor.email,
    });

    return moved;
  });
}

const READABLE: Record<string, string> = {
  pending_payment: "awaiting payment",
  paid: "paid",
  confirmed: "confirmed",
  processing: "being packed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
  failed: "failed",
  expired: "expired",
  rto_returned: "returned to us",
};
export const readable = (status: string) => READABLE[status] ?? status;

/* ── Cash collected ────────────────────────────────────────────────────────────── */

/**
 * Record that the courier handed over the money for a COD order.
 *
 * This stamps `paid_at` and does NOT change the status, and that separation is the point:
 * for cash, "paid" is a fact about money, while the status tracks where the parcel is.
 * A COD order can legitimately be delivered before the courier remits, and forcing the
 * two onto one axis would make one of them lie.
 *
 * Idempotent: marking an already-collected order collected again changes nothing, which
 * matters because the bulk action below is exactly where a double-click happens.
 */
export async function markCodCollected(
  orderIds: string[],
  actor: Pick<AdminUser, "id" | "email">
): Promise<number> {
  if (orderIds.length === 0) return 0;

  const collected = await db
    .update(order)
    .set({ paidAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        inArray(order.id, orderIds),
        eq(order.paymentMethod, "cod"),
        /* Not already collected, and not an order that was never going to be paid. */
        sql`${order.paidAt} is null`,
        sql`${order.status} not in ('cancelled', 'expired', 'failed', 'rto_returned')`
      )
    )
    .returning({ id: order.id, orderNumber: order.orderNumber, totalMinor: order.totalMinor });

  for (const row of collected) {
    await audit({
      actor,
      action: "order.cod_collected",
      entity: "order",
      entityId: row.id,
      after: { amountMinor: row.totalMinor },
    });
  }

  if (collected.length > 0) {
    logger.info("orders.cod_collected", {
      count: collected.length,
      orderNumbers: collected.map((r) => r.orderNumber),
      by: actor.email,
    });
  }

  return collected.length;
}

/* ── Refunds ───────────────────────────────────────────────────────────────────── */

/**
 * Return money for a prepaid order.
 *
 * Only for prepaid: cash never reached us, so a COD refund is a conversation and a bank
 * transfer, not an API call. Attempting one here would produce a refund record for money
 * we never held.
 */
export async function refundOrder(
  orderId: string,
  actor: Pick<AdminUser, "id" | "email">,
  opts: { amountMinor?: number; reason?: string } = {}
): Promise<{ refundId: string; amountMinor: number }> {
  if (!isRazorpayConfigured()) {
    throw new AppError(ErrorCode.PAYMENT_UNAVAILABLE, "The payment gateway isn't configured.");
  }

  const [row] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "No such order.");

  if (row.paymentMethod !== "prepaid") {
    throw new AppError(
      ErrorCode.CONFLICT,
      "This was a cash-on-delivery order — there is nothing for the gateway to return."
    );
  }

  const [captured] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.status, "captured")))
    .limit(1);

  if (!captured?.providerPaymentId) {
    throw new AppError(ErrorCode.CONFLICT, "No captured payment to refund.");
  }

  const amountMinor = opts.amountMinor ?? row.totalMinor;
  if (amountMinor <= 0 || amountMinor > captured.amountMinor) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "That refund amount isn't valid.");
  }

  /* The gateway call comes FIRST and is not inside a transaction: money leaving is the
     real event, and a database row claiming a refund that never happened is worse than a
     refund that happened without a local row — the latter is visible in the dashboard and
     recoverable, the former silently tells the client they have paid someone back. */
  const result = await createRefund({
    paymentId: captured.providerPaymentId,
    amountMinor,
    notes: { orderNumber: row.orderNumber, by: actor.email },
  });

  await db.transaction(async (tx) => {
    await tx.insert(refund).values({
      paymentId: captured.id,
      providerRefundId: result.id,
      amountMinor,
      reason: opts.reason ?? null,
      status: result.status ?? "created",
      createdBy: actor.id,
      createdByEmail: actor.email,
    });

    /* A full refund settles the order; a partial one leaves it where it was, because the
       customer still has most of what they bought. */
    if (amountMinor === row.totalMinor) {
      await tx.update(order).set({ status: "refunded", updatedAt: new Date() }).where(eq(order.id, orderId));
    }

    await audit({
      actor,
      action: "order.refunded",
      entity: "order",
      entityId: orderId,
      after: { amountMinor, providerRefundId: result.id },
      exec: tx,
    });
  });

  logger.info("order.refunded", {
    orderNumber: row.orderNumber,
    amountMinor,
    providerRefundId: result.id,
    by: actor.email,
  });

  return { refundId: result.id, amountMinor };
}

/* ── Reading ───────────────────────────────────────────────────────────────────── */

export type OrderFilter = {
  status?: OrderStatus | "all" | "needs_action";
  q?: string;
  limit?: number;
};

/** Statuses that mean somebody has to do something. The default view, because an order
 *  list is a worklist first and an archive second. */
const NEEDS_ACTION: OrderStatus[] = ["paid", "confirmed", "processing"];

export async function listOrders(filter: OrderFilter = {}) {
  const clauses = [];

  if (filter.status === "needs_action" || !filter.status) {
    clauses.push(inArray(order.status, NEEDS_ACTION));
  } else if (filter.status !== "all") {
    clauses.push(eq(order.status, filter.status));
  }

  const q = filter.q?.trim();
  if (q) {
    /* Whatever the client has to hand: the number from an email, a phone number from a
       courier's call, an address they half-remember. */
    clauses.push(
      or(
        ilike(order.orderNumber, `%${q}%`),
        ilike(order.email, `%${q}%`),
        ilike(order.phone, `%${q}%`),
        ilike(order.trackingNumber, `%${q}%`)
      )!
    );
  }

  return db
    .select()
    .from(order)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(order.placedAt))
    .limit(Math.min(filter.limit ?? 100, 200));
}

export async function getOrderDetail(orderId: string) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!row) return null;

  const [items, payments] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, orderId)),
    db.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(desc(payment.createdAt)),
  ]);

  return { order: row, items, payments };
}

/** Counts for the overview, in one query rather than one per status. */
export async function orderCounts() {
  const [row] = await db
    .select({
      needsAction: sql<number>`count(*) filter (where ${order.status} in ('paid','confirmed','processing'))`,
      shipped: sql<number>`count(*) filter (where ${order.status} = 'shipped')`,
      awaitingCash: sql<number>`count(*) filter (where ${order.paymentMethod} = 'cod' and ${order.paidAt} is null and ${order.status} in ('confirmed','processing','shipped','delivered'))`,
      awaitingCashMinor: sql<number>`coalesce(sum(${order.totalMinor}) filter (where ${order.paymentMethod} = 'cod' and ${order.paidAt} is null and ${order.status} in ('confirmed','processing','shipped','delivered')), 0)`,
    })
    .from(order);

  return {
    needsAction: Number(row?.needsAction ?? 0),
    shipped: Number(row?.shipped ?? 0),
    awaitingCash: Number(row?.awaitingCash ?? 0),
    awaitingCashMinor: Number(row?.awaitingCashMinor ?? 0),
  };
}
