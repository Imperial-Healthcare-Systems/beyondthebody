"use client";

/* /checkout — the order form.
 *
 * Deliberately one quiet column. Everywhere else on this site the motion is the product;
 * here the customer is typing an address with a card in their hand, and choreography
 * would be something to sit through rather than something to enjoy. The only animation
 * is the total settling when it changes.
 *
 * THE SERVER DECIDES THE PRICE. Every figure on this page comes from /api/v1/cart/quote,
 * not from the bag in localStorage — a bag can be weeks old. The prices the bag remembers
 * are sent along for exactly one purpose: so the server can say "this changed" before the
 * customer commits, rather than after. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../_components/CartProvider";
import { INDIAN_STATES } from "@/lib/address";
import "./checkout.css";

const inr = (minor: number) => `₹ ${(minor / 100).toLocaleString("en-IN")}`;

type QuoteLine = {
  sku: string;
  name: string;
  size: string;
  unitPriceMinor: number;
  qty: number;
  lineTotalMinor: number;
  issues: { code: string; message: string; previousPriceMinor?: number }[];
};

type Quote = {
  lines: QuoteLine[];
  dropped: { sku: string; reason: string; message: string }[];
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxInclusive: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  storeOpen: boolean;
  needsReview: boolean;
};

type PaymentMethod = "cod" | "prepaid";

/* Razorpay Checkout is loaded from their CDN — it is a payment sheet, and self-hosting it
   would mean shipping a stale copy of somebody else's security-critical code. Loaded ONLY
   on this page and only once the customer has chosen to pay by card, so the rest of the
   site carries no third-party script at all. */
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const FIELDS = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  notes: "",
};

export default function Checkout() {
  const { items, setQty, remove } = useCart();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [form, setForm] = useState(FIELDS);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* One key per bag. Retrying a submit — a double click, a dropped connection — reuses
     it and gets the SAME order back instead of a second one. Changing the bag mints a
     new one, because that genuinely is a different order. */
  const bagSignature = useMemo(
    () => items.map((i) => `${i.sku}:${i.qty}`).sort().join("|"),
    [items]
  );
  const idempotencyKey = useRef<string>("");
  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
  }, [bagSignature]);

  const payload = useMemo(
    () =>
      items.map((i) => ({
        sku: i.sku,
        qty: i.qty,
        expectedPriceMinor: i.price == null ? null : Math.round(i.price * 100),
      })),
    [items]
  );

  /* Which request is current. Picking a state re-quotes, and a slow earlier response
     must not land on top of a newer one — that would show a total for a different
     address than the one selected. */
  const latestQuote = useRef(0);

  const refreshQuote = useCallback(
    async (state?: string, paymentMethod: PaymentMethod = "cod") => {
      const ticket = ++latestQuote.current;

      /* Nothing sets state before the first await, deliberately: this runs from an effect
         on every bag or state change, and a synchronous setState there cascades a render
         each time. The previous total stays on screen until the new one arrives, which
         also stops the figures flickering to "…" every time a field changes. */
      try {
        const res = await fetch("/api/v1/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: payload,
            paymentMethod,
            ...(state ? { state } : {}),
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const next = await res.json();

        if (ticket !== latestQuote.current) return; // a newer quote won
        setQuote(next);
        setQuoteFailed(false);
      } catch {
        /* No total is better than a wrong total: the form stays, the figures do not. */
        if (ticket === latestQuote.current) setQuoteFailed(true);
      }
    },
    [payload]
  );

  useEffect(() => {
    /* Re-quotes on bag change, on state change (state decides GST place of supply) and on
       payment method (COD can carry a fee); every other keystroke leaves the total alone.
       The rule cannot see through the await inside refreshQuote: every setState there
       happens after the fetch resolves, so there is no synchronous cascade to avoid.
       Fetching remote data is what an effect is for. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (payload.length > 0) void refreshQuote(form.state || undefined, method);
  }, [refreshQuote, form.state, method, payload.length]);

  const set = (key: keyof typeof FIELDS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  /* If the client switches COD off while somebody is mid-checkout, the choice they made
     is no longer available. Derived rather than corrected with an effect: there is no
     moment where the form is showing one method and about to submit another. */
  const chosen: PaymentMethod =
    quote && !quote.codAvailable && quote.prepaidAvailable ? "prepaid" : method;

  /* Open Razorpay's payment sheet for an order that already exists on our side.
   *
   * Nothing here decides whether the order is paid. The handler tells our server what the
   * gateway told the browser, the server checks it against Razorpay, and the webhook
   * settles it regardless of whether any of this runs — a customer who closes the tab
   * mid-payment still gets their order. */
  async function payWithRazorpay(session: {
    razorpayKeyId: string;
    razorpayOrderId: string;
    amountMinor: number;
    orderNumber: string;
    statusUrl: string;
    prefill?: { name?: string; email?: string; contact?: string };
  }) {
    const ready = await loadRazorpay();
    if (!ready) {
      setError(
        "The payment window couldn't load. Check your connection, or choose cash on delivery."
      );
      return;
    }

    const checkout = new window.Razorpay!({
      key: session.razorpayKeyId,
      order_id: session.razorpayOrderId,
      amount: session.amountMinor,
      currency: "INR",
      name: "Beyond The Body",
      description: session.orderNumber,
      prefill: session.prefill ?? {},
      theme: { color: "#4E212D" },

      handler: async (response: Record<string, string>) => {
        try {
          await fetch("/api/v1/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
        } catch {
          /* Swallowed on purpose. The webhook is what actually completes the order, so a
             failed confirmation call must not tell a customer who has paid that
             something went wrong. The order page shows the real state. */
        }
        window.location.href = `${session.statusUrl}?placed=1`;
      },

      modal: {
        ondismiss: () => {
          /* The order exists and is holding stock; it expires by itself in half an hour
             if nothing is paid. Say so plainly rather than leaving a dead form. */
          setSubmitting(false);
          setError(
            "Payment wasn't completed. Your order is held for 30 minutes — try again, or choose cash on delivery."
          );
        },
      },
    });

    checkout.open();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          items: payload,
          email: form.email,
          phone: form.phone,
          paymentMethod: chosen,
          shippingAddress: {
            name: form.name,
            line1: form.line1,
            line2: form.line2 || undefined,
            landmark: form.landmark || undefined,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            country: "IN",
          },
          notes: form.notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        /* A price or stock change is the one failure the customer can act on, so show
           them the new figures immediately rather than making them hunt for what moved. */
        if (data?.error?.code === "price_changed" || data?.error?.code === "out_of_stock") {
          await refreshQuote(form.state || undefined, chosen);
        }
        return;
      }

      if (chosen === "prepaid") {
        await payWithRazorpay(data);
        return;
      }

      /* Leave via the browser, not the router: the confirmation page is its own document
         and every navigation on this site is a full load by design. The bag is cleared by
         the confirmation page, so a failed navigation never loses it. */
      window.location.href = `${data.statusUrl}?placed=1`;
    } catch {
      setError("We couldn't reach the house. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Empty bag ─────────────────────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <section className="co" data-theme="light">
        <div className="co__inner co__inner--empty">
          <p className="co__eyebrow">Checkout</p>
          <h1 className="co__title">Your bag is empty.</h1>
          <p className="co__lede">A house that begins with scent.</p>
          <a className="co__btn co__btn--ghost" href="/collection">
            See the collection
          </a>
        </div>
      </section>
    );
  }

  const closed = quote?.storeOpen === false;

  return (
    <section className="co" data-theme="light">
      <div className="co__inner">
        <header className="co__head">
          <p className="co__eyebrow">Checkout</p>
          <h1 className="co__title">Your order</h1>
        </header>

        <div className="co__grid">
          {/* ── The bag ───────────────────────────────────────────────────── */}
          <aside className="co__summary" aria-label="Order summary">
            <ul className="co__lines">
              {(quote?.lines ?? []).map((line) => (
                <li className="co__line" key={line.sku}>
                  <div className="co__linebody">
                    <span className="co__name">{line.name}</span>
                    <span className="co__size">{line.size}</span>
                    <div className="co__qty" aria-label={`Quantity of ${line.name}`}>
                      <button type="button" aria-label="Decrease" onClick={() => setQty(line.sku, line.qty - 1)}>
                        −
                      </button>
                      <span aria-live="polite">{line.qty}</span>
                      <button type="button" aria-label="Increase" onClick={() => setQty(line.sku, line.qty + 1)}>
                        +
                      </button>
                    </div>
                    {line.issues.map((issue) => (
                      <p className="co__issue" key={issue.code} role="status">
                        {issue.message}
                        {issue.previousPriceMinor != null && (
                          <>
                            {" "}
                            <span className="co__was">{inr(issue.previousPriceMinor)}</span>{" "}
                            {inr(line.unitPriceMinor)}
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                  <span className="co__lineprice">{inr(line.lineTotalMinor)}</span>
                </li>
              ))}
            </ul>

            {quote?.dropped.map((d) => (
              <p className="co__dropped" key={d.sku} role="status">
                {d.message}{" "}
                <button type="button" className="co__link" onClick={() => remove(d.sku)}>
                  Remove
                </button>
              </p>
            ))}

            {quoteFailed && (
              <p className="co__issue" role="alert">
                We couldn&rsquo;t price your bag just now. Reload the page to try again.
              </p>
            )}

            {quote && (
              <dl className="co__totals" aria-live="polite">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{inr(quote.subtotalMinor)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{quote.shippingMinor === 0 ? "Included" : inr(quote.shippingMinor)}</dd>
                </div>
                {quote.codFeeMinor > 0 && (
                  <div>
                    <dt>Cash on delivery</dt>
                    <dd>{inr(quote.codFeeMinor)}</dd>
                  </div>
                )}
                {quote.taxMinor > 0 && (
                  <div>
                    <dt>GST{quote.taxInclusive ? " (included)" : ""}</dt>
                    <dd>{inr(quote.taxMinor)}</dd>
                  </div>
                )}
                <div className="co__total">
                  <dt>Total</dt>
                  <dd>{inr(quote.totalMinor)}</dd>
                </div>
              </dl>
            )}
          </aside>

          {/* ── The form ──────────────────────────────────────────────────── */}
          <form className="co__form" onSubmit={submit} noValidate={false}>
            <fieldset className="co__set" disabled={submitting || closed}>
              <legend className="co__legend">Where it goes</legend>

              <label className="co__field">
                <span className="co__label">Full name</span>
                <input className="co__input" name="name" value={form.name} onChange={set("name")} required maxLength={120} autoComplete="name" />
              </label>

              <div className="co__row">
                <label className="co__field">
                  <span className="co__label">Mobile</span>
                  <input className="co__input" name="phone" value={form.phone} onChange={set("phone")} required inputMode="numeric" autoComplete="tel" placeholder="10 digits" />
                </label>
                <label className="co__field">
                  <span className="co__label">Email</span>
                  <input className="co__input" name="email" type="email" value={form.email} onChange={set("email")} required maxLength={254} autoComplete="email" />
                </label>
              </div>

              <label className="co__field">
                <span className="co__label">Address</span>
                <input className="co__input" name="line1" value={form.line1} onChange={set("line1")} required maxLength={180} autoComplete="address-line1" placeholder="Flat, building, street" />
              </label>

              <div className="co__row">
                <label className="co__field">
                  <span className="co__label">Area <span className="co__opt">optional</span></span>
                  <input className="co__input" name="line2" value={form.line2} onChange={set("line2")} maxLength={180} autoComplete="address-line2" />
                </label>
                <label className="co__field">
                  <span className="co__label">Landmark <span className="co__opt">optional</span></span>
                  <input className="co__input" name="landmark" value={form.landmark} onChange={set("landmark")} maxLength={120} />
                </label>
              </div>

              <div className="co__row">
                <label className="co__field">
                  <span className="co__label">City</span>
                  <input className="co__input" name="city" value={form.city} onChange={set("city")} required maxLength={80} autoComplete="address-level2" />
                </label>
                <label className="co__field">
                  <span className="co__label">PIN code</span>
                  <input className="co__input" name="pincode" value={form.pincode} onChange={set("pincode")} required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" />
                </label>
              </div>

              <label className="co__field">
                <span className="co__label">State</span>
                <select className="co__input co__select" name="state" value={form.state} onChange={set("state")} required autoComplete="address-level1">
                  <option value="" disabled>
                    Choose a state
                  </option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="co__field">
                <span className="co__label">Anything we should know <span className="co__opt">optional</span></span>
                <textarea className="co__input co__textarea" name="notes" value={form.notes} onChange={set("notes")} maxLength={500} rows={2} />
              </label>
            </fieldset>

            <fieldset className="co__set" disabled={submitting || closed}>
              <legend className="co__legend">How you pay</legend>

              {quote?.prepaidAvailable ? (
                <label className={`co__pay${chosen === "prepaid" ? " co__pay--on" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="prepaid"
                    checked={chosen === "prepaid"}
                    onChange={() => setMethod("prepaid")}
                  />
                  <span className="co__payname">Card, UPI &amp; netbanking</span>
                  <span className="co__paynote">Pay now, securely, through Razorpay.</span>
                </label>
              ) : (
                /* Present, and honest about not being ready. Hiding it would leave a
                   customer wondering whether the house takes cards at all. */
                <div className="co__pay co__pay--off" aria-disabled="true">
                  <span className="co__payname">Card, UPI &amp; netbanking</span>
                  <span className="co__paynote">Opening shortly.</span>
                </div>
              )}

              {quote?.codAvailable !== false &&
                (quote?.prepaidAvailable ? (
                  <label className={`co__pay${chosen === "cod" ? " co__pay--on" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={chosen === "cod"}
                      onChange={() => setMethod("cod")}
                    />
                    <span className="co__payname">Cash on delivery</span>
                    <span className="co__paynote">
                      Pay the courier when it reaches you.
                      {quote && quote.codFeeMinor > 0
                        ? ` A ${inr(quote.codFeeMinor)} handling charge applies.`
                        : ""}
                    </span>
                  </label>
                ) : (
                  /* The only method available — a radio button with nothing to choose
                     between is a control that does nothing. */
                  <div className="co__pay co__pay--on">
                    <span className="co__payname">Cash on delivery</span>
                    <span className="co__paynote">
                      Pay the courier when it reaches you.
                      {quote && quote.codFeeMinor > 0
                        ? ` A ${inr(quote.codFeeMinor)} handling charge applies.`
                        : ""}
                    </span>
                  </div>
                ))}

              {quote && !quote.codAvailable && !quote.prepaidAvailable && (
                <p className="co__issue" role="alert">
                  No payment method is available just now. Please try again shortly.
                </p>
              )}
            </fieldset>

            {closed && (
              <p className="co__issue" role="alert">
                The house isn&rsquo;t taking orders at the moment. Please try again shortly.
              </p>
            )}
            {error && (
              <p className="co__error" role="alert">
                {error}
              </p>
            )}

            <button
              className="co__btn"
              type="submit"
              disabled={submitting || quoteFailed || closed || !quote || quote.lines.length === 0}
            >
              {submitting
                ? chosen === "prepaid"
                  ? "Opening payment…"
                  : "Placing your order…"
                : quote
                  ? `${chosen === "prepaid" ? "Pay" : "Place order —"} ${inr(quote.totalMinor)}`
                  : "Place order"}
            </button>

            <p className="co__fineprint">
              We pack by hand and write again the moment it leaves us. Your details are used
              for this order and nothing else.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
