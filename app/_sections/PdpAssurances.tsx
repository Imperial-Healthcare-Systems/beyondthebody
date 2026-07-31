"use client";

/* PDP · BEAT 7 — Assurances (certifications). The client supplied badge ARTWORK (IFRA, FDA,
   cruelty-free rabbit, made-in-India lion, a red 12-hour hourglass…). Rendered here TYPOGRAPHICALLY
   from house tokens instead of placing the raster: the clip-art badges read as loud ecommerce and
   collide with the editorial register (design-philosophy §1 — "no loud badges"). Text also means a
   claim is one string to edit or pull, which matters because these are unverified regulated claims
   (house-copy.ts flags each; surfaced at the beat gate). Light ivory ground, the calm coda before
   the dark footer. Motion: reveal + stagger on scroll. Reduced-motion: end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ASSURANCES_PRIMARY, ASSURANCES_SECONDARY, LONGEVITY_BADGE } from "./house-copy";
import "./pdpassurances.css";
import { revealTl } from "../_components/reveal-tempo";

export default function PdpAssurances() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".assur__figure, .assur__eyebrow"), { opacity: 0, y: 22 });
      gsap.set(q(".assur__item"), { opacity: 0, y: 16 });

      const tl = revealTl({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      tl.to(q(".assur__figure, .assur__eyebrow"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 })
        .to(q(".assur__item"), { opacity: 1, y: 0, duration: 0.278, ease: "power3.out", stagger: 0.014 }, "-=0.139");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="assur" data-theme="light" id="assurances" ref={root}>
      <div className="assur__inner">
        <p className="assur__figure">{LONGEVITY_BADGE}</p>
        <p className="assur__eyebrow">Made honestly, certified, and safe on the skin</p>

        <ul className="assur__primary" aria-label="Certifications">
          {ASSURANCES_PRIMARY.map((a) => (
            <li className="assur__item" key={a.label}>
              {a.label}
            </li>
          ))}
        </ul>

        <ul className="assur__secondary" aria-label="Formulation">
          {ASSURANCES_SECONDARY.map((a) => (
            <li className="assur__item" key={a.label}>
              {a.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
