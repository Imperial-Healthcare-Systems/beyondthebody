/* Signature verification, without a network or a database.
 *
 * This is the security boundary of the whole payment phase. Everything downstream —
 * marking an order paid, emailing a customer, releasing stock to be packed — happens
 * because one of these two functions returned true. They are worth testing against
 * digests computed independently of the code under test.
 *
 * The two signatures use DIFFERENT secrets over DIFFERENT payloads, and the most
 * dangerous possible bug here is a check that always passes, so several cases below exist
 * only to prove that a wrong input is actually rejected. */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetEnvCache } from "@/lib/env";
import {
  isRazorpayConfigured,
  isTestMode,
  razorpayKeyId,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/razorpay";

const BASE = {
  DATABASE_URL: "postgresql://btb:pw@localhost:5432/btb",
  APP_URL: "https://beyondthebody.com",
  SESSION_SECRET: "0".repeat(32),
};

const KEY_SECRET = "test_api_secret_do_not_use";
const WEBHOOK_SECRET = "test_webhook_secret_do_not_use";

/* Computed here rather than imported, so a bug in the implementation cannot make the
   expectation agree with it. */
const hmac = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("hex");

let original: NodeJS.ProcessEnv;

beforeEach(() => {
  original = process.env;
  process.env = {
    NODE_ENV: "test",
    ...BASE,
    RAZORPAY_KEY_ID: "rzp_test_abc123",
    RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  } as NodeJS.ProcessEnv;
  __resetEnvCache();
});

afterEach(() => {
  process.env = original;
  __resetEnvCache();
});

describe("razorpay · configuration", () => {
  it("is configured only when all three secrets are present", () => {
    expect(isRazorpayConfigured()).toBe(true);

    for (const missing of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) {
      delete process.env[missing];
      __resetEnvCache();
      /* Half-configured must fail CLOSED. A deployment with an API key but no webhook
         secret would take payments it could never confirm. */
      expect(isRazorpayConfigured(), `still configured without ${missing}`).toBe(false);

      process.env[missing] = "x";
      __resetEnvCache();
    }
  });

  it("reports test mode from the key prefix", () => {
    expect(isTestMode()).toBe(true);

    process.env.RAZORPAY_KEY_ID = "rzp_live_abc123";
    __resetEnvCache();
    expect(isTestMode()).toBe(false);
  });

  it("exposes the key id and never the secret", () => {
    /* The key id identifies the account and is meant to reach the browser. Anything
       returned from here ends up in a page, so it must never be the secret. */
    expect(razorpayKeyId()).toBe("rzp_test_abc123");
    expect(razorpayKeyId()).not.toContain(KEY_SECRET);
  });

  it("is unconfigured with no keys at all", () => {
    process.env = { NODE_ENV: "test", ...BASE } as NodeJS.ProcessEnv;
    __resetEnvCache();

    expect(isRazorpayConfigured()).toBe(false);
    expect(razorpayKeyId()).toBeNull();
    /* And every verification refuses rather than throwing — an unconfigured deployment
       must reject callbacks, not crash on them. */
    expect(verifyWebhookSignature("{}", "anything")).toBe(false);
    expect(
      verifyCheckoutSignature({ razorpayOrderId: "o", razorpayPaymentId: "p", signature: "s" })
    ).toBe(false);
  });
});

describe("razorpay · the browser's return from checkout", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const valid = hmac(KEY_SECRET, `${orderId}|${paymentId}`);

  it("accepts a correct signature", () => {
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: valid,
      })
    ).toBe(true);
  });

  it("rejects a signature for a different payment", () => {
    /* The attack this stops: replaying a real ₹1 payment's signature against somebody
       else's ₹10,000 order. */
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: "pay_SOMEONE_ELSE",
        signature: valid,
      })
    ).toBe(false);
  });

  it("rejects a signature for a different order", () => {
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: "order_SOMETHING_ELSE",
        razorpayPaymentId: paymentId,
        signature: valid,
      })
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    /* Specifically: signing with the WEBHOOK secret. The two are different values for
       different purposes, and confusing them must fail rather than quietly work. */
    const wrongSecret = hmac(WEBHOOK_SECRET, `${orderId}|${paymentId}`);
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: wrongSecret,
      })
    ).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["truncated", hmac(KEY_SECRET, `${orderId}|${paymentId}`).slice(0, 32)],
    ["one character off", `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`],
    ["not hex at all", "not-a-signature"],
  ])("rejects a %s signature", (_label, signature) => {
    expect(
      verifyCheckoutSignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, signature })
    ).toBe(false);
  });

  it("does not confuse the two fields", () => {
    /* order|payment, not payment|order. Getting the concatenation order backwards is a
       silent, total failure that only shows up against the real gateway. */
    const reversed = hmac(KEY_SECRET, `${paymentId}|${orderId}`);
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: reversed,
      })
    ).toBe(false);
  });
});

describe("razorpay · webhook deliveries", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 199_800 } } },
  });

  it("accepts a correct signature over the raw body", () => {
    expect(verifyWebhookSignature(body, hmac(WEBHOOK_SECRET, body))).toBe(true);
  });

  it("rejects a body that changed by one byte", () => {
    const tampered = body.replace("199800", "100");
    expect(verifyWebhookSignature(tampered, hmac(WEBHOOK_SECRET, body))).toBe(false);
  });

  it("rejects a signature made with the API secret", () => {
    expect(verifyWebhookSignature(body, hmac(KEY_SECRET, body))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    /* An unsigned POST to the webhook URL is the simplest possible forgery, and the
       header being absent must never read as "nothing to check". */
    expect(verifyWebhookSignature(body, null)).toBe(false);
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });

  it("is sensitive to re-serialisation, which is why the route verifies raw bytes", () => {
    /* Parsing and re-stringifying JSON preserves meaning and changes bytes. If the route
       ever verified `JSON.stringify(await req.json())` instead of `await req.text()`,
       every real delivery would fail — this test is the record of why. */
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(reserialised).not.toBe(body);
    expect(verifyWebhookSignature(reserialised, hmac(WEBHOOK_SECRET, body))).toBe(false);
  });

  it("accepts an empty body signed correctly, and rejects it otherwise", () => {
    expect(verifyWebhookSignature("", hmac(WEBHOOK_SECRET, ""))).toBe(true);
    expect(verifyWebhookSignature("", "00")).toBe(false);
  });
});
