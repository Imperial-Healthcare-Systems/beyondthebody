/* One error shape for the whole API:
 *     { error: { code, message, details? } }
 *
 * `code` is a stable machine string the frontend may branch on — never reword an existing
 * one, add a new one. `message` is safe to render to a visitor as-is: it must never leak
 * a SKU that does not exist, whether an email is registered, or any internal detail.
 *
 * Anything thrown that is NOT an AppError is treated as a bug: logged with its stack and
 * returned as a generic 500. That asymmetry is deliberate — unexpected failures must not
 * accidentally describe themselves to the internet. */

export const ErrorCode = {
  /* client */
  VALIDATION_FAILED: "validation_failed",
  NOT_FOUND: "not_found",
  RATE_LIMITED: "rate_limited",
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
  CONFLICT: "conflict",

  /* commerce — reserved here so the vocabulary is defined in one place */
  CART_EMPTY: "cart_empty",
  SKU_UNAVAILABLE: "sku_unavailable",
  OUT_OF_STOCK: "out_of_stock",
  PRICE_CHANGED: "price_changed",
  PRICE_UNSET: "price_unset",
  COD_UNAVAILABLE: "cod_unavailable",
  STORE_CLOSED: "store_closed",
  PAYMENT_VERIFICATION_FAILED: "payment_verification_failed",

  /* server */
  INTERNAL: "internal_error",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const DEFAULT_STATUS: Record<ErrorCodeValue, number> = {
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.CART_EMPTY]: 400,
  [ErrorCode.SKU_UNAVAILABLE]: 409,
  [ErrorCode.OUT_OF_STOCK]: 409,
  [ErrorCode.PRICE_CHANGED]: 409,
  [ErrorCode.PRICE_UNSET]: 409,
  [ErrorCode.COD_UNAVAILABLE]: 409,
  [ErrorCode.STORE_CLOSED]: 503,
  [ErrorCode.PAYMENT_VERIFICATION_FAILED]: 400,
  [ErrorCode.INTERNAL]: 500,
};

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly details?: unknown;
  /** Extra context for the log line only — never serialised into the response. */
  readonly logContext?: Record<string, unknown>;

  constructor(
    code: ErrorCodeValue,
    message: string,
    opts: { status?: number; details?: unknown; logContext?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? DEFAULT_STATUS[code];
    this.details = opts.details;
    this.logContext = opts.logContext;
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/* Constructors for the cases used often enough that the argument order matters. */
export const notFound = (what = "Not found") => new AppError(ErrorCode.NOT_FOUND, what);

export const validationFailed = (details: unknown) =>
  new AppError(ErrorCode.VALIDATION_FAILED, "Some of the details provided aren't valid.", {
    details,
  });

export const rateLimited = (retryAfterSec: number) =>
  new AppError(ErrorCode.RATE_LIMITED, "Too many attempts. Please try again shortly.", {
    details: { retryAfterSec },
  });

export const unauthenticated = () =>
  new AppError(ErrorCode.UNAUTHENTICATED, "You need to sign in to do that.");

export const forbidden = () =>
  new AppError(ErrorCode.FORBIDDEN, "You don't have access to that.");
