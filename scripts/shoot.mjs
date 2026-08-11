// Isolation screenshot harness for the page_build loop.
//   node scripts/shoot.mjs <beatKey>            -> shoots /preview/<beatKey>
//   flags: --url <base> (default http://localhost:3000)
// Captures desktop [1440] + mobile [390] at deviceScaleFactor 2 and FAILS on any
// console error / page error.
//
// SCOPE: single beats that fit in (or near) the viewport, where the beat's own
// ScrollTrigger fires on load. It does NOT drive reveals — every reveal on this
// page is a component-owned GSAP timeline, so anything below the fold stays in
// its pre-reveal state.
//   · TALL beats  -> scripts/shoot-through.mjs <beatKey>
//   · WHOLE PAGE  -> scripts/shoot-through.mjs --home
// (`--home` here was removed: it produced a page that was blank below the hero.)
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../working/V/screenshots");

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const base = urlIdx >= 0 ? args[urlIdx + 1] : "http://localhost:3000";
const urlValIdx = urlIdx >= 0 ? urlIdx + 1 : -1;
const beat = args.find((a, i) => !a.startsWith("--") && i !== urlValIdx);
if (args.includes("--home")) {
  console.error("shoot.mjs cannot capture the whole page honestly — it does not drive reveals.");
  console.error("use: node scripts/shoot-through.mjs --home");
  process.exit(1);
}
if (!beat) {
  console.error("usage: node scripts/shoot.mjs <beatKey> [--url <base>]");
  process.exit(1);
}
const route = `/preview/${beat}`;
const name = beat;
const target = base + route;

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let hadError = false;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
  // hide Next's dev-tools badge so it never leaks into a review screenshot
  await page.addStyleTag({
    content:
      "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}",
  });
  await page.evaluate(async () => {
    /* Runs in the BROWSER, where `document` exists; the checker sees Node's globals here
       and cannot know that. @ts-expect-error rather than @ts-ignore so this comment
       becomes an error itself the day the types line up and it is no longer needed. */
    // @ts-expect-error -- document is the page's, not Node's
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(2400); // let entrance timelines + easing fully settle

  const file = `${OUT}/${name}-${vp.tag}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const status = errors.length ? `⚠ ${errors.length} error(s)` : "clean";
  console.log(`  ${vp.tag.padEnd(7)} → ${file}  [${status}]`);
  if (errors.length) {
    hadError = true;
    errors.forEach((e) => console.log(`      ${e}`));
  }
  await ctx.close();
}

await browser.close();
console.log(hadError ? "\n✗ console/page errors present — fix before sign-off" : "\n✓ zero console errors");
process.exit(hadError ? 1 : 0);
