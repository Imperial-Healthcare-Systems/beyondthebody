"use client";

/* §1 · HERO — ylem "Origin has a shape." framing, in BTB's skin.
   Bottom row distributes: headline (left) · sentence (centre) · Enter (right).
   Line-mask headline reveal on load · near-still cinemagraph (slow breath) ·
   scroll parallax. Light register (dark oxblood type). Reduced-motion shows
   the final composition with no transforms. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./hero.css";
import { revealTl } from "../_components/reveal-tempo";

/* hero.webp — 1774x887 (2:1). Client asset, 2026-07-28: the Mon Amour bottle on a lit
   vanity, a figure holding the gaze in the mirror behind it. Product-led, which is the
   point; the dark left third is where the headline sits.

   SERVED AS WEBP, and that is not incidental: IntroReel PRELOADS this file before it can
   hand over to the hero, so it gates the opening. The client PNG is 2.6MB; at q92 the WebP
   is 129KB for no visible loss — same convention as the reel's own /intro/*.webp frames.
   The untouched PNG stays in public/hero/ as the source of truth but is never referenced.
   If this URL changes, change IntroReel.HERO_SRC in the same commit — the reel comes to
   rest on a second copy of this exact composition, and a mismatch shows as a pop.

   The superseded mirror-reflection hero is not kept as a file — it is in git at
   ef0c82e (`git show ef0c82e:public/hero/hero.png`, and :hero-mobile.png), which is a
   free and permanent record. Re-committing 3.7MB of it under a *-legacy name was not.

   ONE ASSET FOR ALL VIEWPORTS (was: a portrait hero-mobile.png). The client supplied a
   2:1 landscape only, and a 0.45:1 crop of it would be a ~399px-wide slice — too tight to
   hold both bottle and figure, and soft on a 2x phone. Narrow viewports therefore reframe
   in CSS via object-position instead (hero.css). Reinstate a <source> here the moment a
   purpose-shot portrait asset exists; the crop is a stopgap, not the finish. */
const HAS_ASSET = true;

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    let intro: gsap.core.Timeline | null = null;
    let breath: gsap.core.Tween | null = null;

    const ctx = gsap.context(() => {
      // y: 0 is load-bearing. anim-initial.css mirrors this state as
      // `transform: translateY(110%)` to stop the headline painting composed
      // before hydration; GSAP parses that computed matrix as a PIXEL y offset
      // and would stack yPercent on top of it, leaving the mask stranded ~110%
      // low once yPercent animates back to 0. Pinning y pins the px component.
      gsap.set(q(".hero__title .inner"), { yPercent: 110, y: 0 });
      gsap.set(q(".hero__sub, .hero__enter, .hero__shop"), { opacity: 0, y: 16 });
      gsap.set(q(".hero__sigrule"), { scaleX: 0 });
      gsap.set(q(".hero__sigeyebrow, .hero__signame"), { opacity: 0, y: 18 });

      // Built paused: the preloader curtain fades over 1s, so playing on mount
      // meant the whole reveal finished behind it. `delay` lets the mask start
      // through the last of the fade, then land in the clear. (Tunable.)
      const tl = revealTl({ paused: true, delay: 0.306 });
      intro = tl;
      tl.to(q(".hero__title .inner"), {
        yPercent: 0,
        duration: 0.583,
        ease: "power4.out",
        stagger: 0.026,
      })
        // the credit draws its rule, then names itself — over the headline's tail
        .to(q(".hero__sigrule"), { scaleX: 1, duration: 0.389, ease: "power3.inOut" }, "-=0.417")
        .to(
          q(".hero__sigeyebrow, .hero__signame"),
          { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 },
          "-=0.25"
        )
        .to(
          q(".hero__sub"),
          { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" },
          "-=0.278"
        )
        // both paths out land together, commerce first
        .to(
          q(".hero__shop, .hero__enter"),
          { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.026 },
          "-=0.333"
        );

      // near-still cinemagraph: an almost-imperceptible breath.
      // Paused, and started with the intro — the INTRO REEL rests on a copy of
      // this exact frame at scale 1, so a breath that had been running behind
      // the curtain would pop the moment the reel dissolves away.
      breath = gsap.to(q(".hero__img"), {
        scale: 1.06,
        duration: 16,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        paused: true,
      });

      /* scroll parallax: media lifts slowly, copy eases up + fades.
         -4, not the old -12: the zoom-out cut .hero__img to height 104% with all 4% of
         its headroom below (hero.css), and -12 of that box travels 12.5% of the section
         — far past the headroom, which would slide the photo's bottom edge up into frame
         and expose the section ground mid-scroll. These two numbers are one setting. */
      gsap.to(q(".hero__img"), {
        yPercent: -4,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(q(".hero__footer"), {
        yPercent: -14,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
    }, el);

    // Play once the curtain lifts. On the isolation-preview route there is no
    // Preloader, so nothing sets the flag and the intro plays immediately.
    const play = () => {
      intro?.play();
      breath?.play();
    };
    if (window.__btbPreloading) {
      window.addEventListener("btb:preload-done", play, { once: true });
    } else {
      play();
    }

    return () => {
      window.removeEventListener("btb:preload-done", play);
      ctx.revert();
    };
  }, []);

  return (
    <section className="hero" data-theme="dark" id="hero" ref={root}>
      <div className="hero__media">
        {HAS_ASSET ? (
          <img className="hero__img" src="/hero/hero.webp" alt="" />
        ) : (
          <div className="hero__img hero__placeholder" aria-hidden="true" />
        )}
        <div className="hero__grain" aria-hidden="true" />
        <div className="hero__scrim" aria-hidden="true" />
      </div>

      {/* The product credit, centred in the frame beside the flacon (client direction
          2026-07-28). Both strings are already-approved house copy reused in a new slot,
          not new copy: "The Signature · No.01" is §4's eyebrow and Mon Amour is No.01 in
          the catalogue — so this agrees with brief.yaml and does not collide with §4,
          which carries Don Amour. Centred rather than pinned to a percentage so it holds
          its relationship to the frame at any width. */}
      <div className="hero__signature">
        <span className="hero__sigrule" aria-hidden="true" />
        {/* "No.01" is held out of the uppercase transform so the numero keeps its
            lowercase o, as the client's reference sets it. (§8's .col__no does let the
            transform flatten it to "NO. 01" — left alone, not in scope here.) */}
        <p className="hero__sigeyebrow">
          The Signature · <span className="hero__signo">No.01</span>
        </p>
        <p className="hero__signame">Mon Amour</p>
      </div>

      <div className="hero__footer">
        <h1 className="hero__title">
          <span className="line">
            <span className="inner">Worn close</span>
          </span>
          <span className="line">
            <span className="inner">to the skin.</span>
          </span>
        </h1>

        <p className="hero__sub">
          Presence, before a word is spoken. A house dressed in scent — made for
          everyone, and sorted for no one.
        </p>

        {/* Two paths out, stacked right — the commerce one promoted to a button, the
            editorial one kept as the quieter rule-link beneath it. Route is /collection
            (singular): that is the actual route, there is no /collections. */}
        <div className="hero__actions">
          <a className="hero__shop" href="/collection">
            Shop the collection
          </a>
          <a className="hero__enter" href="/#origin">
            Enter the house
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
              <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
