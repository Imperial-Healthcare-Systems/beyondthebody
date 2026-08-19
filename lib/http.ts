/* Route-handler plumbing: one wrapper that every /api handler goes through, so error
 * shape, logging, request ids and cache headers are decided once instead of per file. */

import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, ErrorCode, isAppError, validationFailed } from "./errors";
import { logger } from "./logger";
import { env } from "./env";
import { pickForwardedIp } from "./net";

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  const res = NextResponse.json(body as object, { status, headers });
  /* API responses are never cached: several carry live stock and price, and a shared
     cache in front of the app must not hand one visitor another's checkout state. */
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

/** Client IP, honouring exactly TRUSTED_PROXY_HOPS entries of X-Forwarded-For.
 *
 * X-Forwarded-For reads `client, proxy1, proxy2` — appended left to right, so the
 * rightmost entries are the ones our own infrastructure added and can be trusted. With
 * N trusted proxies the real client is the Nth from the right. Trusting the *leftmost*
 * entry (the common mistake) lets anyone spoof an IP and walk straight through every
 * rate limit by sending their own header.
 *
 * Returns null when no trustworthy value exists; callers must degrade to a shared
 * bucket rather than to no limit. */
export function clientIp(req: NextRequest): string | null {
  /* hops = 0 means nothing in front of us is trusted, and a Node server behind
     `next start` does not expose the socket address here — so every IP header is
     attacker-controlled. startup.ts warns about this in production.
     The selection rule itself lives in lib/net.ts, where it is unit tested. */
  return pickForwardedIp(req.headers.get("x-forwarded-for"), env.TRUSTED_PROXY_HOPS);
}

/** Stable, non-reversible key for rate limiting and audit rows — never store a raw IP. */
export async function hashIp(ip: string | null): Promise<string> {
  if (!ip) return "unknown";
  const data = new TextEncoder().encode(`${ip}:${env.SESSION_SECRET}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex").slice(0, 32);
}

/** Parse and validate a JSON body. Rejects oversized and malformed payloads cleanly. */
export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "Expected a JSON body.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed(
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }))
    );
  }
  return parsed.data;
}

export type RouteContext = {
  req: NextRequest;
  requestId: string;
  log: ReturnType<typeof logger.child>;
};

type RouteHandler = (ctx: RouteContext) => Promise<Response | unknown>;

/** Wraps a handler: assigns a request id, logs the outcome, and converts anything
 *  thrown into the single documented error shape. */
export function apiRoute(name: string, handler: RouteHandler) {
  return async (req: NextRequest): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const log = logger.child({ requestId, route: name, method: req.method });
    const startedAt = Date.now();

    try {
      const result = await handler({ req, requestId, log });
      const res = result instanceof Response ? result : json(result);
      res.headers.set("X-Request-Id", requestId);
      log.info("request.ok", { status: res.status, ms: Date.now() - startedAt });
      return res;
    } catch (err) {
      /* A ZodError escaping a handler means a schema was used without readJson —
         still a client error, so report it as one rather than a 500. */
      const appErr = isAppError(err)
        ? err
        : err instanceof ZodError
          ? validationFailed(err.issues.map((i) => ({ path: i.path.join("."), message: i.message })))
          : null;

      if (appErr) {
        /* Expected failure: log at the level its status deserves, no stack. */
        const level = appErr.status >= 500 ? "error" : "warn";
        log[level]("request.failed", {
          status: appErr.status,
          code: appErr.code,
          ms: Date.now() - startedAt,
          ...appErr.logContext,
        });
        const res = json(appErr.toBody(), appErr.status);
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      /* Unexpected: this is a bug. Log everything, tell the caller nothing. */
      log.error("request.crashed", { err, ms: Date.now() - startedAt });
      const res = json(
        {
          error: {
            code: ErrorCode.INTERNAL,
            message: "Something went wrong on our side. Please try again.",
          },
        },
        500
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
  };
}
