/* /journal/[slug] — THE MISSING ROUTE.
 *
 * The Journal index has linked here since Sprint 02 with nothing behind it: three live
 * 404s on a page the nav promises. The essay bodies were written and frozen in
 * journal-data.ts and rendered nowhere.
 *
 * Assembled the per-page way (Preloader → Nav → main → Footer → SiteRuntime). Preloader
 * FIRST: SiteRuntime reads __btbPreloading in its own effect and must see it already set. */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Preloader from "../../_components/Preloader";
import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import Footer from "../../_sections/Footer";
import JournalArticle from "../../_sections/JournalArticle";
import { getPublishedPost, getPublishedPosts } from "@/lib/journal";
import { docToPlainText, readingMinutes } from "@/lib/rich-text";

/* ISR, like the PDPs. The page stays prerendered; publishing from admin calls
   revalidatePath so a new essay appears immediately, and the hour is only the backstop. */
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublishedPost(slug);
  if (!result.found) return { title: "The Journal — Beyond The Body" };

  const { post } = result;
  return {
    title: `${post.title} — Beyond The Body`,
    description: post.standfirst || docToPlainText(post.body, 160),
  };
}

export default async function JournalEssayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublishedPost(slug);

  if (!result.found) {
    /* A renamed essay keeps its old address working — a published URL is a promise, and
       an editorial rename should not 404 everyone who shared it. */
    if (result.redirectTo) permanentRedirect(result.redirectTo);
    notFound();
  }

  const { post } = result;

  /* "Read next" — the following essay in the index order, wrapping at the end so the
     last one still offers a way onward rather than a dead stop. */
  const all = await getPublishedPosts();
  const index = all.findIndex((p) => p.slug === post.slug);
  const nextPost = all.length > 1 ? all[(index + 1) % all.length] : null;

  return (
    <>
      <Preloader />
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
          next={nextPost ? { slug: nextPost.slug, title: nextPost.title } : null}
        />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
