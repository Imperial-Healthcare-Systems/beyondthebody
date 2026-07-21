/* optimize-png-lossless.mjs — recompress PNGs with ZERO quality loss.
   Run: node scripts/optimize-png-lossless.mjs [--write]
   Without --write it is a dry run.

   Formats are staying as-is (client, 2026-07-21), which rules out the large
   win (these are photographs in a lossless container). What is still free is
   better PNG encoding: same pixels, different filtering/deflate. Sharp often
   loses to whatever produced these files, so a result is kept ONLY if it is
   actually smaller — and only after proving it is pixel-identical.

   The proof matters. "PNG is a lossless format" guarantees the FORMAT can be
   lossless, not that a given encode preserved everything: palette reduction,
   alpha premultiplication or a colourspace shift would all still emit a valid
   PNG. So every candidate is decoded back to raw RGBA and compared byte-for-
   byte against the source. A mismatch is discarded, never written.
*/
import sharp from "sharp";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const WRITE = process.argv.includes("--write");
const PUBLIC = resolve("public");

/* Why there is a size ceiling as well as a gain floor.
   These files are version-controlled. Rewriting a 1.9 MB PNG to save 149 KB
   stores a NEW 1.75 MB blob in git forever — the repository grows by more than
   ten times what the visitor saves. For big files the trade is net-negative, so
   only recompress where the blob added is small relative to the bytes saved.
   Pass --all to override and take every win regardless. */
const ALL = process.argv.includes("--all");
const MAX_BYTES = ALL ? Infinity : 512 * 1024; // don't rewrite large blobs
const MIN_GAIN = ALL ? 0 : 0.1; // and only for a gain worth the churn

const walk = async (d) => {
  const o = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = resolve(d, e.name);
    if (e.isDirectory()) o.push(...(await walk(p)));
    else o.push(p);
  }
  return o;
};
const rel = (f) => relative(PUBLIC, f).split(sep).join("/");

// raw RGBA of a buffer, for the identity proof
const raw = (buf) => sharp(buf).ensureAlpha().raw().toBuffer();

const files = (await walk(PUBLIC)).filter((f) => f.toLowerCase().endsWith(".png"));
let before = 0, after = 0, changed = 0, rejected = 0, verified = 0;
const wins = [], skipped = [];

for (const f of files) {
  const src = await readFile(f);
  before += src.length;

  let out;
  try {
    // palette:false — never quantise. effort 10 / compressionLevel 9 = try hard.
    out = await sharp(src).png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer();
  } catch {
    after += src.length;
    continue;
  }

  if (out.length >= src.length) { after += src.length; continue; }

  const gain = 1 - out.length / src.length;
  if (src.length > MAX_BYTES || gain < MIN_GAIN) {
    skipped.push([src.length, out.length, rel(f)]);
    after += src.length;
    continue;
  }

  // prove it: decoded pixels must match exactly
  const [a, b] = await Promise.all([raw(src), raw(out)]);
  if (a.length !== b.length || !a.equals(b)) {
    rejected++;
    after += src.length;
    console.log(`  REJECT (pixels differ)  ${rel(f)}`);
    continue;
  }
  verified++;

  wins.push([src.length, out.length, rel(f)]);
  after += out.length;
  changed++;
  if (WRITE) await writeFile(f, out);
}

wins.sort((x, y) => y[0] - y[1] - (x[0] - x[1]));
const K = (b) => (b / 1024).toFixed(0).padStart(6) + "K";
console.log(`\n=== ${WRITE ? "APPLIED" : "DRY RUN"} — lossless PNG recompression ===`);
for (const [b, a, f] of wins.slice(0, 20))
  console.log(`${K(b)} -> ${K(a)}  ${((1 - a / b) * 100).toFixed(0).padStart(3)}%  ${f}`);
if (wins.length > 20) console.log(`  … and ${wins.length - 20} more`);

console.log(
  `\n  ${files.length} PNGs scanned · ${changed} smaller (all ${verified} pixel-verified)` +
    `${rejected ? ` · ${rejected} REJECTED` : ""}`
);
console.log(
  `  ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB ` +
    `(saves ${((before - after) / 1024).toFixed(0)}K, ${((1 - after / before) * 100).toFixed(1)}%)`
);
if (skipped.length) {
  const saved = skipped.reduce((s, r) => s + r[0] - r[1], 0);
  const blobs = skipped.reduce((s, r) => s + r[1], 0);
  console.log(`\n  ${skipped.length} further win(s) DEFERRED — large blob or low gain:`);
  for (const [b, a, f] of skipped)
    console.log(`    ${K(b)} -> ${K(a)}  ${((1 - a / b) * 100).toFixed(0).padStart(3)}%  ${f}`);
  console.log(
    `    Rewriting these saves ${(saved / 1024).toFixed(0)}K of page weight but adds ` +
      `~${(blobs / 1048576).toFixed(1)} MB of new blobs to git history — a net loss for the repo. ` +
      `Use --all to force.`
  );
}
if (!WRITE && changed) console.log(`\n  re-run with --write to apply`);
