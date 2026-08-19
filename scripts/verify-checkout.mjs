/* End-to-end proof that someone can actually buy something.
 *
 * Drives the real PDP, the real bag, and the real checkout form against a PRODUCTION
 * build, then checks the properties that cost money if they are wrong:
 *
 *   · the order reaches the confirmation page, with the total the customer was shown
 *   · the bag is emptied only once the order exists
 *   · a repeated submit places ONE order, not two
 *   · a tampered price is priced by the server, not by the browser
 *   · somebody else's order token is a 404
 *
 *   npm run build && npm start
 *   node scripts/verify-checkout.mjs <baseUrl>
 */

import { chromium } from "playwright";

const [baseUrl] = process.argv.slice(2);

if (!baseUrl) {
  console.error("Usage: node scripts/verify-checkout.mjs <baseUrl>");
  process.exit(1);
}

let failed = false;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

/* formatPrice uses a NON-BREAKING space between ₹ and the figure, deliberately — it stops
   the symbol being orphaned at a line break. Normalise rather than "fix" the typography. */
const normalise = (s) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

const stamp = Date.now().toString(36);
const BUYER = {
  name: "Verification Buyer",
  phone: "9876500001",
  email: `checkout-verify-${stamp}@beyondthebody.invalid`,
  line1: "12 Verification Street",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

const api = (path, body, headers = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  /* ── 1. Bag → checkout → order ────────────────────────────────────────────── */
  console.log("\nA customer can buy something:");

  await page.goto(`${baseUrl}/fragrance/mon-amour`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded" });

  await page.waitForSelector(".co__total", { timeout: 15_000 });
  const quotedTotal = normalise(await page.locator(".co__total dd").innerText());
  check(/^₹ [\d,]+$/.test(quotedTotal), "the bag is priced by the server", quotedTotal);

  await page.fill('input[name="name"]', BUYER.name);
  await page.fill('input[name="phone"]', BUYER.phone);
  await page.fill('input[name="email"]', BUYER.email);
  await page.fill('input[name="line1"]', BUYER.line1);
  await page.fill('input[name="city"]', BUYER.city);
  await page.fill('input[name="pincode"]', BUYER.pincode);
  await page.selectOption('select[name="state"]', BUYER.state);

  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/order\/[^/?]+/, { timeout: 30_000 });

  const body = await page.locator("body").innerText();

  const orderNumber = body.match(/BTB-\d{4}-\d+/)?.[0];
  check(Boolean(orderNumber), "the order gets a quotable number", orderNumber);
  check(normalise(body).includes(quotedTotal), "the total charged is the total quoted", quotedTotal);
  check(body.includes(BUYER.line1), "the confirmation shows where it is going");
  check(/Confirmed/i.test(body), "a COD order is confirmed immediately, with no payment step");

  /* The bag is cleared HERE, not before navigating — a failed navigation must not lose
     somebody's bag. */
  const bagAfter = await page.evaluate(() => localStorage.getItem("btb-cart-v1"));
  check(bagAfter === "[]" || bagAfter === null, "the bag is emptied once the order exists", bagAfter);

  /* ── 2. Not charging twice ────────────────────────────────────────────────── */
  console.log("\nA repeated submit places one order:");

  const payload = {
    items: [{ sku: "MA-100", qty: 1 }],
    email: BUYER.email,
    phone: BUYER.phone,
    paymentMethod: "cod",
    shippingAddress: { ...BUYER, country: "IN" },
  };
  const key = `verify-${stamp}`;

  const first = await api("/api/v1/checkout/session", payload, { "Idempotency-Key": key });
  const second = await api("/api/v1/checkout/session", payload, { "Idempotency-Key": key });
  const [a, b] = [await first.json(), await second.json()];

  check(first.ok && second.ok, "both submits are accepted", `${first.status}/${second.status}`);
  check(a.orderNumber === b.orderNumber, "they return the SAME order", `${a.orderNumber} vs ${b.orderNumber}`);

  const noKey = await api("/api/v1/checkout/session", payload);
  check(noKey.status === 400, "a submit with no idempotency key is refused", String(noKey.status));

  /* ── 3. The browser does not decide the price ─────────────────────────────── */
  console.log("\nThe server decides the price:");

  const quote = await (await api("/api/v1/cart/quote", {
    items: [{ sku: "MA-100", qty: 1, expectedPriceMinor: 100 }],
  })).json();

  check(quote.lines[0].unitPriceMinor > 100, "a bag claiming ₹1 is priced properly", String(quote.lines[0].unitPriceMinor));
  check(quote.needsReview === true, "and the customer is told the price moved");

  /* Its own phone number: COD is capped at three orders a day per number, deliberately,
     and this script places several. Reusing one number here would make the script fail
     against a limit that is working exactly as intended. */
  const tampered = await api(
    "/api/v1/checkout/session",
    {
      ...payload,
      phone: "9876500002",
      items: [{ sku: "MA-100", qty: 1, expectedPriceMinor: 100 }],
    },
    { "Idempotency-Key": `tamper-${stamp}` }
  );
  const tamperedBody = await tampered.json();
  check(
    tampered.status === 409 && tamperedBody.error?.code === "price_changed",
    "and an order at that price is refused outright",
    `${tampered.status} ${tamperedBody.error?.code}`
  );

  /* ── 4. Somebody else's order ─────────────────────────────────────────────── */
  console.log("\nAn order belongs to one person:");

  const stranger = await fetch(`${baseUrl}/order/not-a-real-token-but-long-enough-to-look-like-one`, {
    redirect: "manual",
  });
  check(stranger.status === 404, "a wrong token is a 404, not a hint", String(stranger.status));

  console.log(`\nOrders left by this run (email ${BUYER.email}). Remove with:`);
  console.log(`  delete from "order" where email = '${BUYER.email}';`);
} catch (err) {
  console.error("\nFAIL —", err.message);
  failed = true;
} finally {
  await browser.close();
  console.log(failed ? "\nFAILED" : "\nPASS — checkout holds end to end.");
  process.exit(failed ? 1 : 0);
}
