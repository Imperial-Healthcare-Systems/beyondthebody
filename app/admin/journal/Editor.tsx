"use client";

/* The Journal editor.
 *
 * Tiptap, restricted to what the house's typography actually supports: paragraphs,
 * bold, italic, links, one heading level, a pull quote, lists and a rule. The client
 * asked for something "completely functional" and rarely used — so this is a writing
 * box with seven buttons, not a page builder. An editor that could emit anything would
 * let a well-meaning edit quietly break art direction that was gated per beat.
 *
 * The document is submitted as JSON in a hidden field and validated server-side against
 * the same node list; nothing here is trusted. */

import { useActionState, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { savePostAction, type JournalFormState } from "./actions";
import type { RichDoc } from "@/lib/rich-text";

type Props = {
  id?: string;
  initial: {
    title: string;
    slug: string;
    num: string;
    standfirst: string;
    heroImage: string;
    heroAlt: string;
    body: RichDoc;
  };
};

export default function Editor({ id, initial }: Props) {
  const [state, formAction, pending] = useActionState<JournalFormState, FormData>(
    savePostAction,
    {}
  );
  const [json, setJson] = useState(() => JSON.stringify(initial.body));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        /* Off: h1 belongs to the article title, and code/image/table have no place in
           this typographic system. Link is enabled through the toolbar below. */
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
      }),
    ],
    content: initial.body,
    /* Server-rendering a contenteditable produces a hydration mismatch — Tiptap's own
       guidance is to render it on the client only. */
    immediatelyRender: false,
    editorProps: { attributes: { class: "adm__editor" } },
    /* Sync the hidden field on creation as well as on edit. Tiptap normalises what it is
       given — an empty document comes back as one empty paragraph — so the field has to
       carry the editor's version of the document, not the one we handed it, or saving
       without typing would submit a shape the editor never actually held. */
    onCreate: ({ editor }) => setJson(JSON.stringify(editor.getJSON())),
    onUpdate: ({ editor }) => setJson(JSON.stringify(editor.getJSON())),
  });

  const btn = (active: boolean) => `adm__btn adm__btn--ghost${active ? " is-active" : ""}`;

  return (
    <form action={formAction}>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="body" value={json} />

      <section className="adm__panel">
        <div className="adm__field" style={{ maxWidth: "100%" }}>
          <label className="adm__label" htmlFor="title">Title</label>
          <input className="adm__input" id="title" name="title" defaultValue={initial.title} required maxLength={200} />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="adm__field" style={{ maxWidth: 340 }}>
            <label className="adm__label" htmlFor="slug">Web address</label>
            <input className="adm__input" id="slug" name="slug" defaultValue={initial.slug} placeholder="from the title" maxLength={80} />
          </div>
          <div className="adm__field" style={{ maxWidth: 110 }}>
            <label className="adm__label" htmlFor="num">Number</label>
            <input className="adm__input" id="num" name="num" defaultValue={initial.num} placeholder="01" maxLength={8} />
          </div>
        </div>

        <div className="adm__field" style={{ maxWidth: "100%" }}>
          <label className="adm__label" htmlFor="standfirst">Standfirst</label>
          <input className="adm__input" id="standfirst" name="standfirst" defaultValue={initial.standfirst} maxLength={500} />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="adm__field" style={{ flex: "1 1 300px", maxWidth: "100%" }}>
            <label className="adm__label" htmlFor="heroImage">Image path</label>
            <input className="adm__input" id="heroImage" name="heroImage" defaultValue={initial.heroImage} placeholder="/journal/essay-1.webp" maxLength={400} />
          </div>
          <div className="adm__field" style={{ flex: "1 1 300px", maxWidth: "100%" }}>
            <label className="adm__label" htmlFor="heroAlt">Image description</label>
            <input className="adm__input" id="heroAlt" name="heroAlt" defaultValue={initial.heroAlt} maxLength={300} />
          </div>
        </div>
      </section>

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 10 }}>The essay</p>

        <div className="adm__toolbar">
          <button type="button" className={btn(!!editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
          <button type="button" className={btn(!!editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
          <button type="button" className={btn(!!editor?.isActive("heading", { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
          <button type="button" className={btn(!!editor?.isActive("blockquote"))} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
          <button type="button" className={btn(!!editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button>
          <button type="button" className="adm__btn adm__btn--ghost" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>Rule</button>
          <button type="button" className="adm__btn adm__btn--ghost" onClick={() => editor?.chain().focus().undo().run()}>Undo</button>
        </div>

        <EditorContent editor={editor} />
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="adm__btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create draft"}
        </button>
        {state.ok && <span role="status" style={{ color: "#4a6b46", fontSize: 13 }}>{state.ok}</span>}
        {state.error && <span role="alert" style={{ color: "#8a4a4a", fontSize: 13 }}>{state.error}</span>}
      </div>
    </form>
  );
}
