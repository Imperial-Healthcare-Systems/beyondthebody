import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetEnvCache, loadEnv } from "@/lib/env";

const VALID = {
  DATABASE_URL: "postgresql://btb:pw@localhost:5432/btb",
  APP_URL: "https://beyondthebody.com",
  SESSION_SECRET: "0".repeat(32),
};

let original: NodeJS.ProcessEnv;

beforeEach(() => {
  original = process.env;
  /* Start from a clean slate: a stray DATABASE_URL in the developer's shell would
     otherwise make the "missing var" cases pass for the wrong reason. */
  process.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
  __resetEnvCache();
});

afterEach(() => {
  process.env = original;
  __resetEnvCache();
});

describe("loadEnv", () => {
  it("accepts a minimal valid environment and applies defaults", () => {
    Object.assign(process.env, VALID);
    const env = loadEnv();

    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.WORKER_ENABLED).toBe(true);
    // Safe default: trust no proxy header until the deployment says how many to trust.
    expect(env.TRUSTED_PROXY_HOPS).toBe(0);
  });

  it("refuses a short SESSION_SECRET", () => {
    Object.assign(process.env, { ...VALID, SESSION_SECRET: "too-short" });
    expect(() => loadEnv()).toThrow(/SESSION_SECRET/);
  });

  it("refuses a missing DATABASE_URL", () => {
    Object.assign(process.env, { ...VALID, DATABASE_URL: undefined });
    expect(() => loadEnv()).toThrow(/DATABASE_URL/);
  });

  it("refuses an APP_URL that is not a URL", () => {
    Object.assign(process.env, { ...VALID, APP_URL: "beyondthebody.com" });
    expect(() => loadEnv()).toThrow(/APP_URL/);
  });

  it("reports every problem at once rather than one per restart", () => {
    process.env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
    try {
      loadEnv();
      expect.unreachable("expected loadEnv to throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("APP_URL");
      expect(message).toContain("SESSION_SECRET");
    }
  });

  it("coerces booleanish and numeric strings", () => {
    Object.assign(process.env, {
      ...VALID,
      DATABASE_SSL: "true",
      WORKER_ENABLED: "0",
      TRUSTED_PROXY_HOPS: "2",
    });
    const env = loadEnv();

    expect(env.DATABASE_SSL).toBe(true);
    expect(env.WORKER_ENABLED).toBe(false);
    expect(env.TRUSTED_PROXY_HOPS).toBe(2);
  });

  it("memoises so repeated reads do not re-parse", () => {
    Object.assign(process.env, VALID);
    const first = loadEnv();
    process.env.LOG_LEVEL = "debug"; // changed after the first read
    expect(loadEnv().LOG_LEVEL).toBe(first.LOG_LEVEL);
  });
});
