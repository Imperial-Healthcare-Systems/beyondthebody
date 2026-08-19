import type { Metadata } from "next";
import Nav from "./_components/Nav";
import SiteRuntime from "./_components/SiteRuntime";
import NotFoundCollage from "./_sections/NotFoundCollage";

/* The 404.
 *
 * The house mosaic behind it (2026-08-12, client direction) was the /mockup/collection-collage
 * comp; the treatment was promoted out of that throwaway route and is now a production
 * surface. What used to be here was the legal-page template with a list of links.
 *
 * It keeps the Nav — someone standing in the wrong room should have the whole house
 * available, not just the three doors the copy offers — and drops the full Footer for the
 * minimal foot inside the section. The full one carries a newsletter, a mega-nav and a
 * full-bleed image reveal: a second page to get lost in, appended to the page that told
 * you that you were lost.
 *
 * No Preloader. The curtain exists to hide entrance choreography on a page someone chose to
 * visit; nobody chose this one, and a curtain would only delay the way out.
 *
 * Reached by every unmatched address, and by notFound() from the routes that call it — a
 * draft essay's public address, a stranger's order token, /preview and /mockup in
 * production. All of those must look identical from outside: an address that does not exist
 * tells you nothing about whether it once did. */

export const metadata: Metadata = {
  title: "Not found — Beyond The Body",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="top">
        <NotFoundCollage />
      </main>
      <SiteRuntime />
    </>
  );
}
