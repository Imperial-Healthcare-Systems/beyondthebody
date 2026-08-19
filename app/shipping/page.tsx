import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import Footer from "../_sections/Footer";
import LegalPage, { Todo } from "../_sections/LegalPage";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Shipping — Beyond The Body",
  description: "How Beyond The Body sends its fragrances, what it costs, and how to follow a parcel.",
};

/* Revalidated like the rest of the editorial site, so a change to the shipping charge in
   admin reaches this page without a deploy. The figures below are READ FROM THE SAME
   SETTINGS CHECKOUT USES — a shipping page that disagrees with the checkout total is the
   classic way a shop ends up arguing with a customer who is right. */
export const revalidate = 3600;

const inr = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;

export default async function ShippingPage() {
  const settings = await getSettings();

  return (
    <>
      <Nav />
      <main id="top">
        <LegalPage eyebrow="Legal" title="Shipping" updated="11 August 2026">
          <p>
            Everything is packed by hand at the house and sent from India. What follows is
            what it costs and what to expect.
          </p>

          <h2>What delivery costs</h2>
          <p>
            A flat <strong>{inr(settings.shipping_flat_minor)}</strong> on every order,
            anywhere in India.{" "}
            {settings.shipping_free_above_minor === null ? (
              <>There is no free-delivery threshold.</>
            ) : (
              <>
                Delivery is free on orders over{" "}
                <strong>{inr(settings.shipping_free_above_minor)}</strong>.
              </>
            )}
            {settings.cod_fee_minor > 0 && (
              <>
                {" "}
                Choosing cash on delivery adds{" "}
                <strong>{inr(settings.cod_fee_minor)}</strong>.
              </>
            )}
          </p>
          <p>
            The exact total, including delivery, is shown at checkout before you confirm
            anything.
          </p>

          <h2>How long it takes</h2>
          <p>
            Orders are packed <Todo>packing time, to confirm</Todo> and delivered in{" "}
            <Todo>delivery window, to confirm</Todo> to most Indian addresses.{" "}
            <Todo>any regions that take longer, to confirm</Todo>
          </p>
          <p>
            We write to you when the parcel leaves us, with the courier&rsquo;s name and a
            tracking number. Every order also has its own page, linked from the confirmation
            email, which shows where it has got to.
          </p>

          <h2>Where we send</h2>
          <p>
            Across India. <Todo>international shipping — offered or not, to confirm</Todo>
          </p>

          <h2>Cash on delivery</h2>
          <p>
            Available across India. The full amount is paid to the courier when the parcel
            arrives &mdash; please keep it ready, as couriers do not carry change. If nobody
            is there to receive it, the courier will try again{" "}
            <Todo>number of re-attempts, to confirm</Todo> before the parcel comes back to
            us.
          </p>

          <h2>If a parcel is late, lost or damaged</h2>
          <p>
            Write to <a href="mailto:hello@beyondthebody.com">hello@beyondthebody.com</a>{" "}
            with your order number and we will chase the courier ourselves. A bottle that
            arrives damaged is replaced &mdash; see{" "}
            <a href="/refunds">returns and refunds</a>.
          </p>
        </LegalPage>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
