"use client";

/* §9 · THE JOURNAL — a "Read" beat (brand, not product) that keeps the page
   identity-led, à la Lemaire / Kinfolk. Frozen copy: eyebrow "The Journal",
   headline "The things around the work.", sub, "Read →". Warm editorial register.
   Large 3:2 studio image + a quiet text column. Motion is restrained: image
   clip-reveal + ken-burns + parallax; text staggers in. Reduced-motion: end-state.
   NOTE: /sections/journal.jpg is a temporary warm stand-in — swap with the real
   perfumer's-studio render (prompt in the copy file's §9 imagery brief). */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./journal.css";

export default function Journal() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".jr__media"), { clipPath: "inset(0 0 0 100%)" });
      gsap.set(q(".jr__media img"), { scale: 1.18 });
      gsap.set(q(".jr__text > *"), { opacity: 0, y: 26 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 74%", once: true },
      });
      tl.to(q(".jr__media"), { clipPath: "inset(0 0 0 0%)", duration: 1.15, ease: "power3.inOut" })
        .to(q(".jr__media img"), { scale: 1, duration: 1.6, ease: "power2.out" }, "<")
        .to(q(".jr__text > *"), { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.12 }, "-=0.85");

      gsap.fromTo(
        q(".jr__media img"),
        { yPercent: -6 },
        { yPercent: 6, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="jr" data-theme="light" id="journal" ref={root}>
      <div className="jr__inner">
        <div className="jr__text">
          <p className="jr__eyebrow">The Journal</p>
          <h2 className="jr__headline">The things around the work.</h2>
          <p className="jr__sub">Notes on composition, provenance, and the air a scent is worn in.</p>
          <a className="jr__cta rulelink" href="/journal">
            Read
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
              <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </a>
        </div>

        <figure className="jr__media">
          <img src="/sections/journal.jpg" alt="From the studio — notebook, blotter strips and botanicals in warm window light" />
          <figcaption className="jr__caption">From the studio</figcaption>
        </figure>
      </div>
    </section>
  );
}
