/* POST /api/webhooks/razorpay — the authoritative word on whether an order was paid.
 *
 * Three rules, each learned the expensive way by everyone who has built one of these:
 *
 * 1. VERIFY THE RAW BYTES. The signature covers the body exactly as sent. Parsing the
 *    JSON and re-serialising it changes key order and whitespace, and the signature then
 *    never matches — so this reads `await req.text()` and parses only afterwards.
 * 2. DEDUPE. Razorpay retries until it gets a 2xx and will deliver duplicates anyway. The
 *    unique index on `webhook_event.provider_event_id` is what makes a replay a no-op.
 * 3. ANSWER 200 FOR ANYTHING WE HAVE STORED. A 500 makes Razorpay retry, which is right
 *    when we genuinely failed and wrong when we simply do not care about the event —
 *    endless retries of an event we ignore is noise that hides a real failure.
 *
 * Deliberately NOT rate limited: throttling the payment provider's notifications is how
 * an order stays unpaid after the customer has paid. It is authenticated by HMAC, which
 * is the control that matters here. */

import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { payment, webhookEvent } from "@/db/schema";
import { logger } from "@/lib/logger";
import { markOrderPaid, recordFailedPayment } from "@/lib/payments";
import { isRazorpayConfigured, verifyWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/* Razorpay's payment payload, taken narrowly — anything else in it is kept in `raw`
   rather than trusted into our types. */
type WebhookPayment = {
  id: string;
  order_id?: string;
  amount: number;
  method?: string;
  error_code?: string;
  error_description?: string;
};

type WebhookBody = {
  event?: string;
  payload?: { payment?: { entity?: WebhookPayment } };
};

const ok = (body: Record<string, unknown> = { ok: true }) =>
  NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest): Promise<Response> {
  const log = logger.child({ route: "webhooks.razorpay" });

  if (!isRazorpayConfigured()) {
    /* Nothing is configured, so nothing can be verified. 503 rather than 200: if
       deliveries are arriving at an unconfigured deployment, that is worth retrying and
       worth someone noticing. */
    log.error("webhook.unconfigured");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  /* Raw bytes first — see rule 1. */
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    log.warn("webhook.bad_signature", { hasSignature: Boolean(signature), bytes: raw.length });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    log.error("webhook.unparseable");
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = body.event ?? "unknown";
  const entity = body.payload?.payment?.entity;

  /* Razorpay does not send a stable event id header on every plan, so the payment id
     paired with the event name identifies a delivery: the same payment can legitimately
     produce `payment.authorized` AND `payment.captured`, which are different events, but
     a retry of either carries the same pair. */
  const eventId = `${event}:${entity?.id ?? raw.length}`;

  /* Written BEFORE the work, so a crash mid-processing still leaves a record that the
     delivery arrived, and a retry is recognised. */
  const inserted = await db
    .insert(webhookEvent)
    .values({ providerEventId: eventId, eventType: event, payload: body as object })
    .onConflictDoNothing({ target: [webhookEvent.provider, webhookEvent.providerEventId] })
    .returning({ id: webhookEvent.id });

  if (inserted.length === 0) {
    /* Already seen. 200 so Razorpay stops retrying — this is success, not failure. */
    log.info("webhook.duplicate", { event, eventId });
    return ok({ ok: true, duplicate: true });
  }

  const rowId = inserted[0].id;

  try {
    await handle(event, entity, body);
    await db.update(webhookEvent).set({ processedAt: new Date() }).where(eq(webhookEvent.id, rowId));
    return ok();
  } catch (err) {
    /* Left unprocessed on purpose: the row is the evidence, and the reconciliation job
       repairs the order state independently of whether Razorpay ever retries. */
    const message = err instanceof Error ? err.message : String(err);
    await db.update(webhookEvent).set({ error: message.slice(0, 2_000) }).where(eq(webhookEvent.id, rowId));
    log.error("webhook.processing_failed", { err, event });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

async function handle(event: string, entity: WebhookPayment | undefined, body: WebhookBody) {
  if (!entity?.id) {
    logger.info("webhook.ignored", { event, reason: "no payment entity" });
    return;
  }

  /* Which of OUR orders. Always resolved from the gateway order id we stored when
     checkout opened — never from anything the payload claims about us. */
  const gatewayOrderId = entity.order_id;
  if (!gatewayOrderId) {
    logger.info("webhook.ignored", { event, reason: "no order id" });
    return;
  }

  const [row] = await db
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.providerOrderId, gatewayOrderId))
    .limit(1);

  if (!row) {
    /* A payment for an order we have no record of. Almost always a test-mode delivery
       arriving at a live deployment, or the reverse — worth a loud log, not a retry. */
    logger.error("webhook.unknown_order", { event, gatewayOrderId, paymentId: entity.id });
    return;
  }

  switch (event) {
    case "payment.captured": {
      await markOrderPaid({
        orderId: row.orderId,
        providerOrderId: gatewayOrderId,
        providerPaymentId: entity.id,
        amountMinor: entity.amount,
        method: entity.method ?? null,
        /* The HMAC over the raw body was checked above — this IS the verified path. */
        signatureVerified: true,
        raw: body,
        source: "webhook",
      });
      return;
    }

    case "payment.failed": {
      /* Recorded without touching the order: a declined card must leave the order
         payable so the customer can try another one. */
      await recordFailedPayment({
        orderId: row.orderId,
        providerOrderId: gatewayOrderId,
        providerPaymentId: entity.id,
        amountMinor: entity.amount,
        method: entity.method ?? null,
        errorCode: entity.error_code ?? null,
        errorDescription: entity.error_description ?? null,
        raw: body,
      });
      return;
    }

    default:
      /* Authorised-but-not-captured, refunds, settlements, disputes. Stored by the caller
         and otherwise ignored: acting on an event we have not designed a response to is
         how an order ends up in a state nothing can move it out of. */
      logger.info("webhook.unhandled", { event });
  }
}
