/* The Journal — the client's blog portal.
 *
 * Unlike the product catalogue, this content genuinely belongs in the database: the
 * client writes, edits and publishes it themselves, which was the whole point of asking
 * for it. The three essays that exist today are migrated in from journal-data.ts
 * verbatim, and that file is retired to a seed source.
 *
 * Body is stored as a Tiptap/ProseMirror JSON DOCUMENT, not HTML. That choice removes a
 * whole category of risk: we render the document with our own components, so there is no
 * user-supplied markup to sanitise and no way for an editor paste to inject anything. It
 * also keeps the essay inside the house's typography instead of carrying its own. */

import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);

export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    /* The structural index label the design prints ("01"). Not copy — the Journal index
       numbers its essays as a typographic device. */
    num: text("num"),

    title: text("title").notNull(),
    standfirst: text("standfirst"),
    body: jsonb("body").notNull(),

    status: postStatus("status").notNull().default("draft"),

    heroImage: text("hero_image"),
    heroAlt: text("hero_alt"),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    publishedAt: ts("published_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    uniqueIndex("post_slug_idx").on(t.slug),
    index("post_status_idx").on(t.status, t.publishedAt),
  ]
);

/* Old slugs, so a renamed essay does not break every link anyone ever shared.
 * A published URL is a promise; renaming is an editorial decision that should not
 * silently 404 the people who bookmarked it. */
export const postSlugAlias = pgTable(
  "post_slug_alias",
  {
    slug: text("slug").primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("post_slug_alias_post_idx").on(t.postId)]
);

/* A registry of imagery, so the admin can eventually pick from what exists rather than
 * typing a path. Upload is NOT built: the three essays reference art-directed files that
 * ship in /public, and the client places new ones the same way. The table is here because
 * it costs nothing now and retro-fitting it once paths are scattered through post bodies
 * costs a migration — but nothing writes to it yet, and that is deliberate. */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Public URL path, e.g. /uploads/2026/08/linen.webp */
    path: text("path").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    bytes: text("bytes"),
    alt: text("alt"),
    uploadedBy: uuid("uploaded_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_path_idx").on(t.path)]
);

export type Post = typeof post.$inferSelect;
export type Media = typeof media.$inferSelect;
