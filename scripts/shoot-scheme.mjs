/* shoot-scheme.mjs — per-SECTION viewport captures in a chosen scheme.
   Whole-page grabs are useless for reviewing an art direction (Chromium's
   16384 device-px cap, and a 22000px strip you can't actually look at), so
   this drives the page like shoot-through.mjs to fire every once:true reveal,
   then parks each [data-theme] section in the viewport and shoots it.

     node scripts/shoot-scheme.mjs --dark            -> home, dark scheme
     node scripts/shoot-scheme.mjs --dark --pdp desir
     node scripts/shoot-scheme.mjs --light --contact

   Also reports, per section, the RESOLVED --ground/--ink and the section's
   data-theme, so a section that failed to migrate shows up as a stale value
   in the log without needing to eyeball the PNG.
*/
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const scheme = args.includes("--light") ? "light" : "dark";
const key = args.find((a) => !a.startsWith("--"));

let route = "/";
let name = "home";
if (args.includes("--pdp")) { route = `/fragrance/${key || "desir"}`; name = `pdp-${key || "desir"}`; }
else if (args.includes("--contact")) { route = "/contact"; name = "contact"; }
else if (args.includes("--collection")) { route = "/collection"; name = "collection"; }
else if (args.includes("--journal")) { route = "/journal"; name = "journal"; }

// same home as the other capture harnesses (project/working/V/…), NOT the
// workspace root — framework/** is read-only and must stay clean.
const OUT = resolve(__dirname, "../../working/V/scheme-shots", `${name}-${scheme}`);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: scheme,
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle", timeout: 60000 });
await page.addStyleTag({
  content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button]{display:none!important}",
});
await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
await page.waitForFunction(() => window.__btbPreloading !== true, { timeout: 15000 });
await page.waitForTimeout(1200);

const resolved = await page.evaluate(() => document.documentElement.getAttribute("data-scheme"));
console.log(`route ${route} · requested ${process.env.__S || ""} · data-scheme = ${resolved}\n`);

// drive every once:true reveal
await page.evaluate(async () => {
  const lenis = window.__lenis;
  const max = document.body.scrollHeight - window.innerHeight;
  const steps = Math.max(18, Math.ceil(max / (window.innerHeight / 2)));
  for (let i = 0; i <= steps; i++) {
    const y = (max * i) / steps;
    if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
});

const sections = await page.evaluate(() =>
  Array.from(document.querySelectorAll("[data-theme]")).map((el, i) => {
    const cs = getComputedStyle(el);
    return {
      i,
      theme: el.dataset.theme,
      cls: (el.className || "").split(" ")[0] || el.tagName.toLowerCase(),
      id: el.id || "",
      ground: cs.getPropertyValue("--ground").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      bg: cs.backgroundColor,
      top: el.getBoundingClientRect().top + window.scrollY,
      h: el.getBoundingClientRect().height,
    };
  })
);

for (const s of sections) {
  await page.evaluate((top) => {
    const lenis = window.__lenis;
    if (lenis) lenis.scrollTo(top, { immediate: true }); else window.scrollTo(0, top);
  }, s.top);
  await page.waitForTimeout(450);
  const file = `${OUT}/${String(s.i).padStart(2, "0")}-${s.cls}${s.id ? "-" + s.id : ""}.png`;
  await page.screenshot({ path: file });
  console.log(
    `  ${String(s.i).padStart(2)} ${s.cls.padEnd(10)} theme=${(s.theme || "").padEnd(5)} ` +
      `--ground:${s.ground.padEnd(9)} --ink:${s.ink.padEnd(9)} painted:${s.bg}`
  );
}

console.log(`\n${sections.length} sections -> ${OUT}`);
console.log(errors.length ? `⚠ ${errors.length} console error(s):\n  ${errors.slice(0, 6).join("\n  ")}` : "✓ zero console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
