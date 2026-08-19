/* MOCKUP ONLY — /mockup/collection-collage. A throwaway comp to judge a COLLAGE behind the
   Collection hero before touching the live CollectionMasthead. Same text block (brackets +
   eyebrow + headline + intro) laid over a warm-graded mosaic of house imagery, with an ivory
   radial scrim that keeps the centre clean and legible while the collage bleeds in at the
   edges. Static end-state (no motion) — the point is the look, not the reveal. Not wired into
   the site; delete or fold into CollectionMasthead once a direction is chosen. */

import CollageBackdrop from "../_components/CollageBackdrop";
import "./collectioncollagemock.css";

export default function CollectionCollageMock() {
  return (
    <section className="mock" data-theme="light">
      {/* The mosaic used to be inline here. It was promoted to a shared component when the
          404 adopted it (2026-08-12) — one copy, so the comp and the live page cannot
          drift apart, and the comp still shows what was actually signed off. */}
      <CollageBackdrop />

      <div className="mock__inner">
        <div className="mock__frame">
          <span className="mock__corner mock__corner--tl" aria-hidden="true" />
          <span className="mock__corner mock__corner--tr" aria-hidden="true" />
          <span className="mock__corner mock__corner--bl" aria-hidden="true" />
          <span className="mock__corner mock__corner--br" aria-hidden="true" />

          <p className="mock__eyebrow">The Collection</p>
          <span className="mock__rule" aria-hidden="true" />
          <h1 className="mock__headline">
            <span className="line">A house,</span>
            <span className="line">told in chapters.</span>
          </h1>
          <p className="mock__intro">
            Beyond The Body begins at the skin. Its first chapter is scent — four unisex
            compositions, made for warm light and worn close. A house, though, is more than
            the things it makes; it is a way of being present. What comes after is already
            being composed.
          </p>
        </div>
      </div>
    </section>
  );
}
