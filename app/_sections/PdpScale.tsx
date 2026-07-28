/* PDP · The concentration scale — lives INSIDE the Blueprint beat, between the
   distinction pull-quote and the three points. Presentational only: it owns no
   effect, because its reveal belongs to PdpBlueprint's timeline (one timeline per
   section keeps the choreography honest — see PdpBlueprint.tsx).

   Restructured from the client's 2026-07-28 infographic. What was dropped and why:
   the rounded card frames, the gold filigree and corner flourishes, the sparkles,
   the outlined bottle illustrations and the tinted concentration badges — all of it
   is ornament, and "no loud badges / restraint over decoration" is the doctrine
   (design-philosophy §1). What is KEPT is the whole of the information: four
   categories, their concentration ranges, their longevity. Rendered as an editorial
   spec rail in the house's own hairlines and type — champagne on oxblood, because
   this beat is data-theme="dark" and inherits that register for free.

   The house's own position is the addition the artwork did not have: a champagne
   THRESHOLD tick at 25%, pinned to the rail. The word is already the client's
   ("The 25% Threshold"), and a threshold is a line — so we draw it. */

import { CONCENTRATION_SCALE, CONCENTRATION_MARK } from "./house-copy";
import "./pdpscale.css";

export default function PdpScale() {
  return (
    <figure className="scale">
      <figcaption className="scale__eyebrow">The concentration scale</figcaption>

      {/* One table, two presentations. Desktop reads as a 4-column rail (lightest →
          densest, left to right); under 720px each band becomes its own hairline row.
          A <table> rather than divs: this IS tabular data, and it means the row/column
          association survives for a screen reader in both layouts. */}
      <table className="scale__table">
        <caption className="scale__srcaption">
          Fragrance concentration by category, with typical oil concentration and
          longevity. Beyond The Body is composed at {CONCENTRATION_MARK.figure}.
        </caption>
        <thead>
          <tr>
            {CONCENTRATION_SCALE.map((c) => (
              <th scope="col" key={c.name}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="scale__ranges">
            {CONCENTRATION_SCALE.map((c) => (
              <td key={c.name}>
                {/* the reveal is applied to this span, not to the <td>: transforms on
                    table cells are spec-legal but quirky across engines, and a plain
                    block span is not worth the risk. It is also the flex row ≤980px. */}
                <span className="scale__band">
                  {/* NOT aria-hidden, and that is load-bearing. The two layouts hand the
                      column label back and forth: above 980px the <thead> carries it and
                      this span is display:none (so AT ignores it); at or below, the <thead>
                      is display:none and this one takes over. Marking it aria-hidden would
                      leave the stacked layout as bare numbers with no labels — and the
                      display:block reflow has already cost the <th> association there. */}
                  <span className="scale__catmob">{c.name}</span>
                  <span className="scale__range">{c.range}</span>
                  <span className="scale__hrs">{c.hours}</span>
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* The threshold. The rail draws left-to-right, then the tick and label land.
          aria-hidden on the rail itself — it is the visual restatement of the mark,
          and the caption above already carries the fact in words. */}
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
