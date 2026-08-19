"use client";

/* PDP · BEAT 3 — Story. The quiet, light beat after the dark composition. Since
   2026-08-19 it carries the client's "Sensory Experience Story" VERBATIM
   (fragrance_scripts_and_stories.pdf) — a character quote that "writes in"
   sentence by sentence, then three timed phases (Opening / Heart / Footprint)
   as hairline-ruled rows, closing on the tagline. The quote keeps the old
   .story__s write-in so anim-initial.css needs no new quote rule; the phases
   reveal like the Particulars rows. Reduced-motion: end-state. data-theme light. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Product } from "./products-data";
import "./pdpstory.css";
import { revealTl } from "../_components/reveal-tempo";

export default function PdpStory({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);
  const sentences = product.story.quote.split(/(?<=\.)\s+/).filter(Boolean);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".story__eyebrow, .story__sign"), { opacity: 0, y: 20 });
      gsap.set(q(".story__s"), { opacity: 0.14 }); // dim, then write in
      gsap.set(q(".story__phase"), { opacity: 0, y: 18 });

      const tl = revealTl({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      tl.to(q(".story__eyebrow"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(q(".story__s"), { opacity: 1, duration: 0.278, ease: "power2.out", stagger: 0.046 }, "-=0.111")
        .to(q(".story__phase"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out", stagger: 0.046 }, "-=0.083")
        .to(q(".story__sign"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.083");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="story" data-theme="light" id="story" ref={root}>
      <div className="story__inner">
        {/* the PDF's label minus "Story" (client, 2026-08-19) — was "The Story" */}
        <p className="story__eyebrow">Sensory Experience</p>
        {/* quotation marks are typeset here; the data holds the bare sentence */}
        <p className="story__quote">
          <span aria-hidden="true">&ldquo;</span>
          {sentences.map((s, i) => (
            <span className="story__s" key={i}>
              {s}
              {i < sentences.length - 1 ? " " : ""}
            </span>
          ))}
          <span aria-hidden="true">&rdquo;</span>
        </p>
        <ol className="story__phases">
          {product.story.phases.map((ph) => (
            <li className="story__phase" key={ph.phase}>
              <div className="story__phasehead">
                <span className="story__phasename">{ph.phase}</span>
                <span className="story__phasewindow">{ph.window}</span>
              </div>
              <p className="story__phasebody">{ph.body}</p>
            </li>
          ))}
        </ol>
        <p className="story__sign">{product.tagline}</p>
      </div>
    </section>
  );
}
