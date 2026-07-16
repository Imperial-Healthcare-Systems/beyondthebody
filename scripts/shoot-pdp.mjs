// PDP capture — the /fragrance/<slug> page + the cart interaction. Viewport shots (not
// fullPage): the buy column is above the fold and the cart drawer is a fixed overlay, so
// a top-of-page grab is what we want (no 16384 fullPage cap to worry about).
//   node scripts/shoot-pdp.mjs [slug]     (default: don-amour)
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");
const base = "http://localhost:3000";
const slug = process.argv.slice(2).find((a) => !a.startsWith("--")) || "don-amour";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const shots = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

let totalErr = 0;
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}/fragrance/${slug}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({ content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}" });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(300);

  // 1 — top of the PDP
  await page.screenshot({ path: `${OUT}/pdp-${slug}-${s.label}.png` });

  // 2 — add to bag → cart drawer open
  await page.click(".buy__add");
  await page.waitForSelector(".cart.is-open", { timeout: 4000 });
  await page.waitForTimeout(700); // let the slide-in settle
  await page.screenshot({ path: `${OUT}/pdp-${slug}-cart-${s.label}.png` });

  const tag = errors.length ? `⚠ ${errors.length} err` : "clean";
  console.log(`  ${s.label} → pdp-${slug}-${s.label}.png + cart  [${tag}]`);
  errors.forEach((e) => console.log("      " + e));
  totalErr += errors.length;
  await ctx.close();
}

await browser.close();
console.log(totalErr ? `\n⚠ ${totalErr} console error(s)` : "\n✓ zero console errors");
process.exit(totalErr ? 1 : 0);
