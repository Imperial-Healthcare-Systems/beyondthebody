/* MOCKUP ONLY — /mockup/collection-collage. A throwaway comp to judge a COLLAGE behind the
   Collection hero before touching the live CollectionMasthead. Same text block (brackets +
   eyebrow + headline + intro) laid over a warm-graded mosaic of house imagery, with an ivory
   radial scrim that keeps the centre clean and legible while the collage bleeds in at the
   edges. Static end-state (no motion) — the point is the look, not the reveal. Not wired into
   the site; delete or fold into CollectionMasthead once a direction is chosen. */

import "./collectioncollagemock.css";

const IMAGES = [
  "/hero/hero.jpg",
  "/journal/index-lead.jpg",
  "/journal/essay-1-patience.jpg",
  "/journal/essay-2-towns.jpg",
  "/journal/essay-3-heat.jpg",
  "/sections/origin-bg.jpg",
  "/sections/journal.jpg",
  "/sections/banner-1.jpg",
  "/footer/reveal-desktop.jpg",
  "/products/collection/mon-amour.png",
  "/products/collection/don-amour.png",
  "/products/notes/don-amour-notes-grid.png",
];

// enough tiles to cover the section; a few span 2 to break the grid into a collage
const TILES = Array.from({ length: 48 }, (_, i) => {
  const src = IMAGES[i % IMAGES.length];
  const span = i % 5 === 0 ? "s2r" : i % 7 === 3 ? "s2c" : "";
  return { src, span, key: i };
});

export default function CollectionCollageMock() {
  return (
    <section className="mock" data-theme="light">
      <div className="mock__collage" aria-hidden="true">
        {TILES.map((t) => (
          <figure className={`mock__tile ${t.span}`} key={t.key}>
            <img src={t.src} alt="" loading="lazy" />
          </figure>
        ))}
      </div>
      <div className="mock__tint" aria-hidden="true" />
      <div className="mock__scrim" aria-hidden="true" />
      <div className="mock__grain" aria-hidden="true" />

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
