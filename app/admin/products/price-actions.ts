"use server";

/* Price and availability edits.
 *
 * A Server Action rather than a route handler: this is a form submission from a page we
 * own, and there is no reason to hand-write an endpoint for it. Authorisation is
 * re-checked here, inside the action — a Server Action is a POST endpoint like any other,
 * and the fact that the button rendering it was only shown to signed-in staff guarantees
 * nothing about who can call it. */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-session";
import { updateVariant, rupeesToPaise } from "@/lib/catalogue";
import { pickForwardedIp } from "@/lib/net";
import { env } from "@/lib/env";
import { hashIp } from "@/lib/http";
import { logger } from "@/lib/logger";

/* Accepts what a person types — "1,899", "1899.00", " 1899 " — and rejects the rest.
   Empty string is meaningful: it clears the price back to "Price on request". */
const PriceInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s₹]/g, ""))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter a number like 1899 or 1899.50, or leave it blank for price on request.",
  });

const Schema = z.object({
  sku: z.string().min(1).max(64),
  price: PriceInput,
  status: z.enum(["active", "hidden", "sold_out", "discontinued"]),
  note: z.string().max(300).optional(),
});

export type PriceFormState = { ok?: string; error?: string };

export async function updatePriceAction(
  _prev: PriceFormState,
  formData: FormData
): Promise<PriceFormState> {
  /* Prices are money: owner only, not editor. */
  let admin;
  try {
    admin = await requireAdminApi("owner");
  } catch {
    return { error: "You don't have access to change prices." };
  }

  const parsed = Schema.safeParse({
    sku: formData.get("sku"),
    price: formData.get("price"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That didn't look right." };
  }

  const { sku, price, status, note } = parsed.data;
  const priceMinor = price === "" ? null : rupeesToPaise(Number(price));

  try {
    const hdrs = await headers();
    const ipHash = await hashIp(
      pickForwardedIp(hdrs.get("x-forwarded-for"), env.TRUSTED_PROXY_HOPS)
    );

    await updateVariant(sku, { priceMinor, status }, admin, { note, ipHash });

    /* Push the change live now rather than waiting for the hourly ISR window. Each path
       that renders a price has to be named: revalidatePath does not cascade.
       'page' on the dynamic segment covers all four PDPs in one call. */
    revalidatePath("/fragrance/[slug]", "page");
    revalidatePath("/collection");
    revalidatePath("/");
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/[slug]", "page");

    logger.info("admin.price_updated", { sku, priceMinor, status, by: admin.email });
    return { ok: `${sku} saved.` };
  } catch (err) {
    logger.error("admin.price_update_failed", { err, sku });
    return { error: "Couldn't save that. Please try again." };
  }
}
