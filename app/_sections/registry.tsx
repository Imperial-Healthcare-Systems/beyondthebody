import type { ComponentType } from "react";
import Hero from "./Hero";
import Bridge from "./Bridge";
import Origin from "./Origin";
import OriginB from "./OriginB";
import ProductTouch1 from "./ProductTouch1";
import ProductTouch2 from "./ProductTouch2";
import Statement from "./Statement";
import Values from "./Values";
import ProductTouch3 from "./ProductTouch3";
import Journal from "./Journal";
import CircularClose from "./CircularClose";
import Footer from "./Footer";
import ArticleStress from "../_archetypes/ArticleStress";

/* The accumulating page spine. Each approved beat is APPENDED here verbatim
   (page_build loop). page.tsx renders BEATS in order; the /preview/[section]
   route renders any single beat in isolation for its screenshot sign-off. */

export type Beat = {
  key: string;
  label: string;
  Component: ComponentType;
};

export const BEATS: Beat[] = [
  { key: "hero", label: "§1 · HERO", Component: Hero },
  { key: "bridge", label: "§2 · BRIDGE", Component: Bridge },
  { key: "origin", label: "§3 · ORIGIN", Component: OriginB }, // Variant B chosen (full-bleed)
  { key: "signature", label: "§4 · PRODUCT TOUCH 1", Component: ProductTouch1 },
  { key: "statement", label: "§5 · BRAND STATEMENT", Component: Statement },
  { key: "desir", label: "§6 · PRODUCT TOUCH 2 (Desir)", Component: ProductTouch2 },
  { key: "values", label: "§7 · WHAT THE HOUSE HOLDS TO", Component: Values },
  { key: "collection", label: "§8 · THE COLLECTION", Component: ProductTouch3 },
  { key: "journal", label: "§9 · THE JOURNAL", Component: Journal },
  { key: "close", label: "§10 · CIRCULAR CLOSE", Component: CircularClose },
  { key: "newsletter", label: "§11 · FOOTER (newsletter + reveal)", Component: Footer },
  // next beats appended here as each one passes its human gate.
];

/* Preview-only alternates (comparisons); NOT part of the live page. */
export const VARIANTS: Beat[] = [
  { key: "origin-a", label: "§3 · ORIGIN (Variant A — vertical BTB)", Component: Origin },
  /* Not an alternate — a fixture. The Journal is authored from the admin portal, so the
     editorial-article archetype has to be checked against content nobody has written yet.
     Shoot this alongside a real essay whenever the archetype changes. */
  { key: "article-stress", label: "ARCHETYPE · editorial article (stress fixture)", Component: ArticleStress },
];
