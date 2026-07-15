// Capture the real footer on the full page (all sections present) at the bottom,
// plus one mid-page grab, to sanity-check the live scrollspy + no console errors.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");
const base = "http://localhost:3000";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.addStyleTag({ content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}" });
await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

// step through so ScrollTrigger reveals fire, then settle near the bottom where the
// footer mega-nav sits in view
await page.evaluate(async () => {
  const max = document.body.scrollHeight - window.innerHeight;
  const lenis = window.__lenis;
  for (let i = 0; i <= 20; i++) {
    const y = (max * i) / 20;
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 110));
  }
  await new Promise((r) => setTimeout(r, 500));
});

// nudge up a little so the mega-nav is centred (not the image band)
await page.evaluate(async () => {
  const nav = document.querySelector(".ft__mega-row");
  if (nav) nav.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 700));
});
await page.screenshot({ path: `${OUT}/home-footer-live.png` });

console.log(`  home-footer-live.png  [${errors.length ? "⚠ " + errors.length + " err" : "clean"}]`);
errors.forEach((e) => console.log("      " + e));
await browser.close();
process.exit(errors.length ? 1 : 0);
