"use client";

/* One SKU's price + availability. Lives under /admin/products because a price is a fact
   about a product, and the client asked for one screen per product rather than one screen
   per kind-of-field (2026-08-12). Moved here verbatim from the old /admin/prices table. */

import { useActionState } from "react";
import { updatePriceAction, type PriceFormState } from "./price-actions";

type Props = {
  sku: string;
  /* The scent's name is the page's <h1> on the product screen, so the row leads with the
     SIZE — repeating "Desir" down a column of Desir's own sizes is noise. `productName` is
     still taken, for the aria-labels: a screen reader arriving at this input out of context
     needs "Price in rupees for Desir 100 ml", not "price". */
  productName: string;
  sizeLabel: string;
  priceRupees: string;
  status: string;
};

const STATUSES = [
  { value: "active", label: "Active — on sale" },
  { value: "sold_out", label: "Sold out — shown, not buyable" },
  { value: "hidden", label: "Hidden — not shown" },
  { value: "discontinued", label: "Discontinued" },
];

export default function PriceRow({ sku, productName, sizeLabel, priceRupees, status }: Props) {
  const [state, formAction, pending] = useActionState<PriceFormState, FormData>(
    updatePriceAction,
    {}
  );

  return (
    <tr>
      <td>
        <strong>{sizeLabel}</strong>
        <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>{sku}</div>
      </td>
      <td colSpan={3}>
        <form action={formAction} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="sku" value={sku} />

          <label className="adm__label" htmlFor={`price-${sku}`} style={{ minWidth: 0 }}>
            <span className="sr-only">Price for {sku}</span>
          </label>
          <input
            className="adm__input"
            id={`price-${sku}`}
            name="price"
            defaultValue={priceRupees}
            placeholder="Price on request"
            inputMode="decimal"
            aria-label={`Price in rupees for ${productName} ${sizeLabel}`}
            style={{ width: 130 }}
            disabled={pending}
          />

          <select
            className="adm__input"
            name="status"
            defaultValue={status}
            aria-label={`Availability for ${productName} ${sizeLabel}`}
            disabled={pending}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <input
            className="adm__input"
            name="note"
            placeholder="Reason (optional)"
            aria-label={`Reason for changing ${sku}`}
            style={{ width: 170 }}
            disabled={pending}
          />

          <button className="adm__btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>

          {state.ok && (
            <span role="status" style={{ color: "#4a6b46", fontSize: 12 }}>
              {state.ok}
            </span>
          )}
          {state.error && (
            <span role="alert" style={{ color: "#8a4a4a", fontSize: 12 }}>
              {state.error}
            </span>
          )}
        </form>
      </td>
    </tr>
  );
}
