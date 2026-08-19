/* Pure network helpers. Kept free of `next/server` and the database so the parts that
 * are security-critical can be unit tested without a runtime. */

/**
 * Pick the real client IP out of an X-Forwarded-For header.
 *
 * XFF reads `client, proxy1, proxy2` — each hop APPENDS the address it saw, so the
 * rightmost entries are the ones our own infrastructure added and are the only ones we
 * can trust. With N trusted proxies, the client is the Nth entry from the right.
 *
 * Reading the leftmost entry instead — the common implementation — trusts a value the
 * caller wrote, so anyone can spoof an IP and walk through every rate limit by sending
 * their own header.
 *
 * `hops = 0` means nothing trustworthy is in front of us, so no value is returned at
 * all: callers degrade to a shared bucket (over-restrictive) rather than to no limit.
 */
export function pickForwardedIp(xff: string | null | undefined, hops: number): string | null {
  if (hops <= 0) return null;
  if (!xff) return null;

  const parts = xff
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  /* Fewer entries than claimed hops means the header is shorter than the topology
     implies — take the leftmost, which is the earliest address any trusted proxy could
     have reported. Clamping (rather than returning null) keeps limiting working if a
     proxy is reconfigured, and cannot be used to inject an untrusted value. */
  const index = Math.max(parts.length - hops, 0);
  return parts[index] ?? null;
}
