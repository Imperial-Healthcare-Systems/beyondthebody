"use client";

/* §3 · ORIGIN — Variant A. Small clean ⚥ mark + tight copy; a giant
   stacked BTB on the right with a champagne-glow/grain parallax; a
   faint-glow coda at the bottom prompting the scroll into the products. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./origin.css";
import { revealTl } from "../_components/reveal-tempo";

export default function Origin() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".origin__mark, .origin__eyebrow, .origin__head, .origin__line"), {
        opacity: 0,
        y: 26,
      });
      gsap.set(q(".origin__scroll"), { opacity: 0 });

      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".origin__mark"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(q(".origin__eyebrow"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" }, "-=0.25")
        .to(q(".origin__head"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.222")
        .to(q(".origin__line"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.25")
        .to(q(".origin__scroll"), { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.111");

      // parallax: the glow + BTB drift at different speeds
      gsap.to(q(".origin__glow"), {
        yPercent: 14,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(q(".origin__btb"), {
        yPercent: -8,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    /* id is origin-a, NOT origin: OriginB is the live §3 and owns #origin.
       Both variants render the same copy, and Hero + Bridge both link #origin —
       if this ever re-entered BEATS under the same id, those anchors would
       resolve to whichever rendered first. */
    <section className="origin" data-theme="dark" id="origin-a" ref={root}>
      <div className="origin__glow" aria-hidden="true" />
      <div className="origin__btb" aria-hidden="true">
        <span>B</span>
        <span>T</span>
        <span>B</span>
      </div>

      <div className="origin__inner">
        <div className="origin__col">
          <img
            className="origin__mark"
            src="/brand/btb-mark.png"
            alt="The Beyond The Body ⚥ monogram"
            width={82}
            height={82}
          />
          <p className="eyebrow origin__eyebrow">Chapter One</p>
          <h2 className="origin__head">A house has to begin somewhere.</h2>
          <p className="origin__line">Venus and Mars, made one and the same.</p>
        </div>
      </div>

      <div className="origin__scroll">
        <p className="origin__coda">
          Scent is where we begin. It is not where the house ends.
        </p>
        <span className="origin__scrollline" aria-hidden="true" />
      </div>
    </section>
  );
}
