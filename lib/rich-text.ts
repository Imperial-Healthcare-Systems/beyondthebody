/* The document format the Journal stores.
 *
 * A Tiptap/ProseMirror JSON document, validated on the way in and rendered by our own
 * components on the way out. Storing HTML instead would mean sanitising it on every
 * render and trusting that the sanitiser is correct forever; storing a document we can
 * only render through a fixed set of components means there is nothing to sanitise.
 *
 * The node list is DELIBERATELY SHORT. This is an editorial site with a typographic
 * system that was designed and gated per beat — an editor that can emit arbitrary
 * headings, tables and images would let a well-meaning edit quietly break the art
 * direction. Prose, emphasis, links, a pull quote, a rule, and lists. */

import { z } from "zod";

export const ALLOWED_MARKS = ["bold", "italic", "link"] as const;
export const ALLOWED_NODES = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
  "hardBreak",
] as const;

const Mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      /* Only http(s) and mailto. Blocks `javascript:` and `data:` URLs, which are the
         two that turn a link into script execution. */
      href: z
        .string()
        .max(2000)
        .refine((h) => /^(https?:\/\/|mailto:|\/)/i.test(h), {
          message: "Links must start with http://, https://, mailto: or /",
        }),
      target: z.string().nullish(),
    }),
  }),
]);

export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: z.infer<typeof Mark>[];
  content?: RichNode[];
};

const Node: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.enum(ALLOWED_NODES),
    text: z.string().max(20_000).optional(),
    attrs: z
      .object({
        /* Only h2 and h3: h1 belongs to the article title, and deeper levels have no
           place in the typographic scale. */
        level: z.number().int().min(2).max(3).optional(),
      })
      .passthrough()
      .optional(),
    marks: z.array(Mark).max(4).optional(),
    content: z.array(Node).max(500).optional(),
  })
);

export const RichDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(Node).max(500).default([]),
});

export type RichDoc = z.infer<typeof RichDocSchema>;

export const EMPTY_DOC: RichDoc = { type: "doc", content: [] };

/** Parse untrusted JSON from the editor. Throws with a readable message. */
export function parseRichDoc(value: unknown): RichDoc {
  return RichDocSchema.parse(value);
}

/** Plain text, for SEO descriptions and previews. */
export function docToPlainText(doc: RichDoc, limit = 300): string {
  const out: string[] = [];

  const walk = (nodes: RichNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.type === "text" && n.text) out.push(n.text);
      if (n.content) walk(n.content);
      if (n.type === "paragraph") out.push(" ");
    }
  };

  walk(doc.content);
  return out.join("").replace(/\s+/g, " ").trim().slice(0, limit);
}

/** Rough reading time, for the article masthead. 200 wpm is the usual editorial figure. */
export function readingMinutes(doc: RichDoc): number {
  const words = docToPlainText(doc, 100_000).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
