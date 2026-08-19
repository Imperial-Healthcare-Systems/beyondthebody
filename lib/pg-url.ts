/* Connection-string normalisation.
 *
 * node-postgres gives `sslmode` in the URL priority over the `ssl` object passed to the
 * Pool, and SILENTLY IGNORES the object when both are present. Two consequences, both
 * bad and neither visible at runtime:
 *
 *   1. Our DATABASE_SSL / DATABASE_SSL_INSECURE settings would do nothing whenever the
 *      URL carries `?sslmode=…` — including the self-hosted-with-internal-CA case the
 *      escape hatch exists for. It would look configured and behave otherwise.
 *   2. `sslmode=require` currently means verify-full in pg, but pg v9 adopts libqp
 *      semantics where it means "encrypt, don't verify". A routine dependency bump would
 *      then quietly downgrade every connection.
 *
 * So `sslmode` is stripped here and TLS is configured exclusively from the environment.
 * Ref: pg's own deprecation warning, and the precedence behaviour documented upstream. */

export type NormalisedConnection = {
  /** Connection string with SSL-related query params removed. */
  connectionString: string;
  /** True if the original URL asked for TLS (any sslmode except `disable`). */
  urlWantedSsl: boolean;
  /** True if an sslmode param was present and removed. */
  strippedSslMode: boolean;
};

const SSL_PARAMS = ["sslmode", "uselibpqcompat", "ssl"];

export function normaliseConnectionString(raw: string): NormalisedConnection {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    /* Not a URL (a libpq key=value DSN, say). Leave it untouched rather than mangle it —
       nothing here is worth breaking a connection string we do not understand. */
    return { connectionString: raw, urlWantedSsl: false, strippedSslMode: false };
  }

  const sslmode = url.searchParams.get("sslmode");
  const strippedSslMode = sslmode !== null;
  const urlWantedSsl = strippedSslMode && sslmode !== "disable";

  for (const param of SSL_PARAMS) url.searchParams.delete(param);

  return { connectionString: url.toString(), urlWantedSsl, strippedSslMode };
}
