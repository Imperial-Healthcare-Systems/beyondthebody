"use client";

/* PDP · BEAT 5 — The Blueprint (why 25% Eau de Parfum) + The Value. The dense "specs / FAQ"
   tail, placed BELOW the recommendations (client's Amazon ordering, 2026-07-17). Register is
   the client's marketing prose (verbatim, house-copy.ts + per-scent blueprint tails) — rendered
   with restraint so it still reads editorial: one distinction pull-quote, then the three
   Blueprint points, then the two Value points. Dark oxblood ground (data-theme dark → nav
   inverts). Motion: header + lede rise, points reveal in sequence on scroll. Reduced-motion:
   end-state. */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ChromaticWaves from "../_components/ChromaticWaves";
import { useScheme } from "../_components/useScheme";
import type { Product } from "./products-data";
import { EDP_DISTINCTION, BLUEPRINT, VALUE } from "./house-copy";
import PdpScale from "./PdpScale";
import "./pdpblueprint.css";

/* Dot colour for the client's Chromatic Waves bg (client-chosen 2026-07-17): a single deep
   red #410505, a touch brighter than the near-black ground (bgColor #1E0000), so the drifting
   marks read as tonal texture rather than the element's default rainbow.

   Dark scheme (2026-07-21): the shader is WebGL, so its colours are uniforms — no stylesheet
   can reach them and they would otherwise be the one surface on the site that ignores the
   theme. In the dark scheme this beat drops to the DEEPEST register (--night-0 #0C0508), so
   #1E0000 would suddenly sit *above* its own section and read as a lit panel. Both values are
   deepened by the same amount to hold the client's chosen relationship (the dots stay exactly
   as far above the ground as they are today) — the RATIO is the design, the absolute values
   are the theme. speed / cellSize are untouched: client-chosen, not ours to tune. */
const WAVE = {
  light: { bg: "#1E0000", dots: ["#410505"] },
  dark: { bg: "#120000", dots: ["#350404"] },
} as const;

export default function PdpBlueprint({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);
  // Motion floor: the WebGL bg only mounts when the viewer allows motion (and only on the
  // client — starts false so SSR/first paint match, then flips on mount). Reduced-motion
  // viewers keep the static oxblood ground.
  const [motionOK, setMotionOK] = useState(false);
  useEffect(() => {
    setMotionOK(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /* ChromaticWaves reads its colours once, at init, into GL uniforms — it has no
     effect watching these props. Keying the element on the scheme remounts the
     canvas on a toggle, which is the honest way to re-colour it. Cheap: this only
     happens when the viewer actually changes the theme. */
  const scheme = useScheme();
  const wave = WAVE[scheme];

  const points = [
    { label: BLUEPRINT.threshold.label, body: `${BLUEPRINT.threshold.lead} ${product.blueprint.thresholdTail}` },
    { label: BLUEPRINT.longevity.label, body: `${BLUEPRINT.longevity.opener} ${product.blueprint.longevityBody}` },
    { label: BLUEPRINT.microBatch.label, body: BLUEPRINT.microBatch.body },
  ];
  const values = [
    { label: VALUE.crowdVetted.label, body: VALUE.crowdVetted.body },
    { label: VALUE.skinCentric.label, body: `${VALUE.skinCentric.lead} ${product.blueprint.skinTail}` },
  ];

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".bp__head > *, .bp__lede"), { opacity: 0, y: 26 });
      gsap.set(q(".bp__point, .bp__val"), { opacity: 0, y: 22 });
      /* The scale (client reference, 2026-07-28): header, then the platform and the
         bottles rise together per column, then the connecting line draws, then the
         markers and the closing statement land. Slow by direction — 900–1200ms, 120ms
         stagger, no bounce.

         NOTE what is deliberately NOT transformed: `.scale__marker`. It carries a CSS
         transform of its own (translate(-50%,50%) centring), and GSAP resolves a computed
         transform into a PIXEL matrix — writing to it would freeze that centring at one
         viewport width and stack on top of it (calibration ledger, trap 1). Only its opacity
         is animated. `.scale__strip` is safe to move: it carries no layout transform.

         The line's clip keeps a NEGATIVE bottom inset in both states. The connector is a
         curve that sags below the straight chord, so a flush clip would slice the dip off
         as it drew. */
      gsap.set(q(".scale__title, .scale__subtitle"), { opacity: 0, y: 18 });
      gsap.set(q(".scale__col, .scale__entry"), { opacity: 0, y: 22 });
      gsap.set(q(".scale__strip"), { opacity: 0, y: 26 });
      gsap.set(q(".scale__lineclip"), { clipPath: "inset(0 100% -40% 0)" });
      gsap.set(q(".scale__marker"), { opacity: 0 });
      gsap.set(q(".scale__rule"), { scaleX: 0 });
      gsap.set(q(".scale__mark"), { opacity: 0, y: 12 });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      tl.to(q(".bp__head > *"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 })
        .to(q(".bp__lede"), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, "-=0.167")
        .to(
          q(".scale__title, .scale__subtitle"),
          { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 },
          "-=0.25"
        )
        // the platform rises step by step, and the bottles settle onto it as one
        .to(
          q(".scale__col"),
          { opacity: 1, y: 0, duration: 0.611, ease: "power3.out", stagger: 0.034 },
          "-=0.167"
        )
        .to(q(".scale__strip"), { opacity: 1, y: 0, duration: 0.667, ease: "power3.out" }, "-=0.528")
        // the connecting line draws across the ladder — 250ms ceiling, once
        .to(q(".scale__lineclip"), { clipPath: "inset(0 0% 0 0)", duration: 0.389, ease: "power2.inOut" }, "-=0.278")
        .to(q(".scale__marker"), { opacity: 0.85, duration: 0.278, ease: "power2.out", stagger: 0.023 }, "-=0.222")
        .to(
          q(".scale__entry"),
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.034 },
          "-=0.417"
        )
        .to(q(".scale__rule"), { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, "-=0.222")
        .to(q(".scale__mark"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.278")
        .to(q(".bp__point"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out", stagger: 0.034 }, "-=0.167")
        .to(q(".bp__val"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out", stagger: 0.034 }, "-=0.111");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="bp" data-theme="dark" id="blueprint" ref={root}>
      {motionOK && (
        <div className="bp__bg" aria-hidden="true">
          <ChromaticWaves
            key={scheme}
            speed={1}
            bgColor={wave.bg}
            cellSize={7}
            colors={wave.dots}
          />
        </div>
      )}
      <div className="bp__scrim" aria-hidden="true" />

      <div className="bp__inner">
        <header className="bp__head">
          <p className="bp__eyebrow">The Blueprint</p>
          <h2 className="bp__title">Why twenty-five percent.</h2>
        </header>

        <p className="bp__lede">{EDP_DISTINCTION}</p>

        {/* The claim above, shown. Sits between the pull-quote and the three points so
            the beat escalates: state it → show it → elaborate. */}
        <PdpScale />

        <div className="bp__grid">
          {points.map((p) => (
            <article className="bp__point" key={p.label}>
              <h3 className="bp__pointlabel">{p.label}</h3>
              <p className="bp__pointbody">{p.body}</p>
            </article>
          ))}
        </div>

        <div className="bp__value">
          <p className="bp__valueeyebrow">The Value</p>
          <div className="bp__valuegrid">
            {values.map((v) => (
              <article className="bp__val" key={v.label}>
                <h3 className="bp__pointlabel">{v.label}</h3>
                <p className="bp__pointbody">{v.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
