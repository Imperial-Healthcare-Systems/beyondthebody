/* /admin/journal — the essay list. */

import { requireAdminPage } from "@/lib/admin-session";
import { listPosts } from "@/lib/journal";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

export default async function AdminJournalPage() {
  await requireAdminPage("editor");
  const posts = await listPosts();

  return (
    <main className="adm__main">
      <h1 className="adm__h1">The Journal</h1>
      <p className="adm__sub">
        Drafts are visible only to you. Publishing puts an essay on the site within seconds.
      </p>

      <p style={{ marginBottom: 18 }}>
        <a className="adm__btn" href="/admin/journal/new">
          Write a new essay
        </a>
      </p>

      <section className="adm__panel">
        {posts.length === 0 ? (
          <p className="adm__empty">Nothing written yet.</p>
        ) : (
          <div className="adm__scroll">
            <table className="adm__table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/admin/journal/${p.id}`} style={{ color: "inherit" }}>
                        <strong>{p.num ? `${p.num} · ` : ""}{p.title}</strong>
                      </a>
                      {p.standfirst && (
                        <div style={{ color: "var(--adm-muted)", fontSize: 12, maxWidth: 460 }}>
                          {p.standfirst}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`adm__tag adm__tag--${p.status === "published" ? "confirmed" : "pending"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>{dateFmt.format(p.updatedAt)}</td>
                    <td style={{ fontSize: 12 }}>
                      {p.status === "published" ? (
                        <a href={`/journal/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          /journal/{p.slug} ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--adm-muted)" }}>/journal/{p.slug}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
