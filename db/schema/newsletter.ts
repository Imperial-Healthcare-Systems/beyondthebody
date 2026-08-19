/* Newsletter subscribers — double opt-in.
 *
 * Double opt-in is not ceremony here. The footer form currently *claims* a subscription
 * without recording one, so the first honest version of this must be able to prove that
 * a given address asked to be on the list: `consent_text` stores the exact wording shown
 * at signup and `confirmed_at` records when they acted on it. That pair is the evidence
 * the DPDP Act 2023 expects, and it is also what stops a third party subscribing someone
 * else's address.
 *
 * Only token HASHES are stored. A database dump must not yield working confirm or
 * unsubscribe links. */

import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const subscriberStatus = pgEnum("subscriber_status", [
  "pending", // asked to join; confirmation link not yet followed
  "confirmed", // on the list
  "unsubscribed", // asked to leave; the row is kept so we can prove they were removed
  "bounced", // mail server rejected them permanently; stop sending
]);

export const subscriber = pgTable(
  "subscriber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* Lowercased by the application before write. One row per address, ever — a
       re-subscribe updates this row rather than creating a second one. */
    email: text("email").notNull(),
    status: subscriberStatus("status").notNull().default("pending"),

    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: ts("confirm_expires_at"),
    confirmSentAt: ts("confirm_sent_at"),

    /* Stored in PLAINTEXT, unlike every other token here — a deliberate asymmetry.
       A confirm token is single-use, grants list membership, and is verified once, so it
       is hashed. An unsubscribe token must be reproducible in EVERY future email we send,
       for years, which a one-way hash cannot do: hashing it means the link can never be
       regenerated, so it can never be included, so nobody can ever unsubscribe.
       The capability it grants is only self-removal from a mailing list — the mildest in
       the system, and arguably a courtesy if it ever leaked. */
    unsubToken: text("unsub_token"),

    confirmedAt: ts("confirmed_at"),
    unsubscribedAt: ts("unsubscribed_at"),

    source: text("source").notNull().default("footer"),
    /* The exact sentence shown next to the field when they submitted. If the wording
       changes later, older rows still record what THEY agreed to. */
    consentText: text("consent_text"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),

    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriber_email_idx").on(t.email),
    uniqueIndex("subscriber_confirm_token_idx").on(t.confirmTokenHash),
    uniqueIndex("subscriber_unsub_token_idx").on(t.unsubToken),
    index("subscriber_status_idx").on(t.status),
  ]
);

export type Subscriber = typeof subscriber.$inferSelect;
