/* GET /api/v1/admin/subscribers/export — CSV of confirmed subscribers.
 *
 * Owner-only, and audited: this is the one endpoint that hands the entire mailing list to
 * whoever calls it, so who exported it and when is worth being able to answer later.
 *
 * Only CONFIRMED addresses are included. Pending ones asked but never agreed, and
 * unsubscribed ones actively withdrew — exporting either would be the mechanism by which
 * a double opt-in gets quietly undone downstream. */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriber } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-session";
import { audit } from "@/lib/audit";
import { apiRoute, clientIp, hashIp } from "@/lib/http";

export const dynamic = "force-dynamic";

/** RFC 4180 quoting, plus the spreadsheet-injection guard.
 *
 *  A value beginning = + - or @ is interpreted as a FORMULA by Excel and Sheets, so a
 *  subscriber who signs up as `=HYPERLINK(...)` would execute inside the client's
 *  spreadsheet. Prefixing a tab neutralises it while leaving the text readable. */
function csvCell(value: string | null | undefined): string {
  const raw = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `\t${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export const GET = apiRoute("admin.subscribers.export", async ({ req, log }) => {
  const admin = await requireAdminApi("owner");

  const rows = await db
    .select({
      email: subscriber.email,
      confirmedAt: subscriber.confirmedAt,
      source: subscriber.source,
      consentText: subscriber.consentText,
    })
    .from(subscriber)
    .where(eq(subscriber.status, "confirmed"));

  const header = "email,confirmed_at,source,consent_text";
  const body = rows
    .map((r) =>
      [
        csvCell(r.email),
        csvCell(r.confirmedAt?.toISOString()),
        csvCell(r.source),
        csvCell(r.consentText),
      ].join(",")
    )
    .join("\r\n");

  await audit({
    actor: admin,
    action: "subscribers.export",
    entity: "subscriber",
    after: { count: rows.length },
    ipHash: await hashIp(clientIp(req)),
  });

  log.info("admin.subscribers.exported", { count: rows.length });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`${header}\r\n${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="btb-subscribers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
