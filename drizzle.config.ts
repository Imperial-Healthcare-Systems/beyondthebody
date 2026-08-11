/* drizzle-kit config — generates SQL migrations from db/schema into db/migrations.
 *
 * Workflow: edit the schema → `npm run db:generate` → review the generated SQL →
 * commit both → `npm run db:migrate` on deploy. `db:push` exists for local iteration
 * only; it skips migration files and must never be pointed at production. */

import { defineConfig } from "drizzle-kit";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

/* `generate` only diffs the schema against db/migrations and never connects, so it must
   work on a machine with no database. Commands that DO connect (`migrate`, `push`,
   `studio`) fail with their own clear message, and scripts/db-migrate.mjs checks
   explicitly before it starts. */
const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  /* Every table this app owns is unprefixed and lives in `public`; the filter stops
     drizzle-kit from proposing to drop anything else that shares the database. */
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
