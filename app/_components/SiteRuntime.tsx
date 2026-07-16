"use client";

/* =================================================================
   SiteRuntime — the page's one motion system (renders nothing).
   · Lenis smooth scroll, wired into GSAP ScrollTrigger's clock
   · the INVERSION SIGNATURE: the section under the nav sets
     <html data-ui-theme>, recolouring nav + cursor + rail in one move
   Fully reduced-motion aware: with RM on, no Lenis, no transforms —
   content sits in its final state and the theme is set statically.

   NB: entrance choreography is NOT here — every beat owns its own GSAP
   timeline, scoped to its root ref. A generic [data-reveal] batch + a
   __btbForceReveal() hook used to live here; nothing ever carried the
   attribute, so both were dead code (and the hook silently forced
   nothing, which made whole-page screenshots read as blank). Whole-page
   capture is scripts/shoot-through.mjs --home, which drives real scroll.
   ================================================================= */

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export default function SiteRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    gsap.registerPlugin(ScrollTrigger);

    // ---- inversion signature: pick the section crossing the nav line ----
    const themeTriggers: ScrollTrigger[] = [];
    const applyThemeFromSections = () => {
      const sections = gsap.utils.toArray<HTMLElement>("[data-theme]");
      sections.forEach((section) => {
        themeTriggers.push(
          ScrollTrigger.create({
            trigger: section,
            start: "top 8%",
            end: "bottom 8%",
            onToggle: (self) => {
              if (self.isActive) {
                const t = section.dataset.theme;
                if (t) root.setAttribute("data-ui-theme", t);
              }
            },
          })
        );
      });
      // seed from the first section so the nav is correct before any scroll
      const first = sections[0];
      if (first?.dataset.theme)
        root.setAttribute("data-ui-theme", first.dataset.theme);
    };

    // ---- reduced-motion short path: no Lenis, static theme, no transforms ----
    if (prefersReduced) {
      applyThemeFromSections();
      ScrollTrigger.refresh();
      return () => {
        themeTriggers.forEach((t) => t.kill());
      };
    }

    // ---- Lenis smooth scroll wired to GSAP's ticker ----
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    // ---- cross-page hash landing (Sprint 02, beat 0) ----
    // Arriving at /#collection from another route: the browser's native
    // scroll-to-anchor happens while the preloader holds the scroll locked and
    // Lenis is stopped, so it lands at the top instead. Re-run it via Lenis once
    // scroll is actually live — after preload release if the preloader is up,
    // else immediately (sub-routes mount no preloader). Instant, like a hash jump.
    const initialHash = window.location.hash;
    const landHash = () => {
      if (initialHash.length < 2) return;
      const target = document.querySelector(initialHash);
      if (target) lenis.scrollTo(target as HTMLElement, { immediate: true });
    };

    // The preloader mounts before this and may still be up; start held so its
    // scroll lock is honoured. Preloader calls __lenis.start() on release.
    if (window.__btbPreloading) {
      lenis.stop();
      window.addEventListener("btb:preload-done", landHash, { once: true });
    } else {
      requestAnimationFrame(landHash);
    }

    applyThemeFromSections();
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("btb:preload-done", landHash);
      gsap.ticker.remove(tick);
      lenis.destroy();
      // Kill ONLY what this component created. ScrollTrigger.getAll().kill()
      // would take every section's triggers with it — and SiteRuntime is a
      // sibling of <main>, not its parent, so a lone remount (Fast Refresh)
      // would leave all 11 beats' parallax and reveals permanently dead.
      themeTriggers.forEach((t) => t.kill());
    };
  }, []);

  return null;
}
