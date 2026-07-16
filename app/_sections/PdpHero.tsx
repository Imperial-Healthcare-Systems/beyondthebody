"use client";

/* PDP · BEAT 1 — Hero / buy panel. Delvaux structure (breadcrumb → gallery + a quiet buy
   panel), BTB skin + ecommerce. ONE main product image with a thumbnail strip to switch
   (no more stacked renders); a clean top-aligned two-column layout (no sticky — see pdphero.css).
   Motion: main image clip-reveals + ken-burns and the panel staggers in on mount (no
   preloader on this route); thumbnail swaps cross-fade. Reduced-motion: end-state.
   Images are PLACEHOLDER by aspect-ratio fit — re-art later. */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import AddToBag from "../_components/AddToBag";
import type { Product } from "./products-data";
import "./pdphero.css";

export default function PdpHero({ product }: { product: Product }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".pdp__crumb, .pdp__buyinner > *"), { opacity: 0, y: 22 });
      gsap.set(q(".pdp__thumb"), { opacity: 0, y: 14 });
      gsap.set(q(".pdp__main"), { clipPath: "inset(0 0 100% 0)" });
      gsap.set(q(".pdp__main img"), { scale: 1.16 });

      const tl = gsap.timeline({ delay: 0.12 });
      tl.to(q(".pdp__main"), { clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: "power3.inOut" })
        .to(q(".pdp__main img"), { scale: 1, duration: 1.6, ease: "power2.out" }, "<")
        .to(q(".pdp__crumb"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.15)
        .to(q(".pdp__buyinner > *"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.09 }, 0.3)
        .to(q(".pdp__thumb"), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 }, 0.5);
    }, el);

    return () => ctx.revert();
  }, []);

  const img = product.gallery[active];

  return (
    <section className="pdp" data-theme="light" ref={root}>
      <div className="pdp__wrap">
        <nav className="pdp__crumb" aria-label="Breadcrumb">
          <a href="/#collection">The Collection</a>
          <span aria-hidden="true">·</span>
          <span>{product.name}</span>
        </nav>

        <div className="pdp__hero">
          <div className="pdp__gallery">
            <figure className="pdp__main" style={{ aspectRatio: img.ratio }}>
              {/* key swaps → CSS cross-fade on thumbnail change; frame follows each
                  image's own ratio so wide art (banner, notes grid) shows uncropped */}
              <img key={active} src={img.src} alt={img.alt} />
            </figure>

            {product.gallery.length > 1 && (
              <div className="pdp__thumbs" role="tablist" aria-label="Product images">
                {product.gallery.map((im, i) => (
                  <button
                    key={im.src}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    aria-label={`View image ${i + 1} of ${product.gallery.length}`}
                    className={`pdp__thumb${i === active ? " is-active" : ""}`}
                    onClick={() => setActive(i)}
                  >
                    <img src={im.src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pdp__buy">
            <div className="pdp__buyinner">
              <p className="pdp__eyebrow">{product.eyebrow}</p>
              <h1 className="pdp__name">{product.name}</h1>
              <p className="pdp__tag">{product.tagline}</p>
              <AddToBag product={product} />
              <ul className="pdp__spec" aria-label="At a glance">
                {product.concentration && <li>{product.concentration}</li>}
                <li>{product.spec.longevity}</li>
                <li>{product.spec.climate}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
