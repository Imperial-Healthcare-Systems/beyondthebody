"use client";

/* §10 · CIRCULAR CLOSE — ylem returns to "Origin has a shape." + a made-in line.
   The valedictory bookend: a wide 21:9 band, the same figure walking away into
   warm doorway light, closing the loop opened by §1. Deliberately mirrors the
   HERO — dark register, the same line-mask headline reveal — so the page ends
   where it began. One line of Fraunces over the shadowed left third; a made-in
   accent beneath. Slow ken-burns + scroll parallax; reduced-motion: end-state. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./circularclose.css";
import { revealTl } from "../_components/reveal-tempo";

export default function CircularClose() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".cc__title .inner"), { yPercent: 110 });
      gsap.set(q(".cc__rule"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q(".cc__accent, .cc__mark"), { opacity: 0, y: 16 });

      const tl = revealTl({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
      tl.to(q(".cc__mark"), { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" })
        .to(q(".cc__title .inner"), { yPercent: 0, duration: 0.611, ease: "power4.out", stagger: 0.029 }, "-=0.278")
        .to(q(".cc__rule"), { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, "-=0.306")
        .to(q(".cc__accent"), { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" }, "-=0.278");

      // near-still breath, echoing the hero cinemagraph
      gsap.to(q(".cc__img"), {
        scale: 1.07,
        duration: 18,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // scroll parallax — the frame drifts up as the page ends
      gsap.fromTo(
        q(".cc__img"),
        { yPercent: -8 },
        { yPercent: 8, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="cc" data-theme="dark" id="close" ref={root}>
      <div className="cc__media">
        <img className="cc__img" src="/sections/circular-close.webp" alt="" />
        <div className="cc__grain" aria-hidden="true" />
        <div className="cc__scrim" aria-hidden="true" />
      </div>

      <div className="cc__inner">
        <span className="cc__mark" aria-hidden="true" />
        <h2 className="cc__title">
          <span className="line"><span className="inner">A house that</span></span>
          <span className="line"><span className="inner">begins with scent.</span></span>
        </h2>
        <span className="cc__rule" aria-hidden="true" />
        <p className="cc__accent">Made in India · Sourced from Grasse, Seville &amp; Florence</p>
      </div>
    </section>
  );
}
