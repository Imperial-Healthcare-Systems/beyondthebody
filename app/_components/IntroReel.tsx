"use client";

/* INTRO REEL — the home page's opening marquee.

   A vertical column of full-bleed frames races past on a tilted 3D plane and
   decelerates onto the HERO frame, which comes to rest full-bleed. The resting
   frame is not a lookalike: it renders §1 HERO's own media block (same markup,
   same classes, same data-theme, same asset URL), so settling and fading out is
   a dissolve between two copies of one composition.

   The Preloader owns the handshake and mounts this; this owns only its own
   choreography and reports back:
     · onReady()  — every frame decoded; safe to hand over
     · onFlatten() — ~78% through, the column is levelling (nav mark fades in)
     · onSettle() — at rest on the hero (scroll unlocks, hero copy plays)

   Desktop + motion-allowed + once per session. Preloader decides all three. */

import { useEffect, useRef } from "react";
import "./introreel.css";
import "../_sections/hero.css";

/* the travelling frames, in order. Sourced stock, graded to the house look and
   converted to WebP at 1920px — see project/working/ for provenance. */
const FRAMES = [
  "/intro/intro-01.webp",
  "/intro/intro-02.webp",
  "/intro/intro-03.webp",
  "/intro/intro-04.webp",
];
const HERO_SRC = "/hero/hero.png";

const DURATION = 4000;  // ms of travel — the whole intro
const SPIN = 5;         // frames that fly past before the hero
const BLUR_MAX = 2;     // peak velocity blur, px (0 disables)
const FLATTEN_AT = 0.78; // progress at which we call the column "levelling"

type Props = {
  onReady: () => void;
  onFlatten: () => void;
  onSettle: () => void;
  /* set true by the Preloader once its curtain has lifted */
  play: boolean;
  /* set true after onSettle — fades the reel out over the real hero */
  spent: boolean;
};

export default function IntroReel({ onReady, onFlatten, onSettle, play, spent }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const vignette = useRef<HTMLDivElement>(null);
  /* Callbacks live in a ref so the rAF loop never restarts on a parent render.
     Synced in an effect, not during render — and declared FIRST so it runs
     before the effects below on mount. */
  const cbs = useRef({ onReady, onFlatten, onSettle });
  useEffect(() => {
    cbs.current = { onReady, onFlatten, onSettle };
  });

  // ---- preload every frame (incl. the hero) before we report ready ----------
  useEffect(() => {
    let live = true;
    const all = [...FRAMES, HERO_SRC].map(
      (src) =>
        new Promise<void>((res) => {
          const im = new Image();
          im.onload = im.onerror = () => res();
          im.src = src;
        })
    );
    Promise.all(all).then(() => {
      if (live) cbs.current.onReady();
    });
    return () => {
      live = false;
    };
  }, []);

  // ---- the travel ----------------------------------------------------------
  useEffect(() => {
    if (!play || !reel.current) return;

    const el = reel.current;
    const gap = parseFloat(
      getComputedStyle(root.current!).getPropertyValue("--reel-gap")
    ) || 250;
    const tiltMax = 15;
    const pushMax = 1150;

    // fast launch, long gentle settle
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    // flattens later than it travels, so the frame levels right at the end
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    let raf = 0;
    let start: number | null = null;
    let flattened = false;

    const frame = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / DURATION);

      const eP = easeOutExpo(t);
      const eF = easeOutQuart(t);

      const step = window.innerHeight + gap;
      const posEnd = -SPIN * step;                       // hero full-bleed
      const posStart = posEnd + SPIN * step + window.innerHeight / 2;
      const posY = posStart + (posEnd - posStart) * eP;

      const tilt = tiltMax * (1 - eF);
      const push = pushMax * (1 - eF);

      // velocity-driven motion blur
      const ahead = easeOutExpo(Math.min(1, t + 0.012));
      const vel = Math.abs(ahead - eP) * (posStart - posEnd);
      const blur = Math.min(BLUR_MAX, vel * 0.09);

      el.style.transform = `translate3d(0, ${posY}px, ${-push}px) rotateX(${tilt}deg)`;
      el.style.filter = blur > 0.4 ? `blur(${blur.toFixed(2)}px)` : "none";

      if (!flattened && t > FLATTEN_AT) {
        flattened = true;
        vignette.current?.classList.add("is-clear");
        cbs.current.onFlatten();
      }

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        el.style.filter = "none";
        atRest = true;
        cbs.current.onSettle();
      }
    };

    // a resize mid-fade would strand the column off its rest position
    let atRest = false;
    const onResize = () => {
      if (!atRest) return;
      el.style.transform = `translate3d(0, ${
        -SPIN * (window.innerHeight + gap)
      }px, 0) rotateX(0deg)`;
    };
    window.addEventListener("resize", onResize);

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [play]);

  /* Sequence: SPIN travelling frames cycling the stock set, then the hero at
     rest, then two never-seen frames so the column has depth past the stop. */
  const travelling = Array.from({ length: SPIN }, (_, i) => FRAMES[i % FRAMES.length]);
  const trailing = [FRAMES[0], FRAMES[1]];

  return (
    <div
      className={`introreel${spent ? " is-spent" : ""}`}
      ref={root}
      aria-hidden="true"
    >
      <div className="introreel__reel" ref={reel}>
        {travelling.map((src, i) => (
          <div className="introreel__slide" key={`t${i}`}>
            <img src={src} alt="" decoding="async" />
          </div>
        ))}

        {/* the resting frame — §1 HERO's media block, verbatim */}
        <div className="introreel__slide introreel__slide--hero" data-theme="dark">
          <div className="hero__media">
            <img className="hero__img" src={HERO_SRC} alt="" />
            <div className="hero__grain" />
            <div className="hero__scrim" />
          </div>
        </div>

        {trailing.map((src, i) => (
          <div className="introreel__slide" key={`x${i}`}>
            <img src={src} alt="" decoding="async" />
          </div>
        ))}
      </div>

      <div className="introreel__vignette" ref={vignette} />
    </div>
  );
}
