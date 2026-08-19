/* /admin/journal/[id]/preview — a draft, rendered exactly as the public article route
 * renders it, so what the client approves is what ships.
 *
 * Gated by requireAdminPage, dynamic, and noindex. That combination is what keeps a
 * draft private: there is no token in the URL to leak, and it can never be prerendered
 * into the ISR cache and served to a visitor. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "@/app/_components/Nav";
import SiteRuntime from "@/app/_components/SiteRuntime";
import Footer from "@/app/_sections/Footer";
import JournalArticle from "@/app/_sections/JournalArticle";
import { requireAdminPage } from "@/lib/admin-session";
import { getPostForPreview } from "@/lib/journal";
import { readingMinutes } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview — Beyond The Body",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  /* Authorisation FIRST — before the post is even loaded. */
  await requireAdminPage("editor");

  const { id } = await params;
  const post = await getPostForPreview(id);
  if (!post) notFound();

  return (
    <>
      {/* No Preloader here: the curtain exists to cover the entrance choreography on a
          real visit, and an editor checking a draft should see the page immediately. */}
      <Nav />
      <main id="top">
        <JournalArticle
          num={post.num}
          title={post.title}
          standfirst={post.standfirst}
          body={post.body}
          img={post.img}
          imgAlt={post.imgAlt}
          readingMinutes={readingMinutes(post.body)}
          isDraft
        />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
