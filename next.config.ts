import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { PRIVATE_CACHE_HEADERS, securityHeaders } from "./lib/http-headers";

// Pin Turbopack's workspace root to THIS directory. Next 16 otherwise re-infers the
// root on a dev memory-restart and sometimes lands outside the project (→ "couldn't find
// next/package.json from …/app"). This makes it deterministic.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const dev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },

  /* Don't advertise the framework and version to every scanner on the internet. */
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev }),
      },
      {
        /* The two surfaces that are nobody's business but the person signed in. */
        source: "/admin/:path*",
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        source: "/api/:path*",
        headers: PRIVATE_CACHE_HEADERS,
      },
      {
        /* The customer's own order page is reachable with a token in the URL. Shared
           caches must not keep a copy of somebody's address and phone number. */
        source: "/order/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
