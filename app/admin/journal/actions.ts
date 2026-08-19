"use server";

/* Journal editing actions.
 *
 * Authorisation is re-checked inside every action. A Server Action is a POST endpoint
 * like any other — the fact that the form was only rendered for a signed-in editor
 * guarantees nothing about who can invoke it.
 *
 * `editor` role is enough here: the Journal is content, not money. */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-session";
import {
  createPost,
  setPostStatus,
  slugAvailable,
  slugify,
  updatePost,
} from "@/lib/journal";
import { parseRichDoc } from "@/lib/rich-text";
import { logger } from "@/lib/logger";

export type JournalFormState = { ok?: string; error?: string };

const Schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give the essay a title.").max(200),
  slug: z.string().trim().max(80).optional(),
  num: z.string().trim().max(8).optional(),
  standfirst: z.string().trim().max(500).optional(),
  heroImage: z.string().trim().max(400).optional(),
  heroAlt: z.string().trim().max(300).optional(),
  body: z.string().min(2),
});

/** Publishing changes what the public site shows, so every path that renders an essay
 *  has to be revalidated by name — revalidatePath does not cascade. */
function revalidateJournal() {
  revalidatePath("/journal");
  revalidatePath("/journal/[slug]", "page");
  revalidatePath("/"); // the home page carries the §9 Journal tease
}

export async function savePostAction(
  _prev: JournalFormState,
  formData: FormData
): Promise<JournalFormState> {
  let admin;
  try {
    admin = await requireAdminApi("editor");
  } catch {
    return { error: "You don't have access to edit the Journal." };
  }

  const parsed = Schema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug") || undefined,
    num: formData.get("num") || undefined,
    standfirst: formData.get("standfirst") || undefined,
    heroImage: formData.get("heroImage") || undefined,
    heroAlt: formData.get("heroAlt") || undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Something's missing." };

  const input = parsed.data;

  /* The body arrives as JSON from the editor. Validated against the allowed node list
     rather than trusted — see lib/rich-text.ts for why the list is short. */
  let body;
  try {
    body = parseRichDoc(JSON.parse(input.body));
  } catch (err) {
    logger.warn("journal.invalid_body", { err });
    return { error: "That content couldn't be saved. Try removing any pasted formatting." };
  }

  const slug = slugify(input.slug || input.title);
  if (!slug) return { error: "That title doesn't make a usable web address. Add a slug." };

  if (!(await slugAvailable(slug, input.id))) {
    return { error: `The address "${slug}" is already taken. Choose another.` };
  }

  const values = {
    title: input.title,
    slug,
    num: input.num ?? null,
    standfirst: input.standfirst ?? null,
    body,
    heroImage: input.heroImage ?? null,
    heroAlt: input.heroAlt ?? null,
    seoTitle: null,
    seoDescription: null,
  };

  try {
    if (input.id) {
      await updatePost(input.id, values, admin);
      revalidateJournal();
      revalidatePath(`/admin/journal/${input.id}`);
      return { ok: "Saved." };
    }

    const created = await createPost(values, admin);
    redirect(`/admin/journal/${created.id}?created=1`);
  } catch (err) {
    /* redirect() throws a control-flow signal that must not be swallowed as an error. */
    if (err && typeof err === "object" && "digest" in err) throw err;
    logger.error("journal.save_failed", { err });
    return { error: "Couldn't save that. Please try again." };
  }

  return {};
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

export async function setStatusAction(
  _prev: JournalFormState,
  formData: FormData
): Promise<JournalFormState> {
  let admin;
  try {
    admin = await requireAdminApi("editor");
  } catch {
    return { error: "You don't have access to publish." };
  }

  const parsed = StatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "That didn't look right." };

  try {
    await setPostStatus(parsed.data.id, parsed.data.status, admin);
    revalidateJournal();
    revalidatePath(`/admin/journal/${parsed.data.id}`);
    revalidatePath("/admin/journal");

    return {
      ok:
        parsed.data.status === "published"
          ? "Published — it's live on the site."
          : parsed.data.status === "draft"
            ? "Unpublished — it's back to a draft."
            : "Archived.",
    };
  } catch (err) {
    logger.error("journal.status_failed", { err });
    return { error: "Couldn't change that. Please try again." };
  }
}
