"use client";

/* EDITORIAL ARTICLE — the long-form page ARCHETYPE.
 *
 * The Journal essay was written as a one-off section; it is now an instance of this.
 * The distinction matters because the Journal is authored from the admin portal: every
 * post the client publishes from here on renders through this component, so it has to
 * hold for content nobody has seen yet. That is why the props below are all optional
 * except `title` and `body`, and why each optional one has a spelled-out degradation
 * rather than an assumption.
 *
 * SHAPE  centred front matter → hero media → one measured prose column → foot.
 * SKIN   100% BTB, inherited from the /journal index so the two read as one house.
 *        (Kinfolk index→article STRUCTURE only, per brief.yaml sources.)
 *
 * MOTION masthead reveal held until the preloader curtain lifts (btb:preload-done);
 *        media clip-reveal + ken-burns + parallax drift; prose rising on scroll; a
 *        scroll-linked reading rail.
 * REDUCED MOTION  every timed reveal early-returns to its end state. The reading rail
 *        deliberately SURVIVES: it is scroll-linked, so it reports the reader's own
 *        position rather than performing, which is not what the preference is about.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { revealTl } from "../_components/reveal-tempo";
import "./editorial-article.css";

export type EditorialArticleProps = {
  /** Required. Everything else has a defined absence. */
  title: string;
  /** The prose column. Pre-rendered so the archetype stays agnostic about the source
      — the Journal passes <RichText>, another page could pass anything. */
  body: ReactNode;
  /** Front-matter meta, rendered in order with a hairline drawn only BETWEEN items.
      Falsy entries are dropped, so a post with no number does not leave a stray rule. */
  meta?: (string | null | undefined | false)[];
  standfirst?: string;
  img?: string;
  imgAlt?: string;
  /** Up-link, shown above the front matter and again in the foot. */
  backHref?: string;
  backLabel?: string;
  /** Optional onward link. Absent on a one-post journal — the foot simply holds the
      up-link alone rather than rendering an empty column. */
  next?: { href: string; label: string; title: string } | null;
  /** Preview-only banner. Never set on a published route. */
  draftNotice?: string;
};

export default function EditorialArticle({
  title,
  body,
  meta = [],
  standfirst,
  img,
  imgAlt = "",
  backHref = "/",
  backLabel = "Back",
  next,
  draftNotice,
}: EditorialArticleProps) {
  const root = useRef<HTMLElement>(null);
  const items = meta.filter(Boolean) as string[];

  useEffect(() => {
    if (!root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let intro: gsap.core.Timeline | null = null;

    const ctx = gsap.context(() => {
      /* The reading rail — scroll-linked, so it runs in both motion modes. */
      gsap.fromTo(
        q(".ea__railfill"),
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.3 },
        }
      );

      if (prefersReduced) return;

      /* .ea__mast .ea__back, not .ea__back — the foot carries a second one that this
         timeline never plays, and hiding it here would hide it for good. */
      gsap.set(q(".ea__mast .ea__back, .ea__meta, .ea__standfirst"), { opacity: 0, y: 20 });
      gsap.set(q(".ea__rule"), { scaleX: 0 });
      /* y: 0 alongside yPercent — anim-initial.css mirrors percentage offsets as a CSS
         transform, which GSAP would otherwise read back as a stacked pixel offset. Same
         trap as the six yPercent pins in the ledger. */
      gsap.set(q(".ea__title .inner"), { yPercent: 115, y: 0 });
      gsap.set(q(".ea__media"), { clipPath: "inset(0 0 100% 0)" });
      gsap.set(q(".ea__media img"), { scale: 1.12 });

      /* Paused: the public route carries a Preloader, and an unpaused timeline would run
         and finish behind the curtain, lifting onto a spent masthead. */
      const tl = revealTl({ paused: true, delay: 0.083 });
      intro = tl;
      tl.to(q(".ea__mast .ea__back"), { opacity: 1, y: 0, duration: 0.36, ease: "power3.out" })
        .to(q(".ea__rule"), { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, "-=0.2")
        .to(q(".ea__meta"), { opacity: 1, y: 0, duration: 0.39, ease: "power3.out" }, "-=0.3")
        .to(
          q(".ea__title .inner"),
          { yPercent: 0, duration: 0.58, ease: "power4.out", stagger: 0.023 },
          "-=0.26"
        )
        .to(q(".ea__standfirst"), { opacity: 1, y: 0, duration: 0.47, ease: "power3.out" }, "-=0.32")
        .to(
          q(".ea__media"),
          { clipPath: "inset(0 0 0% 0)", duration: 0.72, ease: "power3.inOut" },
          "-=0.34"
        )
        .to(q(".ea__media img"), { scale: 1, duration: 0.95, ease: "power2.out" }, "<");

      /* Slow drift while the hero holds the frame — the index rows do the same, so the
         photography behaves identically on both pages. */
      gsap.fromTo(
        q(".ea__media img"),
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: "none",
          scrollTrigger: {
            trigger: q(".ea__media"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );

      /* Prose rises as it enters. Batched so a long essay does not create one
         ScrollTrigger per paragraph. */
      ScrollTrigger.batch(q(".ea__body > *"), {
        start: "top 88%",
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.07, overwrite: true }
          ),
      });

      gsap.fromTo(
        q(".ea__foot"),
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: "power3.out",
          scrollTrigger: { trigger: q(".ea__foot"), start: "top 92%", once: true },
        }
      );
    }, el);

    /* On the admin preview route there is no Preloader, so nothing sets the flag and the
       intro plays immediately. */
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
      {draftNotice && (
        <p className="ea__draft" role="status">
          {draftNotice}
        </p>
      )}

      <article className="ea" data-theme="light" ref={root}>
        <div className="ea__rail" aria-hidden="true">
          <span className="ea__railfill" />
        </div>

        <div className="ea__inner">
          <header className="ea__mast">
            <a className="ea__back" href={backHref}>
              ← {backLabel}
            </a>
            <span className="ea__rule" aria-hidden="true" />

            {items.length > 0 && (
              <p className="ea__meta">
                {items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </p>
            )}

            <h1 className="ea__title">
              <span className="line">
                <span className="inner">{title}</span>
              </span>
            </h1>

            {standfirst && <p className="ea__standfirst">{standfirst}</p>}
          </header>

          {img && (
            <figure className="ea__media">
              <img src={img} alt={imgAlt} />
            </figure>
          )}

          <div className="ea__body">{body}</div>

          <footer className="ea__foot">
            <a className="ea__back" href={backHref}>
              ← {backLabel}
            </a>
            {next && (
              <a className="ea__next" href={next.href}>
                <span className="ea__nextlabel">{next.label}</span>
                <span className="ea__nexttitle">{next.title}</span>
              </a>
            )}
          </footer>
        </div>
      </article>
    </>
  );
}
