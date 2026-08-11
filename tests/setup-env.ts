/* Loads .env.local for the integration suite. Unit tests are unaffected — they replace
 * process.env wholesale in their own beforeEach, so nothing here leaks into them. */

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
