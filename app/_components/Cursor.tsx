"use client";

/* Custom cursor — a champagne/oxblood ring + dot that eases toward the
   pointer and swells over interactive elements. Colour is var(--ui-fg),
   so it inverts with the section. Hidden on touch + reduced-motion.

   It also hides the NATIVE cursor while the pointer is inside the document, so this
   is the only cursor on screen (desktop, fine pointer). It does that by toggling
   `html.custom-cursor` (CSS applies `cursor: none` + reveals these els); the class is
   dropped the instant the pointer leaves the window or the tab blurs, restoring the
   native cursor. Coarse/touch + reduced-motion bail below and keep the native cursor. */

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

    // native-cursor hiding is a class on <html>: on while the pointer is in the doc, off
    // when it leaves the window / the tab blurs (native cursor returns instantly).
    const root = document.documentElement;
    const activate = () => root.classList.add("custom-cursor");
    const deactivate = () => root.classList.remove("custom-cursor");

    const onMove = (e: PointerEvent) => {
      activate(); // covers a pointer already inside at load (no enter event fires)
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
    root.addEventListener("pointerenter", activate);
    root.addEventListener("pointerleave", deactivate);
    window.addEventListener("blur", deactivate);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerenter", activate);
      root.removeEventListener("pointerleave", deactivate);
      window.removeEventListener("blur", deactivate);
      deactivate();
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
