/* Loads .env.local for the integration suite. Unit tests are unaffected — they replace
 * process.env wholesale in their own beforeEach, so nothing here leaks into them. */

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/* Order notifications otherwise fall back to the MAIL_FROM address, which is a real
 * domain — so a test's queued mail would be indistinguishable from anyone else's and its
 * cleanup could not safely delete it. Left behind, those rows fill the job worker's
 * batches in the NEXT integration file, which is how phase 0's concurrency spec started
 * failing for reasons that had nothing to do with phase 0. */
process.env.ORDERS_EMAIL ??= "studio-test@beyondthebody.invalid";
