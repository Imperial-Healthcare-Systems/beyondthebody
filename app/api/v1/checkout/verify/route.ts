/* POST /api/v1/checkout/verify — the browser coming back from Razorpay Checkout.
 *
 * ADVISORY, and that word is doing real work. This exists so the customer sees "thank
 * you" immediately instead of watching a spinner until a webhook lands. It is not the
 * path money depends on:
 *
 *   · a customer whose tab crashed, or whose UPI app swallowed the redirect, never sends
 *     this at all — and their order must still complete
 *   · anyone can POST this endpoint, so what it carries is a claim until the signature
 *     proves otherwise
 *
 * The webhook is authoritative. Both paths converge on the same idempotent transition, so
 * whichever arrives first completes the order and the second changes nothing. */

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { order, payment } from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { apiRoute, clientIp, hashIp, readJson } from "@/lib/http";
import { enforce, RULES } from "@/lib/ratelimit";
import { markOrderPaid } from "@/lib/payments";
import { fetchPayment, verifyCheckoutSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

const Body = z.object({
  razorpayOrderId: z.string().trim().min(1).max(120),
  razorpayPaymentId: z.string().trim().min(1).max(120),
  razorpaySignature: z.string().trim().min(1).max(200),
});

export const POST = apiRoute("checkout.verify", async ({ req, log }) => {
  await enforce(RULES.checkoutIp, await hashIp(clientIp(req)));

  const body = await readJson(req, Body);

  if (
    !verifyCheckoutSignature({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    })
  ) {
    /* Someone is either confused or forging. Either way the webhook will settle the real
       state, so nothing here needs to be generous about it. */
    log.warn("checkout.verify.bad_signature", { razorpayOrderId: body.razorpayOrderId });
    throw new AppError(
      ErrorCode.PAYMENT_VERIFICATION_FAILED,
      "We couldn't confirm that payment. If money has left your account, it will be sorted — write to us."
    );
  }

  /* Which of OUR orders this is. Looked up by the gateway order id we recorded when
     checkout opened, never taken from the request. */
  const [row] = await db
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.providerOrderId, body.razorpayOrderId))
    .limit(1);

  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "We can't find that order.");

  /* The AMOUNT is read from Razorpay, not from the request. A signature proves the
     browser is relaying a real payment; it proves nothing about how much it was for, and
     the amount is the thing that decides whether an order is fulfilled. */
  const gatewayPayment = await fetchPayment(body.razorpayPaymentId);

  if (gatewayPayment.order_id !== body.razorpayOrderId) {
    /* A valid signature over a payment belonging to a DIFFERENT order — which is what a
       replay of somebody else's ₹1 payment would look like. */
    log.error("checkout.verify.order_mismatch", {
      claimed: body.razorpayOrderId,
      actual: gatewayPayment.order_id,
    });
    throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, "We couldn't confirm that payment.");
  }

  if (gatewayPayment.status !== "captured") {
    /* Authorised but not captured, or still processing. Not an error the customer can act
       on — the webhook will finish it. */
    log.info("checkout.verify.not_captured", { status: gatewayPayment.status });
    return { status: "pending" };
  }

  const result = await markOrderPaid({
    orderId: row.orderId,
    providerOrderId: body.razorpayOrderId,
    providerPaymentId: body.razorpayPaymentId,
    amountMinor: gatewayPayment.amount,
    method: gatewayPayment.method ?? null,
    signatureVerified: true,
    raw: gatewayPayment,
    source: "callback",
  });

  if (!result.ok) {
    /* Recorded and flagged inside markOrderPaid. The customer is told something neutral:
       an amount mismatch is our problem to investigate, not theirs to interpret. */
    return { status: "pending" };
  }

  const [current] = await db
    .select({ accessToken: order.accessToken })
    .from(order)
    .where(eq(order.id, row.orderId))
    .limit(1);

  return { status: "paid", statusUrl: `/order/${current.accessToken}` };
});
