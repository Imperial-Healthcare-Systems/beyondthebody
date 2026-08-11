import type { Metadata } from "next";
import Nav from "../_components/Nav";
import SiteRuntime from "../_components/SiteRuntime";
import Footer from "../_sections/Footer";
import LegalPage, { Todo } from "../_sections/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — Beyond The Body",
  description:
    "What Beyond The Body collects, why, and what is never done with it. No advertising trackers, no analytics, no data sold.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main id="top">
        <LegalPage eyebrow="Legal" title="Privacy" updated="11 August 2026">
          <p>
            This page describes what this website collects, why it is collected and how long
            it is kept. It is written to be read, not to be survived.
          </p>

          <h2>What is collected, and when</h2>
          <p>
            Nothing is collected from you for simply reading. There are no accounts on this
            site — you are never asked to make one, and no password is stored anywhere.
          </p>
          <ul>
            <li>
              <strong>When you place an order:</strong> your name, email address, telephone
              number, delivery address, an optional billing address, and anything you type
              into the order notes. Along with them, what you bought and what you paid.
            </li>
            <li>
              <strong>When you join the house list:</strong> your email address and nothing
              else. You are then emailed a link, and you are not on the list until you
              follow it — so an address entered by someone other than its owner never
              becomes a subscription.
            </li>
            <li>
              <strong>When you write to us:</strong> whatever your email contains.
            </li>
          </ul>

          <h2>What is not collected</h2>
          <p>
            There are no analytics on this site, no advertising pixels, no social media
            trackers, and no third-party scripts that watch what you read. Nothing about
            your visit is shared with an advertising network, because none is present.
          </p>

          <h3>Cookies and local storage</h3>
          <p>
            No cookie is set for advertising or measurement. Two things are stored in your
            own browser and never sent to us as a profile:
          </p>
          <ul>
            <li>
              <strong>Your bag</strong> — what you have added, kept in your browser&rsquo;s
              local storage so it survives a reload. It is cleared when an order is placed.
            </li>
            <li>
              <strong>Your choice of light or dark</strong> — a single stored preference.
            </li>
          </ul>
          <p>
            One genuine cookie exists: a sign-in session for the house&rsquo;s own staff at
            the admin address. If you are not staff, it is never set for you.
          </p>

          <h2>Who else sees it</h2>
          <ul>
            <li>
              <strong>Razorpay</strong>, if you pay by card, UPI or netbanking. Your card
              details are entered on Razorpay&rsquo;s own payment sheet and never reach this
              website or its servers &mdash; we receive only a confirmation that a payment
              succeeded, its amount, and its reference. Razorpay&rsquo;s handling of your
              payment data is governed by their privacy policy.
            </li>
            <li>
              <strong>The courier</strong> who brings your order, who is given your name,
              address and phone number, because a parcel cannot arrive without them.
            </li>
            <li>
              <strong>Our email provider</strong>, which carries order confirmations and
              house-list messages.
            </li>
          </ul>
          <p>
            Your information is never sold, rented, or given to anyone for their own
            marketing. There is no arrangement under which that could happen.
          </p>

          <h2>Where it is kept, and for how long</h2>
          <p>
            Order records are held in the house&rsquo;s own database, hosted{" "}
            <Todo>hosting location and provider, to confirm</Todo>. Orders are kept as
            long as they may be needed for accounts, tax and any question you later ask
            about a purchase &mdash; <Todo>retention period, to confirm</Todo>. House-list
            addresses are kept until you unsubscribe, which every message we send carries a
            link to do.
          </p>

          <h2>What you can ask for</h2>
          <p>
            You may ask what is held about you, ask for it to be corrected, or ask for it to
            be deleted &mdash; subject to records we are required to keep for tax and
            accounting. Write to{" "}
            <a href="mailto:hello@beyondthebody.com">hello@beyondthebody.com</a> and we will
            answer within <Todo>response time, to confirm</Todo>.
          </p>

          <h2>Who we are</h2>
          <p>
            <Todo>registered legal name</Todo>, <Todo>registered address</Todo>. Grievance
            officer, as required under the Information Technology Rules:{" "}
            <Todo>name and contact address of the grievance officer</Todo>.
          </p>
        </LegalPage>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
