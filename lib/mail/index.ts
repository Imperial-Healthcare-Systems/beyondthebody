/* Mail sending, always through the job queue.
 *
 * Nothing calls the transport directly. Requests enqueue a `mail:send` job — in the same
 * transaction as whatever state change caused it — and the worker delivers it with
 * retries. Two reasons, and both matter more with company SMTP than they would with a
 * provider:
 *
 *   · a slow or unreachable mail server cannot hold a web request open, or (from phase 6)
 *     roll back a captured payment
 *   · a transient SMTP failure is retried with backoff instead of losing the message
 *
 * Delivery is at-least-once, so a duplicate confirmation email is possible and harmless;
 * losing one is not. */

import { z } from "zod";
import type { Executor } from "@/db/client";
import { enqueue, registerJobHandler } from "../jobs";
import { logger, maskEmail } from "../logger";
import { getTransport, type MailMessage } from "./transport";

export * from "./templates";
export type { MailMessage } from "./transport";

const MailPayload = z.object({
  to: z.string(),
  subject: z.string(),
  text: z.string(),
  html: z.string(),
  listUnsubscribe: z.string().optional(),
});

/** Queue a message. Pass the caller's transaction as `exec` to make it atomic with the
 *  state change that triggered it. */
export async function queueMail(message: MailMessage, exec?: Executor) {
  return enqueue("mail:send", message as unknown as Record<string, unknown>, {
    exec,
    /* Roughly a day of backoff before giving up: enough to ride out a mail server
       restart or a brief DNS problem without retrying forever. */
    maxAttempts: 8,
  });
}

export function registerMailJobs() {
  registerJobHandler("mail:send", async (payload) => {
    const message = MailPayload.parse(payload);
    const transport = getTransport();

    await transport.send(message);

    /* Log the masked recipient only — the subject and body can carry a single-use link. */
    logger.info("mail.sent", {
      to: maskEmail(message.to),
      subject: message.subject,
      transport: transport.name,
    });
  });
}
