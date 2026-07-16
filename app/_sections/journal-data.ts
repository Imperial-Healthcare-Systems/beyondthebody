/* Journal content — Sprint 02. Single source of truth for BOTH the /journal index
   cards and the /journal/[slug] essay pages, so title/standfirst never drift between
   the two surfaces. Copy is VERBATIM from "Beyond The Body — Copy Rewrite.md" §6 and
   is FROZEN (content@journal) — do not rewrite. Numbering + slugs are structural, not
   copy. Imagery is PLACEHOLDER (sourced candidates, reused per the 2026-07-16 imagery
   decision); the client swaps the finals in later — keep the public/journal/* paths. */

export type Essay = {
  slug: string;
  num: string; // structural index label, e.g. "01"
  title: string;
  standfirst: string;
  paras: string[];
  img: string; // PLACEHOLDER — swap the file at this path, keep the path
  imgAlt: string;
};

export const JOURNAL_INDEX = {
  eyebrow: "Read",
  headline: "The things around the work.",
  intro:
    "Scent as culture — composition, provenance and memory. Never a sales pitch; just the field the house grows in.",
};

export const ESSAYS: Essay[] = [
  {
    slug: "the-long-patience-of-composition",
    num: "01",
    title: "The Long Patience of Composition",
    standfirst:
      "A fragrance is written more than it is mixed. On why the best compositions are the ones that were made to wait.",
    paras: [
      "A composition is not a recipe. Materials do not simply add up; they argue, defer, and eventually agree. A perfumer spends most of the work listening — moving a single note by a fraction, then setting the whole thing down for weeks to hear what it becomes.",
      "The temptation is always to add. A doubtful accord can be rescued, briefly, by piling brightness on top of it. The discipline is to take away instead — to trust one material to carry the weight a dozen were hired to share.",
      "This is why we let a named note lead and keep the adjectives out of it. Amber is amber. Oud is oud. If the material is right and rested, it does not need to be described as luxurious; it simply behaves that way on skin.",
      "Patience is the least visible ingredient and the most expensive one. It does not appear on the pyramid. It is the reason a scent that opens quietly can still be present eight hours later, having said very little the whole time.",
    ],
    img: "/journal/essay-1-patience.jpg",
    imgAlt:
      "A pressed book and blotter strips in warm window light — the slow patience of composition",
  },
  {
    slug: "three-towns-and-a-bottle",
    num: "02",
    title: "Three Towns and a Bottle",
    standfirst:
      "Grasse, Seville, Florence. On why certain materials are only themselves when they come from where they are made best.",
    paras: [
      "Some places have spent centuries becoming good at one thing. Grasse learned flowers — the jasmine and orris that arrive there with a depth grown fields cannot fake. Seville learned the bitter orange, sun-hard and sharp, that gives a citrus its spine. Florence learned iris, and the slow craft of drawing powder from a root.",
      "Provenance is not a flag to wave. It is a practical fact: the same botanical, grown in the wrong soil or lifted the wrong way, is a different material with the same name. The town is shorthand for everything that had to go right before the note reached the bottle.",
      "We source from these three not for the labels but because the materials refuse to be improved elsewhere. A house that begins with scent can afford to be stubborn about this. It is, after all, the whole of the work.",
      "And then the material travels — to a studio, into a composition, onto skin that lives in a warmer climate than any of those towns. Which is its own kind of provenance, and the next thing worth getting right.",
    ],
    img: "/journal/essay-2-towns.jpg",
    imgAlt:
      "Kraft-paper letters and botanicals arranged on a warm surface — provenance and place",
  },
  {
    slug: "scent-for-the-heat",
    num: "03",
    title: "Scent for the Heat",
    standfirst:
      "Most perfume is composed for a cool European day. On tuning a composition for the air it will actually be worn in.",
    paras: [
      "A fragrance is a different thing at 41°C than at 18. Heat lifts the top notes faster, pushes the whole composition forward, and burns through a thin, water-heavy scent before the afternoon is out. Much of the perfume sold here was never built for the air it is worn in.",
      "So we build for the heat rather than against it. A higher load of oil — 22% — gives the composition somewhere to hold on. The heart and base are weighted to survive the first hot hour, so that what is left by evening is the part meant to stay.",
      "Warm air is also honest. It reveals a thin composition quickly and rewards a deep one just as fast, drawing out amber, oud and skin musk into something that reads as warmth on warmth.",
      "Tuning for climate is not a feature to announce. It is simply what it means to compose for the people who will actually wear the work, in the air they will actually wear it in.",
    ],
    img: "/journal/essay-3-heat.jpg",
    imgAlt:
      "Warm, hazy afternoon light across a studio surface — composing for the heat",
  },
];

export const essayBySlug = (slug: string): Essay | undefined =>
  ESSAYS.find((e) => e.slug === slug);
