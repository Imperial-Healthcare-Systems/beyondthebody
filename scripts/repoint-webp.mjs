/* Repoint every source reference at the WebP twin produced by to-webp.mjs.
   ---------------------------------------------------------------------------
   The replacement set is DERIVED, not hand-listed: a path is rewritten only if
   `<name>.webp` actually exists on disk beside `<name>.png|jpg`. That makes it
   impossible to point the site at a file that was never written.

   One case is not a like-for-like swap and is called out rather than folded in:
   /hero/hero.jpg -> /hero/hero.webp. hero.webp is NOT a conversion of hero.jpg;
   it is the CURRENT client hero, and hero.jpg is the superseded one that only the
   /mockup/collection-collage route still referenced. Repointing it is the fix for
   a known-open item, not a compression swap.

   Run:  node scripts/repoint-webp.mjs */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PUB = join(ROOT, "public");
const APP = join(ROOT, "app");

/* ---- derive the swap table from disk ---- */
const swaps = new Map();
const walkPub = (dir, rel = "") => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walkPub(abs, `${rel}/${name}`);
      continue;
    }
    const m = name.match(/^(.*)\.(png|jpe?g)$/i);
    if (!m) continue;
    if (!existsSync(join(dir, `${m[1]}.webp`))) continue;
    swaps.set(`${rel}/${name}`, `${rel}/${m[1]}.webp`);
  }
};
walkPub(PUB);

/* the one dynamic reference — PdpComposition builds note paths at runtime */
const TEMPLATES = [["/products/notes/${k}.png", "/products/notes/${k}.webp"]];

/* ---- apply across app/ ---- */
const hits = [];
const walkApp = (dir) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walkApp(abs);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(name)) continue;

    const src = readFileSync(abs, "utf8");
    let out = src;
    for (const [from, to] of swaps) out = out.split(from).join(to);
    for (const [from, to] of TEMPLATES) out = out.split(from).join(to);

    if (out === src) continue;
    writeFileSync(abs, out);
    const n = src.split("\n").reduce((a, l, i) => {
      const after = (() => {
        let x = l;
        for (const [f, t] of swaps) x = x.split(f).join(t);
        for (const [f, t] of TEMPLATES) x = x.split(f).join(t);
        return x;
      })();
      if (after !== l) a.push(i + 1);
      return a;
    }, []);
    hits.push({ file: abs.slice(ROOT.length + 1).replace(/\\/g, "/"), lines: n });
  }
};
walkApp(APP);

console.log(`swap table: ${swaps.size} assets have a .webp twin\n`);
for (const h of hits) console.log(`  ${h.file}  lines ${h.lines.join(", ")}`);
console.log(`\n${hits.length} source files repointed`);

/* ---- report anything still pointing at a raster with no twin ---- */
const left = [];
const scan = (dir) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) { scan(abs); continue; }
    if (!/\.(tsx?|css)$/.test(name)) continue;
    for (const m of readFileSync(abs, "utf8").matchAll(/["'`(]([^"'`()\s]*\.(?:png|jpe?g))/g)) {
      left.push(`${abs.slice(ROOT.length + 1).replace(/\\/g, "/")}  ${m[1]}`);
    }
  }
};
scan(APP);
if (left.length) {
  console.log(`\nstill referencing a raster (intentional or needs a look):`);
  for (const l of left) console.log(`  ${l}`);
}
