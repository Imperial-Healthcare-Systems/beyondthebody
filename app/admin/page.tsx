/* /admin — overview.
 *
 * Deliberately thin. It exists so signing in lands somewhere meaningful and so the
 * client can see at a glance that the list is real; the panels below fill in as later
 * phases add prices, the journal and orders. */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriber } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin-session";
import { orderCounts } from "@/lib/fulfilment";
import { queueDepth } from "@/lib/jobs";

export const dynamic = "force-dynamic";

async function subscriberCounts() {
  const [row] = await db
    .select({
      confirmed: sql<number>`count(*) filter (where ${subscriber.status} = 'confirmed')`,
      pending: sql<number>`count(*) filter (where ${subscriber.status} = 'pending')`,
      unsubscribed: sql<number>`count(*) filter (where ${subscriber.status} = 'unsubscribed')`,
    })
    .from(subscriber);
  return row ?? { confirmed: 0, pending: 0, unsubscribed: 0 };
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const admin = await requireAdminPage();
  const { denied } = await searchParams;

  /* Order figures are owner business — an editor writes essays and has no reason to see
     the day's takings. Fetched conditionally rather than fetched-and-hidden. */
  const [counts, queue, orders] = await Promise.all([
    subscriberCounts(),
    queueDepth(),
    admin.role === "owner" ? orderCounts() : null,
  ]);

  return (
    <main className="adm__main">
      <h1 className="adm__h1">Overview</h1>
      <p className="adm__sub">
        Signed in as {admin.email} · {admin.role}
      </p>

      {denied && (
        <p className="adm__error" role="alert">
          That area needs owner access.
        </p>
      )}

      {orders && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 14 }}>
            Orders
          </p>
          <div className="adm__stats">
            <div className="adm__stat">
              <div className="adm__statnum">{orders.needsAction}</div>
              <div className="adm__statlabel">Needs action</div>
            </div>
            <div className="adm__stat">
              <div className="adm__statnum">{orders.shipped}</div>
              <div className="adm__statlabel">On its way</div>
            </div>
            <div className="adm__stat">
              <div className="adm__statnum">{orders.awaitingCash}</div>
              <div className="adm__statlabel">
                Cash to collect · ₹ {(orders.awaitingCashMinor / 100).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
          <p className="adm__note">
            <a href="/admin/orders">Open the order list →</a>
          </p>
        </section>
      )}

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 14 }}>
          The house list
        </p>
        <div className="adm__stats">
          <div className="adm__stat">
            <div className="adm__statnum">{counts.confirmed}</div>
            <div className="adm__statlabel">Confirmed</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statnum">{counts.pending}</div>
            <div className="adm__statlabel">Awaiting confirmation</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statnum">{counts.unsubscribed}</div>
            <div className="adm__statlabel">Unsubscribed</div>
          </div>
        </div>
        <p className="adm__note">
          Only confirmed addresses have agreed to receive mail. Pending ones asked, but
          haven&rsquo;t followed the link yet.
        </p>
      </section>

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 14 }}>
          Background work
        </p>
        <div className="adm__stats">
          <div className="adm__stat">
            <div className="adm__statnum">{queue.pending}</div>
            <div className="adm__statlabel">Queued</div>
          </div>
          <div className="adm__stat">
            <div className="adm__statnum">{queue.failed}</div>
            <div className="adm__statlabel">Failed</div>
          </div>
        </div>
        <p className="adm__note">
          Email is sent by a background worker. Anything under &ldquo;failed&rdquo; gave up after
          repeated attempts and is worth investigating &mdash; usually the mail server.
        </p>
      </section>
    </main>
  );
}
