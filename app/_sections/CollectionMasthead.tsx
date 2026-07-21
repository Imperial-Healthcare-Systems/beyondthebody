"use client";

/* /collection · BEAT 1 — Masthead. The house statement: you clicked "The Collection",
   and the page reframes the collection as a HOUSE told in chapters — scent is the first,
   not the whole. Register + art direction inherit the Journal masthead (warm ivory ground,
   oxblood ink, rose-taupe eyebrow, Fraunces 300, centred, line-masked headline rise) so the
   sub-pages read as one house. Copy is drafted house-voice prose (gated per beat).
   Motion: reveal held until the preloader curtain lifts (btb:preload-done), so it never
   plays behind it. Reduced-motion: end-state.
   data-theme light → nav inverts to dark UI. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./collectionmasthead.css";

export default function CollectionMasthead() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    const el = root.current;
    const q = gsap.utils.selector(el);
    let intro: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      gsap.set(q(".cmast__rule"), { scaleX: 0, transformOrigin: "left" });
      gsap.set(q(".cmast__eyebrow, .cmast__intro"), { opacity: 0, y: 22 });
      // y: 0 — see Hero.tsx: anim-initial.css mirrors this as a CSS transform,
      // which GSAP would otherwise read as a stacked pixel offset.
      gsap.set(q(".cmast__headline .inner"), { yPercent: 115, y: 0 });
      gsap.set(q(".cmast__corner"), { opacity: 0, scale: 0.7, transformOrigin: "center" });
      gsap.set(q(".cmast__watermark"), { opacity: 0, scale: 1.06 });

      // Paused: the route now carries a Preloader, and an unpaused timeline
      // would run and finish behind the curtain, lifting onto a spent masthead.
      const tl = gsap.timeline({ paused: true, delay: 0.15 });
      intro = tl;
      tl.to(q(".cmast__eyebrow"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" })
        .to(q(".cmast__rule"), { scaleX: 1, duration: 0.9, ease: "power3.inOut" }, "-=0.4")
        .to(q(".cmast__watermark"), { opacity: 0.05, scale: 1, duration: 1.4, ease: "power2.out" }, "<")
        .to(q(".cmast__headline .inner"), { yPercent: 0, duration: 1.05, ease: "power4.out", stagger: 0.08 }, "-=0.5")
        .to(q(".cmast__corner"), { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out", stagger: 0.06 }, "-=0.7")
        .to(q(".cmast__intro"), { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, "-=0.6");
    }, el);

    // Play once the curtain lifts. On the isolation-preview route there is no
    // Preloader, so nothing sets the flag and the intro plays immediately.
    const play = () => intro?.play();
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
    <section className="cmast" data-theme="light" ref={root}>
      <div className="cmast__grain" aria-hidden="true" />
      <span className="cmast__watermark" aria-hidden="true">⚥</span>

      <div className="cmast__inner">
        <div className="cmast__frame">
          <span className="cmast__corner cmast__corner--tl" aria-hidden="true" />
          <span className="cmast__corner cmast__corner--tr" aria-hidden="true" />
          <span className="cmast__corner cmast__corner--bl" aria-hidden="true" />
          <span className="cmast__corner cmast__corner--br" aria-hidden="true" />

          <p className="cmast__eyebrow">The Collection</p>
          <span className="cmast__rule" aria-hidden="true" />
          <h1 className="cmast__headline">
            <span className="line"><span className="inner">A house,</span></span>
            <span className="line"><span className="inner">told in chapters.</span></span>
          </h1>
          <p className="cmast__intro">
            Beyond The Body begins at the skin. Its first chapter is scent — four unisex
            compositions, made for warm light and worn close. A house, though, is more than
            the things it makes; it is a way of being present. What comes after is already
            being composed.
          </p>
        </div>
      </div>
    </section>
  );
}
