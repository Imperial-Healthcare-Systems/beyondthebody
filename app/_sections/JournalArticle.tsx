"use client";

/* /journal/[slug] · THE ARTICLE — the route the Journal index has linked to since
   Sprint 02 with nothing behind it (three live 404s until now).
   Kinfolk index→article shape, STRUCTURE only per brief.yaml; the skin is 100% BTB and
   inherits the index masthead's art direction so the two read as one house.
   Motion: masthead reveal held until the preloader curtain lifts (btb:preload-done),
   media clip + ken-burns, body paragraphs rising on scroll.
   Reduced-motion: end-state, no transforms — every element early-returns visible. */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import RichText from "../_components/RichText";
import { revealTl } from "../_components/reveal-tempo";
import type { RichNode } from "@/lib/rich-text";
import "./journalarticle.css";

export type ArticleProps = {
  num: string;
  title: string;
  standfirst: string;
  body: { content?: RichNode[] };
  img: string;
  imgAlt: string;
  readingMinutes: number;
  next?: { slug: string; title: string } | null;
  isDraft?: boolean;
};

export default function JournalArticle({
  num,
  title,
  standfirst,
  body,
  img,
  imgAlt,
  readingMinutes,
  next,
  isDraft,
}: ArticleProps) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);
    let intro: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      gsap.set(q(".ja__back, .ja__meta, .ja__standfirst"), { opacity: 0, y: 20 });
      /* y: 0 alongside yPercent — anim-initial.css mirrors percentage offsets as a CSS
         transform, which GSAP would otherwise read as a stacked pixel offset. Same trap
         as the six yPercent pins in the ledger. */
      gsap.set(q(".ja__title .inner"), { yPercent: 115, y: 0 });
      gsap.set(q(".ja__media"), { clipPath: "inset(0 0 100% 0)" });
      gsap.set(q(".ja__media img"), { scale: 1.12 });

      /* Paused: the route carries a Preloader, and an unpaused timeline would run and
         finish behind the curtain, lifting onto a spent masthead. */
      const tl = revealTl({ paused: true, delay: 0.083 });
      intro = tl;
      tl.to(q(".ja__back"), { opacity: 1, y: 0, duration: 0.36, ease: "power3.out" })
        .to(q(".ja__meta"), { opacity: 1, y: 0, duration: 0.39, ease: "power3.out" }, "-=0.22")
        .to(
          q(".ja__title .inner"),
          { yPercent: 0, duration: 0.58, ease: "power4.out", stagger: 0.023 },
          "-=0.26"
        )
        .to(q(".ja__standfirst"), { opacity: 1, y: 0, duration: 0.47, ease: "power3.out" }, "-=0.32")
        .to(
          q(".ja__media"),
          { clipPath: "inset(0 0 0% 0)", duration: 0.72, ease: "power3.inOut" },
          "-=0.34"
        )
        .to(q(".ja__media img"), { scale: 1, duration: 0.95, ease: "power2.out" }, "<");

      /* Body prose rises as it enters. Batched so a long essay does not create one
         ScrollTrigger per paragraph. */
      ScrollTrigger.batch(q(".ja__body > *"), {
        start: "top 88%",
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.07, overwrite: true }
          ),
      });
    }, el);

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
    <>
      {isDraft && (
        <p className="ja__draft" role="status">
          Draft preview — not visible to anyone else
        </p>
      )}
      <article className="ja" data-theme="light" ref={root}>
        <div className="ja__inner">
          <header className="ja__mast">
            <a className="ja__back" href="/journal">
              ← The Journal
            </a>
            <p className="ja__meta">
              {num && <span>{num}</span>}
              <span>{readingMinutes} min read</span>
            </p>
            <h1 className="ja__title">
              <span className="line">
                <span className="inner">{title}</span>
              </span>
            </h1>
            {standfirst && <p className="ja__standfirst">{standfirst}</p>}
          </header>

          {img && (
            <figure className="ja__media">
              <img src={img} alt={imgAlt} />
            </figure>
          )}

          <div className="ja__body">
            <RichText doc={body} />
          </div>

          <footer className="ja__foot">
            <a className="ja__back" href="/journal">
              ← All essays
            </a>
            {next && (
              <a className="ja__next" href={`/journal/${next.slug}`}>
                <span className="ja__nextlabel">Read next</span>
                <span className="ja__nexttitle">{next.title}</span>
              </a>
            )}
          </footer>
        </div>
      </article>
    </>
  );
}
