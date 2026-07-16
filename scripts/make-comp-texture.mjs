// Crop a dark rock texture out of the Don Amour scene, for the composition section's
// MOBILE background (where the full-bleed scene is dropped). Playwright/canvas since
// sharp/IM aren't available. node scripts/make-comp-texture.mjs
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../public/products/notes/don-amour-scene.png");
const OUT = resolve(__dirname, "../public/products/notes/comp-texture.jpg");

const b64 = (await readFile(SRC)).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  // upper-right rock face — dark, textured, clear of the bottle (centre) and the
  // flower/lime props (lower-centre)
  const r = { x0: 0.72, x1: 0.99, y0: 0.03, y1: 0.6 };
  const sx = Math.round(r.x0 * W), sy = Math.round(r.y0 * H);
  const sw = Math.round((r.x1 - r.x0) * W), sh = Math.round((r.y1 - r.y0) * H);
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL("image/jpeg", 0.82);
}, `data:image/png;base64,${b64}`);

await writeFile(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log("wrote comp-texture.jpg");
await browser.close();
