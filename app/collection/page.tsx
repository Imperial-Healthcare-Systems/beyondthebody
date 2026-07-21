import type { Metadata } from "next";
import Preloader from "../_components/Preloader";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import CollectionMasthead from "../_sections/CollectionMasthead";
import CollectionScent from "../_sections/CollectionScent";
import CollectionForthcoming from "../_sections/CollectionForthcoming";
import Footer from "../_sections/Footer";

/* /collection — "The house, in chapters." A house index where scent reads as Chapter One
   of something larger (unnamed forthcoming beyond it). Assembled the per-page way (Nav +
   main + Footer + SiteRuntime). Carries the brief-pace Preloader (2026-07-21): the masthead's
   entrance is an on-mount timeline, and without a curtain its copy painted composed for the
   hydration window and then snapped back to play. Preloader FIRST — SiteRuntime reads
   __btbPreloading in its own effect and must see it already set.
   Built beat by beat behind the page_build human gate:
     Beat 1 — Masthead (the house statement)
     Beat 2 — Chapter One · Scent (the four fragrances, Delvaux row)
     Beat 3 — Chapter Two · forthcoming (unnamed) */

export const metadata: Metadata = {
  title: "The Collection — Beyond The Body",
  description:
    "A house told in chapters. The first is scent — four unisex compositions for warm light, from a house that will not end at the skin.",
};

export default function CollectionPage() {
  return (
    <>
      <Preloader />
      <Nav />
      <main id="top">
        <CollectionMasthead />
        <CollectionScent />
        <CollectionForthcoming />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
