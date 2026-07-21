import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin Turbopack's workspace root to THIS directory. Next 16 otherwise re-infers the
// root on a dev memory-restart and sometimes lands outside the project (→ "couldn't find
// next/package.json from …/app"). This makes it deterministic.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
