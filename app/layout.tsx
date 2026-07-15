import type { Metadata } from "next";
import { Fraunces, Archivo } from "next/font/google";
import "./globals.css";
import "./_components/chrome.css";

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
      className={`${fraunces.variable} ${archivo.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
