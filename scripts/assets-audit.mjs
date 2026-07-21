/* assets-audit.mjs — DRY RUN. Decides which assets are worth recompressing.
   Writes nothing.

   The point is to NOT re-encode already-optimized files: every lossy re-encode
   costs a generation of quality, so a file only qualifies if a HIGH-QUALITY
   trial encode saves real bytes. Heuristics used:

     bpp  = bytes / (w*h)   — the honest "is this dense?" measure. A tuned
            photographic JPEG lands ~0.08–0.25 bpp; >0.5 is untouched output.
     trial = re-encode at the quality we would actually ship, in memory, and
            compare. If it saves < MIN_GAIN, it is already optimized → SKIP.

   Run: node scripts/assets-audit.mjs
*/
import sharp from "sharp";
import { readdir, stat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, "../public");

// Quality-first settings. These are deliberately high: the brief is
// "prefer higher fidelity than compression".
export const JPEG = { quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4", progressive: true };
export const PNG = { compressionLevel: 9, effort: 10, palette: false };
const MIN_GAIN = 0.15; // must save >=15% to be worth a re-encode
const MIN_BYTES = 40 * 1024; // ignore anything already tiny

const walk = async (d) => {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = resolve(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
};

const IMG = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const files = (await walk(PUBLIC)).filter((f) => IMG.has(extname(f).toLowerCase()));

const rows = [];
for (const f of files) {
  const bytes = (await stat(f)).size;
  const buf = await readFile(f);
  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    continue;
  }
  const { width: w = 0, height: h = 0, hasAlpha, format } = meta;
  const px = w * h || 1;
  const bpp = bytes / px;

  // trial encode at ship quality, same format
  let trial = bytes;
  let trialFmt = format;
  try {
    if (format === "png" && hasAlpha) {
      trial = (await sharp(buf).png(PNG).toBuffer()).length;
    } else if (format === "png") {
      // opaque PNG holding a photograph — report BOTH: lossless png, and what
      // jpeg would cost (a format change needs code edits, so it is a decision)
      trial = (await sharp(buf).png(PNG).toBuffer()).length;
      trialFmt = "png";
    } else {
      trial = (await sharp(buf).jpeg(JPEG).toBuffer()).length;
    }
  } catch { /* leave trial = bytes */ }

  let jpegAlt = null;
  if (format === "png" && !hasAlpha) {
    try { jpegAlt = (await sharp(buf).jpeg(JPEG).toBuffer()).length; } catch {}
  }

  const gain = 1 - trial / bytes;
  /* Verdict. The subtlety worth keeping: "same-format re-encode doesn't help"
     is NOT the same as "already optimized". A photograph stored as PNG has a
     bpp around 1.0–1.6 and cannot be improved by ANY png encoder — it is
     simply the wrong container. Calling that "optimized" (an earlier cut of
     this script did) hides the single biggest win in the tree. */
  const PHOTO_BPP = 0.5;
  const verdict =
    bytes < MIN_BYTES
      ? "tiny-skip"
      : format === "png" && bpp > PHOTO_BPP
        ? hasAlpha
          ? "WRONG-FORMAT(webp)" // photo + transparency → webp keeps alpha
          : "WRONG-FORMAT(jpeg)" // opaque photo in a lossless container
        : gain >= MIN_GAIN
          ? "RECOMPRESS"
          : "already-optimized";

  rows.push({ f, rel: relative(PUBLIC, f).replace(/\\/g, "/"), bytes, w, h, bpp, hasAlpha, format, trial, trialFmt, jpegAlt, gain, verdict });
}

const kb = (b) => (b / 1024).toFixed(0).padStart(6) + "K";
rows.sort((a, b) => b.bytes - a.bytes);

console.log("=== TOP 25 BY SIZE ===");
console.log("  size    dims          bpp   a  fmt   trial   gain   verdict            file");
for (const r of rows.slice(0, 25)) {
  console.log(
    `${kb(r.bytes)} ${String(r.w + "x" + r.h).padEnd(12)} ${r.bpp.toFixed(2).padStart(5)} ${r.hasAlpha ? "A" : " "}  ${String(r.format).padEnd(4)} ${kb(r.trial)} ${(r.gain * 100).toFixed(0).padStart(4)}%  ${r.verdict.padEnd(17)} ${r.rel}`
  );
}

const tot = (arr, k = "bytes") => arr.reduce((s, r) => s + r[k], 0);
const recomp = rows.filter((r) => r.verdict === "RECOMPRESS");
const already = rows.filter((r) => r.verdict === "already-optimized");
const tiny = rows.filter((r) => r.verdict === "tiny-skip");

console.log(`\n=== SUMMARY (${rows.length} images, ${(tot(rows) / 1048576).toFixed(1)} MB) ===`);
console.log(`  already optimized : ${String(already.length).padStart(3)}  (${(tot(already) / 1048576).toFixed(1)} MB)  -> LEAVE ALONE`);
console.log(`  tiny (<40K)       : ${String(tiny.length).padStart(3)}  (${(tot(tiny) / 1048576).toFixed(1)} MB)  -> leave alone`);
console.log(`  worth recompress  : ${String(recomp.length).padStart(3)}  (${(tot(recomp) / 1048576).toFixed(1)} MB -> ${(tot(recomp, "trial") / 1048576).toFixed(1)} MB, saves ${((1 - tot(recomp, "trial") / tot(recomp)) * 100).toFixed(0)}%)`);

const opaquePng = rows.filter((r) => r.format === "png" && !r.hasAlpha && r.jpegAlt);
if (opaquePng.length) {
  console.log(`\n=== OPAQUE PNGs HOLDING PHOTOGRAPHS (format change = code edits; DECISION) ===`);
  let a = 0, b = 0;
  for (const r of opaquePng) {
    a += r.bytes; b += r.jpegAlt;
    console.log(`  ${kb(r.bytes)} -> ${kb(r.jpegAlt)} as jpeg q88 (${((1 - r.jpegAlt / r.bytes) * 100).toFixed(0)}% )  ${r.rel}`);
  }
  console.log(`  TOTAL ${(a / 1048576).toFixed(1)} MB -> ${(b / 1048576).toFixed(1)} MB  (saves ${((1 - b / a) * 100).toFixed(0)}%)`);
}
