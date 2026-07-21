"use client";

/* Preloader — ⚥ mark, house word, a filling rule, then an elegant lift.

   Mounted on the HOME route and on the main pages (/collection, /journal,
   /contact) — not on secondary pages like /fragrance/[slug]. It exists to do
   real work, not decoration: while it is up, scroll is locked
   (html.btb-preloading) and `window.__btbPreloading` is true, so a section's
   entrance timeline HOLDS instead of painting un-animated and then playing
   behind the curtain. On release it unlocks scroll and fires
   `btb:preload-done`, which every gated section listens for.

   On HOME (`intro`), and only on desktop, with motion allowed, once per
   browser session, the curtain hands over to the INTRO REEL instead of
   lifting straight onto the page:

     curtain (black) ──0.5s──► reel travels ──► rests on hero ──► fades out
                                                    │                │
                                       nav ⚥ in ────┘                │
                                       hero copy plays ──────────────┘
                                       scroll restored ~1.4s later

   The curtain turns BLACK for that hand-off (.is-onyx) so the cut into the
   reel's black ground is invisible. Every other case — mobile, a repeat visit
   in the session, the other routes — keeps the oxblood house ground.

   Reduced motion: no reel, no ⚥ choreography — just a short black-to-page
   dissolve, handled in CSS (chrome.css → prefers-reduced-motion). */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import IntroReel from "./IntroReel";

const INTRO_KEY = "btb:intro-played";   // sessionStorage — once per session
const HANDOFF_DELAY = 500;              // ms of black between curtain and reel (tunable)

/* Two paces. HOME's curtain is a moment in its own right. On a sub-page the
   curtain is doing a job — arming the entrance timelines so nothing paints
   un-animated — and every internal link here is a plain <a>, so it runs on
   every click. It stays short enough not to tax browsing. */
const PACE = {
  full:  { step: 160, gain: 18, floor: 6,  tail: 480 },   // ≈1.2–1.8s
  brief: { step: 90,  gain: 22, floor: 14, tail: 260 },   // ≈0.6–0.8s
} as const;

const SCROLL_RELEASE_DELAY = 1400;      // ms after the reel settles — lets the hero copy land first
const INTRO_MIN_WIDTH = 821;            // desktop only (matches the site's mobile breakpoint)
const SAFETY_MS = 3600;                 // never hold the page hostage to a slow asset
const REEL_FADE_MS = 900;               // must outlast .introreel's opacity transition

/* useLayoutEffect on the client so the ground colour is decided before paint
   (a plain useEffect would flash oxblood for a frame before turning black). */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Phase = "curtain" | "reel" | "spent" | "done";

export default function Preloader({
  intro = false,
  pace = intro ? "full" : "brief",
}: {
  intro?: boolean;
  pace?: keyof typeof PACE;
}) {
  const [phase, setPhase] = useState<Phase>("curtain");
  /* state, not a ref: the reel must MOUNT during the curtain so it can preload
     its frames and report ready. A ref wouldn't re-render and it'd never mount. */
  const [willIntro, setWillIntro] = useState(false);
  const willIntroRef = useRef(false);   // the same answer, readable inside effects
  const reelReady = useRef(false);
  const barDone = useRef(false);
  const advance = useRef<() => void>(() => {});
  const fill = useRef<HTMLSpanElement>(null);

  // ---- decide the opening, before first paint ------------------------------
  useIsoLayoutEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;  // CSS owns the reduced-motion dissolve

    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      seen = true;  // storage blocked → treat as seen; never trap the visitor in an intro
    }

    const go = intro && !seen && window.innerWidth >= INTRO_MIN_WIDTH;
    willIntroRef.current = go;
    if (!go) return;

    setWillIntro(true);
    // hold the chrome back so the reel owns the frame (see chrome.css)
    document.documentElement.classList.add("btb-intro");
  }, [intro]);

  // ---- the curtain: hold the page, fill the rule ---------------------------
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // static dissolve: let the composed page paint, then clear the black
      const t = setTimeout(() => setPhase("done"), 600);
      return () => clearTimeout(t);
    }

    window.__btbPreloading = true;
    document.documentElement.classList.add("btb-preloading");

    const tryAdvance = () => {
      if (!barDone.current) return;
      if (willIntroRef.current) {
        if (!reelReady.current) return;   // onReady calls back through here
        try {
          sessionStorage.setItem(INTRO_KEY, "1");
        } catch {
          /* storage blocked — the intro simply replays next load */
        }
        setPhase("reel");
      } else {
        setPhase("done");
      }
    };
    advance.current = tryAdvance;

    let pct = 0;
    let handoff: ReturnType<typeof setTimeout>;
    const el = fill.current;
    const p = PACE[pace];
    const iv = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * p.gain + p.floor);
      if (el) el.style.width = pct + "%";
      if (pct >= 100) {
        clearInterval(iv);
        barDone.current = true;
        handoff = setTimeout(tryAdvance, willIntroRef.current ? HANDOFF_DELAY : p.tail);
      }
    }, p.step);

    // a slow asset must never strand the visitor behind the curtain
    const safety = setTimeout(() => {
      barDone.current = true;
      reelReady.current = true;
      tryAdvance();
    }, SAFETY_MS);

    return () => {
      clearInterval(iv);
      clearTimeout(handoff);
      clearTimeout(safety);
    };
    // `pace` is fixed per route, so this never actually re-runs
  }, [pace]);

  // ---- release: hand the stage over, then restore scroll -------------------
  const release = useCallback((delayScroll: number) => {
    window.__btbPreloading = false;
    window.dispatchEvent(new Event("btb:preload-done"));
    const unlock = () => {
      document.documentElement.classList.remove("btb-preloading");
      window.__lenis?.start();
    };
    if (delayScroll > 0) setTimeout(unlock, delayScroll);
    else unlock();
  }, []);

  // no intro: the curtain lifting IS the release (today's behaviour)
  useEffect(() => {
    if (phase !== "done" || willIntroRef.current) return;
    release(0);
  }, [phase, release]);

  // the spent reel has finished dissolving — drop it out of the DOM
  useEffect(() => {
    if (phase !== "spent") return;
    const t = setTimeout(() => setPhase("done"), REEL_FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const onSettle = useCallback(() => {
    setPhase("spent");
    // hero copy plays now; the rest of the nav staggers in behind the ⚥
    document.documentElement.classList.remove("btb-intro");
    release(SCROLL_RELEASE_DELAY);
  }, [release]);

  const onReady = useCallback(() => {
    reelReady.current = true;
    advance.current();
  }, []);

  const onFlatten = useCallback(() => {
    // the column is levelling — bring the house mark in
    document.documentElement.classList.add("btb-intro-mark");
  }, []);

  return (
    <>
      <div
        className={`preloader${willIntro ? " is-onyx" : ""}${
          phase !== "curtain" ? " is-done" : ""
        }`}
        aria-hidden="true"
      >
        <div className="preloader__inner">
          <span className="preloader__glyph" aria-hidden="true" />
          <span className="preloader__word">Beyond The Body</span>
          <span className="preloader__bar">
            <span ref={fill} className="preloader__fill" />
          </span>
        </div>
      </div>

      {willIntro && phase !== "done" && (
        <IntroReel
          play={phase === "reel" || phase === "spent"}
          spent={phase === "spent"}
          onReady={onReady}
          onFlatten={onFlatten}
          onSettle={onSettle}
        />
      )}
    </>
  );
}
