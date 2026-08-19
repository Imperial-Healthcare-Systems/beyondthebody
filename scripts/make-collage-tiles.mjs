/* COLLAGE TILES  ·  deploy-weight pass for the 404
   ---------------------------------------------------------------------------
   The 404 lays twelve house photographs out as a mosaic. Reusing the live assets
   would make an error page — the one page a visitor never chose to load — the
   heaviest cold fetch on the site: 1.78MB for twelve images that render into
   150–210px cells behind a 0.62 grade, a champagne tint, a radial ground scrim
   and a grain film.

   So they get their own derivatives. 520px on the long edge is ~2.5x the widest
   single cell and ~1.2x a 2-column span, which is more than the treatment can
   show — everything above that was paying for detail the scrim removes.

   Sources are the LIVE assets, so re-running this after a photograph is replaced
   regenerates the tile from the new one. Output is committed; this is not part
   of the build.

     node scripts/make-collage-tiles.mjs
*/

import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = resolve(__dirname, "../public");
const OUT = resolve(PUB, "collage");

/* The twelve, in the order the mosaic cycles them. Keep this list and the one in
   NotFoundCollage.tsx in step — the component reads /collage/<basename>.webp. */
const SOURCES = [
  "hero/hero.webp",
  "journal/index-lead.webp",
  "journal/essay-1-patience.webp",
  "journal/essay-2-towns.webp",
  "journal/essay-3-heat.webp",
  "sections/origin-bg.webp",
  "sections/journal.webp",
  "sections/banner-1.webp",
  "footer/reveal-desktop.webp",
  "products/collection/mon-amour.webp",
  "products/collection/don-amour.webp",
  "products/notes/don-amour-notes-grid.webp",
];

const LONG_EDGE = 520;
const QUALITY = 70;

await mkdir(OUT, { recursive: true });

let before = 0;
let after = 0;

for (const rel of SOURCES) {
  const src = resolve(PUB, rel);
  const name = basename(rel);
  const dest = resolve(OUT, name);

  const srcBytes = (await stat(src)).size;
  await sharp(src)
    /* `inside` — never upscale, never crop. The cell crops via object-fit: cover;
       cropping here would bake one aspect ratio into an asset the grid uses at
       three different ones. */
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(dest);
  const destBytes = (await stat(dest)).size;

  before += srcBytes;
  after += destBytes;
  const pct = Math.round((1 - destBytes / srcBytes) * 100);
  console.log(
    `  ${name.padEnd(30)} ${(srcBytes / 1024).toFixed(0).padStart(5)}KB → ` +
      `${(destBytes / 1024).toFixed(0).padStart(4)}KB  (-${pct}%)`
  );
}

console.log(
  `\n  total ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB ` +
    `(-${Math.round((1 - after / before) * 100)}%)`
);
