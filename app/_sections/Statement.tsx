"use client";

/* §5 · BRAND STATEMENT — ylem's "a statement of future intent" beat. A near-
   empty warm plaster frame with raking window light and slow dust motes; the
   house statement floats as large Fraunces serif over the emptiness, its two
   pillars — presence, scent — set in italic. Light register (inverts out of the
   dark Don Amour before it). Words rise into place on enter; the light drifts.
   Reduced-motion: everything sits in its end-state. */

import { Fragment, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./statement.css";

const STATEMENT =
  "Beyond The Body is a study in presence — its first chapter written in scent.";
const EM = new Set(["presence", "scent."]); // the two pillars, set in italic
const WORDS = STATEMENT.split(" ");

/* comparison toggle for the accent motifs — the human picks what to keep:
   "base"    → just the (pushed) light-shaft + dust motes
   "line"    → base + a single ultra-fine champagne horizon hairline
   "contour" → base + a whisper-weight oxblood contour in one corner
   "all"     → everything on */
const FX: "base" | "line" | "contour" | "all" = "all";

export default function Statement() {
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
      gsap.set(q(".bs__w"), { opacity: 0, y: "0.5em" });
      gsap.set(q(".bs__attr"), { opacity: 0, y: 20 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 68%", once: true },
      });
      tl.to(q(".bs__w"), {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: "power3.out",
        stagger: 0.045,
      }).to(
        q(".bs__attr"),
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=0.3"
      );

      // the shaft of window light drifts slowly across the scroll
      gsap.fromTo(
        q(".bs__shaft"),
        { xPercent: -4, yPercent: -3 },
        {
          xPercent: 4,
          yPercent: 3,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="bs" data-theme="light" data-fx={FX} id="statement" ref={root}>
      <div className="bs__shaft" aria-hidden="true" />
      <div className="bs__motes" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <span className="bs__mote" key={i} />
        ))}
      </div>
      <div className="bs__grain" aria-hidden="true" />

      {/* option 2 — a single ultra-fine champagne horizon the type sits above */}
      <span className="bs__horizon" aria-hidden="true" />

      {/* option 3 — a whisper-weight oxblood contour, one corner only */}
      <svg
        className="bs__contour"
        viewBox="0 0 200 200"
        fill="none"
        preserveAspectRatio="xMaxYMin meet"
        aria-hidden="true"
      >
        <path d="M200 34 C 150 52, 142 88, 92 96 S 22 122, 0 112" vectorEffect="non-scaling-stroke" />
        <path d="M200 66 C 150 84, 146 120, 96 130 S 30 152, 0 146" vectorEffect="non-scaling-stroke" />
        <path d="M200 98 C 156 116, 152 152, 102 162 S 42 180, 0 176" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="bs__inner">
        <h2 className="bs__statement">
          {WORDS.map((w, i) => (
            <Fragment key={i}>
              <span className={`bs__w${EM.has(w) ? " bs__em" : ""}`}>{w}</span>
              {i < WORDS.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </h2>
        <p className="bs__attr">Priced to the craft, not the markup.</p>
      </div>
    </section>
  );
}
