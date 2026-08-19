/* The document format, tested without a database.
 *
 * This is the security boundary of the Journal: whatever survives parseRichDoc is
 * rendered to every visitor. The renderer has no HTML sanitiser because it never handles
 * HTML — so these cases are what stands between an editor paste and the public page. */

import { describe, expect, it } from "vitest";
import {
  EMPTY_DOC,
  docToPlainText,
  parseRichDoc,
  readingMinutes,
  type RichDoc,
} from "@/lib/rich-text";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const para = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

describe("rich text · what is allowed in", () => {
  it("accepts the prose the editor can actually produce", () => {
    const input = doc(
      para("An ordinary paragraph."),
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A section" }] },
      { type: "blockquote", content: [para("A pull quote.")] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [para("One")] }],
      },
      { type: "horizontalRule" }
    );
    expect(() => parseRichDoc(input)).not.toThrow();
  });

  it("accepts an empty document", () => {
    expect(parseRichDoc({ type: "doc", content: [] })).toEqual(EMPTY_DOC);
    /* Tiptap omits `content` entirely for a brand-new empty editor. */
    expect(parseRichDoc({ type: "doc" })).toEqual(EMPTY_DOC);
  });

  it("rejects a node type that is not on the list", () => {
    /* An <img> would put an unbriefed image into an art-directed page; a <table> would
       carry its own typography. Neither is a security hole — both are art-direction ones,
       which is why the list is short rather than merely safe. */
    expect(() => parseRichDoc(doc({ type: "image", attrs: { src: "/x.jpg" } }))).toThrow();
    expect(() => parseRichDoc(doc({ type: "table" }))).toThrow();
  });

  it("rejects a script-bearing link href", () => {
    const attack = (href: string) =>
      parseRichDoc(doc(para("click", [{ type: "link", attrs: { href } }])));

    expect(() => attack("javascript:alert(1)")).toThrow();
    expect(() => attack("JaVaScRiPt:alert(1)")).toThrow(); // scheme match is case-insensitive
    expect(() => attack("data:text/html,<script>alert(1)</script>")).toThrow();
    expect(() => attack("vbscript:msgbox(1)")).toThrow();
  });

  it("allows the three link shapes an essay legitimately needs", () => {
    const ok = (href: string) =>
      expect(() =>
        parseRichDoc(doc(para("read", [{ type: "link", attrs: { href } }])))
      ).not.toThrow();

    ok("https://example.com/essay");
    ok("http://example.com");
    ok("mailto:hello@beyondthebody.invalid");
    ok("/journal/three-towns-and-a-bottle"); // internal
  });

  it("rejects a mark it does not know", () => {
    expect(() =>
      parseRichDoc(doc(para("x", [{ type: "textStyle", attrs: { color: "#f00" } }])))
    ).toThrow();
  });

  it("holds headings to the two levels the type scale has", () => {
    const heading = (level: number) =>
      parseRichDoc(doc({ type: "heading", attrs: { level }, content: [{ type: "text", text: "h" }] }));

    expect(() => heading(2)).not.toThrow();
    expect(() => heading(3)).not.toThrow();
    /* h1 is the article title. h4+ has nothing to render it with. */
    expect(() => heading(1)).toThrow();
    expect(() => heading(4)).toThrow();
  });

  it("validates all the way down a nested document", () => {
    /* The schema is recursive; a disallowed node three levels deep must still be caught,
       because the renderer walks the whole tree. */
    const nested = doc({
      type: "blockquote",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "image", attrs: { src: "x" } }] }],
        },
      ],
    });
    expect(() => parseRichDoc(nested)).toThrow();
  });

  it("rejects something that is not a document at all", () => {
    expect(() => parseRichDoc(null)).toThrow();
    expect(() => parseRichDoc("<p>hello</p>")).toThrow();
    expect(() => parseRichDoc({ type: "paragraph" })).toThrow();
  });
});

describe("rich text · derived values", () => {
  const essay: RichDoc = parseRichDoc(
    doc(para("The first paragraph runs on."), para("A second follows it."))
  );

  it("flattens a document to plain text", () => {
    expect(docToPlainText(essay)).toBe("The first paragraph runs on. A second follows it.");
  });

  it("truncates to the limit it was given", () => {
    expect(docToPlainText(essay, 9)).toBe("The first");
  });

  it("never reports a reading time of zero", () => {
    /* "1 min read" on a short essay; "0 min read" would read as a bug to the client. */
    expect(readingMinutes(EMPTY_DOC)).toBe(1);
    expect(readingMinutes(essay)).toBe(1);
  });

  it("scales reading time with length", () => {
    const long = parseRichDoc(doc(para(Array(600).fill("word").join(" "))));
    expect(readingMinutes(long)).toBe(3); // 600 words at 200wpm
  });
});
