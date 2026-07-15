"use client";

/* §2 · BRIDGE — ylem "Every curve is / an attitude." in BTB's skin.
   Two fragmented display lines (left / right) reveal by mask on enter,
   drifting apart on scroll. Below them, a full-bleed 21:9 band that
   parallaxes — the neutral breathing space between sections. Light
   register. Reduced-motion: everything sits in its end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./bridge.css";

export default function Bridge() {
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
      gsap.set(q(".bridge__line .inner"), { yPercent: 110 });
      gsap.set(q(".bridge__eyebrow, .bridge__link"), { opacity: 0, y: 24 });

      // --- type reveal ---
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 74%", once: true },
      });
      tl.to(q(".bridge__eyebrow"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" })
        .to(
          q(".bridge__line .inner"),
          { yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.14 },
          "-=0.35"
        )
        .to(q(".bridge__link"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=0.5");

      // fragmented lines drift apart on scroll
      gsap.to(q(".bridge__line--a"), {
        xPercent: -6,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(q(".bridge__line--b"), {
        xPercent: 6,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });

      // gentle parallax on the neutral band
      gsap.fromTo(
        q(".bridge__placeholder"),
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: "none",
          scrollTrigger: {
            trigger: q(".bridge__band"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="bridge" data-theme="light" id="bridge" ref={root}>
      <div className="bridge__type">
        <p className="eyebrow bridge__eyebrow">A house that begins with scent</p>
        <h2 className="bridge__lines">
          <span className="bridge__line bridge__line--a">
            <span className="inner">The first thing you wear —</span>
          </span>
          <span className="bridge__line bridge__line--b">
            <span className="inner">— the last thing remembered.</span>
          </span>
        </h2>
        <a className="rulelink bridge__link" href="#origin">
          Read the house
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </div>

      {/* the seam — a neutral full-bleed band that parallaxes */}
      <div className="bridge__band">
        <div className="bridge__placeholder" aria-hidden="true" />
        <div className="bridge__grain" aria-hidden="true" />
      </div>
    </section>
  );
}
