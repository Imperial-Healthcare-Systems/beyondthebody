/* /admin/journal/[id] — write or edit an essay. `new` opens a blank one. */

import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-session";
import { getPost } from "@/lib/journal";
import { EMPTY_DOC, type RichDoc } from "@/lib/rich-text";
import Editor from "../Editor";
import StatusControls from "../StatusControls";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdminPage("editor");

  const { id } = await params;
  const { created } = await searchParams;
  const isNew = id === "new";

  const existing = isNew ? null : await getPost(id);
  if (!isNew && !existing) notFound();

  const initial = {
    title: existing?.title ?? "",
    slug: existing?.slug ?? "",
    num: existing?.num ?? "",
    standfirst: existing?.standfirst ?? "",
    heroImage: existing?.heroImage ?? "",
    heroAlt: existing?.heroAlt ?? "",
    body: (existing?.body as RichDoc) ?? EMPTY_DOC,
  };

  return (
    <main className="adm__main">
      <p style={{ marginBottom: 12 }}>
        <a href="/admin/journal" style={{ fontSize: 12, color: "var(--adm-muted)" }}>
          ← All essays
        </a>
      </p>

      <h1 className="adm__h1">{isNew ? "New essay" : initial.title || "Untitled"}</h1>
      <p className="adm__sub">
        {isNew
          ? "Saved as a draft first — nothing is public until you publish it."
          : `Status: ${existing!.status}`}
      </p>

      {created && (
        <p className="adm__note" role="status">
          Draft created. Publish it when you&rsquo;re ready.
        </p>
      )}

      {existing && (
        <section className="adm__panel">
          <p className="adm__label" style={{ marginBottom: 12 }}>
            Publishing
          </p>
          <StatusControls id={existing.id} status={existing.status} />
          <p className="adm__note">
            {existing.status === "published" ? (
              <>
                Live at{" "}
                <a href={`/journal/${existing.slug}`} target="_blank" rel="noopener noreferrer">
                  /journal/{existing.slug} ↗
                </a>
              </>
            ) : (
              <>
                Not public.{" "}
                <a
                  href={`/admin/journal/${existing.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview it ↗
                </a>{" "}
                as it will appear.
              </>
            )}
          </p>
        </section>
      )}

      <Editor id={existing?.id} initial={initial} />
    </main>
  );
}
