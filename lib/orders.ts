/* Placing an order.
 *
 * One function does the whole thing, in one transaction, because the parts are not
 * separable: an order that exists without its stock decrement oversells, and a stock
 * decrement without an order loses inventory. Either both happen or neither does.
 *
 * The confirmation emails are queued inside that same transaction (the outbox pattern in
 * lib/jobs.ts). A dead SMTP host therefore cannot roll back an order, and a rolled-back
 * order cannot email anybody about a purchase that did not happen. */

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  inventoryMovement,
  order,
  orderItem,
  type Order,
  type OrderItem,
} from "@/db/schema";
import { AppError, ErrorCode } from "./errors";
import { env } from "./env";
import { logger } from "./logger";
import { newOrderNotificationEmail, orderConfirmationEmail, queueMail } from "./mail";
import { getSettings } from "./settings";
import { generateToken, normaliseEmail } from "./tokens";
import { quoteCart, type Quote, type QuoteItem } from "./pricing";
import type { Address } from "./address";

export type PlaceOrderInput = {
  items: QuoteItem[];
  email: string;
  /** Already normalised by PhoneSchema — ten digits, no prefix. */
  phone: string;
  paymentMethod: "prepaid" | "cod";
  shippingAddress: Address;
  billingAddress?: Address | null;
  notes?: string | null;
  idempotencyKey?: string | null;
};

export type PlacedOrder = {
  order: Order;
  items: OrderItem[];
  /** True when an idempotency key returned an order that already existed. */
  reused: boolean;
};

/* ── Order numbers ─────────────────────────────────────────────────────────────── */

const istYear = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

/** `BTB-2026-0001`. The year is IST regardless of where the server thinks it is — a UTC
 *  host must not stamp January on an order placed at 3am IST on New Year's Eve. */
export function formatOrderNumber(sequence: number, at = new Date()): string {
  return `BTB-${istYear.format(at)}-${String(sequence).padStart(4, "0")}`;
}

/* ── Placing ───────────────────────────────────────────────────────────────────── */

export async function findByIdempotencyKey(key: string): Promise<PlacedOrder | null> {
  const [existing] = await db.select().from(order).where(eq(order.idempotencyKey, key)).limit(1);
  if (!existing) return null;

  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, existing.id));
  return { order: existing, items, reused: true };
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  /* Cheap path first: a retried submit should not re-quote or re-check anything. */
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  const settings = await getSettings();

  if (!settings.store_open) {
    throw new AppError(ErrorCode.STORE_CLOSED, "The house is not taking orders just now.");
  }

  if (input.paymentMethod === "cod" && !settings.cod_enabled) {
    /* Re-checked here and not only in the UI: the customer may have loaded checkout
       before it was switched off, and the browser is not where this is decided. */
    throw new AppError(ErrorCode.COD_UNAVAILABLE, "Cash on delivery isn't available right now.");
  }

  /* Priced from the database, through the same function the quote endpoint uses. What is
     charged is what was quoted, because there is only one implementation. */
  const quote = await quoteCart(input.items, {
    paymentMethod: input.paymentMethod,
    state: input.shippingAddress.state,
  });

  if (quote.lines.length === 0) {
    throw new AppError(ErrorCode.CART_EMPTY, "There's nothing in your bag to order.", {
      details: { dropped: quote.dropped },
    });
  }

  if (quote.needsReview) {
    /* Something moved between the quote and the submit — a price, or the last of the
       stock. The customer sees the change and confirms it; we do not silently charge a
       different total than the one on their screen. */
    throw new AppError(ErrorCode.PRICE_CHANGED, "Something in your bag changed. Please review it.", {
      details: {
        dropped: quote.dropped,
        issues: quote.lines.flatMap((l) => l.issues.map((i) => ({ sku: l.sku, ...i }))),
        quote: publicQuote(quote),
      },
    });
  }

  const email = normaliseEmail(input.email);
  const accessToken = generateToken();
  const status = input.paymentMethod === "cod" ? "confirmed" : "pending_payment";

  try {
    return await db.transaction(async (tx) => {
      /* Stock first: it is the only step that can legitimately fail on a race, and
         failing before an order row exists keeps the failure clean. */
      for (const line of quote.lines) {
        const result = await tx.execute(sql`
          update product_variant
             set stock_qty = case when stock_tracked then stock_qty - ${line.qty} else stock_qty end
           where sku = ${line.sku}
             and status = 'active'
             and (not stock_tracked or stock_qty >= ${line.qty})
          returning sku, stock_tracked
        `);

        /* Zero rows means the last one went between the quote and this statement. The
           conditional UPDATE is what makes that safe: two concurrent orders for one
           remaining bottle cannot both succeed, without any locking of our own. */
        if (result.rows.length === 0) {
          throw new AppError(
            ErrorCode.OUT_OF_STOCK,
            `${line.name} · ${line.size} has just sold out.`,
            { logContext: { sku: line.sku, qty: line.qty } }
          );
        }
      }

      const [{ seq }] = (
        await tx.execute(sql`select nextval('order_number_seq') as seq`)
      ).rows as { seq: string }[];

      const [row] = await tx
        .insert(order)
        .values({
          orderNumber: formatOrderNumber(Number(seq)),
          email,
          phone: input.phone,
          paymentMethod: input.paymentMethod,
          status,
          subtotalMinor: quote.subtotalMinor,
          shippingMinor: quote.shippingMinor,
          codFeeMinor: quote.codFeeMinor,
          taxMinor: quote.taxMinor,
          totalMinor: quote.totalMinor,
          taxInclusive: quote.taxInclusive,
          taxBreakup: quote.taxBreakup,
          placeOfSupply: quote.placeOfSupply,
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? null,
          notes: input.notes?.slice(0, 500) ?? null,
          accessToken,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();

      const items = await tx
        .insert(orderItem)
        .values(
          quote.lines.map((line) => ({
            orderId: row.id,
            sku: line.sku,
            productSlug: line.productSlug,
            nameSnapshot: line.name,
            sizeSnapshot: line.size,
            unitPriceMinor: line.unitPriceMinor,
            qty: line.qty,
            lineTotalMinor: line.lineTotalMinor,
            hsnSnapshot: line.hsnCode,
            taxRateBp: line.taxRateBp,
            taxMinor: line.taxMinor,
          }))
        )
        .returning();

      /* Ledger rows only for SKUs that actually track stock, so that the sum of deltas
         and stock_qty stay reconcilable. An untracked SKU has no stock story to tell. */
      const tracked = quote.lines.filter((l) => l.stockTrackedAtQuote);
      if (tracked.length > 0) {
        await tx.insert(inventoryMovement).values(
          tracked.map((line) => ({
            sku: line.sku,
            delta: -line.qty,
            reason: "order_placed",
            orderId: row.id,
          }))
        );
      }

      /* Queued inside the transaction — the outbox. If these rows commit, the order
         committed; if the order rolls back, so does the promise to email about it.
         Rendered here rather than in a handler so the message is a snapshot of the order
         as placed, and so no new job kind is needed. */
      const statusUrl = `${env.APP_URL}/order/${accessToken}`;
      await queueMail({ to: email, ...orderConfirmationEmail(row, items, statusUrl) }, tx);
      await queueMail(
        { to: ordersInboxAddress(), ...newOrderNotificationEmail(row, items) },
        tx
      );

      logger.info("order.placed", {
        orderNumber: row.orderNumber,
        paymentMethod: row.paymentMethod,
        totalMinor: row.totalMinor,
        lines: items.length,
      });

      return { order: row, items, reused: false };
    });
  } catch (err) {
    /* Two submits with the same idempotency key can race past the check at the top; one
       loses on the unique index. Losing that race means the order exists — which is the
       answer the caller wanted. */
    if (input.idempotencyKey && isUniqueViolation(err)) {
      const existing = await findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }
    throw err;
  }
}

/** Postgres unique violation, anywhere in the error chain.
 *
 * Drizzle wraps driver errors in a DrizzleQueryError and puts the original on `.cause`,
 * so checking `err.code` alone silently never matches. That is not cosmetic: it is the
 * difference between the losing side of an idempotency race quietly returning the
 * winner's order, and a customer seeing a 500 for an order that in fact succeeded.
 * Found by the concurrent-submit test, which is the only thing that exercises this path. */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === "object" && "code" in e && (e as { code?: unknown }).code === "23505") {
      return true;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/** Where the house is told an order arrived. Until the admin order list exists (S7) this
 *  email is the ONLY notification, so it falls back to the From address rather than
 *  silently going nowhere when ORDERS_EMAIL is unset. */
function ordersInboxAddress(): string {
  if (env.ORDERS_EMAIL) return env.ORDERS_EMAIL;
  const match = env.MAIL_FROM.match(/<([^>]+)>/);
  return match ? match[1] : env.MAIL_FROM;
}

/* ── Reading ───────────────────────────────────────────────────────────────────── */

export type OrderWithItems = { order: Order; items: OrderItem[] };

/** The customer's own order, by the token in their confirmation email. The token IS the
 *  authorisation — there are no accounts — so it is high-entropy and single-purpose. */
export async function getOrderByToken(token: string): Promise<OrderWithItems | null> {
  if (!token || token.length < 20) return null;

  const [row] = await db.select().from(order).where(eq(order.accessToken, token)).limit(1);
  if (!row) return null;

  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, row.id));
  return { order: row, items };
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const [row] = await db.select().from(order).where(eq(order.id, id)).limit(1);
  if (!row) return null;

  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, row.id));
  return { order: row, items };
}

/* ── The shape sent to the browser ─────────────────────────────────────────────── */

/** A quote as the API returns it. Deliberately narrower than the internal one: stock
 *  levels and HSN codes are ours, not a visitor's. */
export function publicQuote(quote: Quote) {
  return {
    currency: quote.currency,
    lines: quote.lines.map((l) => ({
      sku: l.sku,
      productSlug: l.productSlug,
      name: l.name,
      size: l.size,
      unitPriceMinor: l.unitPriceMinor,
      qty: l.qty,
      lineTotalMinor: l.lineTotalMinor,
      issues: l.issues,
    })),
    dropped: quote.dropped,
    subtotalMinor: quote.subtotalMinor,
    shippingMinor: quote.shippingMinor,
    codFeeMinor: quote.codFeeMinor,
    taxMinor: quote.taxMinor,
    totalMinor: quote.totalMinor,
    taxInclusive: quote.taxInclusive,
    codAvailable: quote.codAvailable,
    storeOpen: quote.storeOpen,
    needsReview: quote.needsReview,
  };
}
