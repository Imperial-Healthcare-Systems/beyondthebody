"use client";

/* Slide-in cart, mounted once globally from layout.tsx. Reads the shared cart context.
   Checkout is intentionally a disabled stub — front-end cart only for now (no backend). */

import { useEffect } from "react";
import { useCart } from "./CartProvider";
import { formatPrice, CURRENCY } from "../_sections/products-data";
import "./cartdrawer.css";

export default function CartDrawer() {
  const { items, count, subtotal, hasUnpriced, setQty, remove, open, setOpen } = useCart();

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

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
      </aside>
    </div>
  );
}
