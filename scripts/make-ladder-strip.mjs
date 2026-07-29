/* Build public/scale/ladder.webp — the concentration ladder's four bottles as ONE asset,
   cut from the client's background-removed reference composition.
   Run:  node scripts/make-ladder-strip.mjs "C:/Users/garvi/Downloads/Product bottles/image-Photoroom.png"

   WHY A CROP AND NOT THE FILE AS SUPPLIED. The supplied asset is the whole reference
   composition with its ground knocked out — so it still carries the title, the subtitle, the
   category labels, the percentages, the longevity line, the foot rule and the house
   statement, baked into pixels. Two problems with shipping that: the copy and the
   client-specified percentage bands would stop being live text (uneditable, unselectable,
   invisible to a screen reader, and duplicated by the markup that already renders them), and
   the background removal damaged several of those strings ("ODY MIST / BODY SPL", "AU DE
   COLOGNL", and the 01-04 index numbers reduced to fragments). So this takes only the band
   that holds the four bottles and drops everything else.

   GEOMETRY. Measured from THIS file's ALPHA CHANNEL, which is the most accurate source we
   have had: with the ground removed, each bottle's silhouette is exact, so the bases and
   heights are read directly instead of inferred. That corrected two errors in the previous
   pass, which had traced the ladder line and assumed the bottles stood on it:
     · tread 1 was extrapolated 24px too low (the line trace never reached column 1)
     · the bottles do NOT stand on the line. Their bases sit 23-40px ABOVE the markers,
       because a bottle rests at the BACK of a tread while the marker sits on its front lip.
   The crop is the STAGE's content box, x 157..1618 — the same span the rendered stage
   occupies — so the four bottles land on the four column centres for free, with no
   per-bottle positioning. Its bottom edge is column 1's base, so aligning the strip's bottom
   to tread 1 in CSS puts every other bottle on its own tread automatically: the rises
   between the bases are baked into the asset at the same ratios the CSS steps use.

   PER-COLUMN ERASE. Each bottle's base sits at or above the crop's bottom edge, so the space
   under bottles 2-4 would otherwise still hold the marker rings and the ghost index numbers.
   Each column is cleared below its own bottle's base (+3px of slack).

   IT ALSO EMITS THE FOUR SINGLES. Below 720px the composition becomes a 2x2 and a single
   four-across strip cannot reflow, so the individual bottles are cut from the SAME source.
   That matters tonally: the reference's bottles read as DARK glass because the dark ground
   showed through them, where the raw product renders these previously came from are bright
   clear glass and read as a foreign object on this beat's oxblood. Cutting both from one
   source keeps the two breakpoints speaking the same visual language.

   EDGE BLEED. Background removal zeroes alpha but leaves the old RGB behind it. When the
   browser downscales, it resamples colour and alpha together, so that hidden dark RGB bleeds
   into the visible edge as a halo against our lighter ground. Ten passes push opaque colour
   outward into the transparent pixels first, leaving alpha untouched. Same treatment as
   make-scale-bottles.mjs. */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/make-ladder-strip.mjs "<path to image-Photoroom.png>"');
  process.exit(1);
}
const OUT = path.join(process.cwd(), "public", "scale", "ladder.webp");

// ---- measured reference geometry (frame coordinates, 1774x887) ----
/* Per-column bottle silhouettes, read from this file's alpha channel. Column centres are
   19.17 / 38.90 / 59.75 / 80.98% of the frame — an even pitch of 20.603% — which puts the
   four-column stage span at 8.868%..91.282%, i.e. x 157..1618. */
const BOTTLE = [
  { x0: 306, x1: 374, y0: 267, y1: 559 }, // Body Mist
  { x0: 636, x1: 744, y0: 235, y1: 519 }, // Eau de Cologne
  { x0: 985, x1: 1135, y0: 182, y1: 471 }, // Eau de Toilette
  { x0: 1351, x1: 1522, y0: 125, y1: 423 }, // Eau de Parfum
];
const CROP = { left: 157, top: 125, width: 1462, height: 435 }; // top = highest cap, bottom = lowest base
const BASE = BOTTLE.map((b) => b.y1);
// the four equal column boundaries across the crop, in crop coordinates
const EDGE = [0, 366, 731, 1096, 1462];
const KEEP_BELOW_BASE = 3; // px of slack so a base measured 1px high cannot clip the glass
const SINGLES = ["mist", "edc", "edt", "edp"]; // index-matched to CONCENTRATION_SCALE

const src = sharp(SRC);
const meta = await src.metadata();
if (meta.width !== 1774 || meta.height !== 887) {
  console.error(
    `unexpected source size ${meta.width}x${meta.height} — the measured crop assumes the ` +
      `1774x887 reference frame. Re-measure before trusting the output.`
  );
  process.exit(1);
}

const { data, info } = await src
  .extract(CROP)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const W = info.width;
const H = info.height;
const CH = info.channels; // 4
const px = Buffer.from(data);
const A = (x, y) => px[(y * W + x) * CH + 3];

// ---- 1. per-column erase below each bottle's own base ----
let erased = 0;
for (let c = 0; c < 4; c++) {
  const cut = Math.round(BASE[c] - CROP.top) + KEEP_BELOW_BASE;
  for (let y = cut; y < H; y++) {
    for (let x = EDGE[c]; x < EDGE[c + 1]; x++) {
      const i = (y * W + x) * CH;
      if (px[i + 3] !== 0) erased++;
      px[i + 3] = 0;
    }
  }
  console.log(`  col ${c + 1}: cleared below y=${cut} across x ${EDGE[c]}..${EDGE[c + 1] - 1}`);
}
console.log(`  ${erased} pixels cleared (ghost index numbers + stray matte)`);

// ---- 2. edge bleed: push opaque RGB outward into transparent pixels, alpha untouched ----
const PASSES = 10;
for (let pass = 0; pass < PASSES; pass++) {
  const snapshot = Buffer.from(px);
  const snapA = (x, y) => snapshot[(y * W + x) * CH + 3];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (snapA(x, y) !== 0) continue; // only fill transparent pixels
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = (ny * W + nx) * CH;
          // a donor is any neighbour that already carries colour (opaque, or filled earlier)
          if (snapshot[j + 3] === 0 && !(pass > 0 && snapshot[j] + snapshot[j + 1] + snapshot[j + 2] > 0)) continue;
          r += snapshot[j]; g += snapshot[j + 1]; b += snapshot[j + 2]; n++;
        }
      }
      if (!n) continue;
      const i = (y * W + x) * CH;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
    }
  }
}

// ---- 3. report alpha coverage, so a bad cutout is visible in the log ----
let opaque = 0, partial = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const a = A(x, y);
  if (a === 255) opaque++;
  else if (a > 0) partial++;
}
console.log(
  `  coverage: ${((opaque / (W * H)) * 100).toFixed(1)}% opaque, ` +
    `${((partial / (W * H)) * 100).toFixed(1)}% partial (soft edges), rest clear`
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(px, { raw: { width: W, height: H, channels: CH } })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(OUT);

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`\nwrote ${OUT}  ${W}x${H}  ${kb}KB   aspect ${(W / H).toFixed(4)}`);
// ---- 4. the derived numbers the stylesheet needs, printed so they are never hand-guessed --
const SPAN_CQW = 86.44; // the stage's content span, as a share of the section's inner box
const cqw = (pxAcross) => ((pxAcross / W) * SPAN_CQW).toFixed(3);
console.log(`
DERIVED  (these are CONCENTRATION_LADDER in house-copy.ts)`);
console.log(`  strip aspect              ${(W / H).toFixed(4)}`);
console.log(`  strip height              ${cqw(H)} cqw`);
console.log(`  base rises (cumulative)   ${BASE.map((b) => cqw(BASE[0] - b)).join(", ")} cqw`);
{
  const h = BOTTLE.map((b) => b.y1 - b.y0 + 1);
  const m = Math.max(...h);
  console.log(`  bottle heights            ${h.join(", ")} px  ->  ${h.map((v) => ((v / m) * 100).toFixed(1)).join(" / ")}`);
}

// ---- 5. the four singles, for the 2x2 below 720px ----
console.log(`
SINGLES  (same source, so both breakpoints match tonally)`);
for (let c = 0; c < 4; c++) {
  const b = BOTTLE[c];
  const one = await sharp(SRC)
    .extract({ left: b.x0, top: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const q = Buffer.from(one.data);
  const OW = one.info.width, OH = one.info.height, OC = one.info.channels;
  for (let pass = 0; pass < PASSES; pass++) {
    const snap = Buffer.from(q);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      if (snap[(y * OW + x) * OC + 3] !== 0) continue;
      let r = 0, g = 0, bl = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= OW || ny >= OH) continue;
        const j = (ny * OW + nx) * OC;
        if (snap[j + 3] === 0 && !(pass > 0 && snap[j] + snap[j + 1] + snap[j + 2] > 0)) continue;
        r += snap[j]; g += snap[j + 1]; bl += snap[j + 2]; n++;
      }
      if (!n) continue;
      const i = (y * OW + x) * OC;
      q[i] = Math.round(r / n); q[i + 1] = Math.round(g / n); q[i + 2] = Math.round(bl / n);
    }
  }
  const dest = path.join(path.dirname(OUT), `${SINGLES[c]}.webp`);
  await sharp(q, { raw: { width: OW, height: OH, channels: OC } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(dest);
  console.log(`  ${SINGLES[c]}.webp  ${OW}x${OH}  ${(fs.statSync(dest).size / 1024).toFixed(1)}KB`);
}
