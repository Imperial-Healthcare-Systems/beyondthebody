import type { Metadata } from "next";
import Preloader from "../_components/Preloader";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import ContactMasthead from "../_sections/ContactMasthead";
import Footer from "../_sections/Footer";

/* /contact — the contact page. Assembled the per-page way (Nav + main + Footer + SiteRuntime).
   Carries the sub-page Preloader (2026-07-21; retimed per device 2026-08-10): the masthead's linen still wipes in from a
   clip-path set in JS, so without a curtain the full-bleed photo painted and then snapped to
   zero width. Preloader FIRST — SiteRuntime reads __btbPreloading in its own effect and must
   see it already set. Editorial single lane (client 2026-07-17):
   one masthead + the way-in (mailto email + socials); the Footer already carries the newsletter,
   so nothing is duplicated. SiteRuntime tracks each section's data-theme for nav inversion:
   ContactMasthead is light, Footer is dark. */

export const metadata: Metadata = {
  title: "Contact — Beyond The Body",
  description:
    "Write to Beyond The Body — a house that begins with scent. A question, press, or simply hello.",
};

export default function ContactPage() {
  return (
    <>
      <Preloader />
      <Nav />
      <main id="top">
        <ContactMasthead />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
