import { describe, expect, it } from "vitest";
import { normaliseConnectionString } from "@/lib/pg-url";

/* If `sslmode` survives into the connection string, node-postgres silently discards the
 * whole `ssl` config object — so DATABASE_SSL_INSECURE stops working with no error, and
 * pg v9 would quietly reinterpret `require` as "encrypt but don't verify". */
describe("normaliseConnectionString", () => {
  it("strips sslmode and reports that the URL wanted TLS", () => {
    const r = normaliseConnectionString(
      "postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require"
    );
    expect(r.connectionString).not.toContain("sslmode");
    expect(r.urlWantedSsl).toBe(true);
    expect(r.strippedSslMode).toBe(true);
  });

  it("treats sslmode=disable as not wanting TLS", () => {
    const r = normaliseConnectionString("postgresql://u:p@localhost:5432/btb?sslmode=disable");
    expect(r.urlWantedSsl).toBe(false);
    expect(r.strippedSslMode).toBe(true);
  });

  it("removes the libpq-compat and ssl params too", () => {
    const r = normaliseConnectionString(
      "postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require&ssl=true"
    );
    expect(r.connectionString).not.toMatch(/sslmode|uselibpqcompat|ssl=/);
  });

  it("keeps unrelated query parameters intact", () => {
    const r = normaliseConnectionString(
      "postgresql://u:p@h/db?sslmode=require&application_name=btb&connect_timeout=10"
    );
    expect(r.connectionString).toContain("application_name=btb");
    expect(r.connectionString).toContain("connect_timeout=10");
    expect(r.connectionString).not.toContain("sslmode");
  });

  it("leaves a plain URL untouched", () => {
    const raw = "postgresql://u:p@localhost:5432/btb";
    const r = normaliseConnectionString(raw);
    expect(r.strippedSslMode).toBe(false);
    expect(r.urlWantedSsl).toBe(false);
    expect(r.connectionString).toContain("localhost:5432");
  });

  it("preserves credentials and database name", () => {
    const r = normaliseConnectionString(
      "postgresql://neondb_owner:npg_secret@ep-x.aws.neon.tech/neondb?sslmode=require"
    );
    expect(r.connectionString).toContain("neondb_owner");
    expect(r.connectionString).toContain("npg_secret");
    expect(r.connectionString).toContain("/neondb");
  });

  it("returns a non-URL DSN unchanged rather than mangling it", () => {
    const dsn = "host=localhost user=btb dbname=btb sslmode=require";
    const r = normaliseConnectionString(dsn);
    expect(r.connectionString).toBe(dsn);
    expect(r.strippedSslMode).toBe(false);
  });
});
