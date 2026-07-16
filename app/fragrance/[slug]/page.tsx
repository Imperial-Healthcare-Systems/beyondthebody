import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import Footer from "../../_sections/Footer";
import PdpHero from "../../_sections/PdpHero";
import PdpComposition from "../../_sections/PdpComposition";
import PdpStory from "../../_sections/PdpStory";
import PdpDetails from "../../_sections/PdpDetails";
import PdpCrossSell from "../../_sections/PdpCrossSell";
import { PRODUCTS, productBySlug } from "../../_sections/products-data";

/* /fragrance/[slug] — the PDP route. Server component; params is awaited (Next 16).
   Chrome the per-page way (Nav + main + Footer + SiteRuntime), NO Preloader. The four
   scents are prerendered; unknown slugs 404. DOM order (client swapped 2↔4 on 07-16):
   Hero → Details → Story → Composition → You-may-also-wear. */

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = productBySlug(slug);
  if (!p) return { title: "Beyond The Body" };
  return {
    title: `${p.name} — Beyond The Body`,
    description: `${p.tagline} A fragrance from a house that begins with scent.`,
  };
}

export default async function FragrancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  return (
    <>
      <Nav />
      <main id="top">
        <PdpHero product={product} />
        <PdpDetails product={product} />
        <PdpStory product={product} />
        <PdpComposition product={product} />
        <PdpCrossSell product={product} />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
