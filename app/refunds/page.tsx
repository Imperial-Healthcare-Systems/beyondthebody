import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import Footer from "../_sections/Footer";
import LegalPage, { Todo } from "../_sections/LegalPage";

export const metadata: Metadata = {
  title: "Returns & refunds — Beyond The Body",
  description:
    "Cancelling an order, returning a fragrance, and how refunds are made at Beyond The Body.",
};

export default function RefundsPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <LegalPage eyebrow="Legal" title="Returns &amp; refunds" updated="11 August 2026">
          <p>
            Perfume is one of the few things that cannot be tried before it is bought, and a
            bottle that has been opened cannot be sold again. What follows is where that
            leaves us both.
          </p>

          <h2>Cancelling before it ships</h2>
          <p>
            Write to <a href="mailto:hello@beyondthebody.com">hello@beyondthebody.com</a>{" "}
            with your order number. If the parcel has not yet left the house we will cancel
            it, and anything paid is returned in full. Once it has been handed to a courier
            it is a return rather than a cancellation.
          </p>

          <h2>If something is wrong with what arrived</h2>
          <p>
            A bottle damaged in transit, a leak, a broken seal, or the wrong item &mdash; tell
            us within <Todo>reporting window, to confirm</Todo> of delivery, with a
            photograph, and we will replace it or refund it in full, whichever you prefer.
            Nothing is charged for sending the replacement.
          </p>

          <h2>If you have simply changed your mind</h2>
          <p>
            <Todo>
              whether unopened bottles may be returned, within how many days, and who pays
              the return postage &mdash; to confirm
            </Todo>
          </p>
          <p>
            An opened bottle cannot be returned, for reasons of hygiene and because it
            cannot be resold. This does not affect anything above about a fault.
          </p>

          <h2>How a refund is made</h2>
          <ul>
            <li>
              <strong>Card, UPI or netbanking</strong> &mdash; returned to the same account it
              came from, through Razorpay. Your bank then takes{" "}
              <Todo>typical bank clearing time, to confirm</Todo> to show it.
            </li>
            <li>
              <strong>Cash on delivery</strong> &mdash; the money never reached us through the
              website, so a refund is made by bank transfer. We will ask you for the
              account.
            </li>
          </ul>
          <p>
            Delivery charges are refunded when the fault was ours, and{" "}
            <Todo>whether delivery is refunded on a change of mind &mdash; to confirm</Todo>{" "}
            otherwise.
          </p>

          <h2>Parcels that come back to us</h2>
          <p>
            If a cash-on-delivery parcel is refused or nobody is there to receive it, it
            returns to the house and the order ends there. Nothing is charged, because
            nothing was paid. You are welcome to order again.
          </p>
        </LegalPage>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
