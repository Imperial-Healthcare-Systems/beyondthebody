/* POST /api/v1/checkout/session — place the order.
 *
 * COD is complete here: the order is `confirmed`, stock is committed, and both
 * confirmation emails are queued, with no gateway involved. Prepaid is refused until the
 * Razorpay keys exist (phase 6) — the enum, the status and the columns are all in place,
 * so turning it on is additive rather than a rewrite.
 *
 * Requires an `Idempotency-Key` header. A double-clicked submit, a retried request on a
 * flaky connection, or a customer refreshing the tab must not place two orders. */

import { z } from "zod";
import { AppError, ErrorCode } from "@/lib/errors";
import { apiRoute, clientIp, hashIp, readJson } from "@/lib/http";
import { enforce, RULES } from "@/lib/ratelimit";
import { AddressSchema, PhoneSchema } from "@/lib/address";
import { MAX_LINES, MAX_QTY_PER_LINE } from "@/lib/pricing";
import { findByIdempotencyKey, placeOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

const Body = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(40),
        qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
        expectedPriceMinor: z.number().int().min(0).max(100_000_000).nullish(),
      })
    )
    .min(1, "There's nothing in your bag.")
    .max(MAX_LINES),

  email: z.email("Enter an email address we can reach you at.").max(254),
  phone: PhoneSchema,

  paymentMethod: z.enum(["prepaid", "cod"]),
  shippingAddress: AddressSchema,
  /* Billing is optional and defaults to the shipping address — nobody wants to type an
     address twice, and for a COD order the two are the same by definition. */
  billingAddress: AddressSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const POST = apiRoute("checkout.session", async ({ req, log }) => {
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      "This request is missing something. Please reload the page and try again.",
      { logContext: { reason: "missing or malformed Idempotency-Key" } }
    );
  }

  await enforce(RULES.checkoutIp, await hashIp(clientIp(req)));

  const body = await readJson(req, Body);

  if (body.paymentMethod === "prepaid") {
    /* Refused rather than silently accepted: an order created as `pending_payment` with
       no gateway to pay it would sit there until it expired, and the customer would have
       every reason to believe they had bought something. */
    throw new AppError(
      ErrorCode.COD_UNAVAILABLE,
      "Card and UPI payment isn't open yet. Cash on delivery is available today."
    );
  }

  /* COD commits real stock with no money at risk to whoever placed it — the cheapest way
     to empty an eight-SKU inventory. Limited by phone number as well as by IP, because
     an IP is free to change and a working phone number is not.

     Charged only for a genuinely NEW order. A retry — a double click, a dropped
     connection — is the same order arriving twice, and billing it a second time against
     a three-a-day allowance would spend a real customer's quota on our own plumbing. */
  const alreadyPlaced = await findByIdempotencyKey(idempotencyKey);
  if (!alreadyPlaced) await enforce(RULES.codPhone, body.phone);

  const placed = await placeOrder({
    items: body.items,
    email: body.email,
    phone: body.phone,
    paymentMethod: body.paymentMethod,
    shippingAddress: body.shippingAddress,
    billingAddress: body.billingAddress ?? null,
    notes: body.notes ?? null,
    idempotencyKey,
  });

  log.info("checkout.session", {
    orderNumber: placed.order.orderNumber,
    reused: placed.reused,
  });

  /* The token is the customer's only key to their order, so it goes back once, here, and
     is also in their confirmation email. */
  return {
    orderNumber: placed.order.orderNumber,
    orderToken: placed.order.accessToken,
    paymentMethod: placed.order.paymentMethod,
    totalMinor: placed.order.totalMinor,
    statusUrl: `/order/${placed.order.accessToken}`,
  };
});
