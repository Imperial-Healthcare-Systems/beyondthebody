/* GET /media/… — serves client-uploaded imagery.
 *
 * These files deliberately do NOT live in `public/` (see lib/uploads.ts), so Next's static
 * handler never sees them and this route is how they reach a browser.
 *
 * PUBLIC BY DESIGN. A product photograph appears on a product page; there is nothing to
 * authorise. What matters instead is that the path cannot be used to read anything else,
 * which resolveMediaPath() enforces by comparing the RESOLVED path against the upload root.
 *
 * Everything served here is WebP written by storeImage(), so the content type is a fact
 * rather than a guess from the extension — there is no sniffing to get wrong.
 *
 * In front of a real deployment this route is a fallback: nginx can serve UPLOAD_DIR
 * directly at the same prefix and never wake Node. It exists so the app is correct on its
 * own, which is what makes that optimisation optional.
 */

import { NextResponse } from "next/server";
import { readMedia } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;

  const data = await readMedia(path);
  /* One shape of answer for "outside the root" and "not there". A distinguishable response
     would turn this into a probe for what exists on the filesystem. */
  if (!data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      /* Immutable: the filename carries a random id and storeImage never overwrites, so a
         given URL's bytes can never change. Replacing an image mints a new path. */
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
