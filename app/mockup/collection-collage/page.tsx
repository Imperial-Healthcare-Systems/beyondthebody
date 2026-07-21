import type { Metadata } from "next";
import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import CollectionCollageMock from "../../_sections/CollectionCollageMock";

/* MOCKUP ONLY — a throwaway route to judge a collage behind the Collection hero. Not linked
   from anywhere; delete (route + CollectionCollageMock + its css) once a direction is chosen,
   or fold the winning collage layer into the live CollectionMasthead. */

export const metadata: Metadata = {
  title: "Mockup — Collection collage",
  robots: { index: false, follow: false },
};

export default function CollectionCollageMockPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <CollectionCollageMock />
      </main>
      <SiteRuntime />
    </>
  );
}
