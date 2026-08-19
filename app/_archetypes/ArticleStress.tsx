/* ARCHETYPE STRESS FIXTURE — /preview/article-stress
 *
 * The Journal is authored from the admin portal, so the three essays that exist today
 * are not the test. This is: one post that pushes every axis the editor can push, so the
 * archetype can be re-proved in one screenshot whenever it is touched.
 *
 * WHAT IT EXERCISES, and why each one is here:
 *   · a title far longer than the three real ones, plus a single unbreakable 34-character
 *     word — the exact shape that sheared under the old 183px masthead
 *   · NO standfirst, NO hero image, NO number — every optional prop absent at once, which
 *     is the state an admin gets by filling in only the required fields
 *   · a body that OPENS ON A HEADING, so the lead-paragraph rule must not fire
 *   · every node RichText.tsx can emit: h2, h3, paragraph, blockquote (multi-paragraph),
 *     bulletList, orderedList, nested list, horizontalRule, hardBreak, bold, italic,
 *     internal link, external link, and a pasted URL with no spaces in it
 *
 * Preview-only. The /preview/[section] route is off in production and 404s there, so this
 * never ships — it is a working drawing, like every other VARIANT in the registry.
 */

import EditorialArticle from "./EditorialArticle";
import RichText from "../_components/RichText";
import type { RichDoc } from "@/lib/rich-text";

const t = (text: string, marks?: { type: string; attrs?: Record<string, string> }[]) => ({
  type: "text",
  text,
  ...(marks ? { marks } : {}),
});
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const li = (...content: unknown[]) => ({ type: "listItem", content });

const STRESS_BODY = {
  type: "doc",
  content: [
    /* Opens on a heading: proves `.ea__body > .ea__p:first-child` stays out of the way
       and that `.ea__h2:first-child` collapses its top margin. */
    { type: "heading", attrs: { level: 2 }, content: [t("An essay that opens on a heading")] },
    p(
      t("A first paragraph that is "),
      t("not", [{ type: "italic" }]),
      t(" the lead, because a heading came before it. It also carries "),
      t("bold weight", [{ type: "bold" }]),
      t(" and an internal link to "),
      t("the collection", [{ type: "link", attrs: { href: "/collection" } }]),
      t(", which should sit on the champagne underline without breaking the line rhythm.")
    ),
    { type: "heading", attrs: { level: 3 }, content: [t("A level-three label")] },
    p(
      t("A paragraph followed by a hard break,"),
      { type: "hardBreak" },
      t("which continues on the next line inside the same paragraph.")
    ),
    {
      type: "blockquote",
      content: [
        p(t("A pull quote long enough to wrap, so the rule down its left edge has to hold for more than one line.")),
        p(t("And a second paragraph inside the same quote — the editor allows it.")),
      ],
    },
    p(t("A bulleted list, including a nested one:")),
    {
      type: "bulletList",
      content: [
        li(p(t("A first item."))),
        li(
          p(t("A second item with children:")),
          {
            type: "bulletList",
            content: [li(p(t("A nested item.")))],
          }
        ),
        li(p(t("A third item that runs long enough to wrap onto a second line so the hanging indent can be judged."))),
      ],
    },
    { type: "horizontalRule" },
    p(t("A numbered list:")),
    {
      type: "orderedList",
      content: [li(p(t("First."))), li(p(t("Second."))), li(p(t("Third.")))],
    },
    p(
      t("And the classic admin paste — a bare external URL with nowhere to break: "),
      t("https://example.com/a/very/long/path/that/will/not/wrap/without/help/at/all", [
        { type: "link", attrs: { href: "https://example.com/" } },
      ]),
      t(".")
    ),
  ],
} as unknown as RichDoc;

export default function ArticleStress() {
  return (
    <EditorialArticle
      title="A Deliberately Overlong Headline About Counterrevolutionaries"
      /* standfirst, img and num are all absent on purpose — see the header. */
      backHref="/journal"
      backLabel="The Journal"
      meta={[undefined, "9 min read"]}
      next={{ href: "/journal", label: "Read next", title: "Another Essay With A Long Enough Title To Wrap" }}
      body={<RichText doc={STRESS_BODY} />}
    />
  );
}
