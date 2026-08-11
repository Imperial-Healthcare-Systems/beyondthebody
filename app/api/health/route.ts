/* Liveness/readiness probe for the client's ops team.
 *
 * Public, so it says as little as possible: whether the app can reach its database, and
 * nothing about queue depth, versions, or error text. A probe that describes its own
 * internals is a reconnaissance endpoint.
 *
 * 200 = ready to serve. 503 = database unreachable; a load balancer should pull the
 * instance out rather than send it traffic that will fail. */

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { apiRoute, json } from "@/lib/http";

/* Never prerendered or cached — a cached health check is not a health check. */
export const dynamic = "force-dynamic";

export const GET = apiRoute("health", async ({ log }) => {
  try {
    await db.execute(sql`select 1`);
    return json({ status: "ok" });
  } catch (err) {
    log.error("health.db_unreachable", { err });
    return json({ status: "degraded" }, 503);
  }
});
