"use client";

/* §6 · PRODUCT TOUCH 2 — Desir. Sibling of §4 (shares the .p1 full-bleed banner
   structure): the real flacon scene owns the centre, copy anchors to the corners,
   positioning pointers scatter in the frame's dark negative zones. Dark register
   (inverts out of the light Brand Statement). Full olfactory pyramid lives on the
   product page (working/V/assets/product-page-notes.md). Reduced-motion: end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./product1.css";
import { revealTl } from "../_components/reveal-tempo";

const BOTTLE = "/products/fullbleed/product-2-desir-real.webp"; // real Desir render

/* Scattered in the frame's dark zones — the bottle sits left-of-centre, so the
   open dark space is upper-left + the right (above / over the foliage).

   Numbered 01–04 from array order (see ProductTouch1.tsx). Unlike §4, this beat
   needed NO reorder: its `top` values already ascend with the array (21 · 24 ·
   47 · 74), and the texts already run scent → audience → character → longevity,
   which is the client's scent → audience → climate → craft sequence. Positions
   are untouched here; only the numerals were added. */
type Pointer = { text: string; top: string; x: string; anchor: "left" | "right" };
const POINTERS: Pointer[] = [
  { text: "Gourmand · woody",     top: "21%", x: "22%", anchor: "left" },
  { text: "Presence, not gender", top: "24%", x: "9%",  anchor: "right" },
  { text: "Warm and unhurried",   top: "47%", x: "6%",  anchor: "right" },
  { text: "Lasts into the night", top: "74%", x: "11%", anchor: "right" },
];

export default function ProductTouch2() {
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
      gsap.set(q(".p1__eyebrow, .p1__note, .p1__subhead, .p1__cta"), { opacity: 0, y: 26 });
      gsap.set(q(".p1__name"), { opacity: 0, y: 30, filter: "blur(9px)" });
      gsap.set(q(".p1__rule"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".p1__mark"), { scale: 0, opacity: 0 });
      gsap.set(q(".p1__img"), { opacity: 0, scale: 1.14 });

      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".p1__img"), { opacity: 1, scale: 1, duration: 0.833, ease: "power2.out" })
        .to(q(".p1__eyebrow"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" }, "-=0.639")
        .to(q(".p1__name"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.556, ease: "power3.out" }, "-=0.222")
        .to(q(".p1__rule"), { scaleX: 1, duration: 0.333, ease: "power2.out" }, "-=0.278")
        .to(q(".p1__mark"), { scale: 1, opacity: 1, duration: 0.222, ease: "back.out(2)", stagger: 0.034 }, "-=0.194")
        .to(q(".p1__note"), { opacity: 1, y: 0, duration: 0.278, ease: "power3.out", stagger: 0.034 }, "<0.028")
        .to(q(".p1__subhead"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" }, "-=0.167")
        .to(q(".p1__cta"), { opacity: 1, y: 0, duration: 0.333, ease: "power3.out" }, "-=0.222");

      gsap.fromTo(
        q(".p1__img"),
        { yPercent: -3.5 },
        {
          yPercent: 3.5,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="p1" data-theme="dark" id="desir" ref={root}>
      <img
        className="p1__img"
        src={BOTTLE}
        alt="Desir — emerald faceted glass flacon with a gold cap, on a dark reflective surface with driftwood, foliage and a white blossom"
      />

      <p className="p1__eyebrow">— Beyond the body</p>

      {/* <ol> + numerals — see ProductTouch1.tsx for the reasoning. */}
      <ol className="p1__notes" aria-label="Product positioning">
        {POINTERS.map((p, i) => (
          <li
            className="p1__note"
            key={i}
            data-anchor={p.anchor}
            style={
              p.anchor === "left"
                ? { top: p.top, left: p.x }
                : { top: p.top, right: p.x }
            }
          >
            <span className="p1__mark" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="p1__ltext">{p.text}</span>
          </li>
        ))}
      </ol>

      <div className="p1__lead">
        {/* Linked to its PDP — see ProductTouch1.tsx. */}
        <h2 className="p1__name">
          <a className="p1__namelink" href="/fragrance/desir">Desir</a>
        </h2>
        <span className="p1__rule" aria-hidden="true" />
        <p className="p1__subhead">Depth, drawn out slowly.</p>
        {/* §6 spotlights Desir → its PDP (was /#collection, the home band). */}
        <a className="p1__cta rulelink" href="/fragrance/desir">
          Discover the scent
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </div>
    </section>
  );
}
