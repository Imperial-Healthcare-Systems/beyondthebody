import type Lenis from "lenis";

/* Globals the page's runtime hangs off `window`, declared once so the
   handshake between Preloader / Hero / SiteRuntime is typed rather than cast.
     · __btbPreloading — true while the preloader curtain is up; HERO waits on it
     · __lenis         — the single Lenis instance (SiteRuntime owns it)
     · __btbForceReveal — screenshot-harness hook (scripts/shoot.mjs) */
declare global {
  interface Window {
    __btbPreloading?: boolean;
    __lenis?: Lenis;
    __btbForceReveal?: () => void;
  }
}

export {};
