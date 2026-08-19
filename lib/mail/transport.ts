/* Mail transport — company SMTP, behind an adapter.
 *
 * The adapter is deliberate. The client chose their own SMTP over a transactional
 * provider, which is a reasonable call but carries real deliverability risk: order
 * confirmations and admin magic links are FUNCTIONAL mail, and a message in the spam
 * folder reads to a customer as a failed order and locks an admin out of the site.
 * Keeping the transport behind this interface means switching to a provider later is a
 * config change rather than a refactor.
 *
 * With no SMTP_HOST configured, mail is logged instead of sent — so development, CI and
 * tests need no mail server. That fallback is a warning in production, never silent. */

import type { Transporter } from "nodemailer";
import { env } from "../env";
import { logger } from "../logger";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** RFC 8058 one-click unsubscribe, for bulk mail only. */
  listUnsubscribe?: string;
};

export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/** Development / CI fallback: record the message, including the links, so a developer can
 *  complete a confirm or unsubscribe flow locally without any mail server. */
class LogTransport implements MailTransport {
  readonly name = "log";

  async send(message: MailMessage): Promise<void> {
    logger.info("mail.logged", {
      to: message.to,
      subject: message.subject,
      /* The body carries a single-use link. Fine in a local log; this transport is never
         the one used in production (startup.ts warns if it is). */
      body: message.text,
    });
  }
}

class SmtpTransport implements MailTransport {
  readonly name = "smtp";
  private transporter: Transporter | null = null;

  private async get(): Promise<Transporter> {
    if (this.transporter) return this.transporter;
    /* Imported lazily so nodemailer stays out of any bundle that never sends mail. */
    const nodemailer = await import("nodemailer");

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      /* true = implicit TLS (port 465). false = STARTTLS upgrade (port 587), which is
         what most company mail servers expect. */
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      /* One connection reused across the job worker's sends rather than a handshake per
         message — company mail servers commonly rate-limit connections, not messages. */
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });

    return this.transporter;
  }

  async send(message: MailMessage): Promise<void> {
    const transporter = await this.get();
    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: message.listUnsubscribe
        ? {
            "List-Unsubscribe": `<${message.listUnsubscribe}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
    });

    /* A 2xx from the relay is not proof of delivery, only of acceptance. Recording the
       rejected list matters: nodemailer resolves successfully even when some recipients
       were refused, which would otherwise look like a send. */
    if (info.rejected?.length) {
      throw new Error(`SMTP rejected recipient(s): ${info.rejected.join(", ")}`);
    }
  }
}

let cached: MailTransport | null = null;

export function getTransport(): MailTransport {
  if (cached) return cached;
  cached = env.SMTP_HOST ? new SmtpTransport() : new LogTransport();
  return cached;
}

export function __setTransportForTests(t: MailTransport | null) {
  cached = t;
}
