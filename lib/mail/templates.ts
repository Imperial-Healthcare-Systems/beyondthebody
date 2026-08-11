/* Email templates — house voice, house palette, no external assets.
 *
 * Every style is inline and every colour is a literal: email clients strip <style>
 * blocks, ignore CSS variables, and block remote images until a reader opts in. So this
 * cannot reuse tokens.css, and a remote logo would render as a broken box for most
 * recipients. The ⚥ monogram is a text character, which needs nothing loaded.
 *
 * Voice follows the house register (Quiet Atelier): restrained, unhurried, no urgency or
 * deal language — the brand constraint applies to email exactly as it does to the page. */

const OXBLOOD = "#4E212D";
const IVORY = "#F5EFE4";
const CHAMPAGNE = "#E2CBA6";
const INK_MUTED = "#7A6558";

/** Escape anything interpolated into HTML. Today only URLs we generate are inserted, but
 *  the moment a name or address is added this is the difference between a template and
 *  an injection point. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LayoutOptions = {
  preheader: string;
  body: string;
  footerNote?: string;
};

/* Table-based layout: still the only structure Outlook renders predictably. */
function layout({ preheader, body, footerNote }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${IVORY};">
  <!-- Preheader: the grey line the inbox shows after the subject. Hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};">
    <tr><td align="center" style="padding:48px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:36px;">
          <div style="font-size:26px;color:${OXBLOOD};line-height:1;">&#9891;</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.28em;
                      text-transform:uppercase;color:${INK_MUTED};padding-top:12px;">
            Beyond The Body
          </div>
        </td></tr>
        <tr><td style="font-family:Georgia,'Times New Roman',serif;color:${OXBLOOD};
                       font-size:17px;line-height:1.7;">
          ${body}
        </td></tr>
        <tr><td style="padding-top:40px;">
          <div style="height:1px;background:${CHAMPAGNE};"></div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;
                      color:${INK_MUTED};padding-top:18px;">
            ${footerNote ?? ""}
            <div style="padding-top:10px;">A house that begins with scent.</div>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  const safe = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr><td style="background:${OXBLOOD};">
      <a href="${safe}" style="display:inline-block;padding:14px 26px;
         font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;
         text-transform:uppercase;color:${IVORY};text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** Paise → the house's price form. Matches formatPrice() on the site, including the
 *  non-breaking space that stops ₹ being orphaned at a line break. */
export function formatMinor(minor: number): string {
  return `₹ ${(minor / 100).toLocaleString("en-IN")}`;
}

export function confirmSubscriptionEmail(confirmUrl: string) {
  const text = [
    "Confirm your place on the house list.",
    "",
    "You asked to hear from Beyond The Body — notes from the studio, and word of each",
    "drop before it opens. Confirm below and you're on the list.",
    "",
    confirmUrl,
    "",
    "The link is good for 48 hours. If this wasn't you, ignore this note and nothing happens.",
    "",
    "Beyond The Body — a house that begins with scent.",
  ].join("\n");

  const html = layout({
    preheader: "Confirm your place on the house list.",
    body: `
      <p style="margin:0 0 18px;">Confirm your place on the house list.</p>
      <p style="margin:0;font-size:15px;color:${INK_MUTED};font-family:Helvetica,Arial,sans-serif;line-height:1.8;">
        You asked to hear from us — notes from the studio, and word of each drop before it opens.
      </p>
      ${button(confirmUrl, "Confirm subscription")}
      <p style="margin:0;font-size:13px;color:${INK_MUTED};font-family:Helvetica,Arial,sans-serif;line-height:1.8;">
        The link is good for 48 hours. If this wasn&rsquo;t you, ignore this note &mdash; nothing happens
        until it is confirmed.
      </p>`,
  });

  return { subject: "Confirm your place on the house list", text, html };
}

export function adminSignInEmail(signInUrl: string, expiryMinutes: number) {
  const text = [
    "Sign in to Beyond The Body",
    "",
    `Use the link below to sign in. It works once and expires in ${expiryMinutes} minutes.`,
    "",
    signInUrl,
    "",
    "If you didn't ask to sign in, ignore this — the link does nothing on its own,",
    "and no one can sign in without it.",
  ].join("\n");

  const html = layout({
    preheader: "Your sign-in link.",
    body: `
      <p style="margin:0 0 18px;">Sign in to the house.</p>
      <p style="margin:0;font-size:15px;color:${INK_MUTED};font-family:Helvetica,Arial,sans-serif;line-height:1.8;">
        This link works once and expires in ${expiryMinutes} minutes.
      </p>
      ${button(signInUrl, "Sign in")}
      <p style="margin:0;font-size:13px;color:${INK_MUTED};font-family:Helvetica,Arial,sans-serif;line-height:1.8;">
        If you didn&rsquo;t ask to sign in, ignore this note &mdash; the link does nothing on its
        own, and no one can sign in without it.
      </p>`,
  });

  return { subject: "Your sign-in link", text, html };
}

export function welcomeEmail(unsubscribeUrl: string) {
  const text = [
    "You're on the list.",
    "",
    "Notes from the studio, and word of each drop before it opens. We write seldom,",
    "and only when there is something worth reading.",
    "",
    "Beyond The Body — a house that begins with scent.",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  const html = layout({
    preheader: "You're on the list.",
    body: `
      <p style="margin:0 0 18px;">You&rsquo;re on the list.</p>
      <p style="margin:0;font-size:15px;color:${INK_MUTED};font-family:Helvetica,Arial,sans-serif;line-height:1.8;">
        Notes from the studio, and word of each drop before it opens. We write seldom, and only
        when there is something worth reading.
      </p>`,
    footerNote: `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${INK_MUTED};">Unsubscribe</a>`,
  });

  return { subject: "You're on the list", text, html };
}

/* ── Orders ────────────────────────────────────────────────────────────────────────
 *
 * Two messages, deliberately different in register. The customer's is a house note that
 * happens to contain an order; the studio's is a worksheet — it is read on a phone at
 * eight in the morning by someone deciding what to pack, so it leads with the address
 * and the items, not with a greeting. */

type MailOrder = {
  orderNumber: string;
  paymentMethod: "prepaid" | "cod";
  email: string;
  phone: string;
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxInclusive: boolean;
  shippingAddress: unknown;
  notes: string | null;
};

type MailItem = {
  nameSnapshot: string;
  sizeSnapshot: string;
  qty: number;
  lineTotalMinor: number;
};

function addressLines(address: unknown): string[] {
  const a = (address ?? {}) as Record<string, string>;
  return [
    a.name,
    a.line1,
    a.line2,
    a.landmark,
    [a.city, a.state, a.pincode].filter(Boolean).join(", "),
  ].filter((line): line is string => Boolean(line && line.trim()));
}

function itemsTable(items: MailItem[]): string {
  return items
    .map(
      (it) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${CHAMPAGNE};">
          <div>${escapeHtml(it.nameSnapshot)}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${INK_MUTED};">
            ${escapeHtml(it.sizeSnapshot)}${it.qty > 1 ? ` &middot; ${it.qty}` : ""}
          </div>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${CHAMPAGNE};white-space:nowrap;">
          ${escapeHtml(formatMinor(it.lineTotalMinor))}
        </td>
      </tr>`
    )
    .join("");
}

function totalsTable(order: MailOrder): string {
  const row = (label: string, value: string, strong = false) => `<tr>
      <td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-size:${strong ? 14 : 13}px;
                 ${strong ? "" : `color:${INK_MUTED};`}">${escapeHtml(label)}</td>
      <td align="right" style="padding:4px 0;white-space:nowrap;font-size:${strong ? 15 : 13}px;">
        ${escapeHtml(value)}</td>
    </tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
    ${row("Subtotal", formatMinor(order.subtotalMinor))}
    ${row("Delivery", order.shippingMinor === 0 ? "Included" : formatMinor(order.shippingMinor))}
    ${order.codFeeMinor > 0 ? row("Cash on delivery", formatMinor(order.codFeeMinor)) : ""}
    ${order.taxMinor > 0 ? row(order.taxInclusive ? "GST (included)" : "GST", formatMinor(order.taxMinor)) : ""}
    ${row("Total", formatMinor(order.totalMinor), true)}
  </table>`;
}

function totalsText(order: MailOrder): string[] {
  return [
    `Subtotal      ${formatMinor(order.subtotalMinor)}`,
    `Delivery      ${order.shippingMinor === 0 ? "Included" : formatMinor(order.shippingMinor)}`,
    ...(order.codFeeMinor > 0 ? [`Cash on delivery  ${formatMinor(order.codFeeMinor)}`] : []),
    ...(order.taxMinor > 0
      ? [`GST${order.taxInclusive ? " (included)" : ""}  ${formatMinor(order.taxMinor)}`]
      : []),
    `Total         ${formatMinor(order.totalMinor)}`,
  ];
}

export function orderConfirmationEmail(order: MailOrder, items: MailItem[], statusUrl: string) {
  const cod = order.paymentMethod === "cod";
  const address = addressLines(order.shippingAddress);

  /* The house does not promise a date it does not control. "We'll write when it ships"
     is both true and in register; "arrives in 3-5 days" would be neither. */
  const payLine = cod
    ? `Please keep ${formatMinor(order.totalMinor)} ready for the courier.`
    : "Your payment has been received.";

  const text = [
    `Thank you — your order is with us.`,
    "",
    `Order ${order.orderNumber}`,
    "",
    ...items.map((it) => `${it.nameSnapshot} · ${it.sizeSnapshot}${it.qty > 1 ? ` × ${it.qty}` : ""}   ${formatMinor(it.lineTotalMinor)}`),
    "",
    ...totalsText(order),
    "",
    cod ? "Payment: Cash on delivery." : "Payment: Paid online.",
    payLine,
    "",
    "Sending to:",
    ...address,
    "",
    "We pack by hand and write again the moment it leaves us.",
    "",
    `Follow your order: ${statusUrl}`,
    "",
    "Beyond The Body — a house that begins with scent.",
  ].join("\n");

  const html = layout({
    preheader: `Order ${order.orderNumber} — thank you.`,
    body: `
      <p style="margin:0 0 6px;">Thank you &mdash; your order is with us.</p>
      <p style="margin:0 0 26px;font-family:Helvetica,Arial,sans-serif;font-size:12px;
                letter-spacing:.14em;text-transform:uppercase;color:${INK_MUTED};">
        Order ${escapeHtml(order.orderNumber)}
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemsTable(items)}
      </table>
      ${totalsTable(order)}

      <p style="margin:26px 0 0;font-size:15px;font-family:Helvetica,Arial,sans-serif;
                color:${INK_MUTED};line-height:1.8;">
        ${cod ? "Cash on delivery." : "Paid online."} ${escapeHtml(payLine)}
      </p>

      <p style="margin:22px 0 0;font-size:15px;font-family:Helvetica,Arial,sans-serif;
                color:${INK_MUTED};line-height:1.8;">
        Sending to:<br>${address.map(escapeHtml).join("<br>")}
      </p>

      ${button(statusUrl, "Follow your order")}

      <p style="margin:0;font-size:13px;font-family:Helvetica,Arial,sans-serif;
                color:${INK_MUTED};line-height:1.8;">
        We pack by hand, and write again the moment it leaves us.
      </p>`,
  });

  return { subject: `Your order ${order.orderNumber}`, text, html };
}

export function newOrderNotificationEmail(order: MailOrder, items: MailItem[]) {
  const address = addressLines(order.shippingAddress);
  const method = order.paymentMethod === "cod" ? "CASH ON DELIVERY" : "Prepaid";

  const text = [
    `${order.orderNumber} — ${method} — ${formatMinor(order.totalMinor)}`,
    "",
    ...items.map((it) => `${it.qty} × ${it.nameSnapshot} · ${it.sizeSnapshot}`),
    "",
    ...address,
    "",
    `Phone: ${order.phone}`,
    `Email: ${order.email}`,
    ...(order.notes ? ["", `Note from the customer: ${order.notes}`] : []),
  ].join("\n");

  const html = layout({
    preheader: `${order.orderNumber} · ${method} · ${formatMinor(order.totalMinor)}`,
    body: `
      <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;
                letter-spacing:.14em;text-transform:uppercase;color:${INK_MUTED};">
        ${escapeHtml(method)} &middot; ${escapeHtml(formatMinor(order.totalMinor))}
      </p>
      <p style="margin:0 0 22px;">${escapeHtml(order.orderNumber)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemsTable(items)}
      </table>

      <p style="margin:22px 0 0;font-size:15px;font-family:Helvetica,Arial,sans-serif;
                color:${INK_MUTED};line-height:1.8;">
        ${address.map(escapeHtml).join("<br>")}<br>
        ${escapeHtml(order.phone)}<br>
        ${escapeHtml(order.email)}
      </p>
      ${order.notes ? `<p style="margin:18px 0 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;color:${INK_MUTED};">&ldquo;${escapeHtml(order.notes)}&rdquo;</p>` : ""}`,
  });

  return { subject: `${order.orderNumber} · ${method} · ${formatMinor(order.totalMinor)}`, text, html };
}
