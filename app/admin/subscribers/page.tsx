/* /admin/subscribers — the house list.
 *
 * Paged rather than unbounded: the list will outgrow one screen, and a page that loads
 * every row is a page that eventually times out. Export is a separate, owner-only route.
 */

import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriber } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata", // the house operates in IST; show it in IST
});

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const admin = await requireAdminPage();
  const { page: pageParam } = await searchParams;

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        email: subscriber.email,
        status: subscriber.status,
        createdAt: subscriber.createdAt,
        confirmedAt: subscriber.confirmedAt,
        source: subscriber.source,
      })
      .from(subscriber)
      .orderBy(desc(subscriber.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(subscriber),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="adm__main">
      <h1 className="adm__h1">Subscribers</h1>
      <p className="adm__sub">
        {total} {total === 1 ? "address" : "addresses"} · page {page} of {pageCount}
      </p>

      {admin.role === "owner" && (
        <p style={{ marginBottom: 18 }}>
          <a className="adm__btn adm__btn--ghost" href="/api/v1/admin/subscribers/export">
            Export confirmed as CSV
          </a>
        </p>
      )}

      <section className="adm__panel">
        {rows.length === 0 ? (
          <p className="adm__empty">No one has signed up yet.</p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Signed up</th>
                  <th>Confirmed</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.email}</td>
                    <td>
                      <span className={`adm__tag adm__tag--${r.status}`}>{r.status}</span>
                    </td>
                    <td>{dateFmt.format(r.createdAt)}</td>
                    <td>{r.confirmedAt ? dateFmt.format(r.confirmedAt) : "—"}</td>
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pageCount > 1 && (
        <nav className="adm__stats" aria-label="Pagination">
          {page > 1 && (
            <a className="adm__btn adm__btn--ghost" href={`/admin/subscribers?page=${page - 1}`}>
              Previous
            </a>
          )}
          {page < pageCount && (
            <a className="adm__btn adm__btn--ghost" href={`/admin/subscribers?page=${page + 1}`}>
              Next
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
