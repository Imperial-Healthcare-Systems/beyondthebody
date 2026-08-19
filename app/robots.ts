import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/* Rendered per request, not at build: the body needs APP_URL, and evaluating it during
   `next build` made APP_URL a build requirement — a machine with no env failed to build
   (2026-08-19). At runtime the env is guaranteed (boot refuses without it), and a
   robots.txt computed per request costs nothing at this traffic. Same fix in sitemap.ts. */
export const dynamic = "force-dynamic";

/* What a crawler may look at.
 *
 * Everything disallowed here is either private, per-person, or not the site:
 *
 *   /admin      staff only, and already noindex in its own metadata
 *   /api        machine surface; a crawler indexing JSON helps nobody
 *   /order      reachable with a token in the URL — a crawler must never publish
 *               somebody's order page, which is the whole point of the token
 *   /checkout   a form, and one that means nothing without a bag
 *   /newsletter confirm/unsubscribe endpoints reached from email, single use
 *   /preview    working drawings
 *   /mockup     a treatment nobody chose
 *
 * The last two are also unreachable in production (see lib/env → designRoutesEnabled).
 * Listing them anyway costs one line and covers the case where somebody turns them on for
 * a staging look and forgets. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/order", "/checkout", "/newsletter", "/preview", "/mockup"],
    },
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
