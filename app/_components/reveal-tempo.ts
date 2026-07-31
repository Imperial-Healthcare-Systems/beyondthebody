/* VIEWPORT-DEPENDENT REVEAL TEMPO — client direction, 2026-07-31.

   The original complaint was specifically about phones: "if a mobile user scrolls
   hastily, he scrolls everything before anything is even shown". A thumb-flick
   crosses a section far quicker than a desktop scroll does, so the two want
   different tempos — and the ÷1.8 cut that reads well on a desktop is the one the
   client wanted kept there.

   So: timelines are AUTHORED at the desktop tempo, and a phone plays the same
   choreography faster.

   This scales TIME ONLY. Every overlap ratio, every stagger, every position
   offset is preserved exactly — it is one choreography at two speeds, not two
   choreographies to keep in sync. Nothing in any section file has to know about
   the breakpoint.

   WHY PER-TIMELINE, not gsap.globalTimeline.timeScale(): the global timeline
   carries everything, so scaling it would also speed up the two ambient breath
   loops (16s/18s, repeat -1 — the whole point of which is to be barely
   perceptible) and interfere with the 17 scrub-driven parallax blocks, whose
   progress is mapped from scroll position rather than played over time. */

import { gsap } from "gsap";

/** The site's mobile breakpoint. Matches the 820px used across the stylesheets
    and Preloader's INTRO_MIN_WIDTH (821, "matches the site's mobile breakpoint").
    Kept as one exported constant so the tempo can never drift from the layout. */
export const MOBILE_MAX = 820;

/* Written as the two divisors rather than a bare 1.556, so both cuts stay legible
   and either can be retuned on its own. Desktop is the authored baseline, so its
   scale is 1 by construction. */
const DESKTOP_DIVISOR = 1.8;
const MOBILE_DIVISOR = 2.8;

/** Timescale multiplier for the current viewport: 1 on desktop, ~1.556 on a phone.
    Read once when the timeline is built — a mid-session resize deliberately does
    NOT retime an in-flight reveal. */
export const revealTempo = (): number =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX
    ? MOBILE_DIVISOR / DESKTOP_DIVISOR
    : 1;

/** `gsap.timeline()` with the viewport's tempo already applied. Drop-in
    replacement — returns the timeline, so the usual `.to().to()` chain is
    unchanged. */
export const revealTl = (vars?: gsap.TimelineVars): gsap.core.Timeline =>
  gsap.timeline(vars).timeScale(revealTempo());
