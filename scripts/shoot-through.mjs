// Full-page scroll-through capture for TALL beats whose reveals are component
// GSAP ScrollTriggers (once:true) below the fold — steps Lenis top→bottom so every
// trigger fires, then screenshots the whole page in end-state.
//   node scripts/shoot-through.mjs <beatKey>
//   node scripts/shoot-through.mjs --home     -> the assembled page (/)
//
// USE THIS, NOT shoot.mjs, FOR WHOLE-PAGE REVIEW. shoot.mjs cannot drive reveals
// (every reveal on this page is a component-owned GSAP timeline), so a fullPage
// grab there returns the page essentially blank below the hero.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");
const base = "http://localhost:3000";
const args = process.argv.slice(2);
const home = args.includes("--home");
const journal = args.includes("--journal");   // the /journal index (Sprint 02)
const article = args.includes("--article");   // a /journal/<slug> essay (Sprint 02)
const fragrance = args.includes("--fragrance"); // a /fragrance/<slug> PDP (Sprint 03)
const key = args.find((a) => !a.startsWith("--"));
if (!home && !journal && !article && !fragrance && !key) {
  console.error(
    "usage: node scripts/shoot-through.mjs <beatKey> | --home | --journal | --article <slug> | --fragrance <slug>"
  );
  process.exit(2);
}
const slug = fragrance ? key || "don-amour" : article ? key || "the-long-patience-of-composition" : null;
const route = fragrance
  ? `/fragrance/${slug}`
  : article
    ? `/journal/${slug}`
    : journal
      ? "/journal"
      : home
        ? "/"
        : `/preview/${key}`;
const name = fragrance
  ? `fragrance-${slug}`
  : article
    ? `journal-${slug}`
    : journal
      ? "journal-index"
      : home
        ? "home-through"
        : key;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

// Chromium caps a fullPage screenshot at 16384px (2^14) of DEVICE pixels and
// silently returns WHITE past that — no error, no warning. The assembled home
// page is ~11084 CSS px, so at dSF 2 (22168px) the last two beats (§10 close,
// §11 footer) vanished into white. Whole-page shots therefore go at dSF 1;
// per-beat shots stay at 2 since they're short. checkTruncation() below asserts
// this rather than trusting it.
const MAX_DEVICE_PX = 16384;
// Whole-page routes (home, /journal) go at dSF 1 — the tall footer reveal pushes
// them past Chromium's 16384 device-px cap at dSF 2. Short per-beat previews stay at 2.
const dsf = home || journal || article || fragrance ? 1 : 2;

const shots = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

let totalErr = 0;
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: dsf,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.addStyleTag({
    content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}",
  });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  // The home route holds scroll (html.btb-preloading + lenis.stop()) until the
  // preloader curtain lifts. Stepping Lenis before that scrolls nothing.
  await page.waitForFunction(() => window.__btbPreloading !== true, { timeout: 15000 });
  await page.waitForTimeout(1200); // let the hero intro settle

  // step top → bottom so every once:true trigger passes its start
  await page.evaluate(async () => {
    const lenis = window.__lenis;
    const max = document.body.scrollHeight - window.innerHeight;
    // ~half a viewport per step, so no trigger's start is jumped over. The
    // assembled home page is ~22000px tall — a fixed step count would stride
    // past whole sections and leave them unrevealed.
    const steps = Math.max(18, Math.ceil(max / (window.innerHeight / 2)));
    for (let i = 0; i <= steps; i++) {
      const y = (max * i) / steps;
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
    // settle at top for a clean full grab (end-states persist — triggers are once:true)
    if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });

  // fail loudly rather than hand back a half-white page
  const cssH = await page.evaluate(() => document.documentElement.scrollHeight);
  const deviceH = cssH * dsf;
  if (deviceH > MAX_DEVICE_PX) {
    console.log(
      `  ✗ ${s.label}: ${cssH}px × dSF ${dsf} = ${deviceH}px exceeds Chromium's ` +
        `${MAX_DEVICE_PX}px fullPage cap — everything past ${Math.floor(MAX_DEVICE_PX / dsf)}px ` +
        `would render WHITE. Lower deviceScaleFactor or capture in slices.`
    );
    totalErr += 1;
    await ctx.close();
    continue;
  }

  const file = `${OUT}/${name}-${s.label}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const tag = errors.length ? `⚠ ${errors.length} err` : "clean";
  console.log(`  ${s.label} → ${file}  [${tag}]  ${cssH}px @ dSF ${dsf}`);
  errors.forEach((e) => console.log("      " + e));
  totalErr += errors.length;
  await ctx.close();
}

await browser.close();
console.log(totalErr ? `\n⚠ ${totalErr} console error(s)` : "\n✓ zero console errors");
process.exit(totalErr ? 1 : 0);
