"use client";

/* §2 · BRIDGE — ylem "Every curve is / an attitude." in BTB's skin.
   Two fragmented display lines (left / right) reveal by mask on enter,
   drifting apart on scroll. Light register. Reduced-motion: everything
   sits in its end-state.

   The full-bleed sand seam band that used to close this section was REMOVED
   on client direction, 2026-08-01. §2's bone ground now runs straight into
   §3 ORIGIN's full-bleed image. Its markup, its CSS and its parallax are all
   gone — recoverable from git at d774bdf if it is ever wanted back. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./bridge.css";
import { revealTl } from "../_components/reveal-tempo";

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
      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".bridge__eyebrow"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(
          q(".bridge__line .inner"),
          { yPercent: 0, duration: 0.556, ease: "power4.out", stagger: 0.04 },
          "-=0.194"
        )
        .to(q(".bridge__link"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" }, "-=0.278");

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

      /* The seam band's parallax was removed with the band itself (client
         direction, 2026-08-01) — it was the 18th scrub block; 16 remain. */
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
        <a className="rulelink bridge__link" href="/#origin">
          Read the house
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </div>
    </section>
  );
}
