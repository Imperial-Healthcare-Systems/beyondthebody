/* End-to-end proof of the Razorpay webhook path — WITHOUT a Razorpay account.
 *
 * The webhook is the authoritative path: it is what completes an order when the customer
 * closes the tab, and it is the only inbound endpoint an attacker can reach directly. All
 * of that is testable today, because everything that matters is decided by an HMAC we
 * compute with a secret we control. Only the outbound calls to Razorpay genuinely need
 * their account.
 *
 * Run the server with placeholder keys — any values will do, they need not be real:
 *
 *   RAZORPAY_KEY_ID=rzp_test_placeholder \
 *   RAZORPAY_KEY_SECRET=placeholder_secret \
 *   RAZORPAY_WEBHOOK_SECRET=placeholder_webhook_secret \
 *   npm start
 *
 *   node scripts/verify-payments.mjs <baseUrl> <webhookSecret>
 *
 * When the real keys arrive, the only thing left to check is that Razorpay's dashboard is
 * pointed at /api/webhooks/razorpay and that a test-mode payment completes.
 */

import { createHmac } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const [baseUrl, webhookSecret] = process.argv.slice(2);

if (!baseUrl || !webhookSecret) {
  console.error("Usage: node scripts/verify-payments.mjs <baseUrl> <webhookSecret>");
  process.exit(1);
}

let failed = false;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

const stamp = Date.now().toString(36);
const EMAIL = `payments-verify-${stamp}@beyondthebody.invalid`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, ""),
  ssl: { rejectUnauthorized: false },
});

/** POST a webhook exactly as Razorpay would: raw JSON, signed with the webhook secret. */
async function deliver(body, { signature } = {}) {
  const raw = JSON.stringify(body);
  const sig = signature === undefined ? createHmac("sha256", webhookSecret).update(raw).digest("hex") : signature;

  const res = await fetch(`${baseUrl}/api/webhooks/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sig === null ? {} : { "x-razorpay-signature": sig }),
    },
    body: raw,
  });

  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const captured = (gatewayOrderId, paymentId, amountMinor) => ({
  event: "payment.captured",
  payload: {
    payment: {
      entity: { id: paymentId, order_id: gatewayOrderId, amount: amountMinor, method: "upi" },
    },
  },
});

/** Place a real COD order, then stage it as a prepaid order awaiting payment.
 *  A fixture, and named as one: creating it through the API would require the gateway. */
async function stagePrepaidOrder(label) {
  const res = await fetch(`${baseUrl}/api/v1/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `verify-${stamp}-${label}` },
    body: JSON.stringify({
      items: [{ sku: "MA-100", qty: 1 }],
      email: EMAIL,
      /* A fresh number per fixture: cash on delivery is capped at three orders a day per
         phone, deliberately, and this script places two of them on every run. Reusing one
         would make the script fail against a limit that is working correctly. */
      phone: `9${String(Math.floor(Math.random() * 900_000_000) + 100_000_000)}`,
      paymentMethod: "cod",
      shippingAddress: {
        name: "Payment Verification",
        line1: "12 Verification Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "IN",
      },
    }),
  });

  if (!res.ok) throw new Error(`could not place the fixture order: ${res.status}`);
  const { orderNumber } = await res.json();

  const gatewayOrderId = `order_verify_${stamp}_${label}`;
  const { rows } = await client.query(
    `update "order" set payment_method = 'prepaid', status = 'pending_payment'
      where order_number = $1 returning id, total_minor`,
    [orderNumber]
  );
  await client.query(
    `insert into payment (order_id, provider_order_id, status, amount_minor)
     values ($1, $2, 'created', $3)`,
    [rows[0].id, gatewayOrderId, rows[0].total_minor]
  );

  /* The COD placement already queued its emails; clear them so the counts below measure
     only what the webhook path itself sends. */
  await client.query(
    `delete from job where kind = 'mail:send' and payload->>'to' like '%beyondthebody.invalid'`
  );

  return { orderNumber, orderId: rows[0].id, gatewayOrderId, totalMinor: rows[0].total_minor };
}

const statusOf = async (orderId) =>
  (await client.query('select status, paid_at from "order" where id = $1', [orderId])).rows[0];

const mailCount = async () =>
  Number(
    (
      await client.query(
        `select count(*) from job where kind = 'mail:send' and payload->>'to' = $1`,
        [EMAIL]
      )
    ).rows[0].count
  );

try {
  await client.connect();

  /* ── 1. Forgeries ─────────────────────────────────────────────────────────── */
  console.log("\nAn unsigned or forged delivery is refused:");

  const one = await stagePrepaidOrder("a");

  const unsigned = await deliver(captured(one.gatewayOrderId, `pay_${stamp}_x`, one.totalMinor), {
    signature: null,
  });
  check(unsigned.status === 400, "no signature header → 400", String(unsigned.status));

  const wrong = await deliver(captured(one.gatewayOrderId, `pay_${stamp}_x`, one.totalMinor), {
    signature: "0".repeat(64),
  });
  check(wrong.status === 400, "wrong signature → 400", String(wrong.status));

  /* Correctly signed, then one byte of the body changed — the classic replay-with-edits. */
  const body = captured(one.gatewayOrderId, `pay_${stamp}_x`, one.totalMinor);
  const goodSig = createHmac("sha256", webhookSecret).update(JSON.stringify(body)).digest("hex");
  const tampered = await deliver(
    captured(one.gatewayOrderId, `pay_${stamp}_x`, 100),
    { signature: goodSig }
  );
  check(tampered.status === 400, "signature valid for a DIFFERENT body → 400", String(tampered.status));

  check((await statusOf(one.orderId)).status === "pending_payment", "and the order is untouched");
  check((await mailCount()) === 0, "and nobody was emailed");

  /* ── 2. A genuine capture ─────────────────────────────────────────────────── */
  console.log("\nA genuine capture completes the order:");

  const paymentId = `pay_verify_${stamp}_a`;
  const first = await deliver(captured(one.gatewayOrderId, paymentId, one.totalMinor));
  check(first.status === 200, "accepted", String(first.status));

  const afterPaid = await statusOf(one.orderId);
  check(afterPaid.status === "paid", "the order is paid", afterPaid.status);
  check(Boolean(afterPaid.paid_at), "and stamped with when");
  check((await mailCount()) === 1, "the customer is emailed once");

  /* ── 3. Razorpay retries ──────────────────────────────────────────────────── */
  console.log("\nA redelivery changes nothing:");

  const replay = await deliver(captured(one.gatewayOrderId, paymentId, one.totalMinor));
  check(replay.status === 200, "a duplicate is answered 200, not 500", String(replay.status));
  check(replay.body.duplicate === true, "and recognised as a duplicate");
  check((await statusOf(one.orderId)).status === "paid", "the order is still paid");
  check((await mailCount()) === 1, "and the customer is NOT emailed twice");

  /* ── 4. The wrong amount ──────────────────────────────────────────────────── */
  console.log("\nA payment for the wrong amount is never fulfilled:");

  const two = await stagePrepaidOrder("b");
  const short = await deliver(
    captured(two.gatewayOrderId, `pay_verify_${stamp}_b`, two.totalMinor - 100)
  );

  check(short.status === 200, "the delivery is accepted and recorded", String(short.status));
  check(
    (await statusOf(two.orderId)).status === "pending_payment",
    "but the order stays unpaid — never auto-fulfilled"
  );
  /* Staging this order cleared the queue, so zero is the whole count, not a delta. */
  check((await mailCount()) === 0, "and no confirmation is sent for it");

  const { rows: flagged } = await client.query(
    `select status, error_code from payment where provider_payment_id = $1`,
    [`pay_verify_${stamp}_b`]
  );
  check(
    flagged[0]?.status === "failed" && flagged[0]?.error_code === "amount_mismatch",
    "and it is flagged for a human",
    JSON.stringify(flagged[0])
  );

  /* ── 5. A payment for an order we do not know ─────────────────────────────── */
  console.log("\nAn unknown order is logged, not retried forever:");

  const stranger = await deliver(captured(`order_not_ours_${stamp}`, `pay_${stamp}_z`, 100));
  check(
    stranger.status === 200,
    "answered 200 so the provider stops retrying an event we ignore",
    String(stranger.status)
  );
} catch (err) {
  console.error("\nFAIL —", err.message);
  failed = true;
} finally {
  try {
    await client.query(`delete from "order" where email = $1`, [EMAIL]);
    await client.query(
      `delete from job where kind = 'mail:send' and payload->>'to' like '%beyondthebody.invalid'`
    );
    await client.query(`delete from webhook_event where provider_event_id like $1`, [`%${stamp}%`]);
    await client.end();
  } catch {
    /* cleanup is best effort */
  }
  console.log(failed ? "\nFAILED" : "\nPASS — the webhook path holds end to end.");
  process.exit(failed ? 1 : 0);
}
