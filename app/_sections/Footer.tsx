"use client";

/* §11 · FOOTER — the page's close, structurally modelled on the wolverineworldwide
   reveal footer (STRUCTURE only, re-skinned 100% BTB). Tiers, top → bottom:
     0 · Newsletter, folded in — "First to read." + one editorial field
     1 · Mega row — giant ⚥ monogram (left) + big-type Fraunces nav w/ :has() sibling-fade (right)
     2 · Detail row — house line + social · The Collection · Connect
     3 · Legal bar — sticky; pins at the top through the reveal
     R · Sticky reveal — a face-front lifestyle image (landscape desktop / portrait mobile)
         unveiled as the flow scrolls up, with the giant "Beyond The Body" wordmark held
         centered while the image scrubs 1.3 → 1. Tuned so the legal bar stays pinned and
         NOTHING (big-type, wordmark, legal) is ever bisected at rest.
   Reduced-motion: no scrub, image at rest scale, everything in end-state. */

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./footer.css";
import { revealTl, revealTempo } from "../_components/reveal-tempo";

/* Not-yet-live links (Instagram, LinkedIn, Stockists, Press, Contact, legal). They
   carry NO href, so they can never navigate or write "#"/"/#" into the URL — which is
   what used to pollute the address bar and break subsequent relative resolution. The
   default is also prevented as belt-and-suspenders, and aria-disabled marks them
   present-but-unavailable. When a destination exists, swap these for a real href. */
const placeholderProps = {
  role: "link" as const,
  "aria-disabled": true as const,
  onClick: (e: MouseEvent) => e.preventDefault(),
};
const linkAttrs = (href: string) =>
  href === "#" ? placeholderProps : { href };

// Root-relative (Sprint 02, beat 0) — see Nav.tsx: bare hashes break from /journal.
// Platforming pass (2026-07-17): "The Collection" → /collection, "The Journal" → /journal,
// "The House" → / (home), "Contact" → /contact (built 2026-07-17).
const MEGA = [
  { label: "The House", href: "/" },
  { label: "The Collection", href: "/collection" },
  { label: "The Journal", href: "/journal" },
  { label: "Contact", href: "/contact" },
];
const COLLECTION = [
  { name: "Mon Amour", slug: "mon-amour" },
  { name: "Heartthrob", slug: "heartthrob" },
  { name: "Desir", slug: "desir" },
  { name: "Don Amour", slug: "don-amour" },
];
const CONNECT = [
  { label: "Instagram", href: "#" },
  { label: "Stockists", href: "#" },
  { label: "Press", href: "#" },
];

// each big-type footer link maps to the section that represents that "page";
// the scrollspy lights whichever is currently in view (Contact = the footer itself).
const NAV_SPY: Record<string, string> = {
  "The House": "origin",
  "The Collection": "collection",
  "The Journal": "journal",
  "Contact": "newsletter",
};

export default function Footer() {
  const root = useRef<HTMLElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [activeNav, setActiveNav] = useState("The House");

  // live active-section indicator — the footer link for the section nearest the
  // viewport centre shines; the rest dim (readably). Runs regardless of motion pref.
  useEffect(() => {
    const spots = Object.entries(NAV_SPY)
      .map(([label, id]) => ({ label, el: document.getElementById(id) }))
      .filter((s): s is { label: string; el: HTMLElement } => !!s.el);
    if (!spots.length) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const centre = window.innerHeight / 2;
      let best = "";
      let bestDist = Infinity;
      for (const s of spots) {
        const r = s.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue; // off-screen
        const dist = Math.abs(r.top + r.height / 2 - centre);
        if (dist < bestDist) { bestDist = dist; best = s.label; }
      }
      if (best) setActiveNav(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !root.current) return;

    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      // newsletter tier rises in
      gsap.set(q(".ft__mark"), { opacity: 0, scale: 0.6 });
      // y: 0 — see Hero.tsx: anim-initial.css mirrors this as a CSS transform,
      // which GSAP would otherwise read as a stacked pixel offset.
      gsap.set(q(".ft__nl-title .inner"), { yPercent: 110, y: 0 });
      gsap.set(q(".ft__nl-sub, .ft__nl-form"), { opacity: 0, y: 20 });
      const nlTl = revealTl({
        scrollTrigger: { trigger: q(".ft__news"), start: "top 88%", once: true },
      });
      nlTl
        .to(q(".ft__mark"), { opacity: 1, scale: 1, duration: 0.444, ease: "back.out(1.7)" })
        .to(q(".ft__nl-title .inner"), { yPercent: 0, duration: 0.556, ease: "power4.out" }, "-=0.222")
        .to(q(".ft__nl-sub"), { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" }, "-=0.333")
        .to(q(".ft__nl-form"), { opacity: 1, y: 0, duration: 0.444, ease: "power3.out" }, "-=0.333");

      // mega nav lines + columns settle in — mega-links animate Y only, so the
      // live scrollspy (below) owns their opacity/colour.
      /* standalone tweens rather than a timeline, so they carry the viewport
         tempo themselves — see _components/reveal-tempo. */
      gsap.from(q(".ft__monogram"), {
        opacity: 0, y: 26, duration: 0.444, ease: "power3.out",
        scrollTrigger: { trigger: q(".ft__mega-row"), start: "top 88%", once: true },
      }).timeScale(revealTempo());
      gsap.from(q(".ft__mega-link"), {
        y: 26, duration: 0.444, ease: "power3.out", stagger: 0.023,
        scrollTrigger: { trigger: q(".ft__mega-row"), start: "top 88%", once: true },
      }).timeScale(revealTempo());
      gsap.from(q(".ft__col"), {
        opacity: 0, y: 22, duration: 0.389, ease: "power3.out", stagger: 0.029,
        scrollTrigger: { trigger: q(".ft__detail"), start: "top 88%", once: true },
      }).timeScale(revealTempo());

      // THE REVEAL — image scrubs 1.3 → 1 as the sticky frame is unveiled
      gsap.fromTo(
        q(".ft__reveal-img"),
        { scale: 1.3 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: q(".ft__reveal"),
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
          },
        }
      );
      // the giant wordmark drifts up a touch as it settles (subtle, holds centered)
      gsap.fromTo(
        q(".ft__wordmark"),
        { yPercent: 6, opacity: 0.85 },
        {
          yPercent: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: q(".ft__reveal"),
            start: "top bottom",
            end: "center bottom",
            scrub: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <footer className="ft" data-theme="dark" id="newsletter" ref={root}>
      <div className="ft__flow">
        {/* 0 · newsletter, folded in */}
        <div className="ft__news">
          <span className="ft__mark" aria-hidden="true" />
          <h2 className="ft__nl-title">
            <span className="line"><span className="inner">First to read.</span></span>
          </h2>
          <p className="ft__nl-sub">Notes from the studio, and word of each drop before it opens.</p>
          <form
            className="ft__nl-form"
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          >
            {submitted ? (
              <p className="ft__nl-done" role="status">You&rsquo;re on the list. Watch your inbox.</p>
            ) : (
              <div className="ft__field">
                <input
                  className="ft__input"
                  type="email"
                  required
                  placeholder="Your email"
                  aria-label="Your email address"
                  autoComplete="email"
                />
                <button className="ft__submit" type="submit">
                  Join the house list
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
                    <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* 1 · mega row — monogram + big-type nav */}
        <div className="ft__mega-row">
          <div className="ft__monogram">
            <span className="ft__glyph" aria-hidden="true" />
            <span className="ft__tag">A house that begins with scent.</span>
          </div>
          <nav className="ft__mega" aria-label="Footer primary">
            {MEGA.map((l) => (
              <a
                key={l.label}
                className={`ft__mega-link${activeNav === l.label ? " is-active" : ""}`}
                {...linkAttrs(l.href)}
              >
                <span>{l.label}</span>
                {/* An `l.ext` external-link arrow used to render here. MEGA is four
                    INTERNAL routes and no entry ever carried `ext`, so the branch was
                    unreachable — it broke `next build` (TS2339) while rendering nothing.
                    Removed 2026-07-21. If an external destination is ever added to MEGA,
                    reinstate it with `ext` declared on the array's type. */}
              </a>
            ))}
          </nav>
        </div>

        {/* 2 · detail row */}
        <div className="ft__detail">
          <div className="ft__col ft__col--about">
            <p className="ft__blurb">
              A future fashion house, begun in scent — unisex compositions built for warm
              light, and priced to the craft, not the markup.
            </p>
            <div className="ft__social">
              <a {...placeholderProps}>Instagram</a>
              <a {...placeholderProps}>LinkedIn</a>
            </div>
          </div>
          <div className="ft__col">
            <span className="ft__ch">The Collection</span>
            {COLLECTION.map((p) => (
              <a key={p.slug} className="ft__link" href={`/fragrance/${p.slug}`}>{p.name}</a>
            ))}
          </div>
          <div className="ft__col">
            <span className="ft__ch">Connect</span>
            {CONNECT.map((l) => (
              <a key={l.label} className="ft__link" {...linkAttrs(l.href)}>{l.label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* 3 · legal bar — direct child of .ft so it stays pinned THROUGH the reveal */}
      <div className="ft__legal">
        <span className="ft__copy">© 2026 Beyond The Body</span>
        <span className="ft__made">Built in India, with care, by Imperial Tech Innovations</span>
        <span className="ft__legal-links">
          <a {...placeholderProps}>Privacy</a>
          <a {...placeholderProps}>Terms</a>
          <a {...placeholderProps}>Cookies</a>
        </span>
      </div>

      {/* R · image band under the footer */}
      <div className="ft__reveal">
        <div className="ft__sticky">
          <picture>
            <source media="(max-width: 760px)" srcSet="/footer/reveal-mobile.webp" />
            <img className="ft__reveal-img" src="/footer/reveal-desktop.webp" alt="" />
          </picture>
          <div className="ft__reveal-grain" aria-hidden="true" />
          <div className="ft__reveal-scrim" aria-hidden="true" />
          <div className="ft__wordmark" aria-hidden="true">
            <span>Beyond The Body</span>
            <span className="ft__wordmark-glyph" />
          </div>
        </div>
      </div>
    </footer>
  );
}
