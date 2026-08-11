/* /checkout — the order form.
 *
 * No Preloader, unlike every other page. The curtain exists to cover entrance
 * choreography, and this page deliberately has none: a customer who has decided to buy
 * should meet the form, not a two-second reveal. Sections gate themselves on
 * `window.__btbPreloading`, which is simply false when no Preloader mounts, so the rest
 * of the page behaves normally.
 *
 * noindex: a checkout has nothing to say to a search engine, and the order page it leads
 * to is private. */

import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import Checkout from "../_sections/Checkout";
import Footer from "../_sections/Footer";

export const metadata: Metadata = {
  title: "Checkout — Beyond The Body",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <Checkout />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
