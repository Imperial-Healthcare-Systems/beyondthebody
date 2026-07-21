"use client";

/* §4 · PRODUCT TOUCH 1 — Don Amour. Full-bleed cinematic banner: the real
   flacon scene owns the centre. Copy anchors to the corners (eyebrow top-left,
   name + tagline + CTA bottom-left), and a few positioning pointers are
   scattered around the bottle as fine crosshair callouts — NOT the olfactory
   pyramid (that lives on the product page), but what the scent IS / is FOR /
   how it's made. Dark resinous register. Reduced-motion: end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./product1.css";

const BOTTLE = "/products/fullbleed/product-1-donamour.png"; // real Don Amour render

/* scattered around the flacon in the frame's DARK negative zones — positioning
   reinforcement, not notes. `anchor` = which screen edge it hangs off (keeps it
   on-screen); the crosshair always sits on the side FACING the bottle.
     upper-left (above driftwood) · upper-right corner · left edge · lower-right rock */
type Pointer = { text: string; top: string; x: string; anchor: "left" | "right" };
const POINTERS: Pointer[] = [
  { text: "Resinous · warm",        top: "24%", x: "9%", anchor: "left" },
  { text: "Hand-finished",          top: "18%", x: "6%", anchor: "right" },
  { text: "Sorted for no one",      top: "52%", x: "5%", anchor: "left" },
  { text: "Composed for the heat",  top: "64%", x: "6%", anchor: "right" },
];

export default function ProductTouch1() {
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

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 68%", once: true },
      });
      tl.to(q(".p1__img"), { opacity: 1, scale: 1, duration: 1.5, ease: "power2.out" })
        .to(q(".p1__eyebrow"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=1.15")
        .to(q(".p1__name"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.0, ease: "power3.out" }, "-=0.4")
        .to(q(".p1__rule"), { scaleX: 1, duration: 0.6, ease: "power2.out" }, "-=0.5")
        .to(q(".p1__mark"), { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.12 }, "-=0.35")
        .to(q(".p1__note"), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.12 }, "<0.05")
        .to(q(".p1__subhead"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, "-=0.3")
        .to(q(".p1__cta"), { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, "-=0.4");

      // slow cinematic drift on the scene through the scroll
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
    /* id must match the slug §8 derives from the product name
       (`#${name.toLowerCase().replace(/\s+/g,"-")}`) — this is the target of the
       collection's "Discover" link for Don Amour. It was id="signature", left
       over from when §4 was "Beyond The Body · The Signature", which left that
       link dead. §6 already matches this convention with id="desir". */
    <section className="p1" data-theme="dark" id="don-amour" ref={root}>
      <img
        className="p1__img"
        src={BOTTLE}
        alt="Don Amour — faceted black glass flacon with a gold cap, on dark stone with driftwood, warm directional light"
      />

      <p className="p1__eyebrow">— Beyond the body</p>

      <ul className="p1__notes" aria-label="Product positioning">
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
            <span className="p1__mark" aria-hidden="true" />
            <span className="p1__ltext">{p.text}</span>
          </li>
        ))}
      </ul>

      <div className="p1__lead">
        <h2 className="p1__name">Don Amour</h2>
        <span className="p1__rule" aria-hidden="true" />
        <p className="p1__subhead">Warmth, worn as your own.</p>
        {/* §4 spotlights Don Amour → its PDP (was /#collection, the home band). */}
        <a className="p1__cta rulelink" href="/fragrance/don-amour">
          Discover the scent
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </div>
    </section>
  );
}
