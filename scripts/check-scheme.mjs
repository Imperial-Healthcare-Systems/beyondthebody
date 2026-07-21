/* check-scheme.mjs — verifies the dark-mode token engine end to end.
   Asserts, on a real page:
     1 · LIGHT is the default, even when the OS asks for dark (client,
         2026-07-21 — prefers-color-scheme is deliberately NOT an input)
     2 · the drawer toggle flips it, persists, and survives a reload
     3 · the two-axis semantics resolve to DIFFERENT grounds per register
     4 · no console errors
   Run:  node scripts/check-scheme.mjs [route]
*/
import { chromium } from "playwright";

const route = process.argv[2] ?? "/";
const base = "http://localhost:3000";

const probe = () => {
  const root = document.documentElement;
  const read = (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim();
  const light = document.querySelector('[data-theme="light"]');
  const dark = document.querySelector('[data-theme="dark"]');
  return {
    scheme: root.getAttribute("data-scheme"),
    stored: (() => { try { return localStorage.getItem("btb-scheme"); } catch { return "ERR"; } })(),
    lightGround: light ? read(light, "--ground") : null,
    lightInk: light ? read(light, "--ink") : null,
    darkGround: dark ? read(dark, "--ground") : null,
    darkInk: dark ? read(dark, "--ink") : null,
    bodyBg: read(document.body, "background-color"),
    filmBlend: light ? read(light, "--film-blend") : null,
  };
};

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`); if (!cond) fails.push(msg); };

for (const colorScheme of ["light", "dark"]) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(probe);
  console.log(`\n=== OS prefers-color-scheme: ${colorScheme} · ${route} ===`);
  console.log(r);

  // LIGHT is the default regardless of the OS — that is the point of this pass.
  ok(r.scheme === "light", `defaults to LIGHT even with OS "${colorScheme}" (got "${r.scheme}")`);
  ok(r.stored === null, `nothing persisted until the visitor chooses (got ${JSON.stringify(r.stored)})`);
  if (r.lightGround && r.darkGround) {
    ok(
      r.lightGround !== r.darkGround,
      `the two registers keep DIFFERENT grounds — light:${r.lightGround} vs dark:${r.darkGround}`
    );
  }
  ok(errors.length === 0, `no console errors${errors.length ? " → " + errors.slice(0, 3).join(" | ") : ""}`);

  await browser.close();
}

// --- toggle round-trip. Run with the OS asking for DARK, to prove the toggle
//     (not the media query) is what moves the scheme. ---
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  console.log(`\n=== drawer toggle round-trip ===`);
  const before = await page.evaluate(probe);
  ok(before.scheme === "light", `starts light despite a dark OS (got "${before.scheme}")`);

  await page.click(".nav__menu");
  await page.waitForTimeout(600);
  const toggleVisible = await page.isVisible(".schemetoggle");
  ok(toggleVisible, "Appearance control is present in the drawer");

  const optLabels = await page.$$eval(".schemetoggle__opt", (els) =>
    els.map((e) => e.textContent.trim())
  );
  ok(
    optLabels.length === 2 && optLabels.join("/") === "Light/Dark",
    `exactly two options, Light + Dark (got ${JSON.stringify(optLabels)})`
  );

  await page.click('.schemetoggle__opt:has-text("Dark")');
  await page.waitForTimeout(700);
  const after = await page.evaluate(probe);
  ok(after.scheme === "dark", `toggle flipped the scheme (got "${after.scheme}")`);
  ok(after.stored === "dark", `preference persisted (got ${JSON.stringify(after.stored)})`);
  ok(after.bodyBg !== before.bodyBg, `body ground actually repainted (${before.bodyBg} -> ${after.bodyBg})`);

  // survives a reload with the OS still light
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const reloaded = await page.evaluate(probe);
  ok(reloaded.scheme === "dark", `pinned preference survives reload (got "${reloaded.scheme}")`);

  // and back again — a one-way toggle would be a trap
  await page.click(".nav__menu");
  await page.waitForTimeout(600);
  await page.click('.schemetoggle__opt:has-text("Light")');
  await page.waitForTimeout(700);
  const back = await page.evaluate(probe);
  ok(back.scheme === "light", `toggles back to light (got "${back.scheme}")`);
  ok(back.stored === "light", `light is persisted explicitly (got ${JSON.stringify(back.stored)})`);
  ok(back.bodyBg === before.bodyBg, `returns to the exact original ground (${back.bodyBg})`);

  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : "\nAll checks passed.");
process.exit(fails.length ? 1 : 0);
