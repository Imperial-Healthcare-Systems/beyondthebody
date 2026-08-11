import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import Footer from "../_sections/Footer";
import LegalPage, { Todo } from "../_sections/LegalPage";

export const metadata: Metadata = {
  title: "Terms — Beyond The Body",
  description: "The terms on which Beyond The Body sells, and what happens when an order is placed.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <LegalPage eyebrow="Legal" title="Terms" updated="11 August 2026">
          <p>
            These terms apply to everything bought from this website. They are written
            plainly because a term nobody can read is a term nobody agreed to.
          </p>

          <h2>Who you are buying from</h2>
          <p>
            <Todo>registered legal name</Todo>, <Todo>registered address</Todo>,{" "}
            <Todo>GSTIN, if registered</Todo>. Referred to below as &ldquo;the house&rdquo;.
          </p>

          <h2>Prices</h2>
          <p>
            Prices are shown in Indian rupees and are what you pay for the goods. Delivery
            is added at checkout and shown before you confirm. The price you are charged is
            always the price calculated by the house at the moment you order &mdash; not the
            price your browser happened to be showing, which may be out of date. If those
            two differ you are told before anything is charged.
          </p>
          <p>
            Prices may change. A change never affects an order already placed.
          </p>

          <h2>Placing an order</h2>
          <p>
            Adding something to your bag is not an order. An order exists when you complete
            checkout, and you will be emailed a confirmation with a link to its status. That
            confirmation is our acceptance of your order.
          </p>
          <p>
            We may decline an order &mdash; for example where an item is no longer available,
            where a price was listed in obvious error, or where an address cannot be
            delivered to. If we do, nothing is charged, and anything already paid is
            returned in full.
          </p>

          <h2>Paying</h2>
          <ul>
            <li>
              <strong>Card, UPI and netbanking</strong> are handled by Razorpay. Your card
              details are entered on their payment sheet and never reach this website.
            </li>
            <li>
              <strong>Cash on delivery</strong> is available. The full amount is paid to the
              courier when the parcel arrives. Please have it ready &mdash; couriers do not
              carry change.
            </li>
          </ul>
          <p>
            An unpaid card order is released automatically after thirty minutes and the
            goods returned to stock. You are welcome to order again.
          </p>

          <h2>Delivery, returns and refunds</h2>
          <p>
            These have their own pages: <a href="/shipping">shipping</a> and{" "}
            <a href="/refunds">returns and refunds</a>.
          </p>

          <h2>The fragrances themselves</h2>
          <p>
            Scent behaves differently on different skin, and a composition that is
            unmistakable on one person can be quiet on another. That is the nature of
            perfume and not a fault. Anything genuinely wrong &mdash; damaged in transit, the
            wrong item, a bottle that leaked &mdash; is covered by the{" "}
            <a href="/refunds">returns page</a>.
          </p>
          <p>
            <Todo>any allergen, patch-test or age statement the house wishes to make</Todo>
          </p>

          <h2>What is ours</h2>
          <p>
            The names, photography, writing and design on this site belong to the house.
            You are welcome to share a link to any of it. Reproducing it for commercial use
            requires our permission.
          </p>

          <h2>If something goes wrong</h2>
          <p>
            Write to <a href="mailto:hello@beyondthebody.com">hello@beyondthebody.com</a>{" "}
            first &mdash; almost everything is settled that way. Failing that, these terms are
            governed by the laws of India, and the courts at{" "}
            <Todo>city of jurisdiction</Todo> have jurisdiction.
          </p>
        </LegalPage>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
