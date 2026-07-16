// Crop the 11 ingredient cutouts from the transparent note sheet (user-supplied,
// Photoroom-cleaned) into individual PNGs for the PDP composition note-circles.
// Auto-trims each rough region to the ingredient's real alpha bounds, so the crops
// come out tight + centred regardless of loose region estimates. Also writes a
// contact sheet for eyeballing. Run once (asset build): node scripts/make-note-cutouts.mjs
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/products/notes");
const SRC = "C:/Users/garvi/Downloads/ChatGPT Image Jul 16, 2026, 05_02_41 PM-Photoroom.png";

// rough regions (fractions of the sheet), each bounding ONE ingredient (auto-trim does the rest)
const REGIONS = [
  { key: "ambroxan",     x0: 0.08, x1: 0.32, y0: 0.03, y1: 0.32 },
  { key: "bergamot",     x0: 0.34, x1: 0.62, y0: 0.02, y1: 0.33 },
  { key: "orris-root",   x0: 0.64, x1: 0.92, y0: 0.03, y1: 0.32 },
  { key: "jasmine",      x0: 0.02, x1: 0.20, y0: 0.36, y1: 0.66 },
  { key: "woody-notes",  x0: 0.21, x1: 0.39, y0: 0.36, y1: 0.66 },
  { key: "floral-notes", x0: 0.40, x1: 0.58, y0: 0.36, y1: 0.66 },
  { key: "amber",        x0: 0.60, x1: 0.77, y0: 0.38, y1: 0.66 },
  { key: "ambergris",    x0: 0.78, x1: 0.99, y0: 0.36, y1: 0.66 },
  { key: "musk",         x0: 0.28, x1: 0.47, y0: 0.66, y1: 0.92 },
  { key: "cachalox",     x0: 0.50, x1: 0.70, y0: 0.66, y1: 0.92 },
  { key: "patchouli",    x0: 0.70, x1: 0.96, y0: 0.66, y1: 0.92 },
];

await mkdir(OUT, { recursive: true });
const b64 = (await readFile(SRC)).toString("base64");
const dataUrl = `data:image/png;base64,${b64}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const results = await page.evaluate(async ({ dataUrl, REGIONS }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;

  const trimAndExport = (region) => {
    const sx = Math.round(region.x0 * W), sy = Math.round(region.y0 * H);
    const sw = Math.round((region.x1 - region.x0) * W), sh = Math.round((region.y1 - region.y0) * H);
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    // alpha bounding box
    let minX = sw, minY = sh, maxX = 0, maxY = 0, any = false;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (d[(y * sw + x) * 4 + 3] > 24) {
          any = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!any) return { key: region.key, dataUrl: null };
    const padX = Math.round((maxX - minX) * 0.06), padY = Math.round((maxY - minY) * 0.06);
    minX = Math.max(0, minX - padX); minY = Math.max(0, minY - padY);
    maxX = Math.min(sw - 1, maxX + padX); maxY = Math.min(sh - 1, maxY + padY);
    const tw = maxX - minX + 1, th = maxY - minY + 1;
    const t = document.createElement("canvas");
    t.width = tw; t.height = th;
    t.getContext("2d").drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
    return { key: region.key, dataUrl: t.toDataURL("image/png"), w: tw, h: th };
  };

  const out = REGIONS.map(trimAndExport);

  // contact sheet: cutouts on a dark grid
  const cols = 4, cell = 220, pad = 16;
  const rows = Math.ceil(out.length / cols);
  const cs = document.createElement("canvas");
  cs.width = cols * cell; cs.height = rows * cell;
  const cx = cs.getContext("2d");
  cx.fillStyle = "#241016"; cx.fillRect(0, 0, cs.width, cs.height);
  await Promise.all(out.map((o, i) => new Promise((res) => {
    if (!o.dataUrl) return res();
    const im = new Image();
    im.onload = () => {
      const col = i % cols, row = Math.floor(i / cols);
      const box = cell - pad * 2;
      const scale = Math.min(box / im.width, box / im.height);
      const w = im.width * scale, h = im.height * scale;
      cx.drawImage(im, col * cell + (cell - w) / 2, row * cell + (cell - h) / 2, w, h);
      cx.fillStyle = "#E2CBA6"; cx.font = "13px sans-serif"; cx.textAlign = "center";
      cx.fillText(o.key, col * cell + cell / 2, row * cell + cell - 4);
      res();
    };
    im.src = o.dataUrl;
  })));

  return { W, H, out, contact: cs.toDataURL("image/png") };
}, { dataUrl, REGIONS });

console.log(`sheet ${results.W}x${results.H}`);
for (const o of results.out) {
  if (!o.dataUrl) { console.log(`  ✗ ${o.key}: EMPTY region`); continue; }
  const buf = Buffer.from(o.dataUrl.split(",")[1], "base64");
  await writeFile(resolve(OUT, `${o.key}.png`), buf);
  console.log(`  ✓ ${o.key}.png (${o.w}x${o.h})`);
}
await writeFile(resolve(OUT, "_contact.png"), Buffer.from(results.contact.split(",")[1], "base64"));
console.log("  contact → public/products/notes/_contact.png");
await browser.close();
