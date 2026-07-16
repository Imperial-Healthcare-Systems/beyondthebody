"use client";

/* PDP · BEAT 3 — Story. The quiet, light beat after the dark composition. The drafted
   Don Amour narrative (products-data, house voice — note-led, no adjectives-as-claims)
   set as large editorial serif prose that "writes in" sentence by sentence on scroll,
   closing on the tagline. Reduced-motion: end-state. data-theme light. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Product } from "./products-data";
import "./pdpstory.css";

export default function PdpStory({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);
  const sentences = product.story.split(/(?<=\.)\s+/).filter(Boolean);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".story__eyebrow, .story__sign"), { opacity: 0, y: 20 });
      gsap.set(q(".story__s"), { opacity: 0.14 }); // dim, then write in

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 66%", once: true } });
      tl.to(q(".story__eyebrow"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" })
        .to(q(".story__s"), { opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.16 }, "-=0.2")
        .to(q(".story__sign"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "-=0.15");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="story" data-theme="light" id="story" ref={root}>
      <div className="story__inner">
        <p className="story__eyebrow">The Story</p>
        <p className="story__body">
          {sentences.map((s, i) => (
            <span className="story__s" key={i}>
              {s}{" "}
            </span>
          ))}
        </p>
        <p className="story__sign">{product.tagline}</p>
      </div>
    </section>
  );
}
