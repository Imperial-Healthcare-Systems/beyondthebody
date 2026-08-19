import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import CollectionCollageMock from "../../_sections/CollectionCollageMock";
import { designRoutesEnabled } from "@/lib/env";

/* MOCKUP ONLY — a throwaway route to judge a collage behind the Collection hero. Not linked
   from anywhere; delete (route + CollectionCollageMock + its css) once a direction is chosen,
   or fold the winning collage layer into the live CollectionMasthead.

   Closed in production alongside /preview/* (S8): a mockup nobody chose is not something a
   visitor should be able to find. `robots` below asks a crawler not to index it; this
   makes it unreachable, which is the part that does not rely on anyone's good manners. */

export const metadata: Metadata = {
  title: "Mockup — Collection collage",
  robots: { index: false, follow: false },
};

export default function CollectionCollageMockPage() {
  if (!designRoutesEnabled()) notFound();

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
