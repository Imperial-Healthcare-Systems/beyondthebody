/* House copy — the UNIVERSAL layer of the four fragrances. Everything true of every
   scent lives here, stated once; per-scent variation lives in products-data.ts.
   Source: the client content drop 2026-07-17, sorted in project/working/content/products/.
   Client prose is VERBATIM (copy is human_decides — transcribed, not rewritten).

   Voice decision (client, 2026-07-17): HYBRID. The house voice leads the top of the PDP
   (Story = the quiet house narrative); the client's denser Blueprint/Value/EdP prose lives
   BELOW the recommendations, in the "specs & FAQ" tail (Amazon ordering, client-directed). */

// The Eau de Parfum distinction — the one-paragraph "why 25%" (client verbatim, universal).
export const EDP_DISTINCTION =
  "Standard Eau de Parfums often rely on highly volatile, alcohol-heavy top notes that vanish within hours. By shifting the volume to a 25% oil concentration, we focus the formula on a heavy, permanent dry-down. You aren't paying for evaporating alcohol — you are investing in pure fragrance density.";

/* The concentration scale — the ladder the house measures itself against, shown on the PDP
   inside the Blueprint beat. It VISUALISES the argument EDP_DISTINCTION already makes in
   prose ("standard Eau de Parfums often rely on highly volatile, alcohol-heavy top notes
   that vanish within hours") and BLUEPRINT.threshold's "not a fleeting, diluted EDT or
   standard EDC". No claim here is new to the page.

   ⚠ BANDS ARE THE CLIENT'S, SET 2026-07-28 — do not substitute a textbook ladder.
   The first cut used the ranges on the client's own "Perfume Concentration Guide" artwork,
   which topped out at a PURE PARFUM band of 20–30% — so BTB's 25% landed one category ABOVE
   the Eau de Parfum it is sold as. That was proposed deliberately (the tension as the
   argument) and the client OVERRULED it: widen Eau de Parfum to 15–25%, drop Pure Parfum,
   and add a Body Mist / Body Splash floor. The house now reads at the CEILING of its own
   stated category rather than spilling out of it. Logged to calibration-log.jsonl.

   Ranges overlapping slightly at the seams (1–3 / 2–5) is the client's spec, not a typo.

   LONGEVITY: the client specified percentages only, so the hours are held as close to
   already-approved figures as possible —
     · Eau de Cologne 1–3 hrs and Eau de Toilette 3–4 hrs are VERBATIM from their artwork
     · Eau de Parfum is widened to 5–12 hrs because that band now runs to 25%, which is
       where the house sits: its top end is BTB's own published "up to 12 hours", so the
       band and the marker cannot contradict each other
     · Body Mist / Body Splash 1–2 hrs is the one figure with no client source (that band
       is new) — the conventional number, and the first thing to correct if they have one */
/* Subtitle — NEW COPY, client-approved 2026-07-28, transcribed from their reference
   composition. It is not in "Homepage Copy (Final)" or the PDP content drop; it exists
   because the reference sets it under the section title. Approved as the only one of the
   reference's two new strings to carry (the 01–04 index numbers were declined). */
export const CONCENTRATION_SUBTITLE = "A guide to fragrance intensity";

/* THE ≤720px SINGLES. Above that breakpoint the four bottles render as ONE image — see
   CONCENTRATION_LADDER.strip below. Both are cut from the same source by
   scripts/make-ladder-strip.mjs, so the two breakpoints match tonally; the singles exist only
   because a four-across strip cannot reflow into the 2x2 that narrow widths need.

   `w` / `h` are each asset's TRUE intrinsic pixel size — not interchangeable, and not to be
   averaged into one shared pair. They drive the <img> aspect reservation (so nothing shifts as
   the four decode) and the rendered width, which follows from the height × the asset's ratio.

   `refH` is the display height as a share of the tallest, read from the reference's ALPHA
   CHANNEL — exact silhouettes, not inferences. The four bottles are near-LEVEL,
   98.0 / 95.3 / 97.0 / 100, and the ascent is carried entirely by the platform steps. Using
   the original product renders at one uniform scale would instead give
   100 / 88.0 / 87.4 / 87.0 and stand the slimmest bottle, the Body Mist, tallest.

   ⚠ These are NOT the raw product renders any more, and their aspect ratios differ from them
   measurably (the Eau de Toilette is 0.521 here against the render's 0.462). The reference
   composition scaled its bottles non-uniformly, so the renders could never have reproduced it
   by scaling alone — which is the substantive argument for the strip. */
export const CONCENTRATION_SCALE = [
  { name: "Body Mist / Body Splash", range: "1–3%", hours: "1–2 hrs",
    img: "/scale/mist.webp", w: 69, h: 293, refH: 98.0,
    alt: "A slim cylindrical body mist bottle in smoked glass" },
  { name: "Eau de Cologne", range: "2–5%", hours: "1–3 hrs",
    img: "/scale/edc.webp", w: 109, h: 285, refH: 95.3,
    alt: "A rounded cologne flacon, lightly filled" },
  { name: "Eau de Toilette", range: "5–15%", hours: "3–4 hrs",
    img: "/scale/edt.webp", w: 151, h: 290, refH: 97.0,
    alt: "A broad eau de toilette flacon, filled to a third" },
  { name: "Eau de Parfum", range: "15–25%", hours: "5–12 hrs",
    img: "/scale/edp.webp", w: 172, h: 299, refH: 100,
    alt: "A heavy eau de parfum flacon with a spherical stopper, filled with deep amber" },
] as const;

/* THE LADDER — measured, not designed.
   Source: the client's reference composition (1774x887, frame aspect exactly 2.000; its inner
   content box — the title's left edge to the foot rule's right end — is 95.15% of that and
   2.134:1) plus its background-removed twin, whose ALPHA CHANNEL gives exact bottle
   silhouettes. Units are `cqw`: 1% of the rendered section's inner content box, so the whole
   geometry is resolution-independent. Figures measured as a share of the crop's width were
   converted by × 86.44, the stage's content span as a share of that inner box.

   TWO CORRECTIONS THE ALPHA CHANNEL FORCED, both of which had been wrong:
   1. The bottles do NOT stand on the ladder line. Their bases sit 23–40px ABOVE the markers,
      because a bottle rests at the BACK of a tread while the marker sits on its front lip.
      Hence `lineDrop` — and hence the client's "bring the line a little lower", which is the
      reference being right and the earlier build being wrong.
   2. Tread 1 had been extrapolated 24px too low: the line trace only covered x 412..1344, and
      column 1's centre at 338.5 sat outside it.

   THE LINE IS CURVED. A quadratic fit halves a straight one's residual (3.1px vs 5.2px RMS)
   and the traced slope steepens monotonically from -0.071 to -0.180 left to right. At its
   widest the measured line sits 13.0% of its total rise below the straight chord between the
   end markers. `markers` holds those four positions normalised into a 100x100 box (y down;
   100 = marker 1, the lowest, at the four EVEN column centres the grid actually renders), and
   `curveK` scales the bow away from the chord — 1 is exactly as measured. */
export const CONCENTRATION_LADDER = {
  /* The four bottles as one asset. Its width is the stage's content span and its bottom edge
     is column 1's base, so pinning those two in CSS lands every bottle on its own tread with
     no per-bottle positioning: the rises between the bases are baked in at the same ratios
     `rise` below uses. `heightCqw` mirrors the asset's own aspect and exists so the stage can
     reserve height before the image decodes. */
  strip: { src: "/scale/ladder.webp", w: 1462, h: 435, heightCqw: 25.719 },

  /* cumulative BASE rise per column, cqw — where each bottle stands. Index-matched to
     CONCENTRATION_SCALE. Non-uniform: 2.365 / 2.838 / 2.838, so the treads are not evenly
     spaced and a constant-rise model cannot draw the connector. */
  rise: [0, 2.365, 5.203, 8.041],
  totalRise: 8.041,

  /* cumulative MARKER rise per column, cqw — where the line runs. Distinct from `rise`
     above: the line has its own, slightly shallower climb (7.798 against the bases' 8.041). */
  lineY: [0, 1.585, 4.203, 7.798],
  lineTotal: 7.798,
  /* how far the line sits BELOW tread 1 — the tread's front lip, not its surface */
  lineDrop: 1.389,

  /* measured marker positions, normalised (x across the even column centres, y 100 at the
     lowest marker) */
  markers: [
    [0, 100],
    [33.33, 79.68],
    [66.67, 46.17],
    [100, 0],
  ],
  /* Bow multiplier on the curve. 1.0 = exactly as measured; 1.5 is the client's "curve it
     slightly" on top of that. The dots are derived FROM the bowed curve (PdpScale.tsx), never
     from the raw markers above, so this can move without stranding them off the line. */
  curveK: 1.5,

  /* Per-dot optical correction in px, positive = up, applied on top of the curve. Client
     direction 2026-07-29: nudge the Eau de Parfum dot up a couple of pixels. It is the one
     dot sitting on the curve's steepest run, where a hairline stroke's own width reads as the
     dot hanging slightly under the line even when its centre is mathematically on it. The
     other three need no correction. Not measured — a deliberate optical override. */
  dotNudge: [0, 0, 0, 2],
} as const;

/* The house's own position, set bottom-right under the closing divider as the reference
   does. Longevity wording is the RESOLVED 2026-07-17 figure ("up to 12 hours" — the same
   string as LONGEVITY_BADGE), deliberately the more conservative of the client's two
   phrasings (the Blueprint's "well beyond the 12-hour mark" is the other). */
export const CONCENTRATION_MARK = {
  house: "Beyond The Body",
  figure: "25%",
  hours: "up to 12 hours",
} as const;

// The Blueprint — three points. Per scent, the client varies the copy differently in each:
//   · Threshold  — stable lead + a per-scent closing clause (blueprint.thresholdTail)
//   · Longevity  — a stable opener + a FULL per-scent body (blueprint.longevityBody), because
//                  the client rewrites the whole sentence per scent (Desir/Don Amour name their
//                  own molecules), not just the tail
//   · Micro-Batch — no per-scent variation
export const BLUEPRINT = {
  threshold: {
    label: "The 25% Threshold",
    lead: "Formulated at a rare, uncompromising 25% concentration. This is not a fleeting, diluted EDT or standard EDC — it is a highly concentrated Eau de Parfum",
    // rendered: `${lead} ${product.blueprint.thresholdTail}`
  },
  longevity: {
    label: "Engineered Longevity",
    opener: "Architected to endure well beyond the 12-hour mark.",
    // rendered: `${opener} ${product.blueprint.longevityBody}`
  },
  microBatch: {
    label: "Micro-Batch Sourcing",
    body: "Blended strictly in limited, intentional runs. Small-batch maturation guarantees that every single drop maintains maximum molecular stability, freshness, and projection power upon application.",
  },
} as const;

// The Value — two points. Crowd-Vetted is fully universal; Skin-Centric has a universal
// lead + a per-scent tail (products-data.ts → skinTail).
export const VALUE = {
  crowdVetted: {
    label: "Crowd-Vetted Architecture",
    body: "Developed entirely from real-world olfactory feedback, bypassing boardroom assumptions. Every note serves a purpose validated by the people who actually wear it.",
  },
  skinCentric: {
    label: "Skin-Centric Evolution",
    lead: "Due to the elite concentration of raw oils, the fragrance actively works with your natural body chemistry.",
    // + per-scent skinTail
  },
} as const;

// How to apply — identical across all four (client verbatim, universal).
export const HOW_TO_APPLY =
  "Target the arterial pulse points of the neck and inner wrists. This ensures the heavy base notes unfold gradually, lingering effortlessly from day to night.";

/* Certifications — transcribed from the client's badge artwork. WORDING is the client's.
   Corrections applied to obvious artwork errors (flagged in _house-guide.md §7):
     · "PROUNDLY" → "Proudly"   · "LASTS UPTO 12 HOURS" → "Lasts up to 12 hours"
   SUBSTANTIATION — settled 2026-07-28: the client HOLDS the certificates for every claim
   here. They simply live outside this repo, so the absence of a certificate file is not a
   gap and must not be re-flagged. Rendered from house tokens (no raster) so a claim stays
   trivial to edit or pull. `note` is provenance only — it does not render.
   ⚠ CLAIM WORDING IS THE CLIENT'S — DO NOT "CORRECT" IT. An earlier pass reworded the
   artwork's "FDA / Food and Drug Administration India" to "Approved for sale in India" on a
   CDSCO inference; the client overruled that, restored "FDA-Approved" verbatim, and had the
   reworded chip dropped as a duplicate. A regulated claim belongs to the party legally
   responsible for it, not to this file. Typos are mechanical; wording is not. */
export type Assurance = { label: string; note?: string };

export const ASSURANCES_PRIMARY: Assurance[] = [
  { label: "IFRA-Certified", note: "International Fragrance Association" },
  { label: "FDA-Approved", note: "client-restored 2026-07-28, verbatim from the badge artwork; replaced the framework's 'Approved for sale in India' reword, dropped the same day as a duplicate of this claim" },
  { label: "Safe on skin & fabric" },
  { label: "Proudly made in India", note: "artwork typo 'PROUNDLY' corrected" },
];

export const ASSURANCES_SECONDARY: Assurance[] = [
  { label: "Cruelty-free" },
  { label: "Non-carcinogenic" },
  { label: "Silicone-free" },
  { label: "100% Vegan" },
];

// The performance figure — client badge (all four). Longevity decision 2026-07-17: 12h.
export const LONGEVITY_BADGE = "Lasts up to 12 hours";
