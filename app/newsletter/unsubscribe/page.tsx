/* /newsletter/unsubscribe?token=… — the destination of the unsubscribe link.
 *
 * This page only ASKS. The removal happens when the button is pressed, because mail
 * clients and security scanners follow every link in a message to check it, and a
 * GET-driven unsubscribe would silently remove people who never clicked. */

import type { Metadata } from "next";
import UnsubscribeForm from "./UnsubscribeForm";
import "../newsletter.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe — Beyond The Body",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="nlp" id="top">
      <div className="nlp__inner">
        <div className="nlp__mark" aria-hidden="true">
          ⚥
        </div>
        <p className="nlp__eyebrow">The house list</p>

        {token ? (
          <>
            <h1 className="nlp__title">Leave the list?</h1>
            <p className="nlp__body">
              You&rsquo;ll stop receiving notes from the studio and word of each drop. You can
              rejoin whenever you like.
            </p>
            <UnsubscribeForm token={token} />
          </>
        ) : (
          <>
            <h1 className="nlp__title">Something&rsquo;s missing.</h1>
            <p className="nlp__body">
              This page needs the link from your email. Open the message we sent and follow it
              from there.
            </p>
            <div className="nlp__actions">
              <a className="nlp__btn" href="/">
                Return to the house
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
