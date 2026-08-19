"use client";

/* §8 · THE COLLECTION — 1:1 replica of the reference: the four signatures as an
   alternating, slanted editorial catalogue (image ⟷ text zigzag, ⚥ roundels at
   the seams). Order: Don Amour → Heart Throb → Desir → Mon Amour. Real renders.
   Reveal: images wipe in left→right (polygon-animated so the intentional slant is
   preserved). No section header/footer — "THE COLLECTION" + "JOIN THE HOUSE" live
   in the global nav, matching the reference. Reduced-motion: static slanted end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./product3.css";
import { revealTl, revealTempo } from "../_components/reveal-tempo";

type Signature = {
  no: string;
  slug: string; // → /fragrance/[slug]; must match products-data slugs
  name: string;
  tag: string;
  profile: string;
  img: string;
  side: "left" | "right";
};

const COLLECTION: Signature[] = [
  {
    no: "01",
    slug: "mon-amour",
    name: "Mon Amour",
    tag: "Love, remembered.",
    profile: "Pear Blossom · Red Berries · Italian Mandarin · Gardenia · Jasmine · Frangipani · Brown Sugar · Patchouli",
    img: "/products/collection/mon-amour.webp",
    side: "left",
  },
  {
    no: "02",
    slug: "heartthrob",
    name: "Heartthrob",
    tag: "Magnetism, refined.",
    profile: "Bergamot · Lemon Zest · Artemisia · Mint · Lavender · Pineapple · Green Notes · Geranium · Sandalwood · Tonka Bean · Cedar · Iso E Super · Amberwood",
    img: "/products/collection/heart-throb.webp",
    side: "right",
  },
  {
    no: "03",
    slug: "desir",
    name: "Desir",
    tag: "Desire, distilled.",
    profile: "Pear · Pink Pepper · Orange Blossom · Coffee · Jasmine · Bitter Almond · Cedar · Vanilla · Cashmere Wood · Patchouli",
    img: "/products/collection/desir.webp",
    side: "left",
  },
  {
    no: "04",
    slug: "don-amour",
    name: "Don Amour",
    tag: "A love worn in silence.",
    profile: "Ambroxan · Bergamot · Orris Root · Jasmine · Woody Notes · Amber · Musk · Cashalox · Patchouli",
    img: "/products/collection/don-amour.webp",
    side: "right",
  },
];

// DESKTOP only: each frame collapses to its OUTER edge, so left images wipe open
// left→right and right images wipe open right→left — both resolving to the
// slanted frame. Mobile overrides both ends; see CLIP_START_TOP below.
const CLIP_START = {
  left: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
  right: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
} as const;
const CLIP_END = {
  left: "polygon(0% 0%, 100% 0%, 86% 100%, 0% 100%)",
  right: "polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)",
} as const;
/* Mobile drops the slant (product3.css @860px) for a clean single column, so the
   wipe has to land on a rectangle there — ending on CLIP_END would re-introduce
   the parallelogram the mobile layout deliberately removes. */
const CLIP_END_FLAT = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
/* …and it has to START from the TOP edge there, not an outer side (client
   direction, 2026-08-01): every row is one full-width column on mobile, so the
   left/right alternation that gives the horizontal wipe its meaning no longer
   exists — four frames opening sideways in a single stack just read as
   inconsistent. Collapsed flat against the top, it opens downward with the
   scroll. All four rows use this; `side` still governs desktop. */
const CLIP_START_TOP = "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)";
const MOBILE_Q = "(max-width: 860px)";

export default function ProductTouch3() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const isMobile = window.matchMedia(MOBILE_Q).matches;

    /* THE IMAGE OPENING PLAYS AT ITS AUTHORED SPEED ON A PHONE (client
       direction, 2026-08-01: "slow down this image opening animation").

       revealTl runs this whole timeline at timeScale ~1.556 on a phone, which
       was landing the wipe in ~0.39s — too quick to read a full-width
       photograph opening. Pre-multiplying just these two durations by the same
       factor cancels it for them alone: 0.611 x 1.556, played 1.556x faster,
       is 0.611s again. The text stagger and the ⚥ mark keep the phone tempo,
       so only the image opening slowed — which is what was asked for.

       Desktop is untouched by construction: revealTempo() is 1 there, so both
       durations multiply by 1. That is also why this needs no isMobile guard —
       and why it must NOT use one, since isMobile is 860px here while the tempo
       breakpoint is 820, and a guard would double-slow the 821–860 band. */
    const mediaTempo = revealTempo();

    const ctx = gsap.context(() => {
      q(".col__row").forEach((row) => {
        const r = row as HTMLElement;
        const side = r.classList.contains("col__row--right") ? "right" : "left";
        const media = r.querySelector(".col__media");
        const img = r.querySelector(".col__media img");
        const clipStart = isMobile ? CLIP_START_TOP : CLIP_START[side];
        const clipEnd = isMobile ? CLIP_END_FLAT : CLIP_END[side];

        gsap.set(media, { clipPath: clipStart });
        gsap.set(img, { scale: 1.16 });
        gsap.set(r.querySelectorAll(".col__text > *"), { opacity: 0, y: 22 });
        const mark = r.querySelector(".col__mark");
        if (mark) gsap.set(mark, { opacity: 0, scale: 0.6 });

        const tl = revealTl({
          scrollTrigger: { trigger: r, start: "top 88%", once: true },
        });
        tl.to(media, { clipPath: clipEnd, duration: 0.611 * mediaTempo, ease: "power3.inOut" })
          .to(img, { scale: 1, duration: 0.833 * mediaTempo, ease: "power2.out" }, "<")
          .to(r.querySelectorAll(".col__text > *"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 }, "-=0.417");
        if (mark) tl.to(mark, { opacity: 1, scale: 1, duration: 0.389, ease: "back.out(1.7)" }, "-=0.222");

        gsap.fromTo(
          img,
          { yPercent: -5 },
          { yPercent: 5, ease: "none", scrollTrigger: { trigger: r, start: "top bottom", end: "bottom top", scrub: true } }
        );
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="col" data-theme="light" id="collection" ref={root}>
      <div className="col__grid">
        {COLLECTION.map((p, i) => (
          <article className={`col__row col__row--${p.side}`} key={p.no}>
            <figure className="col__media">
              <img src={p.img} alt={`${p.name} — Beyond The Body`} />
              {/* The photograph opens the PDP too (client direction, 2026-08-19).
                  An overlay rather than a wrapper around the img: the img is absolutely
                  positioned against this figure and the reveal reaches it as
                  `.col__media img`, so wrapping it would move its containing block and
                  deepen that selector for no gain. It is the LAST child for the same
                  reason — the reveal takes the row's FIRST `.col__media img`.
                  Hidden from assistive tech and from the tab order on purpose: the name
                  above and "Discover" below already link here, and a third stop on one
                  destination is noise to anyone not using a mouse. */}
              <a
                className="col__medialink"
                href={`/fragrance/${p.slug}`}
                aria-hidden="true"
                tabIndex={-1}
              />
            </figure>

            <div className="col__text">
              <span className="col__no">No. {p.no}</span>
              <span className="col__rule" aria-hidden="true" />
              {/* Linked to the same PDP as "Discover" below (client direction,
                  2026-08-01). The full stop is kept INSIDE the anchor on
                  purpose: .col__namelink is inline-block, so a long name on a
                  narrow column fills the box and a full stop left outside it
                  would orphan onto a line of its own. */}
              <h3 className="col__name">
                <a className="col__namelink" href={`/fragrance/${p.slug}`}>{p.name}.</a>
              </h3>
              <p className="col__tag">{p.tag}</p>
              <span className="col__plabel">Scent Profile</span>
              <p className="col__profile">{p.profile}</p>
              <a className="col__discover rulelink" href={`/fragrance/${p.slug}`}>
                Discover
                <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                  <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </a>
            </div>

            {i === 1 && (
              <div className="col__mark" aria-hidden="true">
                <span className="col__glyph" />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
