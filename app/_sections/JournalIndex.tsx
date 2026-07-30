"use client";

/* /journal · INDEX — Sprint 02, beats 1–2. The Journal's front matter + the three
   essays as an editorial list (Kinfolk index→article shape, STRUCTURE only; skin is
   100% BTB). Shares the §9 tease's art direction verbatim — warm ivory ground, oxblood
   ink, rose-taupe eyebrow, Fraunces 300, 3:2 media with clip-reveal + ken-burns — so the
   home tease and this page read as one house. Copy is frozen (journal-data.ts). Motion:
   the masthead reveal is held until the preloader curtain lifts (btb:preload-done); each
   essay row clip-reveals on scroll, alternating side, with parallax.
   Reduced-motion: end-state, no transforms. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { JOURNAL_INDEX, ESSAYS } from "./journal-data";
import "./journalindex.css";

export default function JournalIndex() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);
    let intro: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      // --- masthead: held until the preloader curtain lifts ---
      // Paused: the route now carries a Preloader, and an unpaused timeline
      // would run and finish behind the curtain, lifting onto a spent masthead.
      // (The essay rows below are ScrollTrigger-driven and need no gate.)
      gsap.set(q(".jx__eyebrow, .jx__intro"), { opacity: 0, y: 22 });
      // y: 0 — see Hero.tsx: anim-initial.css mirrors this as a CSS transform,
      // which GSAP would otherwise read as a stacked pixel offset.
      gsap.set(q(".jx__headline .inner"), { yPercent: 115, y: 0 });
      const mast = gsap.timeline({ paused: true, delay: 0.083 });
      intro = mast;
      mast
        .to(q(".jx__eyebrow"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out" })
        .to(q(".jx__headline .inner"), { yPercent: 0, duration: 0.583, ease: "power4.out" }, "-=0.25")
        .to(q(".jx__intro"), { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" }, "-=0.389");

      // --- essay rows: clip-reveal + ken-burns + text stagger on scroll ---
      const rows = gsap.utils.toArray<HTMLElement>(q(".jx__essay"));
      rows.forEach((row) => {
        const media = row.querySelector<HTMLElement>(".jx__media");
        const img = row.querySelector<HTMLElement>(".jx__media img");
        // Every row uses the "Three Towns and a Bottle" reveal — a right→left wipe —
        // so all three entries introduce identically (layout still alternates sides).
        const hidden = "inset(0 0 0 100%)";

        gsap.set(media, { clipPath: hidden });
        gsap.set(img, { scale: 1.14 });
        gsap.set(row.querySelectorAll(".jx__body > *"), { opacity: 0, y: 24 });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: row, start: "top 88%", once: true },
        });
        tl.to(media, { clipPath: "inset(0 0 0 0%)", duration: 0.611, ease: "power3.inOut" })
          .to(img, { scale: 1, duration: 0.833, ease: "power2.out" }, "<")
          .to(row.querySelectorAll(".jx__body > *"), { opacity: 1, y: 0, duration: 0.389, ease: "power3.out", stagger: 0.029 }, "-=0.444");

        // gentle parallax while the row is in view
        gsap.fromTo(
          img,
          { yPercent: -5 },
          { yPercent: 5, ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true } }
        );
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
    <section className="jx" data-theme="light" ref={root}>
      <div className="jx__inner">
        <header className="jx__masthead">
          <span className="jx__rule" aria-hidden="true" />
          <p className="jx__eyebrow">{JOURNAL_INDEX.eyebrow}</p>
          <h1 className="jx__headline">
            <span className="line">
              <span className="inner">{JOURNAL_INDEX.headline}</span>
            </span>
          </h1>
          <p className="jx__intro">{JOURNAL_INDEX.intro}</p>
        </header>

        <div className="jx__list">
          {ESSAYS.map((e, i) => (
            <a
              key={e.slug}
              className="jx__essay"
              href={`/journal/${e.slug}`}
              data-side={i % 2 === 0 ? "left" : "right"}
            >
              <figure className="jx__media">
                <img src={e.img} alt={e.imgAlt} />
              </figure>
              <div className="jx__body">
                <span className="jx__num">{e.num}</span>
                <h2 className="jx__title">{e.title}</h2>
                <p className="jx__standfirst">{e.standfirst}</p>
                <span className="jx__cta rulelink">
                  Read
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                    <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
