"use client";

/* §3 · ORIGIN — Variant B. Full-bleed ylem-style parallax image with the
   same copy laid over it; faint-glow coda scroll-prompt at the bottom. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./origin.css";
import { revealTl } from "../_components/reveal-tempo";

const HAS_ASSET = true; // Pexels 30987992 (warm raking light on wall)

export default function OriginB() {
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
      gsap.set(q(".origin__mark, .originb__chapter, .origin__head, .origin__line"), {
        opacity: 0,
        y: 26,
      });
      gsap.set(q(".originb__scroll"), { opacity: 0 });

      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".origin__mark"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(q(".originb__chapter"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" }, "-=0.25")
        .to(q(".origin__head"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.222")
        .to(q(".origin__line"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.25")
        .to(q(".originb__scroll"), { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.111");

      gsap.fromTo(
        q(".originb__img"),
        { yPercent: -6 },
        {
          yPercent: 8,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="originb" data-theme="dark" id="origin" ref={root}>
      <div className="originb__media">
        {HAS_ASSET ? (
          <img className="originb__img" src="/sections/origin-bg.webp" alt="" />
        ) : (
          <div className="originb__img originb__placeholder" aria-hidden="true" />
        )}
        <div className="originb__scrim" aria-hidden="true" />
        <div className="originb__grain" aria-hidden="true" />
      </div>

      <div className="originb__inner">
        <div className="originb__row">
          <img
            className="origin__mark"
            src="/brand/btb-mark.png"
            alt="The Beyond The Body ⚥ monogram"
            width={72}
            height={72}
          />
          <p className="originb__chapter">Chapter One</p>
          <div className="originb__text">
            <h2 className="origin__head">A house has to begin somewhere.</h2>
            <p className="origin__line">Venus and Mars, made one and the same.</p>
          </div>
        </div>
      </div>

      <div className="originb__scroll">
        <p className="origin__coda">
          Scent is where we begin. It is not where the house ends.
        </p>
        <span className="origin__scrollline" aria-hidden="true" />
      </div>
    </section>
  );
}
