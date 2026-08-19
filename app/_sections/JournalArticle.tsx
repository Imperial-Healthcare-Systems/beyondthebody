"use client";

/* /journal/[slug] · THE ARTICLE — now an INSTANCE of the editorial-article archetype
 * rather than a layout of its own.
 *
 * Everything structural (front matter, hero, prose measure, foot, motion) lives in
 * app/_archetypes/EditorialArticle.tsx. What remains here is the Journal's own
 * vocabulary: what the meta line says, where "back" goes, what "read next" is called.
 * That split is the point — the client publishes these from the admin portal, so every
 * future post inherits a shape that has been reviewed once, and a Journal-specific tweak
 * can never quietly become a layout regression.
 *
 * The props are unchanged, so both callers — /journal/[slug] and the admin draft
 * preview — are untouched.
 */

import EditorialArticle from "../_archetypes/EditorialArticle";
import RichText from "../_components/RichText";
import type { RichNode } from "@/lib/rich-text";

export type ArticleProps = {
  num: string;
  title: string;
  standfirst: string;
  body: { content?: RichNode[] };
  img: string;
  imgAlt: string;
  readingMinutes: number;
  next?: { slug: string; title: string } | null;
  isDraft?: boolean;
};

export default function JournalArticle({
  num,
  title,
  standfirst,
  body,
  img,
  imgAlt,
  readingMinutes,
  next,
  isDraft,
}: ArticleProps) {
  return (
    <EditorialArticle
      title={title}
      standfirst={standfirst}
      img={img}
      imgAlt={imgAlt}
      backHref="/journal"
      backLabel="The Journal"
      /* `num` is optional on an admin-authored post; the archetype drops falsy entries
         and draws its hairline only between what survives. */
      meta={[num, `${readingMinutes} min read`]}
      next={next ? { href: `/journal/${next.slug}`, label: "Read next", title: next.title } : null}
      draftNotice={isDraft ? "Draft preview — not visible to anyone else" : undefined}
      body={<RichText doc={body} />}
    />
  );
}
