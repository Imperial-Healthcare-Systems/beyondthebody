// Capture the pinned seam at a chosen scroll progress on the FULL page.
//   node scripts/shoot-pin.mjs [progress]   (progress 0..1 through the pin; default .9)
// Loads /, drives Lenis to (band pin-start + progress*pinDistance), waits for
// the scrub to settle, and screenshots the VIEWPORT (not fullPage).
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");
const base = "http://localhost:3000";
const progress = Number(process.argv[2] ?? 0.9);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.addStyleTag({
  content:
    "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}",
});
await page.evaluate(async () => {
  if (document.fonts?.ready) await document.fonts.ready;
});

// drive Lenis to the pinned band, at the requested progress through the pin
await page.evaluate((p) => {
  const band = document.querySelector(".bridge__band");
  if (!band) return;
  const r = band.getBoundingClientRect();
  const bandTopAbs = r.top + window.scrollY;
  const vh = window.innerHeight;
  // pin start for start:"bottom bottom" — when the band's bottom hits vh bottom
  const startY = bandTopAbs - vh + r.height;
  const pinDistance = vh * 1.18; // matches end: "+=118%"
  const target = startY + p * pinDistance;
  const lenis = window.__lenis;
  if (lenis) lenis.scrollTo(target, { immediate: true });
  else window.scrollTo(0, target);
}, progress);

await page.waitForTimeout(1600); // let the scrub + easing settle

const file = `${OUT}/seam-pinned-p${String(progress).replace(".", "")}.png`;
await page.screenshot({ path: file }); // viewport only
console.log(`  seam-pin → ${file}  [${errors.length ? "⚠ " + errors.length + " err" : "clean"}]`);
errors.forEach((e) => console.log("      " + e));

await browser.close();
process.exit(errors.length ? 1 : 0);
