/* /admin/orders — the worklist.
 *
 * Defaults to "needs action" rather than "everything", because this page is opened to
 * answer "what do I have to do today?", not "what has ever happened?". The archive is one
 * click away; the work is on arrival. */

import { requireAdminPage } from "@/lib/admin-session";
import type { Address } from "@/lib/address";
import { listOrders, readable, type OrderStatus } from "@/lib/fulfilment";
import OrdersTable, { type OrderRow } from "./OrdersTable";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const inr = (minor: number) => `₹ ${(minor / 100).toLocaleString("en-IN")}`;

/* The views worth a single click. Everything else is reachable through search or "All" —
   a chip per status would be thirteen chips and no clearer. */
const VIEWS = [
  { key: "needs_action", label: "Needs action" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "pending_payment", label: "Awaiting payment" },
  { key: "rto_returned", label: "Returned" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

const GOOD: string[] = ["paid", "delivered"];
const BAD: string[] = ["cancelled", "failed", "expired", "rto_returned", "refunded"];
const tone = (status: string): OrderRow["tone"] =>
  GOOD.includes(status) ? "good" : BAD.includes(status) ? "bad" : "wait";

/* COD orders whose parcel is out or landed but whose cash hasn't been recorded. Mirrors
   the condition markCodCollected() enforces, so the tick box never offers something the
   action will silently skip. */
const CASH_PENDING: string[] = ["confirmed", "processing", "shipped", "delivered"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdminPage("owner");
  const { status, q } = await searchParams;

  const view = VIEWS.some((v) => v.key === status) ? status! : "needs_action";
  const orders = await listOrders({ status: view as OrderStatus | "all" | "needs_action", q });

  const rows: OrderRow[] = orders.map((o) => {
    const address = o.shippingAddress as Address;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      placedAt: dateFmt.format(o.placedAt),
      email: o.email,
      phone: o.phone,
      city: address?.city ?? "—",
      paymentMethod: o.paymentMethod,
      status: o.status,
      statusLabel: readable(o.status),
      tone: tone(o.status),
      totalLabel: inr(o.totalMinor),
      awaitingCash:
        o.paymentMethod === "cod" && o.paidAt === null && CASH_PENDING.includes(o.status),
    };
  });

  return (
    <main className="adm__main">
      <h1 className="adm__h1">Orders</h1>
      <p className="adm__sub">
        Everything that has been bought, and what still needs doing about it.
      </p>

      <nav className="adm__row" style={{ marginBottom: 16 }} aria-label="Filter orders">
        {VIEWS.map((v) => (
          <a
            key={v.key}
            className={`adm__tag${v.key === view ? " adm__tag--confirmed" : ""}`}
            href={`/admin/orders?status=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={v.key === view ? "page" : undefined}
            style={{ textDecoration: "none" }}
          >
            {v.label}
          </a>
        ))}
      </nav>

      <form className="adm__row" style={{ marginBottom: 18 }} action="/admin/orders" method="get">
        {/* Searching always looks everywhere. Somebody typing a phone number wants that
            order, and finding nothing because it happens to be cancelled is the wrong
            answer to the question they asked. The chips still narrow afterwards. */}
        <input type="hidden" name="status" value="all" />
        <label className="sr-only" htmlFor="order-search">
          Search orders
        </label>
        <input
          className="adm__input"
          id="order-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Order number, email, phone or tracking"
          style={{ width: 320 }}
        />
        <button className="adm__btn adm__btn--ghost" type="submit">
          Search
        </button>
        {q && (
          <a className="adm__btn adm__btn--ghost" href="/admin/orders">
            Clear
          </a>
        )}
      </form>

      <section className="adm__panel">
        {rows.length === 0 ? (
          <p className="adm__empty">
            {q ? `Nothing matches “${q}”.` : "Nothing here — which is the good version."}
          </p>
        ) : (
          <OrdersTable rows={rows} />
        )}
      </section>
    </main>
  );
}
