"use client";

/* The admin nav, split out of the layout for one reason: marking where you are.
 *
 * admin.css has styled `.adm__nav a[aria-current="page"]` since the panel was built, but
 * nothing ever set the attribute — the layout is a server component and cannot read the
 * pathname — so the rule matched nothing and every section looked identical from the bar.
 * On a five-section tool that is the difference between orienting at a glance and reading
 * the heading every time.
 *
 * Kept as a client island rather than making the whole layout client: the layout also
 * reads the session, which belongs on the server. */

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/journal", label: "Journal" },
  /* Prices used to be its own entry. It is now a panel on each product's screen — one page
     per product rather than one page per kind-of-field (client, 2026-08-12). */
  { href: "/admin/products", label: "Products" },
  { href: "/admin/subscribers", label: "Subscribers" },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";

  /* Longest matching prefix wins, so /admin/orders/<id> marks Orders rather than Overview
     — every path starts with /admin, which would otherwise always match first. */
  const current = LINKS.reduce<string | null>((best, l) => {
    const hit = pathname === l.href || pathname.startsWith(`${l.href}/`);
    if (!hit) return best;
    return best && best.length >= l.href.length ? best : l.href;
  }, null);

  return (
    <nav className="adm__nav" aria-label="Admin">
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} aria-current={current === l.href ? "page" : undefined}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
