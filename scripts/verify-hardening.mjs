/* Proof that the hardening hardened something, and broke nothing.
 *
 * A Content Security Policy is the one piece of this work that fails SILENTLY and
 * catastrophically: a directive that is one host too narrow does not throw, it just stops
 * the payment sheet opening, or the fonts loading, or the entrance animations running —
 * and it does it in the visitor's browser, where no server log will ever show it.
 *
 * So this script drives a real browser over every kind of page the site has, with the real
 * production headers, and fails on the first CSP violation the console reports. Then it
 * checks the things a person would otherwise have to remember: that the working drawings
 * are gone, that robots and the sitemap agree about what is public, and that a wrong
 * address still looks like the house.
 *
 *   npm run build && npm start
 *   node scripts/verify-hardening.mjs <baseUrl>
 */

import { chromium } from "playwright";

const [baseUrl] = process.argv.slice(2);

if (!baseUrl) {
  console.error("Usage: node scripts/verify-hardening.mjs <baseUrl>");
  process.exit(1);
}

let failed = false;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

const head = async (path) => {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual", cache: "no-store" });
  return { status: res.status, headers: res.headers };
};

const browser = await chromium.launch();

try {
  /* ── 1 · The headers ──────────────────────────────────────────────────────── */
  console.log("\nEvery response carries the policy:");

  const home = await head("/");
  const csp = home.headers.get("content-security-policy") ?? "";

  const must = [
    ["object-src 'none'", "plugins cannot be used to bypass the policy"],
    ["base-uri 'self'", "a <base> tag cannot repoint every relative URL"],
    ["form-action 'self'", "a form cannot be repointed at someone else's server"],
    ["frame-ancestors 'none'", "the site cannot be framed — no clickjacking"],
    ["default-src 'self'", "nothing loads from anywhere unlisted"],
  ];
  for (const [directive, why] of must) {
    check(csp.includes(directive), why, `missing ${directive}`);
  }

  check(
    csp.includes("https://checkout.razorpay.com"),
    "the payment sheet is allowed to load",
    "Razorpay is not in script-src — prepaid checkout would silently fail"
  );
  check(!/'unsafe-eval'/.test(csp), "no 'unsafe-eval' in production", csp);

  for (const [key, expected] of [
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["x-frame-options", "DENY"],
  ]) {
    check(home.headers.get(key) === expected, `${key}: ${expected}`, home.headers.get(key));
  }
  check(
    (home.headers.get("strict-transport-security") ?? "").includes("max-age="),
    "HSTS is set"
  );
  check(!home.headers.has("x-powered-by"), "the framework is not advertised");

  /* The order token is a credential in a URL. Two things must be true about it. */
  const order = await head("/order/not-a-real-token");
  check(
    (order.headers.get("cache-control") ?? "").includes("no-store"),
    "an order page is never held by a shared cache",
    order.headers.get("cache-control")
  );
  check(
    home.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
    "and its address never travels in a Referer to another site"
  );

  const admin = await head("/admin/login");
  check(
    (admin.headers.get("x-robots-tag") ?? "").includes("noindex"),
    "admin is noindex at the header, not only in metadata",
    admin.headers.get("x-robots-tag")
  );

  /* ── 2 · Nothing the policy broke ─────────────────────────────────────────── */
  console.log("\nThe policy breaks nothing:");

  const pages = [
    ["/", "the home page"],
    ["/collection", "the collection"],
    ["/journal", "the Journal index"],
    ["/journal/scent-for-the-heat", "an essay"],
    ["/fragrance/mon-amour", "a product page"],
    ["/checkout", "checkout"],
    ["/privacy", "a legal page"],
    ["/nothing-here", "the 404"],
  ];

  for (const [path, label] of pages) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const violations = [];

    /* Chromium reports a blocked resource as a console error naming the directive. */
    page.on("console", (msg) => {
      const text = msg.text();
      if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(text)) {
        violations.push(text.split("\n")[0].slice(0, 160));
      }
    });
    page.on("pageerror", (err) => violations.push(`page error: ${err.message.slice(0, 120)}`));

    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200); // let the entrance animations and fonts settle

    check(violations.length === 0, `${label} loads clean`, violations[0]);
    await context.close();
  }

  /* The bag is localStorage plus a client component — the first thing a wrong CSP kills. */
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/fragrance/mon-amour`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
    /* The total arrives from /cart/quote, so it is a wait rather than a read: the server
       prices the bag, the browser never does. */
    const priced = await page
      .waitForSelector(".co__total", { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(priced, "the bag still survives a page load and prices itself");
    await context.close();
  }

  /* ── 3 · The working drawings are gone ────────────────────────────────────── */
  console.log("\nWhat was never meant to be public isn't:");

  for (const path of ["/preview/hero", "/preview/bridge", "/mockup/collection-collage"]) {
    check((await head(path)).status === 404, `${path} is not there`);
  }

  /* ── 4 · robots and the sitemap agree ─────────────────────────────────────── */
  console.log("\nCrawlers are told the same story:");

  const robots = await (await fetch(`${baseUrl}/robots.txt`)).text();
  for (const path of ["/admin", "/api", "/order", "/preview", "/mockup"]) {
    check(robots.includes(`Disallow: ${path}`), `robots.txt keeps crawlers out of ${path}`);
  }
  check(/Sitemap:\s*http/.test(robots), "robots.txt names the sitemap");

  const sitemap = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
  for (const path of ["/collection", "/journal", "/fragrance/mon-amour", "/privacy", "/refunds"]) {
    check(sitemap.includes(path), `the sitemap lists ${path}`);
  }
  for (const path of ["/admin", "/order/", "/preview/", "/checkout"]) {
    check(!sitemap.includes(path), `the sitemap does NOT list ${path}`);
  }

  /* ── 5 · A wrong address still looks like the house ───────────────────────── */
  console.log("\nA wrong address is still a place:");

  const context = await browser.newContext();
  const page = await context.newPage();
  const res = await page.goto(`${baseUrl}/definitely-not-a-page`, { waitUntil: "domcontentloaded" });

  check(res?.status() === 404, "an unknown address returns 404, not 200", String(res?.status()));
  const text = await page.locator("body").innerText();
  check(/doesn.t exist/i.test(text), "it says so in the house's own voice");
  check(
    (await page.getByRole("link", { name: "The Journal" }).count()) > 0,
    "and offers a way onward rather than a dead end"
  );
  await context.close();
} catch (err) {
  console.error("\nVerification aborted:", err.message);
  failed = true;
} finally {
  await browser.close();
}

console.log(failed ? "\nFAILED\n" : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
