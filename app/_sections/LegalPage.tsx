import "./legal.css";

/* The shell every legal page shares.
 *
 * These four pages exist because Razorpay will not activate a live account without them
 * (HANDOVER §A5) and because a customer is entitled to know what is done with their
 * address. They are written to be ACCURATE about the mechanics the code actually
 * implements — what is collected, what is stored, who is paid, what a cookie is used for —
 * and to be visibly INCOMPLETE everywhere a fact belongs to the house rather than to the
 * software.
 *
 * That distinction is the whole design of these pages. Nothing here invents a refund
 * window, a delivery time, a registered address or a jurisdiction; those are the client's
 * to state, and a plausible-sounding guess in a legal document is worse than a blank,
 * because a blank gets filled in and a guess gets relied upon. */

export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className="lg__todo" title="Awaiting confirmation from Beyond The Body">
      « {children} »
    </mark>
  );
}

export default function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lg" data-theme="light">
      <div className="lg__inner">
        <p className="lg__eyebrow">{eyebrow}</p>
        <h1 className="lg__title">{title}</h1>
        <p className="lg__meta">Last updated {updated}</p>
        <div className="lg__body">{children}</div>
        <p className="lg__note">
          Questions about anything on this page: write to{" "}
          <a href="mailto:hello@beyondthebody.com">hello@beyondthebody.com</a>.
        </p>
      </div>
    </section>
  );
}
