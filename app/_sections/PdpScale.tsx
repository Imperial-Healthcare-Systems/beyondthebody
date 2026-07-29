/* PDP · The concentration scale — a wide cinematic composition inside the Blueprint beat,
   between the distinction pull-quote and the three points. Built to the client's reference
   (2026-07-28) as a replication, not an interpretation: title + subtitle top-left, four
   product renders standing on an ascending stepped platform, a bronze connecting line with
   markers, then name / percentage / longevity per column, closed by a divider and the house
   statement bottom-right.

   Supersedes the drawn-SVG flacons. Those were an editorial spec rail; the client's
   requirement was a premium visual — real product renders on a sculpted platform.

   Presentational only: it owns no timeline. The reveal belongs to PdpBlueprint's single
   section timeline (one per section keeps the choreography honest), which is also why the
   ambient highlight sweep and the hover lift live in CSS rather than JS — they must not be
   sequenced against the reveal, and CSS keeps them off the main thread.

   GEOMETRY, and why it still needs no JS measurement. Every figure comes from
   CONCENTRATION_LADDER in house-copy.ts, measured off the reference file pixel by pixel —
   see the long note there. Each column carries its own cumulative `--rise`, so the step
   heights are NON-UNIFORM (1 : 1.65 : 2.27, accelerating), and the connector is a measured
   Bézier path rather than a straight chord. Both were wrong in the previous cut, which
   assumed a constant rise and therefore could only ever draw a straight line.
   Nothing is measured at runtime: the reference numbers are data, the units are cqw, and
   the browser resolves them against the section's own width. See pdpscale.css. */

import {
  CONCENTRATION_SCALE,
  CONCENTRATION_SUBTITLE,
  CONCENTRATION_MARK,
  CONCENTRATION_LADDER,
} from "./house-copy";
import "./pdpscale.css";

type Entry = (typeof CONCENTRATION_SCALE)[number];

/* THE CURVE, resolved ONCE — and the single source of truth for both the path and the dots.

   `curveK` bows each measured marker away from the straight end-to-end chord. Scaling a
   deviation is affine in y, which is why it can be applied to the anchor points and still
   yield a correct Bézier — the same reason preserveAspectRatio="none" is safe on the result.

   ⚠ WHY THIS IS SHARED. The previous cut bowed the PATH by curveK but positioned the markers
   from the RAW measured values, so the two disagreed by exactly the bow: dots 2 and 3 floated
   ~5.6px above the line they were supposed to sit on, and only the two endpoints (whose
   deviation is zero) still touched it. Deriving the dots from the same bowed points makes them
   sit on the line by construction, at any curveK and any viewport width. */
function bow(pts: ReadonlyArray<readonly number[]>, k: number) {
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const chord = (x: number) => ay + ((x - ax) * (by - ay)) / (bx - ax);
  return pts.map(([x, y]) => [x, chord(x) + k * (y - chord(x))]);
}

/* Catmull-Rom with reflected end tangents, so the spline passes THROUGH all four points
   rather than merely approaching them. */
function ladderPath(P: number[][]) {
  const e = [
    [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]],
    ...P,
    [2 * P[3][0] - P[2][0], 2 * P[3][1] - P[2][1]],
  ];
  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(P[0][0])} ${f(P[0][1])}`;
  for (let i = 1; i < e.length - 2; i++) {
    const [p0, p1, p2, p3] = [e[i - 1], e[i], e[i + 1], e[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])}, ${f(c2[0])} ${f(c2[1])}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const BOWED = bow(CONCENTRATION_LADDER.markers, CONCENTRATION_LADDER.curveK);
const LADDER_D = ladderPath(BOWED);

/* Each dot's height above marker 1, in cqw, read off the BOWED curve. y runs 100 (marker 1,
   the lowest) to 0, so the rise is the complement. */
const DOT_Y = BOWED.map((pt) => ((100 - pt[1]) / 100) * CONCENTRATION_LADDER.lineTotal);

/* Per-column custom properties, all UNITLESS numbers so the CSS can do arithmetic with them
   (an earlier cut passed a percentage, and `length * percentage` is invalid CSS — the height
   silently fell back to intrinsic). Typed loosely because React's CSSProperties has no slot
   for custom properties.
     --bottle-k   this bottle's height as a fraction of --bottle-unit (≤720px singles only)
     --bottle-ar  its aspect ratio
     --rise       cumulative BASE rise at this column, cqw — where the bottle stands
     --line-y     this dot's height above marker 1, cqw, taken from the bowed curve
     --dot-nudge  a px optical correction on top (see CONCENTRATION_LADDER.dotNudge)
   Neither rise is derivable from the column index: both are non-uniform. */
function colVars(i: number, c: Entry) {
  return {
    "--bottle-k": (c.refH / 100).toFixed(4),
    "--bottle-ar": (c.w / c.h).toFixed(4),
    "--rise": CONCENTRATION_LADDER.rise[i],
    "--line-y": DOT_Y[i].toFixed(4),
    "--dot-nudge": `${CONCENTRATION_LADDER.dotNudge[i]}px`,
  } as React.CSSProperties;
}

const STRIP = CONCENTRATION_LADDER.strip;

export default function PdpScale() {
  return (
    <figure className="scale">
      <header className="scale__head">
        <h3 className="scale__title">The concentration scale</h3>
        <p className="scale__subtitle">{CONCENTRATION_SUBTITLE}</p>
      </header>

      {/* The stage: platform, bottles, line and markers share one positioning context so
          every element derives its vertical position from the same measured values. */}
      <div className="scale__stage">
        {CONCENTRATION_SCALE.map((c, i) => (
          <div className="scale__col" key={c.name} style={colVars(i, c)}>
            {/* The step. Two faces in one element: a lit top band and a shaded front,
                layered as a single background so there is no extra node to composite. */}
            <span className="scale__step" aria-hidden="true" />
            {/* The ≤720px bottle. Hidden above that breakpoint, where .scale__strip renders
                all four at once — so it costs nothing there (a display:none lazy image below
                the fold is never fetched). width/height are each asset's OWN intrinsic size;
                a shared pair would mis-reserve the box for three of the four. */}
            <img
              className="scale__bottle"
              src={c.img}
              alt={c.alt}
              width={c.w}
              height={c.h}
              loading="lazy"
              decoding="async"
            />
            <span className="scale__marker" aria-hidden="true" />
          </div>
        ))}

        {/* The four bottles as ONE asset, above 720px — the client's supplied composite,
            cropped to the bottles so the copy underneath stays live text. It spans the stage's
            content box and its own bottom edge is column 1's base, so every bottle lands on
            its tread with no per-bottle positioning. It is also the grid row's only in-flow
            item up here, which is what gives the stage its height.
            alt is empty and it is aria-hidden: the legend below states every band in text, so
            announcing the decorative arrangement again would only add noise. */}
        <img
          className="scale__strip"
          src={STRIP.src}
          alt=""
          aria-hidden="true"
          width={STRIP.w}
          height={STRIP.h}
          loading="lazy"
          decoding="async"
        />

        {/* The connecting line — a measured CURVE, and it runs BELOW the bottle bases, on the
            treads' front lips, which is where the reference puts it. preserveAspectRatio="none"
            stretches the normalised 100x100 box onto the rectangle; because a non-uniform
            scale is affine it carries the Bézier control points with it, so the curve keeps
            its measured shape at every viewport width. non-scaling-stroke keeps the stroke a
            true hairline through that stretch. */}
        <span className="scale__lineclip" aria-hidden="true">
          <svg
            className="scale__line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d={LADDER_D} />
          </svg>
        </span>
      </div>

      {/* The legend, on the same four-column grid so every label centres under its bottle. */}
      <div className="scale__legend">
        {CONCENTRATION_SCALE.map((c) => (
          <div className="scale__entry" key={c.name}>
            <p className="scale__cat">{c.name}</p>
            <p className="scale__range">{c.range}</p>
            <p className="scale__hrs">{c.hours}</p>
          </div>
        ))}
      </div>

      <div className="scale__foot">
        <span className="scale__rule" aria-hidden="true" />
        <p className="scale__mark">
          <span className="scale__markhouse">{CONCENTRATION_MARK.house}</span>
          <span className="scale__markfig">
            {CONCENTRATION_MARK.figure} · {CONCENTRATION_MARK.hours}
          </span>
        </p>
      </div>
    </figure>
  );
}
