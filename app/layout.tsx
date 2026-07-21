import type { Metadata } from "next";
import { Fraunces, Archivo } from "next/font/google";
import "./globals.css";
import "./_components/chrome.css";
/* Imported LAST of the global sheets so the entrance initial states outrank the
   section rules they pre-hide. See the file header for the editing rules. */
import "./_components/anim-initial.css";
import { CartProvider } from "./_components/CartProvider";
import CartDrawer from "./_components/CartDrawer";
import Cursor from "./_components/Cursor";
import { ANIM_SCRIPT, THEME_SCRIPT } from "./_components/theme";

/* Frozen DS type: Fraunces (display), Archivo (body), Archivo Expanded (eyebrow/labels). */
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});
// NOTE: "Archivo Expanded" isn't available via next/font (and Archivo's width
// axis isn't exposed). --ff-exp maps to Archivo; the expanded/label register is
// carried by wide letter-spacing + uppercase. Refine in the DS reconciliation pass.

/* "Nine unisex fragrances" until 2026-07-15 — the nine were first-draft placeholders,
   superseded by the four real scents (content@v0.1). The page it describes has shown
   four since §8 was built. */
export const metadata: Metadata = {
  title: "Beyond The Body — A house that begins with scent",
  description:
    "A future fashion house whose first chapter is scent. Four unisex fragrances composed for the Indian climate. Presence, before a word is spoken.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-ui-theme="dark"
      data-scheme="light"
      suppressHydrationWarning
      className={`${fraunces.variable} ${archivo.variable}`}
    >
      {/* Resolve the art direction BEFORE first paint. LIGHT is the default and
          what the server emits; this blocking script upgrades to dark only if the
          visitor has explicitly chosen it, while the HTML is still parsing — no
          flash of the wrong ground, no hydration error (React never renders the
          attribute). Per next/docs → guides/preventing-flash-before-hydration.
          suppressHydrationWarning on <html> covers the script's own mutation. */}
      {/* And resolve the animation-ready flag the same way: html.btb-anim is what
          licenses the CSS initial states that stop entrances painting composed and
          then snapping back to play. It fails OPEN — no JS, or reduced motion, means
          no class and fully visible content. See theme.ts → ANIM_SCRIPT. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ANIM_SCRIPT }} />
      </head>
      <body>
        <CartProvider>
          {children}
          <CartDrawer />
          {/* Custom cursor is site-wide (was home-only) so it can be the ONLY cursor on
              every route; it self-disables on coarse/touch + reduced-motion. */}
          <Cursor />
        </CartProvider>
      </body>
    </html>
  );
}
