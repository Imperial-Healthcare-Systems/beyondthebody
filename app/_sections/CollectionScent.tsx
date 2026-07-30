"use client";

/* /collection · BEAT 2 — Chapter One · Scent. The house's first chapter as a Delvaux-style
   collection row: the four fragrances four-across, minimal and airy — a wishlist heart top-
   right of each frame, and name (left) + format label (right) beneath. Structure mirrors the
   Delvaux "Le Cool Move" grid (STRUCTURE only; skin 100% BTB). Data is the frozen catalogue
   (products-data); no numbering (client rule). The heart is a cosmetic save toggle (no
   wishlist backend yet). Motion: chapter marker reveals, then the row's frames clip-reveal +
   rise on scroll, staggered. Reduced-motion: end-state. data-theme light. */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PRODUCTS, type Product } from "./products-data";
import "./collectionscent.css";

// natural reading order (Mon Amour → Heartthrob → Desir → Don Amour) via the frozen `no`
const ORDERED: Product[] = [...PRODUCTS].sort((a, b) => a.no.localeCompare(b.no));

export default function CollectionScent() {
  const root = useRef<HTMLElement>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      // chapter marker
      gsap.set(q(".cscent__eyebrow, .cscent__intro"), { opacity: 0, y: 22 });
      // y: 0 — see Hero.tsx: anim-initial.css mirrors this as a CSS transform,
      // which GSAP would otherwise read as a stacked pixel offset.
      gsap.set(q(".cscent__title .inner"), { yPercent: 115, y: 0 });
      const mast = gsap.timeline({ scrollTrigger: { trigger: q(".cscent__head"), start: "top 88%", once: true } });
      mast
        .to(q(".cscent__eyebrow"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(q(".cscent__title .inner"), { yPercent: 0, duration: 0.556, ease: "power4.out" }, "-=0.222")
        .to(q(".cscent__intro"), { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" }, "-=0.333");

      // the row's cards — clip-reveal media + rise, staggered across the row
      gsap.set(q(".cscent__media"), { clipPath: "inset(0 0 100% 0)" });
      gsap.set(q(".cscent__media img"), { scale: 1.16 });
      gsap.set(q(".cscent__meta"), { opacity: 0, y: 18 });
      const row = gsap.timeline({ scrollTrigger: { trigger: q(".cscent__row"), start: "top 88%", once: true } });
      row
        .to(q(".cscent__media"), { clipPath: "inset(0 0 0% 0)", duration: 0.556, ease: "power3.inOut", stagger: 0.034 })
        .to(q(".cscent__media img"), { scale: 1, duration: 0.778, ease: "power2.out", stagger: 0.034 }, "<")
        .to(q(".cscent__meta"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.034 }, "-=0.556");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="cscent" data-theme="light" id="chapter-one" ref={root}>
      <div className="cscent__inner">
        <header className="cscent__head">
          <p className="cscent__eyebrow">Chapter One · Scent</p>
          <h2 className="cscent__title">
            <span className="line"><span className="inner">Where the house begins.</span></span>
          </h2>
          <p className="cscent__intro">
            Four unisex compositions — each its own way of being present, none of them a
            his or a hers. Touched, not sold. Begin anywhere.
          </p>
        </header>

        <div className="cscent__row">
          {ORDERED.map((p) => {
            const src = p.gallery.find((g) => g.ratio === "3 / 4")?.src ?? p.gallery[0].src;
            const isSaved = !!saved[p.slug];
            return (
              <article className="cscent__card" key={p.slug}>
                <a className="cscent__link" href={`/fragrance/${p.slug}`}>
                  <figure className="cscent__media">
                    <img src={src} alt={`${p.name} — Beyond The Body`} />
                  </figure>
                  <div className="cscent__meta">
                    <span className="cscent__name">{p.name}</span>
                    <span className="cscent__label">Eau de Parfum</span>
                  </div>
                </a>
                <button
                  type="button"
                  className={`cscent__save${isSaved ? " is-saved" : ""}`}
                  aria-label={isSaved ? `Saved ${p.name}` : `Save ${p.name}`}
                  aria-pressed={isSaved}
                  onClick={() => setSaved((s) => ({ ...s, [p.slug]: !s[p.slug] }))}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} aria-hidden="true">
                    <path
                      d="M12 20.5S3.8 15 3.8 8.9A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.2 2.3C20.2 15 12 20.5 12 20.5Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
