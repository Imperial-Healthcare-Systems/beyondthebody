import type { MetadataRoute } from "next";
import { PRODUCTS } from "./_sections/products-data";
import { env } from "@/lib/env";
import { getPublishedPosts } from "@/lib/journal";

/* Revalidated on the same clock as the Journal, so an essay published in admin appears in
   the sitemap without a deploy — the same promise the rest of the site makes. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;

  /* Fails soft by design (lib/journal falls back to the compiled essays), so a database
     blip produces a slightly stale sitemap rather than a failed build. */
  const essays = await getPublishedPosts();

  /* `priority` is deliberately absent. Google has ignored it for years, and a number
     nobody reads is a number that will eventually be wrong. `changeFrequency` is kept
     because it is at least honest about how often these pages actually move. */
  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${base}/collection`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${base}/journal`, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "yearly" },

    ...PRODUCTS.map((p) => ({
      url: `${base}/fragrance/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
    })),

    ...essays.map((e) => ({
      url: `${base}/journal/${e.slug}`,
      lastModified: e.publishedAt ?? new Date(),
      changeFrequency: "yearly" as const,
    })),

    /* The legal pages: rarely read, never changed, and exactly what a payment gateway's
       reviewer goes looking for. */
    ...["privacy", "terms", "refunds", "shipping"].map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
    })),
  ];
}
