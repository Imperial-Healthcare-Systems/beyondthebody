"use client";

/* PDP · BEAT 4 — The Particulars (details / provenance / care). The quiet spec beat
   after the Story. Delvaux keeps its details as understated rows; BTB renders them as a
   hairline-ruled definition list — concentration, longevity, climate, provenance, batch —
   with a short "how it wears" note. All values are frozen house spec + per-scent prose
   (products-data). Motion: header rises, rows reveal in sequence. Reduced-motion:
   end-state. data-theme light (sand ground). */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Product } from "./products-data";
import "./pdpdetails.css";

export default function PdpDetails({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);

  const rows: { label: string; value: string }[] = [
    ...(product.concentration ? [{ label: "Concentration", value: product.concentration }] : []),
    { label: "Longevity", value: product.spec.longevity },
    { label: "Climate", value: product.spec.climate },
    { label: "Provenance", value: product.spec.provenance },
    { label: "Batch", value: product.spec.batch },
  ];

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".det__head > *"), { opacity: 0, y: 24 });
      gsap.set(q(".det__row"), { opacity: 0, y: 18 });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 68%", once: true } });
      tl.to(q(".det__head > *"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 })
        .to(q(".det__row"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.09 }, "-=0.3");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="det" data-theme="light" id="details" ref={root}>
      <div className="det__inner">
        <header className="det__head">
          <p className="det__eyebrow">The Particulars</p>
          <h2 className="det__title">Made once, kept close.</h2>
          {product.wear && <p className="det__wear">{product.wear}</p>}
        </header>

        <dl className="det__list">
          {rows.map((r) => (
            <div className="det__row" key={r.label}>
              <dt className="det__label">{r.label}</dt>
              <dd className="det__value">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
