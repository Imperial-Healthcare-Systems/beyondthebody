"use client";

/* PDP · BEAT 5 — You may also wear (cross-sell). Delvaux closes a product with a quiet
   "you may also like" rail; BTB shows the two related scents (product.crossSell) as
   editorial cards linking to their PDPs. Each card: a fixed-ratio image frame (source art
   is reused by fit — re-art later), No., name, tagline, "from" price. Motion: header +
   cards reveal on scroll; hover lifts the image. Reduced-motion: end-state. data-theme
   light (ivory) — a calm coda between the dark composition and the dark footer. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { productBySlug, formatPrice, type Product } from "./products-data";
import "./pdpcrosssell.css";

const fromPrice = (p: Product): number | null => {
  const prices = p.sizes.map((s) => s.price).filter((v): v is number => v != null);
  return prices.length ? Math.min(...prices) : null;
};

export default function PdpCrossSell({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);
  const related = product.crossSell
    .map((slug) => productBySlug(slug))
    .filter((p): p is Product => Boolean(p));

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".xsell__head > *"), { opacity: 0, y: 22 });
      gsap.set(q(".xsell__card"), { opacity: 0, y: 34 });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 74%", once: true } });
      tl.to(q(".xsell__head > *"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 })
        .to(q(".xsell__card"), { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.12 }, "-=0.3");
    }, el);

    return () => ctx.revert();
  }, []);

  if (!related.length) return null;

  return (
    <section className="xsell" data-theme="light" id="also" ref={root}>
      <div className="xsell__inner">
        <header className="xsell__head">
          <p className="xsell__eyebrow">You may also wear</p>
          <h2 className="xsell__title">The rest of the house.</h2>
        </header>

        <div className="xsell__grid" data-count={related.length}>
          {related.map((p) => {
            const price = fromPrice(p);
            return (
              <a className="xsell__card" href={`/fragrance/${p.slug}`} key={p.slug}>
                <div className="xsell__frame">
                  <img src={p.gallery[0].src} alt={p.gallery[0].alt} />
                </div>
                <div className="xsell__meta">
                  <h3 className="xsell__name">{p.name}</h3>
                  <p className="xsell__tag">{p.tagline}</p>
                  <p className="xsell__price">
                    {price != null ? `From ${formatPrice(price)}` : "Price on request"}
                    <span className="xsell__arrow" aria-hidden="true">↗</span>
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
