/* Audit trail — who changed what, and what it was before.
 *
 * Written for anything that moves money, changes what a customer can buy, or publishes.
 * The actor's email is snapshotted rather than only their id, so the trail stays readable
 * after a staff account is removed — the commonest moment for wanting to read it.
 *
 * Never fails the operation it is recording. A price change that succeeded but whose
 * audit row failed must not roll back: losing the record is bad, silently refusing the
 * client's edit is worse and far more confusing. */

import { db, type Executor } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "./logger";
import type { AdminUser } from "./auth";

export type AuditEntry = {
  actor?: Pick<AdminUser, "id" | "email"> | null;
  action: string; // "price.update", "post.publish", "order.refund"
  entity: string; // "product_variant", "post", "order"
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipHash?: string;
  /** Pass a transaction to make the record atomic with the change it describes. */
  exec?: Executor;
};

export async function audit(entry: AuditEntry): Promise<void> {
  const exec = entry.exec ?? db;

  try {
    await exec.insert(auditLog).values({
      actorId: entry.actor?.id ?? null,
      actorEmail: entry.actor?.email ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? null) as object | null,
      after: (entry.after ?? null) as object | null,
      ipHash: entry.ipHash ?? null,
    });
  } catch (err) {
    /* Only swallowed when writing standalone. Inside a caller's transaction the error
       propagates, because there the audit row and the change are meant to share a fate. */
    if (entry.exec) throw err;
    logger.error("audit.write_failed", { err, action: entry.action, entity: entry.entity });
  }
}
