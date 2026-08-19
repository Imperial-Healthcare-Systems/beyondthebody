"use client";

/* The buy control — size toggle + quantity + Add to bag. Built in Beat 0 (foundation)
   and reused inside the PDP hero/buy panel in Beat 1. Restrained, editorial register:
   quiet rules and labels, not loud ecommerce. Price shows "Price on request" until the
   client supplies numbers (placeholder era). */

import { useState } from "react";
import { useCart } from "./CartProvider";
import { formatPrice, type Product } from "../_sections/products-data";
import "./addtobag.css";

export default function AddToBag({ product }: { product: Product }) {
  const { add } = useCart();
  const [sizeIdx, setSizeIdx] = useState(0);
  const [qty, setQty] = useState(1);
  /* Clamped: sizes come from the live catalogue (admin can hide a variant), so two PDPs
     can have different counts — and client-side navigation between them keeps this
     component's state. An index picked on a two-size page must not read off the end of
     a one-size page. */
  const activeIdx = Math.min(sizeIdx, product.sizes.length - 1);
  const size = product.sizes[activeIdx];

  /* Every size hidden in admin: the scent is not buyable right now. A quiet line, not a
     broken control. */
  if (!size) {
    return (
      <div className="buy">
        <p className="buy__price buy__unavailable">Currently unavailable</p>
      </div>
    );
  }

  const onAdd = () => {
    add(
      {
        slug: product.slug,
        name: product.name,
        size: size.label,
        ml: size.ml,
        sku: size.sku,
        price: size.price,
      },
      qty
    );
  };

  return (
    <div className="buy">
      <p className="buy__price">{formatPrice(size.price)}</p>

      <div className="buy__sizes" role="radiogroup" aria-label="Size">
        {product.sizes.map((s, i) => (
          <button
            key={s.sku}
            type="button"
            role="radio"
            aria-checked={i === activeIdx}
            className={`buy__size${i === activeIdx ? " is-active" : ""}`}
            onClick={() => setSizeIdx(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="buy__row">
        <div className="buy__qty" aria-label="Quantity">
          <button
            type="button"
            className="buy__step"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="buy__qtyval" aria-live="polite">{qty}</span>
          <button
            type="button"
            className="buy__step"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(9, q + 1))}
          >
            +
          </button>
        </div>

        <button type="button" className="buy__add" onClick={onAdd}>
          Add to bag
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
