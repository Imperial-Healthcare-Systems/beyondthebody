/* Admin shell.
 *
 * This layout renders chrome; it does NOT gate access. Each page calls
 * requireAdminPage() for itself, because a layout is the wrong place to enforce
 * authorisation — it wraps the sign-in page too, and a layout that redirects is one
 * refactor away from leaving a page unguarded. Belt-and-braces by design: the shell
 * simply shows nothing useful when signed out. */

import type { Metadata } from "next";
import { getAdmin } from "@/lib/admin-session";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Beyond The Body",
  /* Keep the whole admin surface out of search engines. */
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();

  return (
    <div className="adm">
      {admin && (
        <header className="adm__bar">
          <span className="adm__brand">
            <span aria-hidden="true">⚥</span> Beyond The Body
          </span>
          <nav className="adm__nav" aria-label="Admin">
            <a href="/admin">Overview</a>
            <a href="/admin/prices">Prices</a>
            <a href="/admin/subscribers">Subscribers</a>
          </nav>
          <div className="adm__who">
            <span>{admin.email}</span>
            <form action="/admin/logout" method="post">
              <button className="adm__btn adm__btn--ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
