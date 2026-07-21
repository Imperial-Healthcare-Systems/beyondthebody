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
   ⚠ LEGAL: these are regulated advertising claims. They are NOT verified. Before this beat
   publishes, each needs substantiation on file, and "FDA / Food and Drug Administration India"
   likely misnames the authority (India's cosmetics regulator is CDSCO; "FDA" here is a STATE
   body). Rendered from house tokens (no raster) so a claim is trivial to edit or pull.
   `note` carries the open question surfaced at the beat gate — it does not render. */
export type Assurance = { label: string; note?: string };

export const ASSURANCES_PRIMARY: Assurance[] = [
  { label: "IFRA-Certified", note: "International Fragrance Association — verify certificate on file" },
  { label: "Approved for sale in India", note: "artwork said 'FDA / Food and Drug Administration India' — India's cosmetics regulator is CDSCO; reworded pending the real authority + registration no." },
  { label: "Safe on skin & fabric", note: "verify dermatological / colourfastness testing on file" },
  { label: "Proudly made in India", note: "artwork typo 'PROUNDLY' corrected" },
];

export const ASSURANCES_SECONDARY: Assurance[] = [
  { label: "Cruelty-free" },
  { label: "Non-carcinogenic", note: "strong regulated claim — verify substantiation before publishing" },
  { label: "Silicone-free" },
  { label: "100% Vegan" },
];

// The performance figure — client badge (all four). Longevity decision 2026-07-17: 12h.
export const LONGEVITY_BADGE = "Lasts up to 12 hours";
