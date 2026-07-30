/* PUBLIC ASSET → WEBP  ·  deploy-weight pass
   ---------------------------------------------------------------------------
   The site renders every photograph through a plain <img> (GSAP owns the
   transforms and clip-paths), so Next's image optimizer never sees them and the
   raw file is what ships. A PDP was fetching 7.2MB of images. This converts the
   LIVE assets to WebP at their exact pixel dimensions — no resampling, so no
   layout or art-direction change — and reports the saving per file.

   Dimensions are preserved deliberately: the ratios in products-data.ts
   (`"1915 / 821"`, `"3 / 4"`) and the measured scale geometry are pinned to
   these sizes.

   Alpha survives: the note cutouts and circular-close are transparent, so
   alphaQuality is held at 100 while the colour channel takes the compression.

   NOT touched:
     · brand/btb-mark.png  — driven through `-webkit-mask`/`mask` in five
       stylesheets. It is small, and swapping a mask source is a needless
       compatibility risk for no measurable gain.
     · hero/hero.jpg       — converting it would collide with the REAL
       hero/hero.webp. It is the superseded hero and only the mockup route
       still points at it; handled at the reference instead.
     · anything already .webp (intro reel, hero, the concentration scale).

   Run:  node scripts/to-webp.mjs          (writes .webp beside each original)
         node scripts/to-webp.mjs --prune  (also deletes the converted original)
   The originals stay in git history either way. */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PUB = path.resolve(import.meta.dirname, "..", "public");
const PRUNE = process.argv.includes("--prune");

/* Live assets, verified by grepping every reference under app/.
   `dir` entries take the whole folder minus `skip`. */
const TARGETS = [
  { file: "sections/circular-close.png" },
  { file: "sections/origin-bg.jpg" },
  { file: "sections/journal.jpg" },
  { file: "sections/banner-1.jpg" },
  { file: "footer/reveal-desktop.jpg" },
  { file: "footer/reveal-mobile.jpg" },
  { file: "journal/essay-1-patience.jpg" },
  { file: "journal/essay-2-towns.jpg" },
  { file: "journal/essay-3-heat.jpg" },
  { file: "journal/index-lead.jpg" },
  { file: "contact/contact-linen.jpg" },
  { file: "products/collection/mon-amour.png" },
  { file: "products/collection/heart-throb.png" },
  { file: "products/collection/desir.png" },
  { file: "products/collection/don-amour.png" },
  { file: "products/fullbleed/product-1-donamour.png" },
  { file: "products/fullbleed/product-2-desir-real.png" },
  /* every note cutout — PdpComposition resolves these dynamically as
     `/products/notes/${slug}.png`, so the whole folder is live except the
     contact sheet the generator drops there. */
  { dir: "products/notes", skip: ["_contact.png"] },
];

const list = [];
for (const t of TARGETS) {
  if (t.file) {
    list.push(t.file);
    continue;
  }
  const abs = path.join(PUB, t.dir);
  for (const name of fs.readdirSync(abs).sort()) {
    if (!/\.(png|jpe?g)$/i.test(name)) continue;
    if (t.skip?.includes(name)) continue;
    list.push(`${t.dir}/${name}`);
  }
}

const kb = (b) => (b / 1024).toFixed(0).padStart(5);
let before = 0;
let after = 0;
let converted = 0;
const missing = [];

for (const rel of list) {
  const src = path.join(PUB, rel);
  if (!fs.existsSync(src)) {
    missing.push(rel);
    continue;
  }
  const out = src.replace(/\.(png|jpe?g)$/i, ".webp");

  const img = sharp(src);
  const meta = await img.metadata();
  /* q82 is where these grades stop giving anything back visually; alpha is
     kept lossless so cutout edges do not crumble against the oxblood. */
  await img
    .webp({ quality: 82, alphaQuality: 100, effort: 6 })
    .toFile(out);

  const b = fs.statSync(src).size;
  const a = fs.statSync(out).size;
  const check = await sharp(out).metadata();
  if (check.width !== meta.width || check.height !== meta.height) {
    throw new Error(`${rel}: dimensions changed ${meta.width}x${meta.height} -> ${check.width}x${check.height}`);
  }

  before += b;
  after += a;
  converted++;
  const cut = (100 * (1 - a / b)).toFixed(0);
  console.log(`${kb(b)}KB -> ${kb(a)}KB  (-${String(cut).padStart(2)}%)  ${meta.width}x${meta.height}  ${rel}`);

  if (PRUNE) fs.unlinkSync(src);
}

console.log(`\n${converted} files   ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB   saved ${((before - after) / 1048576).toFixed(1)}MB (${(100 * (1 - after / before)).toFixed(0)}%)`);
if (missing.length) console.log(`\nMISSING (not converted):\n  ${missing.join("\n  ")}`);
if (!PRUNE) console.log("\noriginals kept — rerun with --prune once references are updated");
