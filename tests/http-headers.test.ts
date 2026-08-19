/* The security headers, asserted as a policy rather than as a string.
 *
 * Two opposite failures matter here, and a browser reports neither to us:
 *
 *   TOO LOOSE — somebody adds a host to get a script working and quietly removes the
 *               protection everyone assumed was there.
 *   TOO TIGHT — a directive drops a host the payment sheet needs, and prepaid checkout
 *               stops opening for every customer while the server logs nothing at all.
 *
 * These tests are cheap insurance against both, and they are the only place the intent
 * behind each directive is written down as something executable.
 */

import { describe, expect, it } from "vitest";
import {
  PRIVATE_CACHE_HEADERS,
  contentSecurityPolicy,
  securityHeaders,
} from "@/lib/http-headers";

/** Pull one directive out of the policy, as a list of its sources. */
function directive(policy: string, name: string): string[] {
  const found = policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (found === undefined) return [];
  return found.slice(name.length).trim().split(/\s+/).filter(Boolean);
}

const prod = contentSecurityPolicy();
const dev = contentSecurityPolicy({ dev: true });

describe("the content security policy", () => {
  it("closes the four holes that cost nothing to close", () => {
    /* Each of these has a specific attack behind it, and none of them constrains this
       site in any way — which is exactly why forgetting one is so easy. */
    expect(directive(prod, "object-src"), "plugin-based bypass").toEqual(["'none'"]);
    expect(directive(prod, "base-uri"), "<base> repointing every relative URL").toEqual(["'self'"]);
    expect(directive(prod, "form-action"), "a form posted to somebody else").toEqual(["'self'"]);
    expect(directive(prod, "frame-ancestors"), "clickjacking").toEqual(["'none'"]);
  });

  it("defaults to same-origin so an unlisted directive fails closed", () => {
    expect(directive(prod, "default-src")).toEqual(["'self'"]);
  });

  it("lets the payment sheet load, connect and frame", () => {
    /* If any of these three loses Razorpay, prepaid checkout breaks in the customer's
       browser and nowhere else. */
    for (const name of ["script-src", "connect-src", "frame-src"]) {
      expect(
        directive(prod, name).some((s) => s.includes("razorpay.com")),
        `${name} must reach Razorpay`
      ).toBe(true);
    }
    expect(directive(prod, "script-src")).toContain("https://checkout.razorpay.com");
  });

  it("never allows eval in production, and does in development", () => {
    /* React uses eval in dev to rebuild server stacks; production has no such excuse. */
    expect(prod).not.toContain("'unsafe-eval'");
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
  });

  it("keeps inline script allowed, deliberately and only here", () => {
    /* Not an oversight — see lib/http-headers, "why there are no nonces". If this ever
       becomes removable (a Next release that nonces static output, say), this test is the
       thing that should fail and prompt the change. */
    expect(directive(prod, "script-src")).toContain("'unsafe-inline'");
    /* But nothing else gets a free pass: no wildcard host anywhere in the policy. */
    expect(prod).not.toMatch(/(^|\s)\*($|\s|;)/);
    expect(prod).not.toContain("http://");
  });

  it("upgrades insecure requests in production only", () => {
    /* On a plain-http localhost this would break every asset. */
    expect(prod).toContain("upgrade-insecure-requests");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});

describe("the other headers", () => {
  const value = (headers: { key: string; value: string }[], key: string) =>
    headers.find((h) => h.key === key)?.value;

  it("sets the ones a scanner will look for", () => {
    const headers = securityHeaders();
    expect(value(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(value(headers, "X-Frame-Options")).toBe("DENY");
    expect(value(headers, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("keeps the order token out of other people's Referer logs", () => {
    /* /order/<token> is a credential in a URL. `no-referrer-when-downgrade` and
       `origin-when-cross-origin` would both leak the path to another site. */
    const policy = value(securityHeaders(), "Referrer-Policy")!;
    expect(["strict-origin-when-cross-origin", "strict-origin", "no-referrer"]).toContain(policy);
  });

  it("does not disable the payment permission", () => {
    /* Denying `payment` would switch off the Payment Request API the sheet uses. */
    expect(value(securityHeaders(), "Permissions-Policy")).not.toContain("payment=");
  });

  it("allows popups while isolating the page", () => {
    /* Plain `same-origin` severs the window handle some netbanking flows need. */
    expect(value(securityHeaders(), "Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
  });

  it("sets HSTS in production but never in development", () => {
    expect(value(securityHeaders(), "Strict-Transport-Security")).toMatch(/max-age=\d+/);
    /* No `preload`: it is a hard-to-reverse commitment on the apex domain, and belongs to
       whoever owns the DNS rather than to this codebase. */
    expect(value(securityHeaders(), "Strict-Transport-Security")).not.toContain("preload");
    expect(value(securityHeaders({ dev: true }), "Strict-Transport-Security")).toBeUndefined();
  });

  it("keeps private pages out of shared caches and search results", () => {
    const cache = PRIVATE_CACHE_HEADERS.find((h) => h.key === "Cache-Control")?.value;
    expect(cache).toContain("no-store");
    expect(PRIVATE_CACHE_HEADERS.find((h) => h.key === "X-Robots-Tag")?.value).toContain("noindex");
  });
});
