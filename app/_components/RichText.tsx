/* Renders a stored Journal document.
 *
 * Every node maps to a component WE choose. Nothing the editor produces reaches the page
 * as markup, so there is no HTML to sanitise and no `dangerouslySetInnerHTML` anywhere in
 * the Journal — an unknown node type is skipped rather than guessed at.
 *
 * Class names hook into journalarticle.css so the essay inherits the house's typographic
 * scale rather than carrying its own. */

import { Fragment, type ReactNode } from "react";
import type { RichNode } from "@/lib/rich-text";

function marksFor(node: RichNode, children: ReactNode): ReactNode {
  let out = children;

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "link") {
      const href = mark.attrs.href;
      const external = /^https?:\/\//i.test(href);
      out = (
        <a
          className="ja__link"
          href={href}
          /* noopener/noreferrer on every external link: without noopener the opened page
             can reach back through window.opener and navigate this one. */
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {out}
        </a>
      );
    }
  }

  return out;
}

function renderNodes(nodes: RichNode[] | undefined): ReactNode {
  return (nodes ?? []).map((node, i) => <RenderNode key={i} node={node} />);
}

function RenderNode({ node }: { node: RichNode }): ReactNode {
  switch (node.type) {
    case "text":
      return <Fragment>{marksFor(node, node.text ?? "")}</Fragment>;

    case "paragraph":
      return <p className="ja__p">{renderNodes(node.content)}</p>;

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      /* Only h2/h3 are permitted by the schema — h1 belongs to the article title. */
      return level === 3 ? (
        <h3 className="ja__h3">{renderNodes(node.content)}</h3>
      ) : (
        <h2 className="ja__h2">{renderNodes(node.content)}</h2>
      );
    }

    case "blockquote":
      return <blockquote className="ja__quote">{renderNodes(node.content)}</blockquote>;

    case "bulletList":
      return <ul className="ja__list">{renderNodes(node.content)}</ul>;

    case "orderedList":
      return <ol className="ja__list ja__list--num">{renderNodes(node.content)}</ol>;

    case "listItem":
      return <li>{renderNodes(node.content)}</li>;

    case "horizontalRule":
      return <hr className="ja__rule" />;

    case "hardBreak":
      return <br />;

    default:
      /* Unknown node — skip it rather than guess. Keeps a future editor upgrade from
         rendering something the design never accounted for. */
      return null;
  }
}

export default function RichText({ doc }: { doc: { content?: RichNode[] } }) {
  return <>{renderNodes(doc.content)}</>;
}
