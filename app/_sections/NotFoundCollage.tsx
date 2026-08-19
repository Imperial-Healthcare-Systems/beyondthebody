"use client";

/* THE 404.
 *
 * Someone who mistyped an address or followed a dead link is not a dead end — they are a
 * visitor standing in the wrong room. So this page does not apologise and does not
 * dead-stop: the house mosaic behind it says "you are still inside", and the three doors
 * under the copy are the actual point of the page.
 *
 * One screen exactly (100dvh, two grid rows) — the collage is a backdrop, not a
 * background you scroll through, and a 404 that scrolls is a 404 that lost the plot. The
 * minimal foot is the second row, so it sits on the bottom edge of that one screen rather
 * than adding a second.
 *
 * MOTION: the mosaic settles in and then breathes, the front matter rises once. Deliberately
 * quieter than a real beat — this page interrupted someone, and the courteous thing is to
 * resolve fast and hold still. Reduced motion: end state, no transforms.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import CollageBackdrop from "../_components/CollageBackdrop";
import { revealTl } from "../_components/reveal-tempo";
import "./notfound.css";

/* The doors. Ordered by how likely each is to be what the visitor actually wanted. */
const DOORS = [
  { href: "/", label: "The house", note: "where everything begins" },
  { href: "/collection", label: "The collection", note: "four unisex fragrances" },
  { href: "/journal", label: "The Journal", note: "scent as culture" },
];

export default function NotFoundCollage() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = root.current;
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      gsap.set(q(".nf__eyebrow, .nf__intro, .nf__door, .nf__foot"), { opacity: 0, y: 18 });
      gsap.set(q(".nf__rule"), { scaleX: 0 });
      /* y: 0 alongside yPercent — anim-initial.css mirrors percentage offsets as a CSS
         transform, which GSAP would otherwise read back as a stacked pixel offset. */
      gsap.set(q(".nf__headline .inner"), { yPercent: 115, y: 0 });
      gsap.set(q(".cb__collage"), { opacity: 0, scale: 1.06 });

      /* Not paused, and no btb:preload-done gate: not-found.tsx carries no Preloader.
         A curtain over an error page only delays the way out. */
      const tl = revealTl({ delay: 0.1 });
      tl.to(q(".cb__collage"), { opacity: 0.62, scale: 1, duration: 1.5, ease: "power2.out" })
        .to(q(".nf__eyebrow"), { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, "-=1.1")
        .to(q(".nf__rule"), { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, "-=0.22")
        .to(
          q(".nf__headline .inner"),
          { yPercent: 0, duration: 0.62, ease: "power4.out", stagger: 0.05 },
          "-=0.34"
        )
        .to(q(".nf__intro"), { opacity: 1, y: 0, duration: 0.46, ease: "power3.out" }, "-=0.34")
        .to(
          q(".nf__door"),
          { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.07 },
          "-=0.28"
        )
        .to(q(".nf__foot"), { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, "-=0.26");

      /* Ambient breath, in the register of the two existing 16s/18s loops. Scale only ever
         goes ABOVE 1, so the mosaic can never pull its own edge into frame. */
      gsap.to(q(".cb__collage"), {
        scale: 1.05,
        duration: 20,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 1.6,
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="nf" data-theme="light" ref={root}>
      <CollageBackdrop />

      <div className="nf__inner">
        <div className="nf__frame">
          <span className="nf__corner nf__corner--tl" aria-hidden="true" />
          <span className="nf__corner nf__corner--tr" aria-hidden="true" />
          <span className="nf__corner nf__corner--bl" aria-hidden="true" />
          <span className="nf__corner nf__corner--br" aria-hidden="true" />

          <p className="nf__eyebrow">Error 404</p>
          <span className="nf__rule" aria-hidden="true" />

          <h1 className="nf__headline">
            <span className="line">
              <span className="inner">Nothing here</span>
            </span>
            <span className="line">
              <span className="inner">but the trace.</span>
            </span>
          </h1>

          <p className="nf__intro">
            This address has moved, or was never composed. Scent behaves the same way — you
            arrive a moment after it has gone, and what is left is only the impression it
            made. The house is still here.
          </p>

          <nav className="nf__doors" aria-label="Where to go from here">
            {DOORS.map((d) => (
              <a className="nf__door" href={d.href} key={d.href}>
                <span className="nf__doorlabel">{d.label}</span>
                <span className="nf__doornote">{d.note}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* The minimal foot — the site footer's legal bar and nothing else. The full footer
          carries a newsletter, a mega-nav and a full-bleed image reveal, all of which turn
          a wrong turn into a second page to get lost in. */}
      <footer className="nf__foot">
        <span className="nf__copy">© 2026 Beyond The Body</span>
        <span className="nf__footlinks">
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </span>
      </footer>
    </section>
  );
}
