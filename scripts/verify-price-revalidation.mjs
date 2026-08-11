/* End-to-end proof that an admin price edit reaches a PRERENDERED page.
 *
 * This is the claim S3 rests on: the client changes a price and the storefront shows it
 * within seconds, without a deploy, while the product pages stay statically rendered. In
 * dev that proves nothing — Next renders every page on demand there — so this drives the
 * real admin form against a production build and reads the resulting HTML.
 *
 *   node scripts/verify-price-revalidation.mjs <baseUrl> <magicLinkUrl> <newPrice>
 */

import { chromium } from "playwright";

const [baseUrl, magicLink, newPrice = "2450"] = process.argv.slice(2);

if (!baseUrl || !magicLink) {
  console.error("Usage: node scripts/verify-price-revalidation.mjs <baseUrl> <magicLink> [price]");
  process.exit(1);
}

/* formatPrice() puts a NON-BREAKING space between ₹ and the figure, deliberately — it
   stops the symbol being orphaned at a line break. Normalise it here rather than compare
   against a plain space and "fix" a piece of typography that is doing its job. */
const normalise = (s) => s.replace(/ /g, " ").trim();

const priceOnPdp = async () => {
  const res = await fetch(`${baseUrl}/fragrance/mon-amour`, { cache: "no-store" });
  const html = await res.text();
  const match = html.match(/buy__price"?>([^<]+)/);
  return match ? normalise(match[1]) : "(not found)";
};

const browser = await chromium.launch();
let failed = false;

try {
  const page = await browser.newPage();

  const before = await priceOnPdp();
  console.log(`PDP price before: ${before}`);

  await page.goto(magicLink, { waitUntil: "domcontentloaded" });
  await page.goto(`${baseUrl}/admin/prices`, { waitUntil: "domcontentloaded" });

  const heading = await page.locator("h1").first().textContent();
  if (heading?.trim() !== "Prices") {
    throw new Error(`Not signed in — landed on "${heading?.trim()}"`);
  }

  /* The row for MA-100: fill the price and submit that form only. */
  const form = page.locator('form:has(input[name="sku"][value="MA-100"])');
  await form.locator('input[name="price"]').fill(newPrice);
  await form.locator('button[type="submit"]').click();
  await form.getByRole("status").waitFor({ timeout: 15_000 });
  console.log(`Saved MA-100 = ${newPrice}`);

  /* revalidatePath is synchronous with the action, but the next request is what
     regenerates the page — poll briefly rather than assume an instant flip. */
  const expected = `₹ ${Number(newPrice).toLocaleString("en-IN")}`;
  let after = "";
  for (let i = 0; i < 10; i++) {
    after = await priceOnPdp();
    if (after === expected) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`PDP price after:  ${after}`);

  if (after !== expected) {
    console.error(`\nFAIL — expected "${expected}" on the prerendered page, got "${after}"`);
    failed = true;
  } else {
    console.log(`\nPASS — the prerendered page picked up the admin edit.`);
  }
} catch (err) {
  console.error("FAIL —", err.message);
  failed = true;
} finally {
  await browser.close();
  process.exit(failed ? 1 : 0);
}
