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

const HAS_ASSET = true; // hero.png (desktop 2.33:1) · hero-mobile.png (portrait) — mirror-reflection, warm window light, oxblood lip

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

    const ctx = gsap.context(() => {
      gsap.set(q(".hero__title .inner"), { yPercent: 110 });
      gsap.set(q(".hero__sub, .hero__enter"), { opacity: 0, y: 16 });

      // Built paused: the preloader curtain fades over 1s, so playing on mount
      // meant the whole reveal finished behind it. `delay` lets the mask start
      // through the last of the fade, then land in the clear. (Tunable.)
      const tl = gsap.timeline({ paused: true, delay: 0.55 });
      intro = tl;
      tl.to(q(".hero__title .inner"), {
        yPercent: 0,
        duration: 1.05,
        ease: "power4.out",
        stagger: 0.09,
      })
        .to(
          q(".hero__sub"),
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
          "-=0.55"
        )
        .to(
          q(".hero__enter"),
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
          "-=0.6"
        );

      // near-still cinemagraph: an almost-imperceptible breath
      gsap.to(q(".hero__img"), {
        scale: 1.06,
        duration: 16,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // scroll parallax: media lifts slowly, copy eases up + fades
      gsap.to(q(".hero__img"), {
        yPercent: -12,
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
    <section className="hero" data-theme="dark" id="hero" ref={root}>
      <div className="hero__media">
        {HAS_ASSET ? (
          <picture>
            <source media="(max-width: 640px)" srcSet="/hero/hero-mobile.png" />
            <img className="hero__img" src="/hero/hero.png" alt="" />
          </picture>
        ) : (
          <div className="hero__img hero__placeholder" aria-hidden="true" />
        )}
        <div className="hero__grain" aria-hidden="true" />
        <div className="hero__scrim" aria-hidden="true" />
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

        <a className="hero__enter" href="#origin">
          Enter the house
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </div>
    </section>
  );
}
