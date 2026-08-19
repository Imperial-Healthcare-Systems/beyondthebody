"use client";

/* §4 · PRODUCT TOUCH 1 — Don Amour. Full-bleed cinematic banner: the real
   flacon scene owns the centre. Copy anchors to the corners (eyebrow top-left,
   name + tagline + CTA bottom-left), and four positioning pointers are
   scattered around the bottle as a numbered 01–04 sequence — NOT the olfactory
   pyramid (that lives on the product page), but what the scent IS / is FOR /
   how it's made. Dark resinous register. Reduced-motion: end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./product1.css";
import { revealTl } from "../_components/reveal-tempo";

const BOTTLE = "/products/fullbleed/product-1-donamour.webp"; // real Don Amour render

/* Scattered around the flacon in the frame's DARK negative zones — positioning
   reinforcement, not notes. `anchor` = which screen edge it hangs off (keeps it
   on-screen). Rendered as a NUMBERED sequence: the index drives 01–04, so the
   number can never drift out of step with array order.

   SEQUENCE — client direction, 2026-08-01: scent → audience → climate → craft.
   ARRAY ORDER IS THE SEQUENCE. It drives the 01–04 numerals in the stacked
   layout (<=1024px) and the reveal stagger; it is the one thing here that must
   not be reordered casually.

   `top` deliberately does NOT ascend with it. On the full-bleed the marker is a
   crosshair, not a number, so there is no visible count for a position to
   contradict — and the client's instruction (2026-08-01) is that each label
   holds the exact slot it has always occupied in the frame's validated dark
   zones: Resinous upper-left above the driftwood · Hand-finished upper-right
   corner · Sorted the left edge · Composed the lower-right rock.

   The one cost, accepted knowingly: the reveal stagger follows array order, so
   the four callouts pop 24% → 52% → 64% → 18%, returning to the top for the
   last. If that ever reads as a glitch, the fix is to sort a COPY of this array
   by `top` for rendering while keeping array order for the numerals — not to
   re-sort this array, which would renumber the stacked list. */
type Pointer = { text: string; top: string; x: string; anchor: "left" | "right" };
const POINTERS: Pointer[] = [
  { text: "Resinous · warm",        top: "24%", x: "9%", anchor: "left" },
  { text: "Sorted for no one",      top: "52%", x: "5%", anchor: "left" },
  { text: "Composed for the heat",  top: "64%", x: "6%", anchor: "right" },
  { text: "Hand-finished",          top: "18%", x: "6%", anchor: "right" },
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
      {/* The whole scene links to the PDP (client, 2026-08-19). The <a> carries
          the layout and the <img> keeps .p1__img — the GSAP tween target — see
          product1.css. The img's alt names the link. */}
      <a className="p1__imglink" href="/fragrance/don-amour">
        <img
          className="p1__img"
          src={BOTTLE}
          alt="Don Amour — faceted black glass flacon with a gold cap, on dark stone with driftwood, warm directional light"
        />
      </a>

      <p className="p1__eyebrow">— Beyond the body</p>

      {/* <ol>, not <ul>: these are now an explicitly numbered sequence, so the
          order is semantic and not only visual. The numeral itself is
          aria-hidden — the list element already conveys ordinality, and a
          screen reader saying "zero one" over it is noise. */}
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
        {/* The name links to the same PDP as "Discover the scent" below it
            (client direction, 2026-08-01). The <a> sits INSIDE the <h2> so the
            heading level and .p1__name — which GSAP tweens — are both unchanged. */}
        <h2 className="p1__name">
          <a className="p1__namelink" href="/fragrance/don-amour">Don Amour</a>
        </h2>
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
