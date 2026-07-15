"use client";

/* Preloader — ⚥ mark, house word, a filling rule, then an elegant lift.
   Home page only (kept off isolation-preview routes). Reduced-motion
   hides it entirely (CSS). Also releases if load takes too long.

   Owns the page's opening handshake: while it is up, scroll is locked
   (html.btb-preloading) and `window.__btbPreloading` is true, so the HERO
   holds its entrance timeline instead of playing it behind the curtain.
   On release it unlocks scroll and fires `btb:preload-done`. */

import { useEffect, useRef, useState } from "react";

export default function Preloader() {
  const [done, setDone] = useState(false);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      setDone(true);
      return;
    }
    // hold the page still until the curtain lifts (Hero waits on this flag)
    window.__btbPreloading = true;
    document.documentElement.classList.add("btb-preloading");
    let pct = 0;
    const el = fill.current;
    const iv = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * 18 + 6);
      if (el) el.style.width = pct + "%";
      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => setDone(true), 480);
      }
    }, 160);
    const safety = setTimeout(() => setDone(true), 3600);
    return () => {
      clearInterval(iv);
      clearTimeout(safety);
    };
  }, []);

  // release: unlock scroll and hand the stage to the hero
  useEffect(() => {
    if (!done) return;
    window.__btbPreloading = false;
    document.documentElement.classList.remove("btb-preloading");
    window.__lenis?.start();
    window.dispatchEvent(new Event("btb:preload-done"));
  }, [done]);

  return (
    <div className={`preloader${done ? " is-done" : ""}`} aria-hidden="true">
      <div className="preloader__inner">
        <span className="preloader__glyph" aria-hidden="true" />
        <span className="preloader__word">Beyond The Body</span>
        <span className="preloader__bar">
          <span ref={fill} className="preloader__fill" />
        </span>
      </div>
    </div>
  );
}
