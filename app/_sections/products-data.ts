/* Product catalogue — the four fragrances. Single source of truth for the /fragrance
   PDPs (and, later, the Collection index). Frozen facts (names, taglines, pyramids,
   renders) come from brief.yaml / content@v0.1 / the client's 2026-07-16 pyramids and
   the approved home §8. House-voice PROSE (story, wear, cardLine) is drafted per-scent.
   The client's denser marketing prose (Blueprint/Value tails) is VERBATIM from the
   2026-07-17 drop (project/working/content/products/*.md).

   Prices are a PLACEHOLDER flat ₹1,899 per client direction 2026-07-16 ("price them to 1899,
   updated later, don't surface as placeholder on the page") — so the UI shows a real price, and
   only this comment records that it's provisional. Swap the `price` fields when finals land.

   CLASSIFICATION — resolved 2026-07-17 (client content drop): all four are "25% Eau de Parfum".
   This closes the old three-way conflict (25% Extrait vs 22% vs the bottle art). The bottle art
   reading "Eau de Parfum" was CORRECT; no re-art needed; there is no house exception. See
   project/working/content/products/_house-guide.md §2.
   LONGEVITY — client says "up to 12 hours" three ways (badge, Blueprint, note); adopted 2026-07-17,
   replaces the earlier "around eight hours". */

export const CURRENCY = "₹";
export function formatPrice(price: number | null): string {
  return price == null ? "Price on request" : `${CURRENCY} ${price.toLocaleString("en-IN")}`;
}

export type Pyramid = { top: string[]; middle: string[]; base: string[] };
export type Size = { label: string; ml: number; sku: string; price: number | null };
export type ProductImage = { src: string; alt: string; ratio: string };

// The Blueprint per-scent variation (client verbatim, 2026-07-17). House-universal frames
// live in house-copy.ts; these are the clauses that differ per scent.
export type Blueprint = {
  thresholdTail: string; // closes "The 25% Threshold" (BLUEPRINT.threshold.lead + " " + this)
  longevityBody: string; // full body after BLUEPRINT.longevity.opener
  skinTail: string; // closes "Skin-Centric Evolution" (VALUE.skinCentric.lead + " " + this)
};

export type Product = {
  slug: string;
  no: string;
  name: string;
  tagline: string; // frozen
  eyebrow: string; // structural
  concentration: string; // "25% Eau de Parfum" (house-wide, resolved 2026-07-17)
  spec: { longevity: string; batch: string };
  pyramid: Pyramid;
  sizes: Size[];
  story: string; // PDP Story beat — house voice (Quiet Atelier), leads the top of the page
  wear: string; // PDP Particulars beat — how/where to wear
  cardLine: string; // Collection-card character line
  blueprint: Blueprint; // client marketing prose (Blueprint/Value tails) — the dense lower beat
  scene?: string; // Composition full-bleed scene; omit → clean deep-oxblood panel (re-art later)
  gallery: ProductImage[]; // PLACEHOLDER art, chosen by aspect-ratio fit; re-art later
  crossSell: string[]; // slugs for "You may also wear"
};

// House defaults reused across scents (spec prose the PDP Particulars beat renders).
// The old "climate" (41°C air) + "provenance" (Grasse/Seville/Florence) rows were REMOVED
// 2026-07-17 (client) — orphan claims inherited from the retired nine-era copy, in no client
// content and unverified. "made in a single run" is corroborated by Micro-Batch Sourcing.
const HOUSE_SPEC = {
  longevity: "up to 12 hours on skin",
  batch: "made in a single run",
};
const SIZES = (skuBase: string): Size[] => [
  { label: "100 ml", ml: 100, sku: `${skuBase}-100`, price: 1899 },
  { label: "Discovery 10 ml", ml: 10, sku: `${skuBase}-10`, price: 1899 },
];

export const PRODUCTS: Product[] = [
  {
    slug: "don-amour",
    no: "04",
    name: "Don Amour",
    tagline: "A love worn in silence.",
    eyebrow: "The Collection",
    concentration: "25% Eau de Parfum",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Ambroxan", "Italian Bergamot", "Orris Root"],
      middle: ["Woody Notes", "Floral Notes", "Ambergris", "Amber", "Jasmine"],
      base: ["Woody Notes", "Musk", "Patchouli", "Cashalox"],
    },
    blueprint: {
      thresholdTail: "built to project strength and power.",
      longevityBody:
        "By anchoring the formulation in heavy, slow-evaporating molecules like Ambroxan, Cashalox, and deep woods, the scent profile maintains its intense velocity throughout the demanding workday and straight into the night.",
      skinTail:
        "As it warms, it transforms into a deeply personalized, magnetic signature that stays potent and clean from morning to night.",
    },
    sizes: SIZES("DA"),
    story:
      "Ambroxan lifts bergamot and orris root — cool, composed, worn close to the skin. Beneath, jasmine warms into amber and ambergris, and the woods settle low: musk, cashalox, patchouli. It asks for nothing and announces less. What it has to say, it says in silence.",
    wear:
      "Wear it close. A touch at the pulse — the wrist, the base of the throat — morning or late. It sits low and stays, more felt than announced. Kept from light and heat, it keeps for years.",
    cardLine:
      "Ambroxan and orris over warm amber, musk and quiet woods. Close-held, and certain of itself.",
    scene: "/products/notes/don-amour-scene.webp",
    gallery: [
      { src: "/products/collection/don-amour.webp", alt: "Don Amour — the flacon, editorial still", ratio: "3 / 4" },
      { src: "/products/fullbleed/product-1-donamour.webp", alt: "Don Amour — the flacon in warm directional light", ratio: "1915 / 821" },
      { src: "/products/notes/don-amour-notes-grid.webp", alt: "Don Amour — the raw materials, laid out", ratio: "3 / 2" },
    ],
    // "You may also wear" — TWO per PDP (client, 2026-07-17). Dark kin + one bright bridge.
    crossSell: ["desir", "heartthrob"],
  },
  {
    slug: "desir",
    no: "03",
    name: "Desir",
    tagline: "Desire, distilled.",
    eyebrow: "The Collection",
    concentration: "25% Eau de Parfum",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Pear", "Pink Pepper", "Orange Blossom"],
      middle: ["Coffee", "Jasmine", "Bitter Almond", "Licorice"],
      base: ["Vanilla", "Patchouli", "Cashmere Wood", "Cedar"],
    },
    blueprint: {
      thresholdTail: "engineered for maximum depth and an intoxicating sillage.",
      longevityBody:
        "By anchoring the sweet, dark notes in slow-evaporating vanilla and rich woods, the fragrance maintains its seductive, warm projection all through the night.",
      skinTail:
        "As it warms, the dark coffee, almond, and sweet vanilla meld to create a deeply personal, seductive signature.",
    },
    sizes: SIZES("DE"),
    story:
      "Pear and pink pepper open bright, then orange blossom softens the edge. Beneath, coffee and bitter almond turn the heart dark and low, jasmine threaded through. The dry-down is slow — vanilla, cashmere wood, patchouli — a warmth that stays on the skin long after you meant it to. It doesn't ask to be noticed. It simply doesn't leave.",
    wear:
      "Wear it after dark — or when you want the dark to arrive early. A touch at the throat and the inner wrist, where warmth will draw it out. Kept from light and heat, it keeps for years.",
    cardLine:
      "Pear and pink pepper over a dark heart of coffee and almond, dried down in vanilla and wood. Warm, and slow to leave.",
    scene: "/products/collection/desir.webp",
    gallery: [
      { src: "/products/fullbleed/product-2-desir-real.webp", alt: "Desir — the flacon in warm directional light", ratio: "1915 / 821" },
      { src: "/products/collection/desir.webp", alt: "Desir — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["don-amour", "mon-amour"],
  },
  {
    slug: "heartthrob",
    no: "02",
    name: "Heartthrob",
    tagline: "Magnetism, refined.",
    eyebrow: "The Collection",
    concentration: "25% Eau de Parfum",
    spec: { ...HOUSE_SPEC },
    // ⚑ PYRAMID BLOCKED — the 2026-07-17 description (grapefruit / dark incense) conflicts
    // with this client-confirmed 2026-07-16 pyramid (bergamot·lemon / sandalwood·tonka·amberwood).
    // Held pending the client's answer (reformulated? or loose prose?). See products/heartthrob.md §3.
    pyramid: {
      top: ["Bergamot", "Lemon Zest", "Artemisia", "Mint"],
      middle: ["Lavender", "Pineapple", "Green Notes", "Geranium"],
      base: ["Sandalwood", "Tonka Bean", "Cedar", "Iso E Super", "Amberwood"],
    },
    blueprint: {
      thresholdTail: "built for raw presence and architectural depth.",
      longevityBody:
        "By anchoring the formulation in heavy, slow-evaporating base structures, the scent profile defies the typical fading cycle of mass-market fragrances.",
      skinTail:
        "creating a deeply personalized signature that stays potent from day to night.",
    },
    sizes: SIZES("HT"),
    story:
      "Bergamot and lemon zest snap it open, cooled with artemisia and mint. The heart turns aromatic — lavender, a green edge, geranium, a bright lift of pineapple. Then it warms and holds: sandalwood, tonka, cedar, amberwood, the quiet pull of Iso E Super. Nothing about it is loud. You notice the person first, and the scent a moment later.",
    wear:
      "An everyday signature — clean enough for the morning, warm enough to carry into the night. A spray at the chest and the nape, where it lifts as you move. Kept from light and heat, it keeps for years.",
    cardLine:
      "Cool bergamot and mint over an aromatic heart, warmed by sandalwood, tonka and amberwood. Clean, and magnetic.",
    scene: "/products/collection/heart-throb.webp",
    gallery: [
      { src: "/products/collection/heart-throb.webp", alt: "Heartthrob — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["mon-amour", "don-amour"],
  },
  {
    slug: "mon-amour",
    no: "01",
    name: "Mon Amour",
    tagline: "Love, remembered.",
    eyebrow: "The Collection",
    concentration: "25% Eau de Parfum",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Pear Blossom", "Red Berries", "Italian Mandarin"],
      middle: ["Gardenia", "Jasmine", "Frangipani"],
      base: ["Brown Sugar", "Patchouli"],
    },
    blueprint: {
      thresholdTail: "engineered for profound depth and botanical richness.",
      longevityBody:
        "By anchoring the formulation in heavy, slow-evaporating base structures, the intricate floral notes remain suspended in a warm, decadent dry-down.",
      skinTail:
        "As it warms, it transforms into a deeply personalized signature that stays potent from day to night.",
    },
    sizes: SIZES("MA"),
    story:
      "Pear blossom, red berries and Italian mandarin open soft and a little sweet. The heart is all white flowers — gardenia, jasmine, frangipani — worn close to the skin. Underneath, brown sugar and patchouli hold it warm and faintly nostalgic, the way a scent you loved once comes back whole. It doesn't announce a moment. It keeps one.",
    wear:
      "Wear it on the days you'll want to remember. A touch at the pulse and through the hair, where it lingers longest. Kept from light and heat, it keeps for years.",
    cardLine:
      "Soft fruit and white flowers over warm brown sugar and patchouli. Tender, and hard to forget.",
    scene: "/products/collection/mon-amour.webp",
    gallery: [
      { src: "/products/collection/mon-amour.webp", alt: "Mon Amour — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["heartthrob", "desir"],
  },
];

export const productBySlug = (slug: string): Product | undefined =>
  PRODUCTS.find((p) => p.slug === slug);
