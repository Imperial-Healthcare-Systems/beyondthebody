import { describe, expect, it } from "vitest";
import { pickForwardedIp } from "@/lib/net";

/* This is the function an attacker probes first: if it can be made to return a value the
 * caller controls, every IP rate limit in the app is bypassable by sending a header. */
describe("pickForwardedIp", () => {
  it("returns nothing when no proxy is trusted", () => {
    // The header exists but is entirely attacker-written — trusting it would be the bug.
    expect(pickForwardedIp("1.2.3.4", 0)).toBeNull();
    expect(pickForwardedIp("1.2.3.4, 5.6.7.8", 0)).toBeNull();
  });

  it("reads the client from the RIGHT with one trusted proxy", () => {
    // nginx appended 203.0.113.9; that is the address it actually saw.
    expect(pickForwardedIp("203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("ignores a spoofed entry the caller prepended", () => {
    // Attacker sent "X-Forwarded-For: 9.9.9.9"; nginx appended their real 203.0.113.9.
    // Taking the leftmost would hand the attacker a fresh rate-limit bucket per request.
    expect(pickForwardedIp("9.9.9.9, 203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("skips exactly the trusted hops with a proxy chain", () => {
    // Cloudflare + nginx: client, cf, nginx-observed.
    expect(pickForwardedIp("9.9.9.9, 198.51.100.1, 203.0.113.9", 2)).toBe("198.51.100.1");
  });

  it("clamps rather than over-reading when the header is shorter than the topology", () => {
    expect(pickForwardedIp("203.0.113.9", 3)).toBe("203.0.113.9");
  });

  it("handles absent, empty and whitespace-only headers", () => {
    expect(pickForwardedIp(null, 1)).toBeNull();
    expect(pickForwardedIp(undefined, 1)).toBeNull();
    expect(pickForwardedIp("", 1)).toBeNull();
    expect(pickForwardedIp("   ,  , ", 1)).toBeNull();
  });

  it("trims whitespace around entries", () => {
    expect(pickForwardedIp("  9.9.9.9 ,  203.0.113.9  ", 1)).toBe("203.0.113.9");
  });
});
