"use client";

/* The order list, with the one bulk action the client will actually use daily.
 *
 * COD remittance arrives as a batch — a courier settles a week of orders at once — so
 * ticking six boxes and pressing one button is the real workflow. Forcing six visits to
 * six detail pages would be the kind of admin screen people stop using. */

import { useActionState, useState } from "react";
import { markCollectedAction, type OrderFormState } from "./actions";

export type OrderRow = {
  id: string;
  orderNumber: string;
  placedAt: string;
  email: string;
  phone: string;
  city: string;
  paymentMethod: "prepaid" | "cod";
  status: string;
  statusLabel: string;
  tone: "good" | "wait" | "bad";
  totalLabel: string;
  /* COD, delivered-or-on-its-way, and the money hasn't been recorded yet. */
  awaitingCash: boolean;
};

export default function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    markCollectedAction,
    {}
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const collectable = rows.filter((r) => r.awaitingCash);
  /* Counted against the rows still on screen rather than the raw set, so that after a
     successful submit — when those rows come back with the money recorded — the count
     falls to zero on its own instead of holding ids that no longer mean anything. */
  const selected = collectable.filter((r) => picked.has(r.id)).length;

  function toggle(id: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <form action={formAction}>
      <div className="adm__scroll">
        <table className="adm__table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <span className="sr-only">Select for cash collection</span>
              </th>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.awaitingCash ? (
                    <input
                      type="checkbox"
                      name="ids"
                      value={r.id}
                      checked={picked.has(r.id)}
                      onChange={(e) => toggle(r.id, e.currentTarget.checked)}
                      aria-label={`Record cash collected for ${r.orderNumber}`}
                      disabled={pending}
                    />
                  ) : null}
                </td>
                <td>
                  <a href={`/admin/orders/${r.id}`} style={{ color: "inherit" }}>
                    <strong>{r.orderNumber}</strong>
                  </a>
                  <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>{r.placedAt}</div>
                </td>
                <td>
                  {r.email}
                  <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>
                    {r.phone} · {r.city}
                  </div>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{r.totalLabel}</td>
                <td>
                  {r.paymentMethod === "cod" ? "Cash on delivery" : "Prepaid"}
                  {r.awaitingCash && (
                    <div style={{ color: "#8a6a2a", fontSize: 12 }}>cash not yet recorded</div>
                  )}
                </td>
                <td>
                  <span
                    className={`adm__tag adm__tag--${
                      r.tone === "good" ? "confirmed" : r.tone === "bad" ? "unsubscribed" : "pending"
                    }`}
                  >
                    {r.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {collectable.length > 0 && (
        <div className="adm__row" style={{ marginTop: 18 }}>
          <button className="adm__btn" type="submit" disabled={pending || selected === 0}>
            {pending
              ? "Recording…"
              : selected === 0
                ? "Record cash collected"
                : `Record cash for ${selected}`}
          </button>
          <span className="adm__note" style={{ margin: 0 }}>
            Tick the orders the courier has settled. This records the money; it doesn&rsquo;t
            change where the parcel is.
          </span>
        </div>
      )}

      {state.ok && (
        <p role="status" style={{ color: "#4a6b46", fontSize: 13 }}>
          {state.ok}
        </p>
      )}
      {state.error && (
        <p className="adm__error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
