/* Product catalogue — the four fragrances. Single source of truth for the /fragrance
   PDPs (and, later, the Collection index). Frozen facts (names, taglines, pyramids,
   renders) come from brief.yaml / content@v0.1 / the client's 2026-07-16 pyramids and
   the approved home §8. PROSE (story, cardLine) is drafted per-scent as its PDP is built
   — Don Amour first; the other three carry pyramids + facts but empty prose until built.

   Prices are a PLACEHOLDER flat ₹1,899 per client direction 2026-07-16 ("price them to 1899,
   updated later, don't surface as placeholder on the page") — so the UI shows a real price, and
   only this comment records that it's provisional. Swap the `price` fields when finals land;
   nothing else changes. Concentration for Don Amour is "25% Extrait" (client, stated
   plainly — not framed as an exception). The bottle art printing "Eau de Parfum" is a known,
   accepted mismatch (client will re-art). */

export const CURRENCY = "₹";
export function formatPrice(price: number | null): string {
  return price == null ? "Price on request" : `${CURRENCY} ${price.toLocaleString("en-IN")}`;
}

export type Pyramid = { top: string[]; middle: string[]; base: string[] };
export type Size = { label: string; ml: number; sku: string; price: number | null };
export type ProductImage = { src: string; alt: string; ratio: string };

export type Product = {
  slug: string;
  no: string;
  name: string;
  tagline: string; // frozen
  eyebrow: string; // structural
  concentration: string; // e.g. "25% Extrait" ("" until confirmed per scent)
  spec: { longevity: string; climate: string; provenance: string; batch: string };
  pyramid: Pyramid;
  sizes: Size[];
  story: string; // PDP narrative — drafted per scent ("" until built)
  wear: string; // PDP details beat — how/where to wear ("" until built)
  cardLine: string; // Collection-card character line ("" until built)
  gallery: ProductImage[]; // PLACEHOLDER art, chosen by aspect-ratio fit; re-art later
  crossSell: string[]; // slugs for "You may also wear"
};

// House defaults reused across scents (spec prose the PDP details beat renders).
const HOUSE_SPEC = {
  longevity: "around eight hours on skin",
  climate: "tuned for 41°C air",
  provenance: "composed with materials from Grasse, Seville and Florence",
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
    concentration: "25% Extrait",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Ambroxan", "Bergamot", "Orris Root"],
      middle: ["Woody Notes", "Jasmine", "Floral Notes", "Amber", "Ambergris"],
      base: ["Woody Notes", "Musk", "Cashalox", "Patchouli"],
    },
    sizes: SIZES("DA"),
    story:
      "Ambroxan lifts bergamot and orris root — cool, composed, worn close to the skin. Beneath, jasmine warms into amber and ambergris, and the woods settle low: musk, cashalox, patchouli. It asks for nothing and announces less. What it has to say, it says in silence.",
    wear:
      "Wear it close. A touch at the pulse — the wrist, the base of the throat — morning or late. It sits low and stays, more felt than announced. Kept from light and heat, it keeps for years.",
    cardLine:
      "Ambroxan and orris over warm amber, musk and quiet woods. Close-held, and certain of itself.",
    gallery: [
      { src: "/products/collection/don-amour.png", alt: "Don Amour — the flacon, editorial still", ratio: "3 / 4" },
      { src: "/products/fullbleed/product-1-donamour.png", alt: "Don Amour — the flacon in warm directional light", ratio: "1915 / 821" },
      { src: "/products/notes/don-amour-notes-grid.png", alt: "Don Amour — the raw materials, laid out", ratio: "3 / 2" },
    ],
    crossSell: ["desir", "heartthrob", "mon-amour"],
  },
  {
    slug: "desir",
    no: "03",
    name: "Desir",
    tagline: "Desire, distilled.",
    eyebrow: "The Collection",
    concentration: "", // ▸ confirm (bottle art: Eau de Parfum)
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Pear", "Pink Pepper", "Orange Blossom"],
      middle: ["Coffee", "Jasmine", "Licorice", "Bitter Almond"],
      base: ["Cedar", "Vanilla", "Cashmere Wood", "Patchouli"],
    },
    sizes: SIZES("DE"),
    story: "",
    wear: "",
    cardLine: "",
    gallery: [
      { src: "/products/fullbleed/product-2-desir-real.png", alt: "Desir — the flacon in warm directional light", ratio: "1915 / 821" },
      { src: "/products/collection/desir.png", alt: "Desir — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["don-amour", "mon-amour"],
  },
  {
    slug: "heartthrob",
    no: "02",
    name: "Heartthrob",
    tagline: "Magnetism, refined.",
    eyebrow: "The Collection",
    concentration: "",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Bergamot", "Lemon Zest", "Artemisia", "Mint"],
      middle: ["Lavender", "Pineapple", "Green Notes", "Geranium"],
      base: ["Sandalwood", "Tonka Bean", "Cedar", "Iso E Super", "Amberwood"],
    },
    sizes: SIZES("HT"),
    story: "",
    wear: "",
    cardLine: "",
    gallery: [
      { src: "/products/collection/heart-throb.png", alt: "Heartthrob — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["don-amour", "desir"],
  },
  {
    slug: "mon-amour",
    no: "01",
    name: "Mon Amour",
    tagline: "Love, remembered.",
    eyebrow: "The Collection",
    concentration: "",
    spec: { ...HOUSE_SPEC },
    pyramid: {
      top: ["Pear Blossom", "Red Berries", "Italian Mandarin"],
      middle: ["Gardenia", "Jasmine", "Frangipani"],
      base: ["Brown Sugar", "Patchouli"],
    },
    sizes: SIZES("MA"),
    story: "",
    wear: "",
    cardLine: "",
    gallery: [
      { src: "/products/collection/mon-amour.png", alt: "Mon Amour — editorial still", ratio: "3 / 4" },
    ],
    crossSell: ["heartthrob", "desir"],
  },
];

export const productBySlug = (slug: string): Product | undefined =>
  PRODUCTS.find((p) => p.slug === slug);
