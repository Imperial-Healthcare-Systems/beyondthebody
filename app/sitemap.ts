import type { MetadataRoute } from "next";
import { PRODUCTS } from "./_sections/products-data";
import { env } from "@/lib/env";
import { getPublishedPosts } from "@/lib/journal";

/* Rendered per request (was ISR-hourly): the body needs APP_URL, and evaluating it at
   build made APP_URL a build requirement — a machine with no env failed to build
   (2026-08-19). Per-request keeps the same promise the revalidate made — an essay
   published in admin appears without a deploy — just fresher, and a sitemap request is
   rare enough that the extra render is free. Same fix in robots.ts. */
export const dynamic = "force-dynamic";

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
