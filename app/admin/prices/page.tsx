/* /admin/prices — kept only so an old bookmark still lands somewhere useful.
 *
 * Price editing moved onto each product's own screen (client, 2026-08-12): one page per
 * product, holding everything about that product, rather than one page per kind-of-field.
 * A 404 here would look like the feature was removed rather than moved. */

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PricesMoved() {
  permanentRedirect("/admin/products");
}
