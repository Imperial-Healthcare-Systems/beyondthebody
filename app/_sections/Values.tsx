"use client";

/* §7 · WHAT THE HOUSE HOLDS TO — ylem's "We Don't Follow Codes / We Rewrite
   Them" beat, in restraint (never defiance). A quiet three-part negation
   resolves into the house line, then a four-value grid. Light register (inverts
   out of the dark Desir). Typographic — the tile imagery is warranted but lives
   as a later asset pass; the grid stands on its own as editorial. The negations
   reveal in sequence, the resolve lands, the values rise. Reduced-motion: end-state. */

import { Fragment, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./values.css";
import { revealTl } from "../_components/reveal-tempo";

const NEGATIONS = ["Neither his nor hers.", "No aisle to stand in."];

const VALUES = [
  { n: "01", title: "Presence over attention", body: "It does not ask to be noticed. It is, quietly, already there." },
  { n: "02", title: "Material over marketing", body: "Absolutes from Grasse, Seville and Florence. The name stays off the price." },
  { n: "03", title: "Made in a single run", body: "We make what we can make well, then rest it before it ships." },
  { n: "04", title: "Composed for the air", body: "Built at 25% to hold through warm light, not a European spring." },
];

export default function Values() {
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
      gsap.set(q(".hv__eyebrow, .hv__neg, .hv__tile"), { opacity: 0, y: 24 });
      gsap.set(q(".hv__resolve"), { opacity: 0, y: 30, filter: "blur(9px)" });
      gsap.set(q(".hv__tile-rule"), { scaleX: 0, transformOrigin: "left center" });

      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".hv__eyebrow"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" })
        .to(q(".hv__neg"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out", stagger: 0.046 }, "-=0.111")
        .to(q(".hv__resolve"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.556, ease: "power3.out" }, "-=0.111")
        .to(q(".hv__tile-rule"), { scaleX: 1, duration: 0.389, ease: "power2.out", stagger: 0.034 }, "-=0.222")
        .to(q(".hv__tile"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.034 }, "<0.056");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="hv" data-theme="light" id="values" ref={root}>
      <div className="hv__inner">
        <p className="hv__eyebrow">What the house holds to</p>

        <div className="hv__statement">
          <p className="hv__negation">
            {NEGATIONS.map((n, i) => (
              <Fragment key={i}>
                <span className="hv__neg">{n}</span>
                {i < NEGATIONS.length - 1 ? " " : ""}
              </Fragment>
            ))}
          </p>
          <h2 className="hv__resolve">
            <span className="hv__resolve-line">Made for everyone.</span>
            <span className="hv__resolve-line hv__resolve-em">Sorted for no one.</span>
          </h2>
        </div>

        <div className="hv__grid">
          {VALUES.map((v) => (
            <div className="hv__tile" key={v.n}>
              <span className="hv__tile-rule" aria-hidden="true" />
              <span className="hv__n">{v.n}</span>
              <h3 className="hv__title">{v.title}</h3>
              <p className="hv__body">{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
