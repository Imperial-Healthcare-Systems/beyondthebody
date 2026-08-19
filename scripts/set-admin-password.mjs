/* Set (or clear) a staff account's password.
 *
 *   node scripts/set-admin-password.mjs someone@beyondthebody.com "TheirPassword"
 *   node scripts/set-admin-password.mjs someone@beyondthebody.com --clear
 *
 * A password is OPT-IN per account (2026-08-19, client request): accounts without one
 * keep signing in by emailed link alone, and this script is the only way one is ever
 * set — there is no self-service "choose a password" flow, deliberately, for the same
 * reason there is no sign-up page. --clear returns the account to link-only.
 *
 * Hash format must match lib/auth.ts verifyPassword: scrypt:<salt hex>:<hash hex>,
 * keylen 64, default scrypt params. */

import { config as loadDotenv } from "dotenv";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

const [emailArg, passwordArg] = process.argv.slice(2);

if (!emailArg || !passwordArg) {
  console.error(`Usage: node scripts/set-admin-password.mjs <email> <password | --clear>`);
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const clearing = passwordArg === "--clear";

if (!clearing && passwordArg.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

/* Mirrors lib/pg-url.ts — sslmode in the URL would otherwise silently override the ssl
   option below. */
const bool = (v) => /^(true|1)$/i.test(v ?? "");
let connectionString = url;
let urlWantedSsl = false;
try {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get("sslmode");
  urlWantedSsl = sslmode !== null && sslmode !== "disable";
  for (const p of ["sslmode", "uselibpqcompat", "ssl"]) parsed.searchParams.delete(p);
  connectionString = parsed.toString();
} catch {
  /* not a URL — leave it */
}
const useSsl = bool(process.env.DATABASE_SSL) || urlWantedSsl;

const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: useSsl ? (bool(process.env.DATABASE_SSL_INSECURE) ? { rejectUnauthorized: false } : true) : undefined,
});

let hash = null;
if (!clearing) {
  const salt = randomBytes(16);
  hash = `scrypt:${salt.toString("hex")}:${scryptSync(passwordArg, salt, 64).toString("hex")}`;
}

try {
  const { rows } = await pool.query(
    `update admin_user set password_hash = $2 where email = $1
     returning email, role, status`,
    [email, hash]
  );

  if (rows.length === 0) {
    console.error(`No account exists for ${email}. Create it first: npm run admin:create -- ${email}`);
    process.exitCode = 1;
  } else if (clearing) {
    console.log(`\n  ${rows[0].email} — password removed; sign-in is by emailed link again.\n`);
  } else {
    console.log(`\n  ${rows[0].email} — password set (${rows[0].role}, ${rows[0].status}).`);
    console.log(`  They can now sign in with it at /admin/login.\n`);
  }
} catch (err) {
  if (err.code === "42703") {
    console.error("The password_hash column does not exist. Run: npm run db:migrate");
  } else {
    console.error("Failed:", err.message);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
