/* Razorpay, over plain HTTP.
 *
 * No SDK. This needs three REST calls and two HMAC checks; the official package brings a
 * dependency tree, its own release cadence and its own supply-chain surface to wrap
 * `fetch` and `crypto.createHmac`. The signature logic below is the part that must be
 * exactly right, and it is better to have it visible here than to trust it is happening
 * correctly inside a dependency.
 *
 * EVERYTHING IS OPTIONAL. With no keys configured the module reports itself unavailable
 * and prepaid checkout stays closed with a plain message — which is the state the site
 * ships in until the client's Razorpay account exists. Adding the three environment
 * variables turns it on; there is no code change and no migration. */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { logger } from "./logger";
import { AppError, ErrorCode } from "./errors";

const API = "https://api.razorpay.com/v1";

/** True only when all three secrets are present. Checked at every boundary rather than
 *  assumed, so a half-configured environment fails closed instead of half-working. */
export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
}

/** The publishable key. Safe to send to the browser — it identifies the account, it does
 *  not authorise anything. The SECRET must never leave the server. */
export function razorpayKeyId(): string | null {
  return env.RAZORPAY_KEY_ID ?? null;
}

export function isTestMode(): boolean {
  return (env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");
}

function auth(): string {
  return Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
}

function requireConfigured() {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      ErrorCode.PAYMENT_UNAVAILABLE,
      "Card and UPI payment isn't open yet. Cash on delivery is available today."
    );
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireConfigured();

  /* A gateway that has stopped answering must not hold a checkout request open until the
     browser gives up — the customer would be left not knowing whether they had paid. */
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const description =
      (body.error as { description?: string } | undefined)?.description ?? `HTTP ${res.status}`;
    /* Logged with the gateway's own words, surfaced to the customer without them: a
       gateway error message can name internal configuration. */
    logger.error("razorpay.call_failed", { path, status: res.status, description });
    throw new AppError(ErrorCode.PAYMENT_FAILED, "We couldn't reach the payment provider. Please try again.", {
      logContext: { path, status: res.status, description },
    });
  }

  return body as T;
}

/* ── Orders ────────────────────────────────────────────────────────────────────── */

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

/** Create the gateway's side of the order. `amountMinor` is paise, which is exactly what
 *  Razorpay wants — no conversion, and no opportunity to introduce one. */
export async function createRazorpayOrder(params: {
  amountMinor: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountMinor,
      currency: "INR",
      /* Our order number, so a Razorpay dashboard row can be matched to ours by eye. */
      receipt: params.receipt,
      notes: params.notes ?? {},
      /* Auto-capture. The alternative — authorise now, capture later — exists for
         businesses that ship before charging; a fragrance house takes the money when the
         customer pays. Leaving payments merely authorised is how they silently expire. */
      payment_capture: 1,
    }),
  });
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  status: string; // created | authorized | captured | refunded | failed
  amount: number;
  method?: string;
  error_code?: string;
  error_description?: string;
};

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** Every payment attempt against one of our orders. Used by reconciliation to answer
 *  "did this actually get paid?" when no webhook ever arrived. */
export async function fetchOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const body = await call<{ items?: RazorpayPayment[] }>(
    `/orders/${encodeURIComponent(orderId)}/payments`
  );
  return body.items ?? [];
}

export async function createRefund(params: {
  paymentId: string;
  amountMinor?: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string; amount: number }> {
  return call(`/payments/${encodeURIComponent(params.paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({
      ...(params.amountMinor === undefined ? {} : { amount: params.amountMinor }),
      notes: params.notes ?? {},
    }),
  });
}

/* ── Signatures ────────────────────────────────────────────────────────────────────
 *
 * Two different signatures, two different secrets, two different payloads. Mixing them up
 * produces a check that always fails, or — far worse — one that always passes. */

/** Constant-time compare of two hex digests. A plain `===` on a signature leaks how much
 *  of a forgery was correct through timing, which is enough to construct one byte by byte. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * The browser's return from Razorpay Checkout.
 *
 * Signed with the API SECRET over `order_id|payment_id`. This is ADVISORY: it proves the
 * browser is not making the payment up, but the webhook is what we actually trust, since
 * a customer whose tab crashed never sends this at all.
 */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;

  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");

  return digestsMatch(expected, params.signature);
}

/**
 * A webhook delivery.
 *
 * Signed with the WEBHOOK SECRET — a different secret from the API one — over the raw
 * request body, byte for byte. It must be verified against the bytes as received:
 * parsing and re-serialising the JSON changes key order and whitespace, and the signature
 * then never matches. That is why the route reads `await req.text()` and parses only
 * afterwards.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;

  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return digestsMatch(expected, signature);
}
