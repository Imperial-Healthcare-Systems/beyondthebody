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

type Signature = {
  no: string;
  name: string;
  tag: string;
  profile: string;
  img: string;
  side: "left" | "right";
};

const COLLECTION: Signature[] = [
  {
    no: "01",
    name: "Mon Amour",
    tag: "Love, remembered.",
    profile: "Pear Blossom · Red Berries · Italian Mandarin · Gardenia · Jasmine · Frangipani · Brown Sugar · Patchouli",
    img: "/products/collection/mon-amour.png",
    side: "left",
  },
  {
    no: "02",
    name: "Heartthrob",
    tag: "Magnetism, refined.",
    profile: "Bergamot · Lemon Zest · Artemisia · Mint · Lavender · Pineapple · Green Notes · Geranium · Sandalwood · Tonka Bean · Cedar · Iso E Super · Amberwood",
    img: "/products/collection/heart-throb.png",
    side: "right",
  },
  {
    no: "03",
    name: "Desir",
    tag: "Desire, distilled.",
    profile: "Pear · Pink Pepper · Orange Blossom · Coffee · Jasmine · Bitter Almond · Cedar · Vanilla · Cashmere Wood · Patchouli",
    img: "/products/collection/desir.png",
    side: "left",
  },
  {
    no: "04",
    name: "Don Amour",
    tag: "A love worn in silence.",
    profile: "Ambroxan · Bergamot · Orris Root · Jasmine · Woody Notes · Amber · Musk · Cashalox · Patchouli",
    img: "/products/collection/don-amour.png",
    side: "right",
  },
];

// each frame collapses to its OUTER edge, so left images wipe open left→right and
// right images wipe open right→left — both resolving to the slanted frame.
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

    const ctx = gsap.context(() => {
      q(".col__row").forEach((row) => {
        const r = row as HTMLElement;
        const side = r.classList.contains("col__row--right") ? "right" : "left";
        const media = r.querySelector(".col__media");
        const img = r.querySelector(".col__media img");
        const clipEnd = isMobile ? CLIP_END_FLAT : CLIP_END[side];

        gsap.set(media, { clipPath: CLIP_START[side] });
        gsap.set(img, { scale: 1.16 });
        gsap.set(r.querySelectorAll(".col__text > *"), { opacity: 0, y: 22 });
        const mark = r.querySelector(".col__mark");
        if (mark) gsap.set(mark, { opacity: 0, scale: 0.6 });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: r, start: "top 76%", once: true },
        });
        tl.to(media, { clipPath: clipEnd, duration: 1.1, ease: "power3.inOut" })
          .to(img, { scale: 1, duration: 1.5, ease: "power2.out" }, "<")
          .to(r.querySelectorAll(".col__text > *"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 }, "-=0.75");
        if (mark) tl.to(mark, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.7)" }, "-=0.4");

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
            </figure>

            <div className="col__text">
              <span className="col__no">No. {p.no}</span>
              <span className="col__rule" aria-hidden="true" />
              <h3 className="col__name">{p.name}.</h3>
              <p className="col__tag">{p.tag}</p>
              <span className="col__plabel">Scent Profile</span>
              <p className="col__profile">{p.profile}</p>
              <a className="col__discover rulelink" href={`#${p.name.toLowerCase().replace(/\s+/g, "-")}`}>
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
