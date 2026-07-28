/* PDP · The concentration scale — lives INSIDE the Blueprint beat, between the
   distinction pull-quote and the three points. Presentational only: it owns no
   effect, because its reveal belongs to PdpBlueprint's timeline (one timeline per
   section keeps the choreography honest — see PdpBlueprint.tsx).

   Restructured from the client's 2026-07-28 infographic. The four DRAWN FLACONS are
   the creative the client asked for; what was dropped is only the packaging around
   them — the rounded card frames, the gold filigree and corner flourishes, and the
   tinted concentration badges. "No loud badges / restraint over decoration"
   (design-philosophy §1) rules out that chrome, not the illustration.

   The vessels are drawn here rather than placed as artwork, and that is deliberate:
     · they inherit --accent, so both colour schemes are correct for free
     · a 1px non-scaling stroke stays a true hairline at every size, which is the
       house's line language (§8's rules, the assurances hairlines, this scale's rail)
     · the FILL IS THE DATA — each flacon is filled topPct/25, so the ladder is legible
       as a picture before a single number is read, and the Eau de Parfum vessel reads
       FULL. That is the argument: the house sits at the ceiling of its own category.
   The fourth silhouette is BTB's own flacon — faceted body, chamfered corners, the
   spherical cap of the real Mon Amour bottle — so the category the house actually
   ships is the one drawn as its own product. The other three are generic vessels for
   categories BTB does not sell, in the same line language.

   Markup is a <ul>, not a <table>. It was a table when the desktop layout was a
   4-column rail with a <thead>, but every band is now self-describing (vessel, name,
   range, longevity), so the column headers had nothing left to associate — and a
   responsive table that reflows via display:block loses its semantics anyway. */

import { CONCENTRATION_SCALE, CONCENTRATION_MARK, CONCENTRATION_CEILING } from "./house-copy";
import "./pdpscale.css";

/* Flacon geometry, in a shared 40x72 viewBox. All four stand on the SAME baseline
   (body bottom y=68) and widen as the category concentrates — 14 / 20 / 26 / 30 units
   — so the row reads as one graduated set rather than four unrelated icons.
   `top`/`bottom` bound the BODY, not the neck or cap: that is what the fill is measured
   against, because liquid must never appear in a neck. The first three carry their cap
   in the outline itself, with `capLine` drawn back over the junction so it still reads
   as a separate stopper.

   THE BOX ASPECT IS THE WHOLE GAME, and it took two passes to get right. `width: auto`
   against a height-driven size means the viewBox ratio sets how wide these can ever
   look: at 40x92 even the widest bottle came out ~0.44 wide-to-tall and every one of
   them read as a laboratory vial. At 40x72 the Eau de Parfum flacon lands near 0.64,
   which is roughly the real Mon Amour bottle. Widen the shapes without shortening the
   box and you get nothing — the box scales them straight back down. */
const VESSELS = {
  // slimmest — a tall mist/splash bottle with a long slender collar
  mist: {
    outline: "M16 4h8v8l3 4v50a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V16l3-4V4z",
    capLine: "M16 12h8",
    top: 16,
    bottom: 68,
  },
  // a lighter flask, shoulders sloping wider
  cologne: {
    outline: "M16 5h8v8l6 4v48a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V17l6-4V5z",
    capLine: "M16 13h8",
    top: 17,
    bottom: 68,
  },
  // squarer and broader, with a heavier stopper
  toilette: {
    outline: "M15 7h10v9l8 4v45a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V20l8-4V7z",
    capLine: "M15 16h10",
    top: 20,
    bottom: 68,
  },
  // the BTB flacon — faceted body, chamfered corners, the spherical cap of the real
  // Mon Amour bottle. The one category the house actually ships is drawn as its product.
  parfum: {
    outline: "M5 27l6-6h18l6 6v38l-4 3H9l-4-3z",
    collar: "M17 16h6v5h-6z",
    capCircle: { cx: 20, cy: 10, r: 7 },
    facets: ["M11 21v47", "M29 21v47"],
    top: 21,
    bottom: 68,
  },
} as const;

function Flacon({ vessel, topPct }: { vessel: keyof typeof VESSELS; topPct: number }) {
  const v = VESSELS[vessel];
  const clipId = `scale-clip-${vessel}`;
  const span = v.bottom - v.top;
  const fillH = span * (topPct / CONCENTRATION_CEILING);
  const fillY = v.bottom - fillH;

  return (
    <svg
      className="scale__flacon"
      viewBox="0 0 40 72"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* the liquid is a plain rect clipped to the body outline, so it takes the
            flacon's exact shape — shoulders, chamfers and all — at any fill level */}
        <clipPath id={clipId}>
          <path d={v.outline} />
        </clipPath>
      </defs>

      <rect
        className="scale__liquid"
        x="0"
        y={fillY}
        width="40"
        height={fillH}
        clipPath={`url(#${clipId})`}
      />
      {/* the surface of the liquid. Clipped to the same body, so it spans exactly the
          flacon's width at that height — and it is what makes a 12% fill legible as a
          LEVEL rather than a smudge. Skipped at full, where it would double the
          shoulder line it sits on. */}
      {topPct < CONCENTRATION_CEILING && (
        <line
          className="scale__meniscus"
          x1="0"
          x2="40"
          y1={fillY}
          y2={fillY}
          clipPath={`url(#${clipId})`}
        />
      )}

      <path className="scale__glass" d={v.outline} />
      {"capLine" in v && <path className="scale__glass" d={v.capLine} />}
      {"collar" in v && <path className="scale__glass" d={v.collar} />}
      {"capCircle" in v && (
        <circle className="scale__glass" cx={v.capCircle.cx} cy={v.capCircle.cy} r={v.capCircle.r} />
      )}
      {"facets" in v &&
        v.facets.map((d) => <path className="scale__facet" key={d} d={d} />)}
    </svg>
  );
}

export default function PdpScale() {
  return (
    <figure className="scale">
      <figcaption className="scale__eyebrow">The concentration scale</figcaption>

      <ul className="scale__bands">
        {CONCENTRATION_SCALE.map((c) => (
          <li className="scale__band" key={c.name}>
            <Flacon vessel={c.vessel} topPct={c.topPct} />
            <span className="scale__cat">{c.name}</span>
            <span className="scale__range">{c.range}</span>
            <span className="scale__hrs">{c.hours}</span>
          </li>
        ))}
      </ul>

      {/* The threshold. The rail draws left-to-right, then the tick and label land.
          aria-hidden on the rail itself — it is the visual restatement of the mark,
          and the sentence below carries the same fact in words. */}
      <div className="scale__railwrap">
        <span className="scale__rail" aria-hidden="true" />
        <span
          className={`scale__mark${
            CONCENTRATION_MARK.anchor === "end" ? " scale__mark--end" : ""
          }`}
          style={{ left: `${CONCENTRATION_MARK.atPercent}%` }}
        >
          <span className="scale__tick" aria-hidden="true" />
          <span className="scale__marklabel">
            <span className="scale__markhouse">{CONCENTRATION_MARK.house}</span>
            <span className="scale__markfig">
              {CONCENTRATION_MARK.figure} · {CONCENTRATION_MARK.hours}
            </span>
          </span>
        </span>
      </div>
    </figure>
  );
}
