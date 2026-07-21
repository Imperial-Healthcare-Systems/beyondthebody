import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import ContactMasthead from "../_sections/ContactMasthead";
import Footer from "../_sections/Footer";

/* /contact — the contact page. Assembled the per-page way (Nav + main + Footer + SiteRuntime);
   NO Preloader (home-only), so Lenis runs immediately. Editorial single lane (client 2026-07-17):
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
      <Nav />
      <main id="top">
        <ContactMasthead />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
