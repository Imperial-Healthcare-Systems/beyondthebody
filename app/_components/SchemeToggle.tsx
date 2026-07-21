"use client";

/* Appearance control — lives in the MENU DRAWER, not the header (client,
   2026-07-21: "the toggle sits in the menu, not disturbing the harmony of
   today's header"). The nav is a signed-off 3-column composition; adding a
   fourth affordance there would cost more than it buys.

   Two states only — Light (the default) and Dark (client, 2026-07-21). An
   earlier cut carried a third "System" option following prefers-color-scheme;
   it was dropped so the house's signed-off light AD is always what a visitor
   lands on.

   Deliberately NOT a sun/moon switch: a two-word set in the same Archivo-
   Expanded label register as every other eyebrow on the site, with a hairline
   under the active term — restraint over decoration (design-philosophy §1).

   a11y: a real radiogroup. Arrow keys move between options via native radio
   semantics; the visible rule is backed by aria-checked, not colour alone. */

import { setScheme, type Scheme } from "./theme";
import { useScheme } from "./useScheme";

const OPTIONS: { value: Scheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SchemeToggle() {
  const scheme = useScheme();

  return (
    <div className="schemetoggle">
      <span className="schemetoggle__label" id="btb-appearance-label">
        Appearance
      </span>
      <div
        className="schemetoggle__set"
        role="radiogroup"
        aria-labelledby="btb-appearance-label"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={scheme === o.value}
            className={`schemetoggle__opt${scheme === o.value ? " is-on" : ""}`}
            onClick={() => setScheme(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
