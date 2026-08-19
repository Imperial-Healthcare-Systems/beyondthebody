"use server";

/* Order operations.
 *
 * OWNER ONLY, every one of them. These move money and inventory: marking cash collected,
 * cancelling a paid order, sending a refund. The role split the project already has —
 * owner for money, editor for words — puts all of this on one side of the line.
 *
 * Authorisation is re-checked inside every action. A Server Action is a POST endpoint like
 * any other, and the fact that the form was only rendered for an owner guarantees nothing
 * about who can invoke it. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  markCodCollected,
  readable,
  refundOrder,
  transitionOrder,
  undoOrderStatus,
} from "@/lib/fulfilment";
import { rupeesToPaise } from "@/lib/catalogue";

export type OrderFormState = { ok?: string; error?: string };

const Id = z.string().uuid();

/** Every action ends by refreshing the two places an order is visible. */
function revalidateOrders(id?: string) {
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/orders/${id}`);
}

/** Owner check + a uniform failure shape, so no action forgets either. */
async function withOwner<T extends OrderFormState>(
  run: (admin: { id: string; email: string }) => Promise<T>
): Promise<T | OrderFormState> {
  let admin;
  try {
    admin = await requireAdminApi("owner");
  } catch {
    return { error: "That needs owner access." };
  }

  try {
    return await run(admin);
  } catch (err) {
    /* AppError messages are written to be shown to a person — an illegal transition says
       which one it was. Anything else is a bug and says nothing. */
    if (isAppError(err)) return { error: err.message };
    logger.error("order.action_failed", { err });
    return { error: "Couldn't do that. Please try again." };
  }
}

const TransitionSchema = z.object({
  id: Id,
  to: z.enum(["processing", "shipped", "delivered", "cancelled", "rto_returned"]),
  courier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  trackingUrl: z.string().trim().max(500).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function transitionAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  return withOwner(async (admin) => {
    const parsed = TransitionSchema.safeParse({
      id: formData.get("id"),
      to: formData.get("to"),
      courier: formData.get("courier") || undefined,
      trackingNumber: formData.get("trackingNumber") || undefined,
      trackingUrl: formData.get("trackingUrl") || undefined,
      note: formData.get("note") || undefined,
    });
    if (!parsed.success) return { error: "That didn't look right." };

    const { id, to, ...rest } = parsed.data;
    const moved = await transitionOrder(id, to, admin, rest);

    revalidateOrders(id);

    return {
      ok:
        to === "shipped"
          ? "Marked shipped — the customer has been emailed."
          : to === "cancelled"
            ? "Cancelled, and any stock is back."
            : to === "rto_returned"
              ? "Recorded as returned, and the stock is back."
              : `Marked ${moved.status}.`,
    };
  });
}

/* Corrections. A separate action from transitionAction for the same reason undoOrderStatus
   is a separate function: it must not be reachable from the forward buttons. */
const UndoSchema = z.object({
  id: Id,
  to: z.enum(["paid", "confirmed", "processing", "shipped"]),
  note: z.string().trim().max(300).optional(),
});

export async function undoAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  return withOwner(async (admin) => {
    const parsed = UndoSchema.safeParse({
      id: formData.get("id"),
      to: formData.get("to"),
      note: formData.get("undoNote") || undefined,
    });
    if (!parsed.success) return { error: "That didn't look right." };

    const moved = await undoOrderStatus(parsed.data.id, parsed.data.to, admin, {
      note: parsed.data.note,
    });

    revalidateOrders(parsed.data.id);
    /* Nothing to revalidate for the customer: /order/[token] is force-dynamic and re-reads
       the order on every request, so their page is already correct. */

    return { ok: `Put back to ${readable(moved.status)} — the customer's page says so too.` };
  });
}

const CollectSchema = z.object({ ids: z.array(Id).min(1).max(200) });

export async function markCollectedAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  return withOwner(async (admin) => {
    /* A courier remits in a batch, so this takes a batch. Forcing one order at a time
       would make the common case the slow one. */
    const parsed = CollectSchema.safeParse({ ids: formData.getAll("ids").map(String) });
    if (!parsed.success) return { error: "Choose at least one order." };

    const count = await markCodCollected(parsed.data.ids, admin);
    revalidateOrders();

    return {
      ok:
        count === 0
          ? "Nothing to record — those were already collected."
          : `Recorded cash for ${count} order${count === 1 ? "" : "s"}.`,
    };
  });
}

const RefundSchema = z.object({
  id: Id,
  /* Entered in rupees, because that is what a human has in front of them. Converted once,
     here, exactly as the price editor does. Strictly positive: a zero would otherwise fall
     through the optional check below and quietly become a FULL refund. */
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function refundAction(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  return withOwner(async (admin) => {
    const parsed = RefundSchema.safeParse({
      id: formData.get("id"),
      amount: formData.get("amount") || undefined,
      reason: formData.get("reason") || undefined,
    });
    if (!parsed.success) return { error: "That didn't look right." };

    const { amountMinor } = await refundOrder(parsed.data.id, admin, {
      amountMinor:
        parsed.data.amount === undefined ? undefined : rupeesToPaise(parsed.data.amount),
      reason: parsed.data.reason,
    });

    revalidateOrders(parsed.data.id);
    return { ok: `Refund of ₹${(amountMinor / 100).toLocaleString("en-IN")} sent.` };
  });
}
