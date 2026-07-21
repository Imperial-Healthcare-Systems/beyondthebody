/* =================================================================
   Theme engine — the ONE place scheme logic lives.

   Two different attributes ride on <html>, and confusing them is the
   easiest way to break this:

     data-scheme    "light" | "dark"   — the whole SITE's art direction.
                                         Owned here. Resolved pre-paint.
     data-ui-theme  "light" | "dark"   — which SECTION is under the nav.
                                         Owned by SiteRuntime. Unrelated.

   Preference is BINARY and defaults to LIGHT (client, 2026-07-21). The light
   art direction is the house's signed-off design; dark is the alternate, and
   a visitor opts into it deliberately. prefers-color-scheme is intentionally
   NOT consulted — a viewer whose OS happens to be dark still lands on the
   canonical page. (An earlier cut had a tri-state "system" default; it was
   dropped on the client's call. Reinstating it means restoring the media
   query here, in useScheme, and a third option in SchemeToggle.)

   Resolution happens in a blocking inline <script> in <head> (see
   THEME_SCRIPT) so the correct ground is painted on the very first frame —
   a flash of the wrong ground is exactly the "obvious shortcut" tell this
   design is trying to avoid. React never renders data-scheme, so there is no
   hydration mismatch on the attribute itself.

   NB: this module is imported by layout.tsx, a SERVER component, so it must
   stay free of React hooks — Next 16 hard-errors on a server module whose
   import graph touches useState. The useScheme() hook therefore lives next
   door in useScheme.ts ("use client"). Keep this file pure.
   ================================================================= */

export type Scheme = "light" | "dark";

export const SCHEME_STORAGE_KEY = "btb-scheme";
export const SCHEME_EVENT = "btb:scheme";

/* The pre-paint script. Kept deliberately terse (it is inlined into every
   HTML response) and fully try/caught — a Safari private-mode localStorage
   throw must not take the page down before it paints. Anything that is not
   an explicit "dark" resolves to light, so a corrupt value fails safe.
   Mirrors readScheme() below; if you change one, change both. */
export const THEME_SCRIPT = `(function(){try{
document.documentElement.setAttribute("data-scheme",localStorage.getItem("${SCHEME_STORAGE_KEY}")==="dark"?"dark":"light");
}catch(e){document.documentElement.setAttribute("data-scheme","light")}})()`;

/* =================================================================
   ANIM_SCRIPT — the animation-ready flag, resolved pre-paint.

   Every entrance on this site sets its own initial state in JS
   (gsap.set: opacity 0, clip-path, yPercent…). Between the HTML
   painting and React hydrating, those elements render in their FINAL
   state and then snap back to hidden to play — the composed headline
   flashes, the full-bleed linen still paints and clips to nothing.
   A preloader curtain covers that, but it does not fix it, and any
   route without a curtain (a PDP) still shows it.

   The fix is to mirror each JS initial state in CSS. That is only safe
   if the hide can never outlive the JS that undoes it, so it is keyed
   on this class, which is added by a BLOCKING script — the only thing
   that runs before first paint:

     · JS disabled or this script throws  → no class → content visible
     · prefers-reduced-motion: reduce     → no class → content visible,
       matching every section's reduced-motion early-return
     · otherwise                          → class set before paint, so
       there is no frame in which the un-animated state is on screen

   In other words the pre-hide is opt-IN and fails open. If you add a
   CSS initial state, scope it under `html.btb-anim` and nothing else. */
export const ANIM_CLASS = "btb-anim";

export const ANIM_SCRIPT = `(function(){try{
if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("${ANIM_CLASS}");
}catch(e){}})()`;

/** The stored scheme, defaulting to light. Anything unrecognised → light. */
export function readScheme(): Scheme {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(SCHEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Apply a scheme: persist it, paint it, and tell every subscriber. */
export function setScheme(scheme: Scheme) {
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
  } catch {
    /* storage unavailable — the choice still applies for this session */
  }
  document.documentElement.setAttribute("data-scheme", scheme);
  window.dispatchEvent(new CustomEvent(SCHEME_EVENT, { detail: { scheme } }));
}
