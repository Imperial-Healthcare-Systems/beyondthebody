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
export const CONCENTRATION_SCALE = [
  { name: "Body Mist / Body Splash", range: "1–3%", hours: "1–2 hrs" },
  { name: "Eau de Cologne", range: "2–5%", hours: "1–3 hrs" },
  { name: "Eau de Toilette", range: "5–15%", hours: "3–4 hrs" },
  { name: "Eau de Parfum", range: "15–25%", hours: "5–12 hrs" },
] as const;

/* Where the house sits on that ladder.
   `atPercent` is the marker's position along the rail, as a % of its width. Four equal
   columns, each standing for one band, so a concentration's position is its position
   WITHIN its band: 25% is the top edge of the 15–25% band, i.e. the far end of the 4th
   column — 100%. `anchor: "end"` is therefore not decoration; a centred label at 100%
   would hang half its width off the container. If the bands ever change, re-derive BOTH.

   Longevity wording is the RESOLVED 2026-07-17 figure ("up to 12 hours" — the same string
   as LONGEVITY_BADGE), deliberately the more conservative of the client's two phrasings
   (the Blueprint's "well beyond the 12-hour mark" is the other). */
export const CONCENTRATION_MARK = {
  house: "Beyond The Body",
  figure: "25%",
  hours: "up to 12 hours",
  atPercent: 100,
  anchor: "end",
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
