import type { Metadata } from "next";
import Preloader from "../_components/Preloader";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import JournalIndex from "../_sections/JournalIndex";
import { getPublishedPosts } from "@/lib/journal";
import Footer from "../_sections/Footer";

/* /journal — the Journal index. Server component that assembles the shared chrome
   the per-page way (Nav + main + Footer + SiteRuntime). Carries the sub-page Preloader
   (2026-07-21; retimed per device 2026-08-10) so the masthead's on-mount entrance is
   armed before anything paints.
   Preloader FIRST — SiteRuntime reads __btbPreloading in its own effect and must see it
   already set. SiteRuntime tracks each section's data-theme for nav inversion:
   JournalIndex is light, Footer is dark. */

export const metadata: Metadata = {
  title: "The Journal — Beyond The Body",
  description:
    "Scent as culture — composition, provenance and memory. Notes from a house that begins with scent.",
};

/* ISR, like the article route: prerendered, revalidated when the client publishes. */
export const revalidate = 3600;

export default async function JournalPage() {
  const essays = await getPublishedPosts();

  return (
    <>
      <Preloader />
      <Nav />
      <main id="top">
        <JournalIndex essays={essays} />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
