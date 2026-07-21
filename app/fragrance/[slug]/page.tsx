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
import PdpBlueprint from "../../_sections/PdpBlueprint";
import PdpAssurances from "../../_sections/PdpAssurances";
import { PRODUCTS, productBySlug } from "../../_sections/products-data";

/* /fragrance/[slug] — the PDP route. Server component; params is awaited (Next 16).
   Chrome the per-page way (Nav + main + Footer + SiteRuntime), NO Preloader. The four
   scents are prerendered; unknown slugs 404.

   DOM order — rebuilt 2026-07-17. The Particulars keeps its original slot after the Hero;
   the DENSER new specs (Blueprint, Assurances) go below the recommendations (client's Amazon
   ordering — editorial + quick details up top, the recs mid-page, the marketing/FAQ tail last):
     Hero → The Particulars → Story → Composition → You-may-also-wear → The Blueprint → Assurances. */

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
        <PdpBlueprint product={product} />
        <PdpAssurances />
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
