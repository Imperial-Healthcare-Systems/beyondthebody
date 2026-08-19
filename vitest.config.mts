/* Unit tests. Pure logic only — no database, no network, no Next runtime.
 *
 * Anything needing a real Postgres belongs in an integration suite run against a
 * throwaway database; that arrives with phase 5, where order and stock transitions are
 * the things genuinely worth testing end to end. */

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    /* Integration specs share one database; running files in parallel would let one
       file's cleanup delete rows another is asserting on. */
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": resolve(root, ".") },
  },
});
