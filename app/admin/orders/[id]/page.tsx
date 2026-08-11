/* /admin/orders/[id] — one order, everything about it.
 *
 * Composed so the top of the page answers a phone call: who, what, where, how much, and
 * where the parcel is. The controls come after, because reading precedes acting. */

import { notFound } from "next/navigation";
import type { Address } from "@/lib/address";
import { formatAddress, formatPhone } from "@/lib/address";
import { requireAdminPage } from "@/lib/admin-session";
import { ALLOWED_TRANSITIONS, getOrderDetail, readable } from "@/lib/fulfilment";
import { isRazorpayConfigured } from "@/lib/razorpay";
import OrderControls from "./OrderControls";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const inr = (minor: number) => `₹ ${(minor / 100).toLocaleString("en-IN")}`;
const when = (d: Date | null) => (d ? dateFmt.format(d) : "—");

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("owner");
  const { id } = await params;

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payments } = detail;
  const ship = order.shippingAddress as Address;
  const bill = order.billingAddress as Address | null;

  const captured = payments.find((p) => p.status === "captured");
  const canRefund =
    order.paymentMethod === "prepaid" &&
    !!captured &&
    order.status !== "refunded" &&
    isRazorpayConfigured();

  /* The cash panel shows for every live COD order, whether or not the money is in — so
     that recording it leaves an answer on screen instead of removing the panel. */
  const showCash =
    order.paymentMethod === "cod" &&
    (order.paidAt !== null ||
      ["confirmed", "processing", "shipped", "delivered"].includes(order.status));

  return (
    <main className="adm__main">
      <p style={{ marginBottom: 8 }}>
        <a href="/admin/orders" style={{ color: "var(--adm-muted)", fontSize: 12 }}>
          ← All orders
        </a>
      </p>

      <h1 className="adm__h1">{order.orderNumber}</h1>
      <p className="adm__sub">
        {readable(order.status)} · placed {when(order.placedAt)} ·{" "}
        {order.paymentMethod === "cod" ? "cash on delivery" : "prepaid"}
      </p>

      <section className="adm__panel">
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220 }}>
            <p className="adm__label">Ships to</p>
            <p style={{ margin: "6px 0 0" }}>
              {formatAddress(ship).map((line) => (
                <span key={line} style={{ display: "block" }}>
                  {line}
                </span>
              ))}
            </p>
          </div>

          <div style={{ minWidth: 220 }}>
            <p className="adm__label">Reachable at</p>
            <p style={{ margin: "6px 0 0" }}>
              <span style={{ display: "block" }}>{order.email}</span>
              <span style={{ display: "block" }}>{formatPhone(order.phone.slice(-10))}</span>
            </p>
          </div>

          {bill && (
            <div style={{ minWidth: 220 }}>
              <p className="adm__label">Bill to</p>
              <p style={{ margin: "6px 0 0" }}>
                {formatAddress(bill).map((line) => (
                  <span key={line} style={{ display: "block" }}>
                    {line}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        {order.notes && <p className="adm__note">Notes: {order.notes}</p>}
      </section>

      <section className="adm__panel">
        <div className="adm__scroll">
          <table className="adm__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style={{ textAlign: "right" }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <strong>{it.nameSnapshot}</strong>
                    <div style={{ color: "var(--adm-muted)", fontSize: 12 }}>
                      {it.sizeSnapshot} · {it.sku} · {inr(it.unitPriceMinor)} each
                    </div>
                  </td>
                  <td>{it.qty}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {inr(it.lineTotalMinor)}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ color: "var(--adm-muted)" }}>
                  Subtotal
                </td>
                <td style={{ textAlign: "right" }}>{inr(order.subtotalMinor)}</td>
              </tr>
              {order.shippingMinor > 0 && (
                <tr>
                  <td colSpan={2} style={{ color: "var(--adm-muted)" }}>
                    Delivery
                  </td>
                  <td style={{ textAlign: "right" }}>{inr(order.shippingMinor)}</td>
                </tr>
              )}
              {order.codFeeMinor > 0 && (
                <tr>
                  <td colSpan={2} style={{ color: "var(--adm-muted)" }}>
                    Cash-on-delivery fee
                  </td>
                  <td style={{ textAlign: "right" }}>{inr(order.codFeeMinor)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td style={{ textAlign: "right" }}>
                  <strong>{inr(order.totalMinor)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 14 }}>
          Where it has been
        </p>
        <div className="adm__stats">
          <div className="adm__stat">
            <div className="adm__statlabel">Paid</div>
            <div>{when(order.paidAt)}</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statlabel">Shipped</div>
            <div>{when(order.shippedAt)}</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statlabel">Delivered</div>
            <div>{when(order.deliveredAt)}</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statlabel">Cancelled</div>
            <div>{when(order.cancelledAt)}</div>
          </div>
        </div>

        {(order.courier || order.trackingNumber) && (
          <p className="adm__note">
            {order.courier ?? "Courier"} ·{" "}
            {order.trackingUrl ? (
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                {order.trackingNumber ?? "track"} ↗
              </a>
            ) : (
              (order.trackingNumber ?? "—")
            )}
          </p>
        )}

        <p className="adm__note">
          The customer sees this at{" "}
          <a href={`/order/${order.accessToken}`} target="_blank" rel="noopener noreferrer">
            /order/…{order.accessToken.slice(-6)} ↗
          </a>
        </p>
      </section>

      {payments.length > 0 && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 14 }}>
            Payment attempts
          </p>
          <div className="adm__scroll">
            <table className="adm__table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Gateway id</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{when(p.createdAt)}</td>
                    <td>
                      <span
                        className={`adm__tag adm__tag--${
                          p.status === "captured"
                            ? "confirmed"
                            : p.status === "failed" || p.status === "refunded"
                              ? "unsubscribed"
                              : "pending"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.status === "captured" && !p.signatureVerified && (
                        <div style={{ color: "#8a6a2a", fontSize: 12 }}>signature unchecked</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{inr(p.amountMinor)}</td>
                    <td>{p.method ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--adm-muted)" }}>
                      {p.providerPaymentId ?? p.providerOrderId ?? "—"}
                      {p.errorDescription && (
                        <div style={{ color: "#8a4a4a" }}>{p.errorDescription}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <OrderControls
        id={order.id}
        allowed={ALLOWED_TRANSITIONS[order.status]}
        courier={order.courier}
        trackingNumber={order.trackingNumber}
        trackingUrl={order.trackingUrl}
        collect={
          showCash
            ? {
                amountLabel: inr(order.totalMinor),
                collectedAt: order.paidAt ? dateFmt.format(order.paidAt) : null,
              }
            : null
        }
        refund={
          canRefund
            ? {
                maxRupees: String(order.totalMinor / 100),
                note: `Up to ${inr(captured!.amountMinor)} can be returned. A full refund settles the order; a partial one leaves it where it is.`,
              }
            : null
        }
      />
    </main>
  );
}
