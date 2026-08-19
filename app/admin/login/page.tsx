/* /admin/login — request a sign-in link.
 *
 * No password field, because there is no password: the schema has no column for one.
 * A signed-in visitor is sent straight through rather than shown a form. */

import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin-session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdmin()) redirect("/admin");

  const { error } = await searchParams;

  return (
    <main className="adm__center">
      <div className="adm__card">
        <p className="adm__label" style={{ marginBottom: 10 }}>
          <span aria-hidden="true">⚥</span> Beyond The Body
        </p>
        <h1 className="adm__h1">Sign in</h1>
        <p className="adm__sub">
          We&rsquo;ll email you a link. There&rsquo;s no password to remember.
        </p>
        <LoginForm error={error} />
      </div>
    </main>
  );
}
