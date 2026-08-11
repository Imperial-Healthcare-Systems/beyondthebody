/* Journal — reads for the public site, writes for the admin portal.
 *
 * Public reads only ever return PUBLISHED posts. Drafts are reachable exactly one way,
 * by an authenticated staff member asking for a preview; there is no query here that can
 * accidentally leak one to a visitor.
 *
 * Like prices, public reads FAIL SOFT to the essays compiled into journal-data.ts. The
 * three existing essays are frozen client copy and the site must render them even if the
 * database is unreachable — and `next build` must work on a machine with no database. */

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { media, post, postSlugAlias, type Post } from "@/db/schema";
import { ESSAYS, type Essay } from "@/app/_sections/journal-data";
import { logger } from "./logger";
import { audit } from "./audit";
import type { AdminUser } from "./auth";
import type { RichDoc } from "./rich-text";

/* ── The shape the public pages render ────────────────────────────────────────── */

export type PublicPost = {
  slug: string;
  num: string;
  title: string;
  standfirst: string;
  body: RichDoc;
  img: string;
  imgAlt: string;
  publishedAt: Date | null;
};

/** Turn the frozen copy in journal-data.ts into a document, for both the seed and the
 *  fallback. Each paragraph becomes a paragraph node — no interpretation, no reformatting. */
export function essayToDoc(essay: Pick<Essay, "paras">): RichDoc {
  return {
    type: "doc",
    content: essay.paras.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

const fromEssay = (e: Essay): PublicPost => ({
  slug: e.slug,
  num: e.num,
  title: e.title,
  standfirst: e.standfirst,
  body: essayToDoc(e),
  img: e.img,
  imgAlt: e.imgAlt,
  publishedAt: null,
});

const fromRow = (r: Post): PublicPost => ({
  slug: r.slug,
  num: r.num ?? "",
  title: r.title,
  standfirst: r.standfirst ?? "",
  body: r.body as RichDoc,
  img: r.heroImage ?? "",
  imgAlt: r.heroAlt ?? "",
  publishedAt: r.publishedAt,
});

let fallbackReported = false;
function reportFallback(err: unknown) {
  if (!fallbackReported) {
    fallbackReported = true;
    logger.error("journal.unavailable", {
      err,
      detail: "Falling back to the essays compiled into journal-data.ts.",
    });
  }
}

/** Published essays, newest first. */
export async function getPublishedPosts(): Promise<PublicPost[]> {
  try {
    const rows = await db
      .select()
      .from(post)
      .where(eq(post.status, "published"))
      .orderBy(asc(post.num), desc(post.publishedAt));

    fallbackReported = false;
    /* An empty table before the seed runs is not a reason to show an empty Journal. */
    return rows.length > 0 ? rows.map(fromRow) : ESSAYS.map(fromEssay);
  } catch (err) {
    reportFallback(err);
    return ESSAYS.map(fromEssay);
  }
}

export type PostLookup =
  | { found: true; post: PublicPost }
  | { found: false; redirectTo: string }
  | { found: false; redirectTo?: undefined };

/** Resolve a slug for the public article route, following a rename if there was one. */
export async function getPublishedPost(slug: string): Promise<PostLookup> {
  try {
    const [row] = await db
      .select()
      .from(post)
      .where(and(eq(post.slug, slug), eq(post.status, "published")))
      .limit(1);

    if (row) return { found: true, post: fromRow(row) };

    /* Not a current slug — it may be one this essay used to have. */
    const [alias] = await db
      .select({ postId: postSlugAlias.postId })
      .from(postSlugAlias)
      .where(eq(postSlugAlias.slug, slug))
      .limit(1);

    if (alias) {
      const [target] = await db
        .select({ slug: post.slug, status: post.status })
        .from(post)
        .where(eq(post.id, alias.postId))
        .limit(1);

      if (target?.status === "published") return { found: false, redirectTo: `/journal/${target.slug}` };
    }

    return { found: false };
  } catch (err) {
    reportFallback(err);
    const essay = ESSAYS.find((e) => e.slug === slug);
    return essay ? { found: true, post: fromEssay(essay) } : { found: false };
  }
}

/** Preview a post regardless of status. Callers MUST have checked staff auth first —
 *  this function deliberately does no authorisation of its own so the check is visible
 *  at the route rather than hidden in a data helper. */
export async function getPostForPreview(id: string): Promise<PublicPost | null> {
  const [row] = await db.select().from(post).where(eq(post.id, id)).limit(1);
  return row ? fromRow(row) : null;
}

/* ── Admin ────────────────────────────────────────────────────────────────────── */

export async function listPosts() {
  return db.select().from(post).orderBy(asc(post.num), desc(post.updatedAt));
}

export async function getPost(id: string): Promise<Post | null> {
  const [row] = await db.select().from(post).where(eq(post.id, id)).limit(1);
  return row ?? null;
}

/** Lowercase, hyphenated, no leading/trailing punctuation. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type PostInput = {
  title: string;
  slug: string;
  num?: string | null;
  standfirst?: string | null;
  body: RichDoc;
  heroImage?: string | null;
  heroAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function createPost(input: PostInput, actor: Pick<AdminUser, "id" | "email">) {
  const [row] = await db
    .insert(post)
    .values({ ...input, body: input.body, status: "draft", createdBy: actor.id, updatedBy: actor.id })
    .returning();

  await audit({ actor, action: "post.create", entity: "post", entityId: row.id, after: { slug: row.slug } });
  return row;
}

export async function updatePost(
  id: string,
  input: PostInput,
  actor: Pick<AdminUser, "id" | "email">
) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(post).where(eq(post.id, id)).limit(1);
    if (!before) throw new Error("No such post");

    /* Renaming a published essay keeps the old address working. A published URL is a
       promise; an editorial rename should not 404 everyone who bookmarked it. */
    if (before.slug !== input.slug && before.status === "published") {
      await tx
        .insert(postSlugAlias)
        .values({ slug: before.slug, postId: id })
        .onConflictDoNothing();
    }

    const [row] = await tx
      .update(post)
      .set({ ...input, updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(post.id, id))
      .returning();

    await audit({
      actor,
      action: "post.update",
      entity: "post",
      entityId: id,
      before: { slug: before.slug, title: before.title },
      after: { slug: row.slug, title: row.title },
      exec: tx,
    });

    return row;
  });
}

export async function setPostStatus(
  id: string,
  status: "draft" | "published" | "archived",
  actor: Pick<AdminUser, "id" | "email">
) {
  const [before] = await db.select().from(post).where(eq(post.id, id)).limit(1);
  if (!before) throw new Error("No such post");

  const [row] = await db
    .update(post)
    .set({
      status,
      /* Stamped on FIRST publish only, so unpublishing and republishing does not
         silently reorder the Journal. */
      publishedAt: status === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt,
      updatedAt: new Date(),
      updatedBy: actor.id,
    })
    .where(eq(post.id, id))
    .returning();

  await audit({
    actor,
    action: `post.${status}`,
    entity: "post",
    entityId: id,
    before: { status: before.status },
    after: { status: row.status },
  });

  return row;
}

/** Is this slug free? Excludes the post being edited, and checks retired slugs too. */
export async function slugAvailable(slug: string, exceptId?: string): Promise<boolean> {
  const clash = await db
    .select({ id: post.id })
    .from(post)
    .where(exceptId ? and(eq(post.slug, slug), ne(post.id, exceptId)) : eq(post.slug, slug))
    .limit(1);

  if (clash.length > 0) return false;

  const alias = await db
    .select({ slug: postSlugAlias.slug })
    .from(postSlugAlias)
    .where(eq(postSlugAlias.slug, slug))
    .limit(1);

  /* A retired slug redirects somewhere; reusing it for a different essay would send
     readers to the wrong place. */
  return alias.length === 0;
}

/* ── Seed ─────────────────────────────────────────────────────────────────────── */

/** Migrate the three frozen essays in. Idempotent: skips any slug already present, so
 *  it can run on every boot without ever overwriting the client's edits. */
export async function seedPosts(): Promise<number> {
  const existing = await db.select({ slug: post.slug }).from(post);
  const have = new Set(existing.map((r) => r.slug));

  const missing = ESSAYS.filter((e) => !have.has(e.slug));
  if (missing.length === 0) return 0;

  await db.insert(post).values(
    missing.map((e) => ({
      slug: e.slug,
      num: e.num,
      title: e.title,
      standfirst: e.standfirst,
      body: essayToDoc(e) as unknown as object,
      status: "published" as const,
      heroImage: e.img,
      heroAlt: e.imgAlt,
      publishedAt: new Date(),
    }))
  );

  logger.info("journal.seeded", { slugs: missing.map((e) => e.slug) });
  return missing.length;
}

export async function listMedia() {
  return db.select().from(media).orderBy(desc(media.createdAt)).limit(100);
}
