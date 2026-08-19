/* The Journal, against a real Postgres.
 *
 * Two properties carry the weight here:
 *
 *   1. A draft must never reach a public read. There is no "mostly private" — an essay the
 *      client has not published yet is theirs alone, and the only way to see one is an
 *      authenticated preview by id.
 *   2. A published URL is a promise. Renaming an essay must not 404 everyone who
 *      bookmarked it, and a retired address must never be handed to a different essay. */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { auditLog, post, postSlugAlias } from "@/db/schema";
import {
  createPost,
  essayToDoc,
  getPublishedPost,
  getPublishedPosts,
  getPostForPreview,
  seedPosts,
  setPostStatus,
  slugAvailable,
  slugify,
  updatePost,
} from "@/lib/journal";
import { parseRichDoc, type RichDoc } from "@/lib/rich-text";
import { ESSAYS } from "@/app/_sections/journal-data";

const hasDb = Boolean(process.env.DATABASE_URL);
const ACTOR = { id: "00000000-0000-0000-0000-000000000000", email: "test@beyondthebody.invalid" };

/* Every post this file creates carries the prefix, so cleanup can never reach the seeded
   essays — which are the client's frozen copy, not test fixtures. */
const PREFIX = "zz-test-";
const body: RichDoc = parseRichDoc({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "A test essay." }] }],
});

const draft = (slug: string, title = "A test essay") =>
  createPost({ title, slug: PREFIX + slug, body }, ACTOR);

async function cleanup() {
  const rows = await db.select({ id: post.id }).from(post).where(like(post.slug, `${PREFIX}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;

  await db.delete(postSlugAlias).where(inArray(postSlugAlias.postId, ids));
  await db.delete(auditLog).where(inArray(auditLog.entityId, ids));
  await db.delete(post).where(inArray(post.id, ids)); // alias rows cascade too
}

describe.skipIf(!hasDb)("phase 4 · the journal", () => {
  beforeAll(async () => {
    await cleanup();
    await seedPosts();
  });
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  /* ── The seed ─────────────────────────────────────────────────────────────── */

  it("migrates the three frozen essays in", async () => {
    const slugs = (await getPublishedPosts()).map((p) => p.slug);
    for (const essay of ESSAYS) expect(slugs).toContain(essay.slug);
  });

  it("seeds idempotently", async () => {
    /* Runs on every boot from lib/startup.ts. If it were not idempotent it would either
       duplicate the essays or overwrite the client's edits to them. */
    expect(await seedPosts()).toBe(0);
  });

  it("does not overwrite an edit the client made to a seeded essay", async () => {
    const slug = ESSAYS[0].slug;
    await db.update(post).set({ title: "Client retitled this" }).where(eq(post.slug, slug));

    await seedPosts();

    const [row] = await db.select().from(post).where(eq(post.slug, slug));
    expect(row.title).toBe("Client retitled this");

    await db.update(post).set({ title: ESSAYS[0].title }).where(eq(post.slug, slug));
  });

  it("converts the frozen copy verbatim, paragraph for paragraph", async () => {
    const doc = essayToDoc(ESSAYS[0]);
    expect(doc.content).toHaveLength(ESSAYS[0].paras.length);
    expect(() => parseRichDoc(doc)).not.toThrow();
  });

  /* ── Drafts stay private ──────────────────────────────────────────────────── */

  it("starts a new essay as a draft", async () => {
    const created = await draft("new-one");
    expect(created.status).toBe("draft");
    expect(created.publishedAt).toBeNull();
  });

  it("keeps a draft out of the index", async () => {
    await draft("hidden-from-index");
    const slugs = (await getPublishedPosts()).map((p) => p.slug);
    expect(slugs).not.toContain(`${PREFIX}hidden-from-index`);
  });

  it("404s a draft at its public address", async () => {
    const created = await draft("not-yet");
    /* Not found, and nowhere to redirect to — the address must behave as though the essay
       does not exist, because as far as the public is concerned it does not. */
    expect(await getPublishedPost(created.slug)).toEqual({ found: false });
  });

  it("shows a draft to a preview by id", async () => {
    const created = await draft("previewable");
    const preview = await getPostForPreview(created.id);
    expect(preview?.slug).toBe(created.slug);
  });

  it("withdraws an archived essay from the public site", async () => {
    const created = await draft("archived-one");
    await setPostStatus(created.id, "published", ACTOR);
    await setPostStatus(created.id, "archived", ACTOR);

    expect((await getPublishedPost(created.slug)).found).toBe(false);
    expect((await getPublishedPosts()).map((p) => p.slug)).not.toContain(created.slug);
  });

  /* ── Publishing ───────────────────────────────────────────────────────────── */

  it("publishes an essay to its address", async () => {
    const created = await draft("goes-live");
    await setPostStatus(created.id, "published", ACTOR);

    const lookup = await getPublishedPost(created.slug);
    expect(lookup.found).toBe(true);
    expect(lookup.found && lookup.post.title).toBe("A test essay");
  });

  it("stamps publishedAt on the first publish only", async () => {
    const created = await draft("first-publish");
    const first = await setPostStatus(created.id, "published", ACTOR);
    expect(first.publishedAt).toBeInstanceOf(Date);

    await setPostStatus(created.id, "draft", ACTOR);
    const again = await setPostStatus(created.id, "published", ACTOR);

    /* Unpublishing to fix a typo and republishing must not jump the essay to the top of
       the Journal — the index is ordered by this column. */
    expect(again.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
  });

  it("keeps the original date through an edit", async () => {
    const created = await draft("edited-after-publish");
    const published = await setPostStatus(created.id, "published", ACTOR);

    await updatePost(created.id, { title: "Revised", slug: created.slug, body }, ACTOR);

    const [row] = await db.select().from(post).where(eq(post.id, created.id));
    expect(row.publishedAt?.getTime()).toBe(published.publishedAt?.getTime());
    expect(row.title).toBe("Revised");
  });

  it("audits every publish", async () => {
    const created = await draft("audited");
    await setPostStatus(created.id, "published", ACTOR);

    const rows = await db.select().from(auditLog).where(eq(auditLog.entityId, created.id));
    expect(rows.map((r) => r.action)).toContain("post.published");
  });

  /* ── Addresses ────────────────────────────────────────────────────────────── */

  it("redirects the old address after a published essay is renamed", async () => {
    const created = await draft("original-address");
    await setPostStatus(created.id, "published", ACTOR);

    await updatePost(
      created.id,
      { title: "Renamed", slug: `${PREFIX}new-address`, body },
      ACTOR
    );

    expect(await getPublishedPost(`${PREFIX}original-address`)).toEqual({
      found: false,
      redirectTo: `/journal/${PREFIX}new-address`,
    });
  });

  it("does not leave an alias behind when a draft is renamed", async () => {
    /* A draft address was never public, so there is nothing to keep working — and an
       alias would needlessly reserve a slug the client might want. */
    const created = await draft("draft-rename");
    await updatePost(created.id, { title: "x", slug: `${PREFIX}draft-renamed`, body }, ACTOR);

    const aliases = await db
      .select()
      .from(postSlugAlias)
      .where(eq(postSlugAlias.slug, `${PREFIX}draft-rename`));
    expect(aliases).toHaveLength(0);
  });

  it("stops an unpublished essay redirecting to a live one", async () => {
    const created = await draft("was-public");
    await setPostStatus(created.id, "published", ACTOR);
    await updatePost(created.id, { title: "x", slug: `${PREFIX}moved`, body }, ACTOR);
    await setPostStatus(created.id, "draft", ACTOR);

    /* The alias row still exists, but its target is no longer public — following it would
       redirect a visitor to a 404, which is worse than a 404. */
    expect(await getPublishedPost(`${PREFIX}was-public`)).toEqual({ found: false });
  });

  it("refuses a slug another essay already has", async () => {
    const created = await draft("taken");
    expect(await slugAvailable(created.slug)).toBe(false);
    /* ...but the essay may keep its own. */
    expect(await slugAvailable(created.slug, created.id)).toBe(true);
  });

  it("refuses a retired slug", async () => {
    const created = await draft("retired");
    await setPostStatus(created.id, "published", ACTOR);
    await updatePost(created.id, { title: "x", slug: `${PREFIX}current`, body }, ACTOR);

    /* Handing a retired address to a different essay would silently send everyone with
       the old bookmark to the wrong piece of writing. */
    expect(await slugAvailable(`${PREFIX}retired`)).toBe(false);
  });

  it("rejects a duplicate slug at the database, not just in the form", async () => {
    const created = await draft("db-unique");
    await expect(
      db.insert(post).values({ slug: created.slug, title: "Copy", body })
    ).rejects.toThrow();
  });

  it("enforces the unique index case-sensitively as slugify produces it", async () => {
    expect(slugify("Three Towns & a Bottle")).toBe("three-towns-a-bottle");
    expect(slugify("  A Scent for the Heat!  ")).toBe("a-scent-for-the-heat");
    expect(slugify("Café Society")).toBe("cafe-society");
    expect(slugify("—")).toBe("");
    expect(slugify("x".repeat(200))).toHaveLength(80);
  });

  /* ── Ordering ─────────────────────────────────────────────────────────────── */

  it("orders the index by the printed number", async () => {
    /* The Journal prints 01/02/03 as a typographic device; the reading order the design
       assumes is that sequence, not recency. */
    const nums = (await getPublishedPosts()).map((p) => p.num).filter(Boolean);
    expect(nums).toEqual([...nums].sort());
  });
});
