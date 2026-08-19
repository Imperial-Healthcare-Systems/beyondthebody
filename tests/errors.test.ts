import { describe, expect, it } from "vitest";
import { AppError, ErrorCode, isAppError, notFound, rateLimited, validationFailed } from "@/lib/errors";
import { maskEmail } from "@/lib/logger";

describe("AppError", () => {
  it("maps each code to its documented status", () => {
    expect(notFound().status).toBe(404);
    expect(validationFailed([]).status).toBe(400);
    expect(rateLimited(30).status).toBe(429);
    expect(new AppError(ErrorCode.OUT_OF_STOCK, "x").status).toBe(409);
    expect(new AppError(ErrorCode.STORE_CLOSED, "x").status).toBe(503);
  });

  it("serialises to the single documented response shape", () => {
    const body = new AppError(ErrorCode.OUT_OF_STOCK, "That size just sold out.").toBody();
    expect(body).toEqual({
      error: { code: "out_of_stock", message: "That size just sold out." },
    });
  });

  it("omits details entirely when there are none", () => {
    expect(Object.keys(notFound().toBody().error)).toEqual(["code", "message"]);
  });

  it("never serialises logContext into the response", () => {
    // logContext exists for the log line only — it may carry internals a visitor must not see.
    const err = new AppError(ErrorCode.INTERNAL, "Something went wrong.", {
      logContext: { sku: "MA-100", internalReason: "pricing table empty" },
    });
    expect(JSON.stringify(err.toBody())).not.toContain("pricing table empty");
  });

  it("is recognisable after being thrown and caught", () => {
    try {
      throw notFound("No such fragrance.");
    } catch (e) {
      expect(isAppError(e)).toBe(true);
    }
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("carries a retry hint on 429 so the client can back off", () => {
    expect(rateLimited(42).toBody().error.details).toEqual({ retryAfterSec: 42 });
  });
});

describe("maskEmail", () => {
  it("keeps an address supportable without logging it in the clear", () => {
    expect(maskEmail("someone@beyondthebody.com")).toBe("so*****@beyondthebody.com");
  });

  it("does not expose a very short local part", () => {
    expect(maskEmail("a@b.com")).toBe("a*@b.com");
  });
});
