/* Structured logging — one JSON object per line on stdout/stderr.
 *
 * Deliberately not a library. The client's team deploys this on their own servers and
 * will ship logs with whatever they already run (journald, Docker, Filebeat, Loki); a
 * line of JSON is the one format all of those read without configuration.
 *
 * Never log a raw email, address, phone number, token, or payment payload. `redact()`
 * catches the obvious keys, but the real defence is not passing them in. */

import { env } from "./env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/* Substring match, lowercased — catches token/accessToken/token_hash in one rule. */
const SECRET_KEYS = [
  "password", "secret", "token", "authorization", "cookie", "signature",
  "apikey", "api_key", "key_secret", "card", "cvv", "otp",
];

const isSecret = (key: string) => {
  const k = key.toLowerCase();
  return SECRET_KEYS.some((s) => k.includes(s));
};

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecret(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Keep an email usable for support without storing it in plaintext logs. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  let threshold: number;
  try {
    threshold = ORDER[env.LOG_LEVEL];
  } catch {
    /* Env not loadable yet (very early boot, or a bad config we are about to report).
       Logging must never be the thing that crashes startup. */
    threshold = ORDER.info;
  }
  if (ORDER[level] < threshold) return;

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  });

  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),

  /** Returns a logger that stamps every line with the same fields (e.g. a request id). */
  child(base: Record<string, unknown>) {
    return {
      debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, { ...base, ...c }),
      info: (m: string, c?: Record<string, unknown>) => emit("info", m, { ...base, ...c }),
      warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, { ...base, ...c }),
      error: (m: string, c?: Record<string, unknown>) => emit("error", m, { ...base, ...c }),
    };
  },
};

export type Logger = ReturnType<typeof logger.child>;
