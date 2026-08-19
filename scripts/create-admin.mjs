/* Create or update a staff account.
 *
 *   npm run admin:create -- someone@beyondthebody.com owner "Their Name"
 *
 * This is the bootstrap: there is no sign-up page and no way to grant yourself access
 * through the web interface, by design. The first account must be created by someone with
 * shell access to the server, and every later one by an existing owner running this.
 *
 * Creating an account grants nothing on its own — there is no password. The person signs
 * in by requesting a link at /admin/login, which only works for an address listed here. */

import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

const [emailArg, roleArg = "editor", nameArg = null] = process.argv.slice(2);

if (!emailArg) {
  console.error(`Usage: npm run admin:create -- <email> [owner|editor] ["Name"]

  owner   full access: prices, refunds, subscriber export, staff
  editor  journal and media only`);
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const role = roleArg.trim().toLowerCase();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`Not a valid email address: ${email}`);
  process.exit(1);
}
if (!["owner", "editor"].includes(role)) {
  console.error(`Role must be "owner" or "editor", got: ${role}`);
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

try {
  const { rows } = await pool.query(
    `insert into admin_user (email, name, role, status)
     values ($1, $2, $3, 'active')
     on conflict (email) do update
       set role = excluded.role,
           name = coalesce(excluded.name, admin_user.name),
           status = 'active'
     returning id, email, name, role, status, created_at`,
    [email, nameArg, role]
  );

  const user = rows[0];
  console.log(`\n  ${user.email}  —  ${user.role}\n`);
  console.log(`  They can now sign in at /admin/login.`);
  console.log(`  No password is set or needed; sign-in is by emailed link.\n`);
} catch (err) {
  if (err.code === "42P01") {
    console.error("The admin_user table does not exist. Run: npm run db:migrate");
  } else {
    console.error("Failed:", err.message);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
