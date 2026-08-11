/* The headers every response carries.
 *
 * Kept here rather than inline in next.config.ts so the policy is one readable list with
 * its reasoning attached, and so the tests can assert the parts that would be expensive to
 * get wrong — a CSP that blocks the payment sheet takes the shop down; one that forgets
 * `object-src` protects nothing.
 *
 * This module is imported by next.config.ts, which is loaded before the app exists. It must
 * therefore have NO imports at all — no `@/` aliases, no env module, nothing.
 *
 *
 * WHY THERE ARE NO NONCES, WHICH IS THE INTERESTING DECISION HERE
 * ──────────────────────────────────────────────────────────────
 * The obvious strict CSP is `script-src 'self' 'nonce-…' 'strict-dynamic'`. It was tried
 * and rejected, on evidence rather than taste:
 *
 *   · A nonce must be generated per request, so Next can only apply it while rendering
 *     that request — which means EVERY page becomes dynamically rendered. Static
 *     generation and ISR are switched off (next/docs → guides/content-security-policy,
 *     "Static vs Dynamic Rendering with CSP"). This site is 31 pages, of which 28 are
 *     static or ISR; that is its entire performance story and the reason publishing an
 *     essay refreshes the site in seconds instead of a deploy.
 *   · `experimental.sri` was built and inspected as the advertised alternative. It adds
 *     `integrity` to the 6 external chunk <script src> tags and does NOTHING for the 8
 *     inline ones — 2 ours, 6 React's own flight data — which are what a strict policy
 *     would block. It also makes the whole site depend on no proxy ever touching a byte of
 *     JS, which is a poor trade for an experimental flag in a handover.
 *
 * So `script-src` carries 'unsafe-inline', deliberately and with the cost understood: CSP
 * is not what stops script injection here. What stops it is that there is exactly one
 * place visitor-adjacent HTML is produced — the Journal — and it is not HTML. It is a
 * Tiptap document validated against an allowlist schema that rejects unknown nodes and
 * any href that is not http(s) or mailto, with tests to that effect (tests/rich-text).
 *
 * The rest of the policy is still worth every line: an injected `<script src="evil.com">`
 * is blocked, `object-src 'none'` closes the plugin-based bypasses, `base-uri` stops a
 * `<base>` tag redirecting every relative URL on the page, `form-action` stops a form
 * being repointed at somebody else's server, and `frame-ancestors` ends clickjacking.
 */

export type HeaderOptions = {
  /** Development needs 'unsafe-eval' (React uses eval for server-stack reconstruction). */
  dev?: boolean;
};

/* Razorpay's checkout sheet. Enumerated rather than waved through with a wildcard on
   `razorpay.com` alone, because the sheet, its telemetry and its bank redirects are three
   different hosts and a reader should be able to see which is which.
   If prepaid ever stops opening after a Razorpay change, this is the first place to look. */
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const RAZORPAY_HOSTS = "https://*.razorpay.com https://razorpay.com";

export function contentSecurityPolicy({ dev = false }: HeaderOptions = {}): string {
  const directives = [
    "default-src 'self'",

    /* See the file header. 'unsafe-inline' is the price of staying statically rendered. */
    `script-src 'self' 'unsafe-inline' ${RAZORPAY_SCRIPT} ${RAZORPAY_HOSTS}${dev ? " 'unsafe-eval'" : ""}`,

    /* Inline style ATTRIBUTES (style={{…}}) are used throughout the admin screens, and a
       nonce cannot cover an attribute. Injected CSS is a far smaller problem than injected
       script — the worst realistic case is a defaced page, not a stolen session. */
    "style-src 'self' 'unsafe-inline'",

    /* data: for the inlined SVG glyphs; blob: for anything canvas-derived. */
    "img-src 'self' data: blob: https://*.razorpay.com",
    "font-src 'self' data:",

    /* Our own API, and Razorpay's telemetry endpoint, which the sheet calls directly. */
    `connect-src 'self' ${RAZORPAY_HOSTS}${dev ? " ws: http://localhost:*" : ""}`,

    /* The payment sheet renders in an iframe, and bank pages open inside it. */
    `frame-src ${RAZORPAY_HOSTS} ${RAZORPAY_SCRIPT}`,

    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",

    /* The four that cost nothing and close real holes. */
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  /* Not in development: the local server is plain http, and upgrading its own subresources
     to https would break every asset on localhost. */
  if (!dev) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

export function securityHeaders(options: HeaderOptions = {}): { key: string; value: string }[] {
  const { dev = false } = options;

  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },

    /* Stops a browser guessing that an uploaded .txt is really HTML and running it. */
    { key: "X-Content-Type-Options", value: "nosniff" },

    /* Send the origin cross-site, the full path same-site. The order token in
       /order/<token> is a credential, and it must never travel in a Referer to
       somebody else's server. */
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

    /* frame-ancestors already says this; kept for browsers and scanners that read the
       older header, at the cost of one line. */
    { key: "X-Frame-Options", value: "DENY" },

    /* Nothing on this site needs any of these. `payment` is deliberately NOT listed —
       denying it would disable the Payment Request API that Razorpay's sheet uses. */
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()",
    },

    /* Isolates the browsing context, but ALLOW-POPUPS: some netbanking flows open a real
       window, and plain `same-origin` severs the handle Razorpay needs to know it closed. */
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];

  /* Two years, subdomains included, no `preload`. Preloading is a hard-to-reverse
     commitment on the apex domain and belongs to whoever owns the DNS, not to us.
     Omitted in development, where the server is http and the header would only be a
     footgun if a browser ever cached it against localhost. */
  if (!dev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }

  return headers;
}

/* Anything under /admin or /api is per-person and must not be held by a shared cache.
   Route handlers already send their own no-store; this covers the admin PAGES, which are
   force-dynamic but would otherwise be storable by an intermediary proxy. */
export const PRIVATE_CACHE_HEADERS = [
  { key: "Cache-Control", value: "no-store, must-revalidate" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];
