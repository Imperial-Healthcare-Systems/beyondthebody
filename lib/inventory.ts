/* Does the stock number still mean anything?
 *
 * `product_variant.stock_qty` is a counter that many code paths move, and
 * `inventory_movement` is the ledger that explains it. A counter and a ledger that are
 * written separately drift eventually — through a bug, an interrupted transaction, or
 * somebody editing a row by hand at two in the morning. The only useful moment to learn
 * that is BEFORE a customer buys the last bottle of something the shelf does not have.
 *
 * What this checks is deliberately not "does the ledger sum to stock_qty". It cannot: the
 * opening stock of a variant is never a movement, so that sum is off by a constant nobody
 * recorded. What it checks instead is an invariant that needs no opening balance and
 * catches the failures that actually happen — for every order, the ledger's net movement
 * for a tracked SKU must match what that order's status implies:
 *
 *   sold      the goods left the building        net = −qty
 *   returned  cancelled, expired, or came back   net =  0   (taken, then given back)
 *
 * A missing decrement, a missing restock, and a restock applied twice are each a different
 * arithmetic answer here, which is why this is worth running rather than a spot check. */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { OrderStatus } from "./fulfilment";
import { registerRecurringJob } from "./jobs";
import { logger } from "./logger";

/**
 * What each status says about where the goods are.
 *
 * Exhaustive on purpose: a new order status will not compile until somebody decides which
 * of the two it is, and that decision is exactly the one a stock audit depends on.
 */
const GOODS: Record<OrderStatus, "sold" | "returned"> = {
  pending_payment: "sold", // reserved off the shelf the moment the order was placed
  paid: "sold",
  confirmed: "sold",
  processing: "sold",
  shipped: "sold",
  delivered: "sold",
  /* A refund returns money, not perfume. Whatever came back physically is a separate
     inbound movement somebody records by hand. */
  refunded: "sold",
  failed: "returned",
  cancelled: "returned",
  expired: "returned",
  rto_returned: "returned",
};

export type StockDrift = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  sku: string;
  qty: number;
  /** What the ledger says moved for this order and SKU. */
  net: number;
  /** What it should have said. */
  expected: number;
};

export type InventoryAudit = {
  checked: number;
  drift: StockDrift[];
  negative: { sku: string; stockQty: number }[];
};

/**
 * Reconcile the ledger against every order placed in the last `days` days.
 *
 * Bounded by time rather than run over the whole table, because an order from two years
 * ago that drifted is history, not something anybody is going to act on — and this runs on
 * a schedule, where an unbounded scan is a slow-growing outage.
 */
export async function auditInventory(days = 90): Promise<InventoryAudit> {
  const { rows } = (await db.execute(sql`
    select o.id                        as order_id,
           o.order_number              as order_number,
           o.status                    as status,
           oi.sku                      as sku,
           sum(oi.qty)::int            as qty,
           coalesce(m.net, 0)::int     as net
      from "order" o
      join order_item oi on oi.order_id = o.id
      /* Only SKUs the shop actually counts. An untracked SKU has no ledger rows by
         design, so including it would report drift on every single order. */
      join product_variant v on v.sku = oi.sku and v.stock_tracked
      left join (
        select order_id, sku, sum(delta)::int as net
          from inventory_movement
         where order_id is not null
         group by order_id, sku
      ) m on m.order_id = o.id and m.sku = oi.sku
     where o.placed_at > now() - (${days} * interval '1 day')
     group by o.id, o.order_number, o.status, oi.sku, m.net
  `)) as unknown as {
    rows: {
      order_id: string;
      order_number: string;
      status: OrderStatus;
      sku: string;
      qty: number;
      net: number;
    }[];
  };

  const drift: StockDrift[] = [];
  for (const r of rows) {
    const expected = GOODS[r.status] === "sold" ? -r.qty : 0;
    if (r.net !== expected) {
      drift.push({
        orderId: r.order_id,
        orderNumber: r.order_number,
        status: r.status,
        sku: r.sku,
        qty: r.qty,
        net: r.net,
        expected,
      });
    }
  }

  /* Cheap, and it catches anything that decremented stock without going through the
     conditional update in placeOrder — which is the one thing that must never happen,
     because it means the shop sold something it did not have. */
  const { rows: negative } = (await db.execute(sql`
    select sku, stock_qty::int as stock_qty
      from product_variant
     where stock_tracked and stock_qty < 0
  `)) as unknown as { rows: { sku: string; stock_qty: number }[] };

  return {
    checked: rows.length,
    drift,
    negative: negative.map((n) => ({ sku: n.sku, stockQty: n.stock_qty })),
  };
}

/**
 * The scheduled version.
 *
 * It reports rather than repairs. An automatic correction would paper over the bug that
 * caused the drift and destroy the evidence of it in the same move; a person looking at
 * the ledger can see what happened and decide. Daily is often enough — this is a slow
 * failure, and waking somebody hourly about it would only teach them to ignore it.
 */
export function registerInventoryJobs() {
  registerRecurringJob("inventory:audit", 24 * 60 * 60, async () => {
    const result = await auditInventory();

    if (result.drift.length > 0 || result.negative.length > 0) {
      logger.error("inventory.drift", {
        checked: result.checked,
        driftCount: result.drift.length,
        negativeCount: result.negative.length,
        /* Capped: if something has gone systematically wrong, the first few lines say so
           just as well as four hundred would, and a log line nobody can read is a log
           line nobody reads. */
        drift: result.drift.slice(0, 20),
        negative: result.negative.slice(0, 20),
      });
      return;
    }

    logger.info("inventory.audit_clean", { checked: result.checked });
  });
}
