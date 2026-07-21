"use client";

/* PDP · BEAT 2 — The Composition (redesigned to the client reference). A full-bleed dark
   "anatomy of the scent": the Don Amour scene fills the frame, editorial copy sits left,
   and the note pyramid (Top / Middle / Base) sits right as cut-out ingredient circles.
   Copy adapted from the reference ("Wear What Remains." / "Scent as identity…"). Notes +
   images are frozen data + client-supplied cutouts. Motion: copy rises, note circles pop
   in per group on scroll. Reduced-motion: end-state. data-theme dark → nav inverts. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Product } from "./products-data";
import "./pdpcomposition.css";

// note label → cutout file (public/products/notes/*.png)
const NOTE_IMG: Record<string, string> = {
  // Don Amour
  ambroxan: "ambroxan",
  bergamot: "bergamot",
  "italian bergamot": "bergamot", // client-specified label (2026-07-17); reuses the bergamot cutout
  "orris root": "orris-root",
  jasmine: "jasmine",
  "woody notes": "woody-notes",
  "floral notes": "floral-notes",
  amber: "amber",
  ambergris: "ambergris",
  musk: "musk",
  cashalox: "cachalox",
  patchouli: "patchouli",
  // Desir + Heartthrob + Mon Amour (sliced from the client note grids 2026-07-16)
  pear: "pear",
  "pink pepper": "pink-pepper",
  "orange blossom": "orange-blossom",
  coffee: "coffee",
  licorice: "licorice",
  "bitter almond": "bitter-almond",
  cedar: "cedar",
  vanilla: "vanilla",
  "cashmere wood": "cashmere-wood",
  "lemon zest": "lemon-zest",
  artemisia: "artemisia",
  mint: "mint",
  lavender: "lavender",
  pineapple: "pineapple",
  "green notes": "green-notes",
  geranium: "geranium",
  sandalwood: "sandalwood",
  "tonka bean": "tonka-bean",
  "iso e super": "iso-e-super",
  amberwood: "amberwood",
  "pear blossom": "pear-blossom",
  "red berries": "red-berries",
  "italian mandarin": "italian-mandarin",
  gardenia: "gardenia",
  frangipani: "frangipani",
  "brown sugar": "brown-sugar",
};
const imgFor = (n: string): string | null => {
  const k = NOTE_IMG[n.toLowerCase()];
  return k ? `/products/notes/${k}.png` : null;
};

const GROUPS = [
  { label: "Top Notes", key: "top" as const },
  { label: "Middle Notes", key: "middle" as const },
  { label: "Base Notes", key: "base" as const },
];

export default function PdpComposition({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".comp__copy > *"), { opacity: 0, y: 26 });
      gsap.set(q(".comp__group"), { opacity: 0, y: 20 });
      gsap.set(q(".comp__note"), { opacity: 0, scale: 0.6 });

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 62%", once: true } });
      tl.to(q(".comp__copy > *"), { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.1 })
        .to(q(".comp__group"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.14 }, "-=0.4")
        .to(q(".comp__note"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.05 }, "-=0.7");
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="comp" data-theme="dark" ref={root}>
      {/* Per-scent scene (products-data). Omitted → the deep-oxblood ground + scrim
          carry the panel on their own (a clean placeholder, never another scent's scene). */}
      {product.scene && (
        <img
          className="comp__scene"
          src={product.scene}
          alt={`${product.name} with its raw materials`}
        />
      )}
      <div className="comp__scrim" aria-hidden="true" />

      <div className="comp__inner">
        <div className="comp__copy">
          <p className="comp__anno">{product.name} · The Collection</p>
          <h2 className="comp__title">
            What it&rsquo;s
            <br />
            made of.
          </h2>
          <p className="comp__sub">Scent as identity. Presence as statement.</p>
          {product.concentration && (
            <p className="comp__meta">{product.concentration} — Intense. Refined. Unforgettable.</p>
          )}
        </div>

        <div className="comp__notes">
          {GROUPS.map((g) => (
            <div className="comp__group" key={g.key}>
              <span className="comp__grouplabel">{g.label}</span>
              <div className="comp__row">
                {product.pyramid[g.key].map((n, i) => {
                  const src = imgFor(n);
                  return (
                    <figure className="comp__note" key={`${n}-${i}`}>
                      <span className="comp__disc">{src && <img src={src} alt="" />}</span>
                      <figcaption>{n}</figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
