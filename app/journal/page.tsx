import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import JournalIndex from "../_sections/JournalIndex";
import Footer from "../_sections/Footer";

/* /journal — the Journal index. Server component that assembles the shared chrome
   the per-page way (Nav + main + Footer + SiteRuntime); NO Preloader (home-only, so
   Lenis runs immediately here). SiteRuntime tracks each section's data-theme for nav
   inversion: JournalIndex is light, Footer is dark. */

export const metadata: Metadata = {
  title: "The Journal — Beyond The Body",
  description:
    "Scent as culture — composition, provenance and memory. Notes from a house that begins with scent.",
};

export default function JournalPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <JournalIndex />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
