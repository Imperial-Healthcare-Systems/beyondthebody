/* /newsletter/confirm?token=… — the destination of the confirmation email.
 *
 * Confirming on GET is deliberate. It is the convention for double opt-in, and the
 * consent evidence is that the link was delivered to that inbox and followed from it —
 * so a scanner in the recipient's own mail provider following it does not weaken the
 * record. Unsubscribe is the opposite case and requires a POST; see that page for why.
 *
 * Rendered per request: it performs a state change and must never be prerendered or
 * cached. */

import type { Metadata } from "next";
import { confirmSubscription } from "@/lib/newsletter";
import "../newsletter.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your subscription — Beyond The Body",
  /* Transactional page carrying a single-use token — keep it out of search results. */
  robots: { index: false, follow: false },
};

type Copy = { eyebrow: string; title: string; body: string };

const COPY: Record<"confirmed" | "already" | "expired" | "invalid" | "missing", Copy> = {
  confirmed: {
    eyebrow: "The house list",
    title: "You're on the list.",
    body: "Notes from the studio, and word of each drop before it opens. We write seldom, and only when there is something worth reading.",
  },
  already: {
    eyebrow: "The house list",
    title: "Already confirmed.",
    body: "You were on the list, and you still are. Nothing further to do.",
  },
  expired: {
    eyebrow: "The house list",
    title: "That link has expired.",
    body: "Confirmation links are good for forty-eight hours. Enter your address again and we'll send a fresh one.",
  },
  invalid: {
    eyebrow: "The house list",
    title: "That link is no longer valid.",
    body: "It may already have been used, or it was mistyped. Enter your address again and we'll send a new one.",
  },
  missing: {
    eyebrow: "The house list",
    title: "Something's missing.",
    body: "This page needs the link from your email. Open the message we sent and follow it from there.",
  },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let key: keyof typeof COPY = "missing";

  if (token) {
    const result = await confirmSubscription(token);
    if (result.ok) key = result.alreadyConfirmed ? "already" : "confirmed";
    else key = result.reason === "expired" ? "expired" : "invalid";
  }

  const copy = COPY[key];
  const succeeded = key === "confirmed" || key === "already";

  return (
    <main className="nlp" id="top">
      <div className="nlp__inner">
        <div className="nlp__mark" aria-hidden="true">
          ⚥
        </div>
        <p className="nlp__eyebrow">{copy.eyebrow}</p>
        <h1 className="nlp__title">{copy.title}</h1>
        <p className="nlp__body">{copy.body}</p>
        <div className="nlp__actions">
          <a className="nlp__btn" href="/">
            Enter the house
          </a>
          {!succeeded && (
            <a className="nlp__link" href="/#newsletter">
              Try again
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
