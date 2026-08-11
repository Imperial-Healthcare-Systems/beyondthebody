/* Capability tokens — emailed links that stand in for a login.
 *
 * Used by the newsletter (confirm, unsubscribe) and, from phase 2 and 6, by admin magic
 * links and guest order-status links. One implementation so the rules hold everywhere:
 *
 *   · the raw token exists only in the email; the database stores its SHA-256
 *   · lookups compare hashes, so a database dump yields no working links
 *   · comparison is constant-time wherever a value is checked against a known secret
 *
 * SHA-256 rather than a password hash is deliberate and correct here: these tokens are
 * 256 bits of CSPRNG output, not human-chosen secrets, so there is nothing to brute
 * force and no need for a slow KDF. */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, URL-safe. Long enough that guessing is not a threat model. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What goes in the database. Never store the raw token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  /* timingSafeEqual throws on a length mismatch, which would itself leak — check first. */
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Email addresses are compared and stored in one canonical form, so that
 *  `Someone@Example.com ` and `someone@example.com` cannot become two subscriptions. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const CONFIRM_TOKEN_TTL_HOURS = 48;

export function confirmExpiry(from = new Date()): Date {
  return new Date(from.getTime() + CONFIRM_TOKEN_TTL_HOURS * 3_600 * 1000);
}
