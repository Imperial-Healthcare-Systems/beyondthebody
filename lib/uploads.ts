/* Client-uploaded imagery: where it goes, what happens to it on the way in, and how it
 * comes back out.
 *
 * WHY NOT `public/`. Everything else on this site is art-directed and ships in the repo,
 * so `public/` was enough. An upload is different: `public/` is build output. On a
 * container deploy it is baked into the image, so a file written there at runtime is gone
 * at the next release — and on a rollback the photographs would silently revert along with
 * the code, which is precisely the sort of thing nobody notices for a month. Uploads
 * therefore live under UPLOAD_DIR, outside the build, and are served by an explicit route
 * (app/media/[...path]) rather than Next's static handler.
 *
 * WHY RE-ENCODE. The site is careful about weight to the point of generating 520px collage
 * derivatives. A 4MB camera original dropped onto a PDP would undo that in one click. Every
 * upload is converted to WebP with the long edge capped, which also normalises the dozen
 * formats a phone or a photographer might hand over.
 *
 * WHY MEASURE. `Product.gallery[].ratio` is a required field of the view model and the
 * collection index picks a card image by it. Those are facts about the file, so the file is
 * asked rather than the client. (The PDP hero frame itself is a fixed square that
 * letterboxes — see db/schema/catalogue.ts — so the numbers describe the image, they do not
 * size the frame.)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { env } from "./env";
import { AppError, ErrorCode } from "./errors";

/** Long edge, in pixels. Comfortably past the largest frame the PDP renders at 2x. */
const MAX_EDGE = 2000;
const WEBP_QUALITY = 82;

/** The public URL prefix these are served under. Matches app/media/[...path]/route.ts. */
export const MEDIA_PREFIX = "/media";

/** Absolute path of the upload root, resolved once per call from the environment.
 *
 * `turbopackIgnore` on the resolve: the build traces filesystem calls to work out which
 * files a route needs, and a path built from an environment variable makes it give up and
 * trace the ENTIRE project into the deploy bundle (it warns about exactly this). The
 * directory is runtime configuration — there is nothing here for a build to trace, and
 * telling it so is the documented fix. */
export function uploadRoot(): string {
  const dir = env.UPLOAD_DIR;
  return isAbsolute(dir) ? normalize(dir) : resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
}

/**
 * Turn a stored path (`/media/products/don-amour/ab12.webp`) back into a file on disk.
 *
 * Returns null for anything that escapes the upload root. The check is done on the
 * RESOLVED path rather than by looking for ".." in the input, because that is the check
 * that actually holds: `%2e%2e`, nested traversal and symlink-ish inputs all normalise
 * before this comparison, and a substring test on the raw string does not see them.
 */
export function resolveMediaPath(relative: string[]): string | null {
  const root = uploadRoot();
  const full = resolve(/*turbopackIgnore: true*/ root, ...relative);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

export type StoredImage = {
  /** Public path, e.g. /media/products/don-amour/ab12cd34.webp */
  path: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Write one uploaded image into the store, converted and measured.
 *
 * `folder` is a caller-supplied, already-validated segment (a product slug). It is joined
 * under the root and re-checked by resolveMediaPath, so a slug that somehow contained a
 * traversal cannot place a file outside the store.
 */
export async function storeImage(file: File, folder: string): Promise<StoredImage> {
  const maxBytes = env.UPLOAD_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${env.UPLOAD_MAX_MB}MB.`
    );
  }
  if (file.size === 0) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "That file was empty.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  /* sharp decides what this is by reading it, not by trusting the name or the browser's
     content-type. A file that is not an image it can decode throws here, which is the
     validation — there is no separate extension check to disagree with it. */
  let pipeline: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    pipeline = sharp(input, { failOn: "error" });
    meta = await pipeline.metadata();
  } catch {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "That file isn't an image we can read.");
  }
  if (!meta.width || !meta.height) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "That image has no readable dimensions.");
  }

  const output = await pipeline
    /* `inside` + withoutEnlargement: never crop (the gallery frame does that at render
       time, per image ratio) and never upscale a small original into a big file. */
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .rotate() // honour EXIF orientation, then drop it — phones rotate, browsers vary
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const name = `${randomUUID().replace(/-/g, "").slice(0, 16)}.webp`;
  const relative = ["products", folder, name];
  const full = resolveMediaPath(relative);
  if (!full) throw new AppError(ErrorCode.VALIDATION_FAILED, "Bad destination.");

  await mkdir(join(/*turbopackIgnore: true*/ uploadRoot(), "products", folder), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ full, output.data);

  return {
    path: `${MEDIA_PREFIX}/${relative.join("/")}`,
    /* From the ENCODED buffer, not the original: these are the dimensions the browser
       will actually lay out, and the resize above may have changed them. */
    width: output.info.width,
    height: output.info.height,
    bytes: output.info.size,
  };
}

/** Read a stored file for the serving route. Null when it is missing or out of bounds. */
export async function readMedia(relative: string[]): Promise<Buffer | null> {
  const full = resolveMediaPath(relative);
  if (!full) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ full);
  } catch {
    return null;
  }
}
