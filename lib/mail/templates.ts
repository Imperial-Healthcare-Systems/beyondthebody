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
