/* Newsletter — subscribe, confirm, unsubscribe.
 *
 * The rule running through all of it: NEVER reveal whether an address is on the list.
 * `subscribe` returns the same result for a new address, one already confirmed, and one
 * that unsubscribed last year. Anything else turns the footer form into an oracle for
 * checking whether a given person is a customer.
 *
 * Replaces the placeholder in Footer.tsx, which showed "You're on the list" and stored
 * nothing anywhere. */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriber } from "@/db/schema";
import { env } from "./env";
import { logger, maskEmail } from "./logger";
import { confirmSubscriptionEmail, queueMail, welcomeEmail } from "./mail";
import {
  confirmExpiry,
  generateToken,
  hashToken,
  normaliseEmail,
} from "./tokens";

/** The exact sentence shown beside the field. Stored per subscriber, so if this wording
 *  ever changes, older rows still record what those people actually agreed to. */
export const CONSENT_TEXT =
  "Notes from the studio, and word of each drop before it opens.";

const confirmUrl = (token: string) =>
  `${env.APP_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`;

const unsubscribeUrl = (token: string) =>
  `${env.APP_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

export type SubscribeInput = {
  email: string;
  ipHash?: string;
  userAgent?: string;
  source?: string;
};

/**
 * Record an intent to subscribe and send a confirmation link.
 *
 * Resolves the same way whatever the address's history — the caller has nothing to
 * branch on, by design. Errors are thrown only for genuine faults, never for "already
 * subscribed".
 */
export async function subscribe(input: SubscribeInput): Promise<void> {
  const email = normaliseEmail(input.email);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(subscriber)
      .where(eq(subscriber.email, email))
      .limit(1);

    /* Already on the list: do nothing at all. Re-sending a confirmation would let anyone
       use the form to mail a person repeatedly, and saying so would leak membership. */
    if (existing?.status === "confirmed") {
      logger.info("newsletter.subscribe.already_confirmed", { email: maskEmail(email) });
      return;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = confirmExpiry();
    const now = new Date();

    if (existing) {
      /* pending, unsubscribed or bounced — all re-enter confirmation with a fresh token.
         An unsubscribed address is deliberately made to re-consent rather than silently
         reinstated. The previous token stops working, so an old link cannot be replayed. */
      await tx
        .update(subscriber)
        .set({
          status: "pending",
          confirmTokenHash: tokenHash,
          confirmExpiresAt: expiresAt,
          confirmSentAt: now,
          consentText: CONSENT_TEXT,
          ipHash: input.ipHash ?? existing.ipHash,
          userAgent: input.userAgent ?? existing.userAgent,
          unsubscribedAt: null,
          updatedAt: now,
        })
        .where(eq(subscriber.id, existing.id));
    } else {
      await tx.insert(subscriber).values({
        email,
        status: "pending",
        confirmTokenHash: tokenHash,
        confirmExpiresAt: expiresAt,
        confirmSentAt: now,
        /* Minted once, at signup, and kept in plaintext so every future email can carry
           the link. See the column comment in db/schema/newsletter.ts for why this one
           token is deliberately not hashed. */
        unsubToken: generateToken(),
        source: input.source ?? "footer",
        consentText: CONSENT_TEXT,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
      });
    }

    /* Queued inside the transaction: if the write rolls back, the email is never sent. */
    const mail = confirmSubscriptionEmail(confirmUrl(token));
    await queueMail({ to: email, ...mail }, tx);
  });

  logger.info("newsletter.subscribe.queued", { email: maskEmail(input.email) });
}

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: "invalid" | "expired" };

export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  const tokenHash = hashToken(token);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(subscriber)
      .where(eq(subscriber.confirmTokenHash, tokenHash))
      .limit(1);

    /* No row means the token is wrong OR it was already consumed and cleared. Both are
       reported as invalid — a distinct "already used" would confirm the address exists. */
    if (!row) return { ok: false, reason: "invalid" } as const;

    if (row.status === "confirmed") {
      return { ok: true, alreadyConfirmed: true } as const;
    }

    if (row.confirmExpiresAt && row.confirmExpiresAt.getTime() < Date.now()) {
      return { ok: false, reason: "expired" } as const;
    }

    /* Backfill for any row that predates the token (or was created another way). */
    const unsubToken = row.unsubToken ?? generateToken();

    await tx
      .update(subscriber)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        /* Single use: clearing it makes a replayed link inert. The unique index permits
           many NULLs, so cleared rows do not collide. */
        confirmTokenHash: null,
        confirmExpiresAt: null,
        unsubToken,
        unsubscribedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriber.id, row.id));

    /* Every confirmation gets the welcome, and every welcome carries a working
       unsubscribe link — both in the body and in the List-Unsubscribe header, so the
       reader's mail client can offer it natively. */
    const mail = welcomeEmail(unsubscribeUrl(unsubToken));
    await queueMail(
      { to: row.email, ...mail, listUnsubscribe: unsubscribeUrl(unsubToken) },
      tx
    );

    logger.info("newsletter.confirmed", { email: maskEmail(row.email) });
    return { ok: true, alreadyConfirmed: false } as const;
  });
}

export type UnsubscribeResult = { ok: boolean };

/** Idempotent: unsubscribing twice succeeds twice. A link in a years-old email must
 *  still work, because a broken unsubscribe is both a complaint and a compliance problem. */
export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  /* Matched by indexed equality rather than a constant-time compare. The token is 256
     bits of CSPRNG output, so there is no meaningful timing attack — an attacker would
     need to guess the value before timing could tell them anything about it. */
  const rows = await db
    .update(subscriber)
    .set({
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
      /* The unsubscribe token is deliberately NOT cleared: the link stays valid so a
         second click reports success rather than an error. */
    })
    .where(eq(subscriber.unsubToken, token))
    .returning({ email: subscriber.email });

  if (rows.length === 0) return { ok: false };

  logger.info("newsletter.unsubscribed", { email: maskEmail(rows[0].email) });
  return { ok: true };
}
