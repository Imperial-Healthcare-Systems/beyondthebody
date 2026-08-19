"use client";

/* Slide-in cart, mounted once globally from layout.tsx. Reads the shared cart context.
   Below the bag sits the order lookup bar — the way back to /order/[token] for anyone who
   no longer has the confirmation email. It stands outside the empty/full branch on
   purpose: the person looking for an order is, almost by definition, not shopping. */

import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { formatPrice, CURRENCY } from "../_sections/products-data";
import "./cartdrawer.css";

export default function CartDrawer() {
  const { items, count, subtotal, hasUnpriced, setQty, remove, open, setOpen } = useCart();

  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  async function trackOrder(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    /* The browser is leaving the page, so the button must STAY held — releasing it would
       flick back to "Track" for the last frame before the navigation lands. */
    let leaving = false;

    try {
      const res = await fetch("/api/v1/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();

      if (!res.ok) {
        /* Rate limited or a rejected payload — the server's own wording is the useful one. */
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
      } else if (!data?.ok) {
        setError(data?.message ?? "We couldn't find that order.");
      } else {
        /* A full document load, like every other navigation on this site: the entrance
           choreography is built around it. */
        leaving = true;
        setOpen(false);
        window.location.assign(data.url);
      }
    } catch {
      setError("We couldn't reach us just now. Please try again.");
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  return (
    <div className={`cart${open ? " is-open" : ""}`} aria-hidden={!open}>
      <button
        className="cart__scrim"
        aria-label="Close bag"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <aside className="cart__panel" role="dialog" aria-modal="true" aria-label="Your bag">
        <header className="cart__head">
          <span className="cart__title">
            Your bag{count > 0 ? ` · ${count}` : ""}
          </span>
          <button
            className="cart__close"
            type="button"
            aria-label="Close bag"
            onClick={() => setOpen(false)}
          >
            <span />
            <span />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="cart__empty">
            <p>Your bag is empty.</p>
            <span className="cart__emptysub">A house that begins with scent.</span>
          </div>
        ) : (
          <>
            <ul className="cart__list">
              {items.map((it) => (
                <li className="cart__item" key={it.sku}>
                  <div className="cart__itemhead">
                    <span className="cart__name">{it.name}</span>
                    <button
                      className="cart__remove"
                      type="button"
                      aria-label={`Remove ${it.name}`}
                      onClick={() => remove(it.sku)}
                    >
                      Remove
                    </button>
                  </div>
                  <span className="cart__size">{it.size}</span>
                  <div className="cart__itemfoot">
                    <div className="cart__qty" aria-label="Quantity">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQty(it.sku, it.qty - 1)}
                      >
                        −
                      </button>
                      <span aria-live="polite">{it.qty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQty(it.sku, it.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="cart__price">{formatPrice(it.price)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="cart__foot">
              <div className="cart__subtotal">
                <span>Subtotal</span>
                <span>
                  {subtotal == null
                    ? hasUnpriced
                      ? "Price on request"
                      : "—"
                    : `${CURRENCY} ${subtotal.toLocaleString("en-IN")}`}
                </span>
              </div>
              {/* A plain <a>, like every other navigation on this site: the full document
                  load is what the entrance choreography is built around. */}
              <a className="cart__checkout" href="/checkout" onClick={() => setOpen(false)}>
                Checkout
              </a>
              <p className="cart__note">
                {hasUnpriced
                  ? "Some pieces aren't priced yet — write to us and we'll arrange it."
                  : "Cash on delivery across India."}
              </p>
            </footer>
          </>
        )}

        {/* The lookup bar. Sits below everything, in both states of the bag. */}
        <form className="cart__track" onSubmit={trackOrder}>
          <span className="cart__tracklabel">Track your order</span>
          <div className="cart__trackfield">
            <input
              className="cart__trackinput"
              type="text"
              name="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="BTB-2026-0507"
              aria-label="Order number"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              required
              disabled={busy}
            />
          </div>
          <div className="cart__trackfield">
            <input
              className="cart__trackinput"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email you ordered with"
              aria-label="Email you ordered with"
              autoComplete="email"
              maxLength={254}
              required
              disabled={busy}
            />
            <button className="cart__trackgo" type="submit" disabled={busy}>
              {busy ? "…" : "Track"}
            </button>
          </div>
          {/* aria-live so the failure is announced: this message replaces a navigation
              that didn't happen, and a screen reader would otherwise report nothing. */}
          <p className="cart__trackmsg" role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </aside>
    </div>
  );
}
