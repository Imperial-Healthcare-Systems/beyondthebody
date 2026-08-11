"use client";

/* The buttons that move an order.
 *
 * Which buttons exist is decided on the server by ALLOWED_TRANSITIONS and passed in — this
 * component renders what it is told and invents nothing. That keeps one table the single
 * answer to "what may follow what", rather than having the screen offer a move the server
 * will then refuse.
 *
 * All the transition buttons share one form and one action; the button's own name/value
 * carries which move was asked for. */

import { useActionState } from "react";
import {
  markCollectedAction,
  refundAction,
  transitionAction,
  type OrderFormState,
} from "../actions";

const LABELS: Record<string, string> = {
  processing: "Start packing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  rto_returned: "Came back to us",
};

/* Moves that put stock back and cannot be undone. Worth a second of friction. */
const CONFIRM: Record<string, string> = {
  cancelled: "Cancel this order? The stock goes back and the money, if any, does not return by itself.",
  rto_returned: "Record this as returned to us? The stock goes back.",
};

type Props = {
  id: string;
  allowed: string[];
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  refund: { maxRupees: string; note: string } | null;
  /* Set for every COD order. `collectedAt` is null until the money has been recorded —
     the panel stays on screen either way, so that pressing the button leaves a visible
     answer rather than making the whole section disappear. */
  collect: { amountLabel: string; collectedAt: string | null } | null;
};

export default function OrderControls({
  id,
  allowed,
  courier,
  trackingNumber,
  trackingUrl,
  refund,
  collect,
}: Props) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(transitionAction, {});
  const [refundState, refundFormAction, refunding] = useActionState<OrderFormState, FormData>(
    refundAction,
    {}
  );
  const [cashState, cashFormAction, recording] = useActionState<OrderFormState, FormData>(
    markCollectedAction,
    {}
  );

  const moves = allowed.filter((a) => a in LABELS);
  const shipping = moves.includes("shipped");

  return (
    <>
      {collect && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 14 }}>
            Cash on delivery
          </p>
          {collect.collectedAt ? (
            <p style={{ margin: 0 }}>
              {collect.amountLabel} recorded as collected on {collect.collectedAt}.
            </p>
          ) : (
            <form action={cashFormAction} className="adm__row">
              <input type="hidden" name="ids" value={id} />
              <button className="adm__btn" type="submit" disabled={recording}>
                {recording ? "Recording…" : `Record ${collect.amountLabel} collected`}
              </button>
              <span className="adm__note" style={{ margin: 0 }}>
                Press this when the courier remits. It records the money and leaves the
                parcel status alone.
              </span>
            </form>
          )}
          {cashState.ok && (
            <p role="status" style={{ color: "#4a6b46", fontSize: 13 }}>
              {cashState.ok}
            </p>
          )}
          {cashState.error && (
            <p className="adm__error" role="alert">
              {cashState.error}
            </p>
          )}
        </section>
      )}

      {/* Kept on screen while there is something to say, not only while there is something
          to press: the last move often empties the list of moves, and a section that
          unmounts on success takes its own confirmation with it. */}
      {(moves.length > 0 || state.ok || state.error) && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 14 }}>
            {moves.length > 0 ? "What happens next" : "Done"}
          </p>

          <form action={formAction}>
            <input type="hidden" name="id" value={id} />

            {shipping && (
              <div className="adm__row" style={{ marginBottom: 16, alignItems: "flex-end" }}>
                <label className="adm__field" style={{ margin: 0, width: 170 }}>
                  <span className="adm__label">Courier</span>
                  <input
                    className="adm__input"
                    name="courier"
                    defaultValue={courier ?? ""}
                    placeholder="Delhivery"
                    disabled={pending}
                  />
                </label>
                <label className="adm__field" style={{ margin: 0, width: 200 }}>
                  <span className="adm__label">Tracking number</span>
                  <input
                    className="adm__input"
                    name="trackingNumber"
                    defaultValue={trackingNumber ?? ""}
                    disabled={pending}
                  />
                </label>
                <label className="adm__field" style={{ margin: 0, width: 260 }}>
                  <span className="adm__label">Tracking link</span>
                  <input
                    className="adm__input"
                    name="trackingUrl"
                    defaultValue={trackingUrl ?? ""}
                    placeholder="https://…"
                    disabled={pending}
                  />
                </label>
              </div>
            )}

            <div className="adm__field" style={{ maxWidth: 520 }}>
              <span className="adm__label">Note (optional, kept on the order)</span>
              <input className="adm__input" name="note" maxLength={300} disabled={pending} />
            </div>

            <div className="adm__row">
              {moves.map((to) => (
                <button
                  key={to}
                  className={`adm__btn${to === "cancelled" || to === "rto_returned" ? " adm__btn--ghost" : ""}`}
                  type="submit"
                  name="to"
                  value={to}
                  disabled={pending}
                  onClick={(e) => {
                    if (CONFIRM[to] && !window.confirm(CONFIRM[to])) e.preventDefault();
                  }}
                >
                  {pending ? "Working…" : LABELS[to]}
                </button>
              ))}
            </div>

            {shipping && (
              <p className="adm__note">
                Marking it shipped emails the customer the tracking details.
              </p>
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
        </section>
      )}

      {refund && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 14 }}>
            Return the money
          </p>

          <form action={refundFormAction} className="adm__row" style={{ alignItems: "flex-end" }}>
            <input type="hidden" name="id" value={id} />
            <label className="adm__field" style={{ margin: 0, width: 150 }}>
              <span className="adm__label">Amount (₹)</span>
              <input
                className="adm__input"
                name="amount"
                inputMode="decimal"
                defaultValue={refund.maxRupees}
                disabled={refunding}
              />
            </label>
            <label className="adm__field" style={{ margin: 0, width: 280 }}>
              <span className="adm__label">Reason</span>
              <input className="adm__input" name="reason" maxLength={300} disabled={refunding} />
            </label>
            <button
              className="adm__btn adm__btn--ghost"
              type="submit"
              disabled={refunding}
              onClick={(e) => {
                if (!window.confirm("Send this refund? The money leaves immediately.")) {
                  e.preventDefault();
                }
              }}
            >
              {refunding ? "Sending…" : "Refund"}
            </button>
          </form>

          <p className="adm__note">{refund.note}</p>

          {refundState.ok && (
            <p role="status" style={{ color: "#4a6b46", fontSize: 13 }}>
              {refundState.ok}
            </p>
          )}
          {refundState.error && (
            <p className="adm__error" role="alert">
              {refundState.error}
            </p>
          )}
        </section>
      )}
    </>
  );
}
