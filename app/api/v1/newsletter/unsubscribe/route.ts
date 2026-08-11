/* POST /api/v1/newsletter/unsubscribe
 *
 * POST, never GET. Mail clients and corporate security scanners follow every link in a
 * message to check it — with a GET-based unsubscribe that silently removes people who
 * never clicked anything. The emailed link therefore lands on a page with a button, and
 * only this endpoint acts.
 *
 * The one exception is RFC 8058 one-click unsubscribe, whose List-Unsubscribe-Post header
 * makes the mail client issue a POST here directly. That is the same verb and the same
 * guarantee, so it needs no separate path. */

import { z } from "zod";
import { apiRoute, json, readJson } from "@/lib/http";
import { unsubscribe } from "@/lib/newsletter";

const Body = z.object({ token: z.string().min(10).max(200) });

export const POST = apiRoute("newsletter.unsubscribe", async ({ req }) => {
  const { token } = await readJson(req, Body);
  const result = await unsubscribe(token);

  /* Same response either way. An unknown token most often means an address that already
     unsubscribed, and "no such subscriber" would confirm the absence of one. */
  return json({
    ok: true,
    message: result.ok
      ? "You've been removed from the list."
      : "You're not on the list.",
  });
});
