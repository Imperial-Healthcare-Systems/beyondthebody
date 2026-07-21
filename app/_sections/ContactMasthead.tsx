"use client";

/* /contact · The contact page — an editorial SINGLE LANE (client, 2026-07-17): a masthead
   statement + a quiet way-in (one email, the socials). No form, no split press/stockist lanes
   — the house's restraint (design-philosophy §1). The contact action is a mailto link (honest,
   works with no backend). Register + art direction inherit the Collection/Journal mastheads
   (warm ivory ground, oxblood ink, rose-taupe eyebrow, Fraunces 300, line-masked headline rise)
   so the sub-pages read as one house; a draped-linen still (royalty-free, Unsplash — see
   public/contact/CREDITS.md) carries the house look on the right. Copy is drafted house-voice
   prose, gated per beat. Motion: reveal + image clip/ken-burns, held until the preloader
   curtain lifts (btb:preload-done) so it never plays behind it.
   Reduced-motion: end-state. data-theme light → nav inverts to dark UI.

   ⚠ PLACEHOLDER FACTS — the client has not supplied the real values; confirm/replace before
   publish (same pattern as the ₹1,899 price placeholder):
     · EMAIL  — the real "write to us" address
     · SOCIALS — the real Instagram / LinkedIn URLs (also still placeholders in the footer) */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import "./contactmasthead.css";

const EMAIL = "hello@beyondthebody.com"; // ⚠ placeholder — confirm
const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/beyondthebody" }, // ⚠ placeholder — confirm
  { label: "LinkedIn", href: "https://www.linkedin.com/company/beyondthebody" }, // ⚠ placeholder — confirm
];

export default function ContactMasthead() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    const el = root.current;
    const q = gsap.utils.selector(el);
    let intro: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      gsap.set(q(".ct__rule"), { scaleX: 0, transformOrigin: "left" });
      gsap.set(q(".ct__eyebrow, .ct__intro, .ct__block"), { opacity: 0, y: 22 });
      // y: 0 — see Hero.tsx: anim-initial.css mirrors this as a CSS transform,
      // which GSAP would otherwise read as a stacked pixel offset.
      gsap.set(q(".ct__headline .inner"), { yPercent: 115, y: 0 });
      gsap.set(q(".ct__media"), { clipPath: "inset(0 0 0 100%)" });
      gsap.set(q(".ct__media img"), { scale: 1.14 });

      // Paused: the route now carries a Preloader, and an unpaused timeline
      // would run and finish behind the curtain, lifting onto a spent masthead.
      const tl = gsap.timeline({ paused: true, delay: 0.15 });
      intro = tl;
      tl.to(q(".ct__media"), { clipPath: "inset(0 0 0 0%)", duration: 1.1, ease: "power3.inOut" })
        .to(q(".ct__media img"), { scale: 1, duration: 1.5, ease: "power2.out" }, "<")
        .to(q(".ct__eyebrow"), { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.25)
        .to(q(".ct__rule"), { scaleX: 1, duration: 0.9, ease: "power3.inOut" }, "-=0.4")
        .to(q(".ct__headline .inner"), { yPercent: 0, duration: 1.05, ease: "power4.out", stagger: 0.08 }, "-=0.55")
        .to(q(".ct__intro"), { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, "-=0.6")
        .to(q(".ct__block"), { opacity: 1, y: 0, duration: 0.75, ease: "power3.out", stagger: 0.12 }, "-=0.5");
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
    <section className="ct" data-theme="light" ref={root}>
      <div className="ct__inner">
        <div className="ct__copy">
          <p className="ct__eyebrow">Contact</p>
          <span className="ct__rule" aria-hidden="true" />
          <h1 className="ct__headline">
            <span className="line"><span className="inner">Say hello.</span></span>
          </h1>
          <p className="ct__intro">
            A question, a word about the work, or simply hello — the house reads every note,
            and answers. There is no queue and no form to fill; just write to us.
          </p>

          <div className="ct__block">
            <p className="ct__label">Write to us</p>
            <a className="ct__email" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>

          <div className="ct__block">
            <p className="ct__label">Follow</p>
            <p className="ct__social">
              {SOCIALS.map((s, i) => (
                <span key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
                  {i < SOCIALS.length - 1 && <span className="ct__dot" aria-hidden="true"> · </span>}
                </span>
              ))}
            </p>
          </div>
        </div>

        <figure className="ct__media">
          <img
            src="/contact/contact-linen.jpg"
            alt="Draped, undyed linen in warm directional window light — the house look"
          />
          <span className="ct__scrim" aria-hidden="true" />
        </figure>

      </div>
    </section>
  );
}
