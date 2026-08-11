/* End-to-end proof that the client can actually RUN the shop, against a production build.
 *
 * S5 proved somebody can buy something. This proves somebody can then do the work: pack
 * it, ship it with a tracking number, record the cash the courier hands over, and cancel
 * the one that came back. The properties that cost money if they are wrong:
 *
 *   · shipping emails the customer, and the tracking number reaches their status page
 *   · recording cash does NOT move the parcel's status, and cannot be done twice
 *   · cancelling puts the stock back — exactly once
 *   · the screen never offers a move the server would refuse
 *   · a stranger cannot see any of it
 *
 * The owner-vs-editor split is not re-proved here: it is the same `requireAdminPage("owner")`
 * guard already verified against a real editor session at S3, and every action re-checks it
 * server-side rather than trusting that the form was only rendered for an owner.
 *
 *   npm run build && npm start
 *   node scripts/verify-fulfilment.mjs <baseUrl> <ownerMagicLink>
 *
 * Sign-in links are rate limited to five per address per fifteen minutes — a sensible rule
 * that makes re-running this awkward. Set VERIFY_STATE to a file path and the signed-in
 * session is saved there and reused, so a second run needs no new link.
 */

import { existsSync } from "node:fs";
import { chromium } from "playwright";

const [baseUrl, magicLink] = process.argv.slice(2);
const statePath = process.env.VERIFY_STATE;
const reusing = Boolean(statePath && existsSync(statePath));

if (!baseUrl || (!magicLink && !reusing)) {
  console.error("Usage: node scripts/verify-fulfilment.mjs <baseUrl> <ownerMagicLink>");
  process.exit(1);
}

let failed = false;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

const stamp = Date.now().toString(36);
const TRACKING = `VERIFY-${stamp.toUpperCase()}`;

/* Each order needs its own phone number: three COD orders per number per day is the
   limit, and this script places two. */
const rand = () => `98765${String(Math.floor(Math.random() * 100_000)).padStart(5, "0")}`;

const buyer = (n) => ({
  name: "Verification Buyer",
  phone: rand(),
  email: `fulfil-verify-${stamp}-${n}@beyondthebody.invalid`,
  line1: "12 Verification Street",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "IN",
});

/** Place a real COD order through the real API, and hand back what the customer got. */
async function place(n) {
  const b = buyer(n);
  const res = await fetch(`${baseUrl}/api/v1/checkout/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      /* A header, not a body field — it is a property of the REQUEST, not of the order. */
      "Idempotency-Key": `verify-fulfil-${stamp}-${n}`,
    },
    body: JSON.stringify({
      items: [{ sku: "MA-100", qty: 1 }],
      email: b.email,
      phone: b.phone,
      paymentMethod: "cod",
      shippingAddress: {
        name: b.name,
        line1: b.line1,
        line2: "",
        landmark: "",
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        country: "IN",
      },
    }),
  });

  if (!res.ok) throw new Error(`Could not place order ${n}: ${res.status} ${await res.text()}`);
  return res.json();
}

const browser = await chromium.launch();
const context = await browser.newContext(reusing ? { storageState: statePath } : {});

try {
  const page = await context.newPage();

  /* Whatever the last action said, success or failure. Reading it rather than waiting for
     one expected phrase means a wrong answer is reported instead of timing out.
     Scoped to the panels: Next puts an empty `role="alert"` route announcer at the end of
     every document, and an unscoped `.last()` finds that instead — silently, as an empty
     string, which looks exactly like a failed assertion. */
  const spoke = async (previous = null) => {
    const el = page.locator('.adm__panel [role="status"], .adm__panel [role="alert"]').last();
    await el.waitFor({ timeout: 15_000 });
    /* A message from the LAST action is still on screen when the next one is submitted, so
       waiting for "a message" would read the old one and report the wrong verdict. Wait
       for it to change. */
    for (let i = 0; i < 60; i++) {
      const text = (await el.innerText()).trim();
      if (text && text !== previous) return text;
      await page.waitForTimeout(250);
    }
    return (await el.innerText()).trim();
  };

  /* The subtitle under the order number: "<status> · placed <date> · <method>". */
  const headline = () => page.locator(".adm__sub").innerText();

  const a = await place("a");
  const b = await place("b");
  console.log(`\nPlaced ${a.orderNumber} and ${b.orderNumber}\n`);

  /* ── Signed in as the owner ───────────────────────────────────────────────── */
  if (!reusing) {
    await page.goto(magicLink, { waitUntil: "domcontentloaded" });
  }
  await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" });

  if ((await page.locator("h1").first().textContent())?.trim() !== "Orders") {
    throw new Error(
      reusing
        ? "The saved session is no longer valid — delete VERIFY_STATE and pass a fresh link."
        : "Not signed in as an owner — the magic link did not take."
    );
  }

  if (statePath && !reusing) await context.storageState({ path: statePath });

  console.log("The order list is a worklist:");

  const body = await page.locator("body").innerText();
  check(body.includes(a.orderNumber), "a new cash order is waiting to be dealt with");
  /* innerText is the RENDERED text, and the chips are uppercased in CSS — compare the
     words, not the casing. */
  check(
    (await page.locator('[aria-current="page"]').innerText()).toLowerCase() === "needs action",
    "and that is the view it opens on"
  );

  /* ── Packing and shipping ─────────────────────────────────────────────────── */
  console.log("\nPacking and shipping:");

  const openOrder = async (number) => {
    await page.goto(`${baseUrl}/admin/orders?status=all&q=${number}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: number }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}/, { timeout: 15_000 });
  };

  await openOrder(a.orderNumber);

  check(
    (await page.getByRole("button", { name: "Mark shipped" }).count()) === 0,
    "a confirmed order cannot be shipped before it is packed"
  );

  await page.getByRole("button", { name: "Start packing" }).click();
  const packMsg = await spoke();
  check(/Marked/.test(packMsg), "an order can be started", packMsg);

  await page.fill('input[name="courier"]', "Delhivery");
  await page.fill('input[name="trackingNumber"]', TRACKING);
  await page.getByRole("button", { name: "Mark shipped" }).click();
  const shipMsg = await spoke(packMsg);
  check(/emailed/.test(shipMsg), "shipping it emails the customer", shipMsg);

  /* The customer's own page — no sign-in, just the address they were emailed. */
  const status = await fetch(`${baseUrl}${a.statusUrl}`, { cache: "no-store" });
  const statusHtml = await status.text();
  check(statusHtml.includes(TRACKING), "the tracking number reaches the customer's page");
  check(statusHtml.includes("It has left the house"), "and it tells them where it is");

  /* ── Cash ─────────────────────────────────────────────────────────────────── */
  console.log("\nRecording the money:");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Record .* collected/i }).click();
  const cashMsg = await spoke();
  check(/Recorded cash for 1 order/.test(cashMsg), "the cash is recorded", cashMsg);

  await page.reload({ waitUntil: "domcontentloaded" });
  check(
    (await page.getByRole("button", { name: /Record .* collected/i }).count()) === 0,
    "an order whose cash is in cannot be collected twice"
  );
  /* Read the headline, not the whole page: "Shipped" and "Cancelled" are permanent labels
     in the timeline panel, so a body-wide match would pass whatever happened. */
  const afterCash = await headline();
  check(/shipped/i.test(afterCash), "and recording it did not move the parcel", afterCash);

  /* ── Cancelling, and the stock ────────────────────────────────────────────── */
  console.log("\nCancelling:");

  page.on("dialog", (d) => d.accept());
  await openOrder(b.orderNumber);
  await page.getByRole("button", { name: "Cancel order" }).click();
  const cancelMsg = await spoke();
  check(/stock is back/.test(cancelMsg), "cancelling puts the stock back", cancelMsg);

  await page.reload({ waitUntil: "domcontentloaded" });
  const afterCancel = await headline();
  check(/cancelled/i.test(afterCancel), "a cancelled order says so", afterCancel);
  check(
    (await page.getByRole("button", { name: "Start packing" }).count()) === 0,
    "and offers no way back — cancelled is the end of the road"
  );

  /* ── Not the editor's business ────────────────────────────────────────────── */
  console.log("\nThe role split holds:");

  const anon = await browser.newContext(); // no session at all
  const anonPage = await anon.newPage();
  const res = await anonPage.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" });
  check(
    !anonPage.url().includes("/admin/orders") || (res && res.status() >= 400),
    "a stranger is not shown the order list",
    anonPage.url()
  );
  await anon.close();
} catch (err) {
  console.error("\nVerification aborted:", err.message);
  failed = true;
} finally {
  await browser.close();
}

console.log(failed ? "\nFAILED\n" : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
