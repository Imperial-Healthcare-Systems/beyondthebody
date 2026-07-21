"use client";

/* /collection · BEAT 3 — Chapter Two · (forthcoming). A DELIBERATELY QUIET coda, not a hero:
   a low, short dark band that states the house is larger than scent without dating or naming
   what comes next (approved "unnamed & forthcoming" direction). Kept subtle — modest type, a
   shallow section, no watermark — so it reads as a soft close before the footer rather than a
   second statement competing with the masthead. Motion: a gentle single-tier reveal on scroll.
   Reduced-motion: end-state. data-theme dark → nav inverts. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./collectionforthcoming.css";

export default function CollectionForthcoming() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".cforth__eyebrow, .cforth__headline, .cforth__sub, .cforth__tag"), { opacity: 0, y: 16 });
      gsap.set(q(".cforth__rule"), { scaleX: 0, transformOrigin: "center" });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 82%", once: true } });
      tl.to(q(".cforth__eyebrow"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" })
        .to(q(".cforth__headline"), { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.35")
        .to(q(".cforth__sub"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "-=0.5")
        .to(q(".cforth__rule"), { scaleX: 1, duration: 0.8, ease: "power3.inOut" }, "-=0.35")
        .to(q(".cforth__tag"), { opacity: 0.9, y: 0, duration: 0.65, ease: "power3.out" }, "-=0.45");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="cforth" data-theme="dark" id="chapter-two" ref={root}>
      <div className="cforth__inner">
        <p className="cforth__eyebrow">Chapter Two</p>
        <h2 className="cforth__headline">The house does not end at the skin.</h2>
        <p className="cforth__sub">
          What it becomes is already being composed — not yet named, only begun.
        </p>
        <span className="cforth__rule" aria-hidden="true" />
        <p className="cforth__tag">In time</p>
      </div>
    </section>
  );
}
