// Footer capture — drives Lenis to several scroll fractions and grabs the VIEWPORT
// at each (the sticky reveal is a pinned end-state that fullPage can't show).
//   node scripts/shoot-footer.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");
const base = "http://localhost:3000";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const shots = [
  { label: "desktop", width: 1440, height: 900, fracs: [0, 0.32, 0.62, 0.82, 1] },
  { label: "mobile", width: 390, height: 844, fracs: [0, 0.4, 0.7, 1] },
];

let totalErr = 0;
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}/preview/newsletter`, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({ content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}" });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  for (let i = 0; i < s.fracs.length; i++) {
    const f = s.fracs[i];
    await page.evaluate(async (frac) => {
      const max = document.body.scrollHeight - window.innerHeight;
      const y = max * frac;
      const lenis = window.__lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 700));
    }, f);
    const file = `${OUT}/footer-${s.label}-${i}.png`;
    await page.screenshot({ path: file });
  }
  const tag = errors.length ? `⚠ ${errors.length} err` : "clean";
  console.log(`  ${s.label} → footer-${s.label}-[0..${s.fracs.length - 1}].png  [${tag}]`);
  errors.forEach((e) => console.log("      " + e));
  totalErr += errors.length;
  await ctx.close();
}

await browser.close();
console.log(totalErr ? `\n⚠ ${totalErr} console error(s)` : "\n✓ zero console errors");
process.exit(totalErr ? 1 : 0);
