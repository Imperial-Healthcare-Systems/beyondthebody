"use server";

/* The PDP gallery editor's operations.
 *
 * OWNER ONLY. These change what a customer sees at the top of a product page, which is
 * merchandising, not copy-editing — the same side of the role line as prices.
 *
 * Authorisation is re-checked inside every action. A Server Action is a POST endpoint like
 * any other, and the fact that the form was only rendered for an owner guarantees nothing
 * about who can invoke it.
 *
 * Every action revalidates the PDP, the collection index and the home page: all three read
 * `gallery`, and a client who replaces a photograph and then finds the old one still on the
 * collection grid will reasonably conclude the feature is broken.
 */

import { revalidatePath } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { productImage } from "@/db/schema";
import { PRODUCTS } from "@/app/_sections/products-data";
import { requireAdminApi } from "@/lib/admin-session";
import { audit } from "@/lib/audit";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storeImage } from "@/lib/uploads";

export type GalleryFormState = { ok?: string; error?: string };

/* A slug is only ever one of the four the code declares. Validating against the catalogue
   rather than a regex means an upload cannot create a folder for a product that does not
   exist, and closes the traversal question at the same time. */
const SLUGS = PRODUCTS.map((p) => p.slug) as [string, ...string[]];
const Slug = z.enum(SLUGS);

async function withOwner<T extends GalleryFormState>(
  run: (admin: { id: string; email: string }) => Promise<T>
): Promise<T | GalleryFormState> {
  let admin;
  try {
    admin = await requireAdminApi("owner");
  } catch {
    return { error: "That needs owner access." };
  }
  try {
    return await run(admin);
  } catch (err) {
    if (isAppError(err)) return { error: err.message };
    logger.error("gallery.action_failed", { err });
    return { error: "Couldn't do that. Please try again." };
  }
}

function revalidateProduct(slug: string) {
  revalidatePath(`/fragrance/${slug}`);
  revalidatePath("/collection");
  revalidatePath("/"); // the home §8 collection touch renders gallery art too
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${slug}`);
}

/**
 * Rows for one product, in display order.
 *
 * Also used to decide the next sort_order. Gaps of 10 mean a reorder usually rewrites one
 * row instead of renumbering the list.
 */
async function rowsFor(slug: string) {
  return db
    .select()
    .from(productImage)
    .where(eq(productImage.productSlug, slug))
    .orderBy(asc(productImage.sortOrder));
}

/* ── Add ───────────────────────────────────────────────────────────────────────── */

export async function addImageAction(
  _prev: GalleryFormState,
  formData: FormData
): Promise<GalleryFormState> {
  return withOwner(async (admin) => {
    const slug = Slug.safeParse(formData.get("slug"));
    if (!slug.success) return { error: "Unknown product." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };

    const alt = z.string().trim().max(300).parse(formData.get("alt") ?? "");

    /* The FIRST upload for a product is the moment its gallery stops being the code array
       and becomes this table — applyGallery is all-or-nothing per product. Say so, rather
       than letting the client discover it by watching three images turn into one. */
    const existing = await rowsFor(slug.data);

    const stored = await storeImage(file, slug.data);

    const [row] = await db
      .insert(productImage)
      .values({
        productSlug: slug.data,
        path: stored.path,
        alt,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
        sortOrder: (existing.at(-1)?.sortOrder ?? 0) + 10,
        createdBy: admin.id,
      })
      .returning();

    await audit({
      actor: admin,
      action: "product_image.add",
      entity: "product_image",
      entityId: row.id,
      after: { productSlug: slug.data, path: stored.path, width: stored.width, height: stored.height },
    });

    revalidateProduct(slug.data);
    logger.info("product_image.added", { slug: slug.data, path: stored.path, by: admin.email });

    return {
      ok:
        existing.length === 0
          ? "Added. This product now shows the images you upload here instead of the original ones."
          : "Added.",
    };
  });
}

/* ── Alt text ──────────────────────────────────────────────────────────────────── */

export async function updateAltAction(
  _prev: GalleryFormState,
  formData: FormData
): Promise<GalleryFormState> {
  /* No audit row for alt text: it is a caption, it changes nothing anyone can be defrauded
     by, and a trail of them would bury the entries that matter. */
  return withOwner(async () => {
    const parsed = z
      .object({ id: z.string().uuid(), alt: z.string().trim().max(300) })
      .safeParse({ id: formData.get("id"), alt: formData.get("alt") ?? "" });
    if (!parsed.success) return { error: "That didn't look right." };

    const [row] = await db
      .update(productImage)
      .set({ alt: parsed.data.alt })
      .where(eq(productImage.id, parsed.data.id))
      .returning();
    if (!row) return { error: "That image is no longer there." };

    revalidateProduct(row.productSlug);
    return { ok: "Description saved." };
  });
}

/* ── Reorder ───────────────────────────────────────────────────────────────────── */

/**
 * Move one image up or down.
 *
 * Implemented as a swap of two sort_orders rather than a drag-and-drop list, because a
 * gallery is three or four images and two buttons work on a phone, in a hurry, without
 * JavaScript being clever. The FIRST image is the one the PDP opens on, which is the only
 * ordering decision that really matters.
 */
export async function moveImageAction(
  _prev: GalleryFormState,
  formData: FormData
): Promise<GalleryFormState> {
  /* Reordering is not audited either — the current order IS the record, and it is visible
     on the screen. */
  return withOwner(async () => {
    const parsed = z
      .object({ id: z.string().uuid(), dir: z.enum(["up", "down"]) })
      .safeParse({ id: formData.get("id"), dir: formData.get("dir") });
    if (!parsed.success) return { error: "That didn't look right." };

    const [row] = await db
      .select()
      .from(productImage)
      .where(eq(productImage.id, parsed.data.id))
      .limit(1);
    if (!row) return { error: "That image is no longer there." };

    const siblings = await rowsFor(row.productSlug);
    const at = siblings.findIndex((s) => s.id === row.id);
    const swapWith = siblings[parsed.data.dir === "up" ? at - 1 : at + 1];
    if (!swapWith) return { ok: "Already at the end." };

    /* Both writes in one transaction: a half-applied swap would leave two rows sharing a
       sort_order, and the order would then depend on whatever the database felt like. */
    await db.transaction(async (tx) => {
      await tx
        .update(productImage)
        .set({ sortOrder: swapWith.sortOrder })
        .where(eq(productImage.id, row.id));
      await tx
        .update(productImage)
        .set({ sortOrder: row.sortOrder })
        .where(eq(productImage.id, swapWith.id));
    });

    revalidateProduct(row.productSlug);
    return { ok: "Moved." };
  });
}

/* ── Remove ────────────────────────────────────────────────────────────────────── */

export async function removeImageAction(
  _prev: GalleryFormState,
  formData: FormData
): Promise<GalleryFormState> {
  return withOwner(async (admin) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
    if (!parsed.success) return { error: "That didn't look right." };

    const [row] = await db
      .delete(productImage)
      .where(eq(productImage.id, parsed.data.id))
      .returning();
    if (!row) return { error: "That image is no longer there." };

    /* The FILE is left on disk on purpose. It is a few hundred KB, it is referenced by
       nothing else, and deleting it would make a mis-click unrecoverable — whereas an
       orphan is a housekeeping job somebody can do later, from the audit trail. */
    await audit({
      actor: admin,
      action: "product_image.remove",
      entity: "product_image",
      entityId: row.id,
      before: { productSlug: row.productSlug, path: row.path },
    });

    const left = await rowsFor(row.productSlug);
    revalidateProduct(row.productSlug);

    return {
      ok:
        left.length === 0
          ? "Removed. With no images here, this product is back to the ones it shipped with."
          : "Removed.",
    };
  });
}

/* ── Reset ─────────────────────────────────────────────────────────────────────── */

/**
 * Back to the images the site shipped with.
 *
 * Deleting every row IS the reset — applyGallery falls through to products-data.ts when a
 * product has none. There is nothing to restore, which is the whole reason the overlay was
 * built as all-or-nothing rather than as a merge.
 */
export async function resetGalleryAction(
  _prev: GalleryFormState,
  formData: FormData
): Promise<GalleryFormState> {
  return withOwner(async (admin) => {
    const slug = Slug.safeParse(formData.get("slug"));
    if (!slug.success) return { error: "Unknown product." };

    const rows = await rowsFor(slug.data);
    if (rows.length === 0) return { ok: "Already showing the original images." };

    await db.delete(productImage).where(inArray(productImage.id, rows.map((r) => r.id)));

    await audit({
      actor: admin,
      action: "product_image.reset",
      entity: "product",
      entityId: slug.data,
      before: { paths: rows.map((r) => r.path) },
    });

    revalidateProduct(slug.data);
    logger.info("product_image.reset", { slug: slug.data, removed: rows.length, by: admin.email });

    /* The product's NAME, not its slug — "Back to the desir images" is the database
       talking, and this sentence is for the person who just pressed the button. */
    const name = PRODUCTS.find((p) => p.slug === slug.data)?.name ?? slug.data;
    return { ok: `${name} is back to the images the site shipped with.` };
  });
}
