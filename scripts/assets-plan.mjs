/* assets-plan.mjs — DRY RUN. What is live, what is dead, what is worth converting.
   Writes nothing. Run: node scripts/assets-plan.mjs

   Liveness is NOT a plain grep. PdpComposition.tsx:61 builds note paths at
   runtime — `/products/notes/${k}.png` — so every cutout under products/notes/
   is reachable even though its filename appears nowhere in source. A naive scan
   reports 35 live files as dead; deleting on that basis would strip the PDP
   note pyramid. Dynamic prefixes are declared below and always count as live.

   Compression policy (brief: "prefer higher fidelity than compression"):
     · JPEG sources        -> LEAVE. Measured at 0.12-0.24 bpp; a re-encode at
                              our own ship quality comes out BIGGER. Already done.
     · opaque photo PNG    -> JPEG q88, 4:4:4 chroma, progressive. No subsampling
                              loss, no visible artefacting, ~88% smaller.
     · alpha photo PNG     -> WebP q92 + alphaQuality 100, so the cut-out edge
                              stays crisp (a soft alpha edge is what betrays a
                              cheap conversion). ~82% smaller.
     · anything under 40K  -> LEAVE. Not worth a generation of loss.
*/
import sharp from "sharp";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative, extname, sep, basename } from "node:path";

const PUBLIC = resolve("public");
const SRC_DIRS = ["app", "scripts"];
// paths assembled at runtime — everything beneath them is live by definition
const DYNAMIC_PREFIXES = ["/products/notes/"];

export const JPEG = { quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4", progressive: true };
export const WEBP = { quality: 92, alphaQuality: 100, effort: 5 };
const MIN_BYTES = 40 * 1024;
const PHOTO_BPP = 0.5;

const walk = async (d) => {
  const o = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = resolve(d, e.name);
    if (e.isDirectory()) o.push(...(await walk(p)));
    else o.push(p);
  }
  return o;
};
const web = (f) => "/" + relative(PUBLIC, f).split(sep).join("/");

let src = "";
for (const d of SRC_DIRS) {
  for (const f of await walk(resolve(d))) {
    if (/\.(tsx?|jsx?|css|mjs|json)$/i.test(f)) src += "\n" + (await readFile(f, "utf8"));
  }
}

const files = (await walk(PUBLIC)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const live = [], dead = [], plan = [];

for (const f of files) {
  const w = web(f);
  const isLive =
    DYNAMIC_PREFIXES.some((p) => w.startsWith(p)) || src.includes(w) || src.includes(basename(f));
  const bytes = (await stat(f)).size;
  (isLive ? live : dead).push({ f, w, bytes });
}

for (const r of live) {
  const buf = await readFile(r.f);
  const m = await sharp(buf).metadata();
  const bpp = r.bytes / ((m.width || 1) * (m.height || 1));
  if (r.bytes < MIN_BYTES) { r.action = "leave (tiny)"; continue; }
  if (m.format !== "png") { r.action = "leave (jpeg already optimal)"; continue; }
  if (bpp <= PHOTO_BPP) { r.action = "leave (dense png, flat art)"; continue; }
  const out = m.hasAlpha
    ? await sharp(buf).webp(WEBP).toBuffer()
    : await sharp(buf).jpeg(JPEG).toBuffer();
  r.action = m.hasAlpha ? "-> webp" : "-> jpeg";
  r.newBytes = out.length;
  r.ext = m.hasAlpha ? ".webp" : ".jpg";
  plan.push(r);
}

const MB = (b) => (b / 1048576).toFixed(1) + " MB";
const sum = (a, k = "bytes") => a.reduce((s, r) => s + (r[k] ?? r.bytes), 0);

console.log("=== CONVERSION PLAN (live assets only) ===");
plan.sort((a, b) => b.bytes - a.bytes);
for (const r of plan.slice(0, 14))
  console.log(`${(r.bytes / 1024).toFixed(0).padStart(6)}K -> ${(r.newBytes / 1024).toFixed(0).padStart(5)}K  ${((1 - r.newBytes / r.bytes) * 100).toFixed(0).padStart(3)}%  ${r.action.padEnd(8)} ${r.w}`);
if (plan.length > 14) console.log(`  … and ${plan.length - 14} more`);
console.log(`\n  convert ${plan.length} files: ${MB(sum(plan))} -> ${MB(sum(plan, "newBytes"))}  (saves ${((1 - sum(plan, "newBytes") / sum(plan)) * 100).toFixed(0)}%)`);

const left = live.filter((r) => !r.newBytes);
console.log(`  leave   ${left.length} live files untouched: ${MB(sum(left))}`);

dead.sort((a, b) => b.bytes - a.bytes);
console.log(`\n=== UNREFERENCED (${dead.length} files, ${MB(sum(dead))}) — NOT deleted, listed for your call ===`);
for (const r of dead.slice(0, 10)) console.log(`${(r.bytes / 1024).toFixed(0).padStart(6)}K  ${r.w}`);
if (dead.length > 10) console.log(`  … and ${dead.length - 10} more`);

const liveAfter = sum(plan, "newBytes") + sum(left);
console.log(`\n=== public/ TOTAL ===`);
console.log(`  now                : ${MB(sum(files.map((f) => ({ bytes: 0 }))) + sum(live) + sum(dead))}`);
console.log(`  after conversion   : ${MB(liveAfter + sum(dead))}`);
console.log(`  if dead also purged: ${MB(liveAfter)}`);
