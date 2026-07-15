"use client";

/* Nav — ylem framing: MENU (left) · ⚥ monogram (centre) · quick link + CTA (right).
   The MENU opens a full slide-in drawer with the complete nav. */

import { useEffect, useState } from "react";

const MENU_LINKS = [
  { label: "The House", href: "#origin" },
  { label: "The Collection", href: "#collection" },
  { label: "The Journal", href: "#journal" },
  { label: "Join the House", href: "#newsletter" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <button
          className="nav__menu"
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="nav__menuicon" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="nav__menulabel">Menu</span>
        </button>

        <a className="nav__brand" href="#top" aria-label="Beyond The Body — home">
          <span className="nav__glyph" aria-hidden="true" />
        </a>

        <nav className="nav__links" aria-label="Primary">
          <a className="nav__link" href="#collection">
            The Collection
          </a>
          <a className="nav__cta" href="#newsletter">
            Join the House
          </a>
        </nav>
      </header>

      <div
        className={`drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <button
          className="drawer__scrim"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer__head">
            <span className="nav__glyph" aria-hidden="true" />
            <button
              className="drawer__close"
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <span />
              <span />
            </button>
          </div>
          <nav className="drawer__nav">
            {MENU_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
          <p className="drawer__foot">A house that begins with scent</p>
        </aside>
      </div>
    </>
  );
}
