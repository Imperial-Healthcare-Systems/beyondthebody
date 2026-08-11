/* Next 16 startup hook — `register()` runs once when a server instance boots, before it
 * accepts requests (node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 *
 * Guarded on NEXT_RUNTIME: this file is also evaluated for the edge runtime, where `pg`
 * and the job worker cannot run. The dynamic import keeps the database out of the edge
 * bundle entirely rather than importing it and hoping it is never called. */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startup } = await import("./lib/startup");
  await startup();
}
