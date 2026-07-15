"use client";

/* Custom cursor — a champagne/oxblood ring + dot that eases toward the
   pointer and swells over interactive elements. Colour is var(--ui-fg),
   so it inverts with the section. Hidden on touch + reduced-motion. */

import { useEffect, useRef } from "react";

export default function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover)").matches;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!canHover || prefersReduced) return;

    const r = ring.current!;
    const d = dot.current!;
    let rx = window.innerWidth / 2,
      ry = window.innerHeight / 2;
    let dx = rx,
      dy = ry;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      dx = e.clientX;
      dy = e.clientY;
      d.style.transform = `translate(${dx}px, ${dy}px) translate(-50%,-50%)`;
      const t = e.target as HTMLElement;
      const interactive = t.closest("a, button, input, [data-cursor='hover']");
      r.classList.toggle("is-hover", !!interactive);
    };
    const loop = () => {
      rx += (dx - rx) * 0.16;
      ry += (dy - ry) * 0.16;
      r.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor" aria-hidden="true" />
      <div ref={dot} className="cursor__dot" aria-hidden="true" />
    </>
  );
}
