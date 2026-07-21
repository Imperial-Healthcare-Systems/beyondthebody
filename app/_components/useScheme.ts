"use client";

/* useScheme — the React subscription to the active art direction.
   Split out of theme.ts because layout.tsx (a Server Component) imports
   THEME_SCRIPT from there, and Next 16 hard-errors if a server module's
   import graph touches a React hook. theme.ts stays pure; this is the
   client half. */

import { useEffect, useState } from "react";
import { SCHEME_EVENT, readScheme, type Scheme } from "./theme";

/**
 * Subscribe to the active scheme ("light" | "dark").
 *
 * First render deliberately returns "light" (matching the server) and corrects
 * in an effect. The <html data-scheme> ATTRIBUTE is already correct from the
 * pre-paint script, so nothing visual flashes — only components that branch on
 * the value in JS (the WebGL blueprint) settle a tick later.
 *
 * No prefers-color-scheme listener: the scheme is an explicit user choice that
 * defaults to light, so the OS setting is not an input. See theme.ts.
 */
export function useScheme(): Scheme {
  const [scheme, setSchemeState] = useState<Scheme>("light");

  useEffect(() => {
    const sync = () => setSchemeState(readScheme());
    sync();

    window.addEventListener(SCHEME_EVENT, sync); // this tab
    window.addEventListener("storage", sync); // another tab

    return () => {
      window.removeEventListener(SCHEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return scheme;
}
