/* /order/[token] — the customer's own order.
 *
 * There are no accounts, so the token in the URL is the authorisation. It is 32 bytes of
 * randomness, it appears in exactly one place a stranger cannot reach (the confirmation
 * email), and it grants read-only sight of one order. That is the whole security model,
 * and it is the same one every guest-checkout store uses.
 *
 * force-dynamic and noindex, both load-bearing: an order page must never be prerendered
 * into a shared cache, and must never be crawled. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "@/app/_components/Nav";
import SiteRuntime from "@/app/_components/SiteRuntime";
import Footer from "@/app/_sections/Footer";
import ClearBagOnPlaced from "./ClearBagOnPlaced";
import { getOrderByToken } from "@/lib/orders";
import { formatAddress, formatPhone, type Address } from "@/lib/address";
import "@/app/_sections/checkout.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order — Beyond The Body",
  robots: { index: false, follow: false, nocache: true },
};

const inr = (minor: number) => `₹ ${(minor / 100).toLocaleString("en-IN")}`;

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "long",
  timeZone: "Asia/Kolkata",
});

/* What each state means to the person who ordered, in their language rather than ours.
   `rto_returned` is worded carefully: it is a routine COD outcome, not an accusation. */
const STATUS_COPY: Record<string, { label: string; line: string }> = {
  pending_payment: { label: "Awaiting payment", line: "We'll begin as soon as the payment lands." },
  paid: { label: "Paid", line: "Thank you — we're preparing it now." },
  confirmed: { label: "Confirmed", line: "We're preparing it now, and will write when it leaves us." },
  processing: { label: "Being packed", line: "It's being packed by hand." },
  shipped: { label: "On its way", line: "It has left the house." },
  delivered: { label: "Delivered", line: "We hope it's welcome." },
  cancelled: { label: "Cancelled", line: "This order was cancelled. Nothing is owed." },
  refunded: { label: "Refunded", line: "The amount has been returned to you." },
  failed: { label: "Not completed", line: "The payment didn't complete, so nothing was charged." },
  expired: { label: "Expired", line: "This order timed out before payment. Nothing was charged." },
  rto_returned: { label: "Returned to us", line: "The parcel came back to the house. Write to us and we'll sort it out." },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { token } = await params;
  const { placed } = await searchParams;

  const found = await getOrderByToken(token);
  /* A wrong or expired token is a 404, not "access denied" — there is nothing to be
     learned from us about whether some other order exists. */
  if (!found) notFound();

  const { order, items } = found;
  const address = order.shippingAddress as Address;
  const status = STATUS_COPY[order.status] ?? { label: order.status, line: "" };
  const cod = order.paymentMethod === "cod";

  return (
    <>
      {/* Arriving here from checkout means the order exists; the bag has done its job.
          Clearing on THIS page rather than before navigating means a failed navigation
          never loses somebody's bag. */}
      {placed === "1" && <ClearBagOnPlaced />}
      <Nav />
      <main id="top">
        <section className="co" data-theme="light">
          <div className="co__inner" style={{ maxWidth: 720 }}>
            <p className="co__eyebrow">{placed === "1" ? "Thank you" : "Your order"}</p>
            <h1 className="co__title">
              {placed === "1" ? "Your order is with us." : `Order ${order.orderNumber}`}
            </h1>

            <p className="co__number" style={{ marginTop: 18 }}>
              {placed === "1" ? `Order ${order.orderNumber} · ` : ""}
              {dateFmt.format(order.placedAt)}
            </p>

            <p className="co__status">{status.label}</p>
            {status.line && <p className="co__lede">{status.line}</p>}

            {/* Only once there is something to track. A courier's name with no number
                beside it tells the customer nothing they can act on, so both the line and
                the link appear only when they would be useful. */}
            {order.trackingNumber && (
              <p className="co__lede">
                {order.courier ? `${order.courier} · ` : ""}
                {order.trackingUrl ? (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    {order.trackingNumber}
                  </a>
                ) : (
                  order.trackingNumber
                )}
              </p>
            )}

            <section className="co__panel">
              <h2>What you ordered</h2>
              <ul className="co__lines">
                {items.map((item) => (
                  <li className="co__line" key={item.id}>
                    <div className="co__linebody">
                      <span className="co__name">{item.nameSnapshot}</span>
                      <span className="co__size">
                        {item.sizeSnapshot}
                        {item.qty > 1 ? ` · ${item.qty}` : ""}
                      </span>
                    </div>
                    <span className="co__lineprice">{inr(item.lineTotalMinor)}</span>
                  </li>
                ))}
              </ul>

              <dl className="co__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{inr(order.subtotalMinor)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{order.shippingMinor === 0 ? "Included" : inr(order.shippingMinor)}</dd>
                </div>
                {order.codFeeMinor > 0 && (
                  <div>
                    <dt>Cash on delivery</dt>
                    <dd>{inr(order.codFeeMinor)}</dd>
                  </div>
                )}
                {order.taxMinor > 0 && (
                  <div>
                    <dt>GST{order.taxInclusive ? " (included)" : ""}</dt>
                    <dd>{inr(order.taxMinor)}</dd>
                  </div>
                )}
                <div className="co__total">
                  <dt>{cod ? "Due on delivery" : "Total"}</dt>
                  <dd>{inr(order.totalMinor)}</dd>
                </div>
              </dl>
            </section>

            <section className="co__panel">
              <h2>Sending to</h2>
              <address className="co__address">
                {formatAddress(address).map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
                {formatPhone(order.phone)}
              </address>
            </section>

            <p className="co__fineprint">
              Keep this page — it stays up to date as your order moves. We&rsquo;ve also sent it
              to {order.email}. Anything at all, write to us and quote {order.orderNumber}.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
