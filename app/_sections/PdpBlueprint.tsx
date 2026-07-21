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

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 66%", once: true } });
      tl.to(q(".bp__head > *"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 })
        .to(q(".bp__lede"), { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, "-=0.3")
        .to(q(".bp__point"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.12 }, "-=0.35")
        .to(q(".bp__val"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.12 }, "-=0.2");
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
