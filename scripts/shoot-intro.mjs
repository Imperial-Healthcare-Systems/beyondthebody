// Intro-reel capture — steps the opening sequence and grabs a strip of frames
// so the choreography (curtain → reel → settle → hero copy) can be reviewed as
// stills. The intro is once-per-session, so each run uses a FRESH context.
//   node scripts/shoot-intro.mjs
import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots/intro");
const base = process.env.BTB_BASE || "http://localhost:3000";

// ms from navigation. The curtain runs ~1.2–1.8s (bar fill), + 0.5s handoff,
// + 4s of travel, then the dissolve and the hero copy.
const MARKS = [0, 300, 700, 1000, 1300, 1700, 2200, 2800, 3400, 4000, 4400, 4900, 5600, 6600];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const log = [];
await page.exposeFunction("__mark", (name, t) => log.push(`${name} @ ${t}ms`));
await page.addInitScript(() => {
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  window.addEventListener("btb:preload-done", () => window.__mark("preload-done", at()));
  const obs = new MutationObserver(() => {
    const c = document.documentElement.className;
    if (c.includes("btb-intro-mark") && !window.__sawMark) {
      window.__sawMark = 1;
      window.__mark("nav ⚥ in", at());
    }
    if (!c.includes("btb-preloading") && window.__sawLock && !window.__sawUnlock) {
      window.__sawUnlock = 1;
      window.__mark("scroll restored", at());
    }
    if (c.includes("btb-preloading")) window.__sawLock = 1;
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
});

await page.goto(base, { waitUntil: "domcontentloaded" });

// Time from the REEL's start, not from navigation: in dev, hydration can take
// seconds and would smear every mark. Wait for the curtain to begin lifting.
await page.waitForSelector(".preloader.is-done", { timeout: 60000 });
const nav = Date.now();

// Name each frame by the elapsed time it was ACTUALLY taken at: a screenshot
// costs a few hundred ms, so the requested mark and the real one drift apart.
for (const m of MARKS) {
  const wait = m - (Date.now() - nav);
  if (wait > 0) await page.waitForTimeout(wait);
  const at = Date.now() - nav;
  await page.screenshot({ path: resolve(OUT, `t${String(at).padStart(5, "0")}.png`) });
}

console.log("events:\n  " + log.join("\n  "));
console.log(`\nframes → ${OUT}`);
await browser.close();
