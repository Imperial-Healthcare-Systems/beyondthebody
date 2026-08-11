# Handover checklist — what the backend needs from you

**Living document.** Updated at every safepoint as phases land. Last updated: **2026-08-11 (S7)**.

Two audiences, and it matters which is which — sending an infrastructure question to the client or
a pricing question to a sysadmin is how these things stall for a week:

- **§A · The client** — business decisions and real values. Nobody else can answer these.
- **§B · The deployment team** — servers, secrets, DNS. Nobody else can do these.
- **§C · Launch blockers** — the short list that actually stops go-live.

Status key: **☐ open** · **◐ has a working default, but the default is a placeholder** · **☑ done**

---

## §A — Needed from the client

### A1 · Prices ◐

Currently a flat **₹1,899** for every scent and both sizes, entered as a placeholder on the client's
own direction (2026-07-16: *"price them to 1899, updated later"*). Two sizes at an identical price
reads as an artefact rather than intent.

| Needed | Notes |
|---|---|
| Price for each of the 4 scents × 2 sizes (8 SKUs) | 100 ml and Discovery 10 ml |
| Whether the two sizes differ in price | They currently do not |

**Now a launch blocker, where it was not before.** These are editable at `/admin/prices` (owner
role) and go live within seconds with no deploy — but as of S5 the store takes real orders, and the
placeholder is what a customer will actually be charged.

### A2 · GST ☐

**Must come from the client's accountant. Nothing here is inferred** — per the project's standing
rule, regulated figures are the client's authority. Tax is currently **switched off (rate 0)** and
the schema is fully tax-ready, so supplying these is a settings change, not a migration.

| Needed | Where it goes |
|---|---|
| GSTIN | printed on invoices |
| HSN code for the fragrances | per product variant |
| GST rate | stored in basis points (1800 = 18%) |
| Are displayed prices inclusive or exclusive of GST? | changes what the customer pays |
| Seller's state | decides CGST/SGST vs IGST |
| The GST **state code** for that state | the numeric code (e.g. 27) — a regulated set we do not guess |

Orders record the buyer's state by **name**, which is unambiguous and enough to decide intra- vs
inter-state supply. The numeric codes an invoice needs are mapped in when the above arrives.

### A3 · Shipping ◐

Defaults to **flat ₹99, no free-shipping threshold** — the ₹99 follows the legacy static site, so it
is precedent rather than invention. Editable in admin.

| Needed | Current default |
|---|---|
| Flat shipping charge | ₹99 |
| Free above what order value? | none |
| Who fulfils and ships? | — |

### A4 · Cash on Delivery ◐

COD is **enabled** per the client's direction (essential in the Indian market).

| Needed | Current default |
|---|---|
| COD fee, if any | ₹0 — the standard lever to nudge customers toward prepaid |
| Pincode or order-value restrictions | none |

Note: a COD order commits stock with **no money received**, and someone must mark it collected in
admin when the courier remits. There is no webhook for cash.

**How you find out an order came in:** an email to `ORDERS_EMAIL` (§B2) the moment it is placed,
carrying the address, the items and the phone number — and, since S7, `/admin/orders` opens on
exactly the orders that need doing something about. The email should still point at a mailbox
somebody opens each morning; it is the thing that tells you to go and look.

**Recording the cash** is one screen: tick the orders a courier has settled, press one button. It
takes a batch because that is how couriers remit. It records the **money** and deliberately leaves
the parcel's status alone — a COD parcel is often delivered days before the money reaches you, and
the shop should not have to pretend otherwise. `/admin` shows the running total you are owed.

One number can place **three COD orders a day**. That is the anti-abuse limit, not a business rule;
say the word and it moves.

### A5 · Legal pages ☐ — **blocks Razorpay**

Razorpay will not activate a live account without these published. They are currently inert `#`
placeholders in the footer, so this is on the critical path to taking payment.

- Privacy policy · Terms · **Refund / cancellation policy** · Shipping policy · Contact

Who writes them, and do they get the house's editorial treatment or plain legal pages?

### A6 · Real contact details ☐

Still flagged as placeholders in the code:

- **`hello@beyondthebody.com`** — is this the real address?
- Instagram and LinkedIn URLs — currently placeholder links

### A7 · Razorpay ☐ — **built and waiting; the keys are the only missing piece**

Card, UPI and netbanking are fully implemented. Supplying three values turns them on: **no code
change, no migration, no deploy flag.** Until then checkout offers cash on delivery and shows
card/UPI as *"opening shortly"* — stated rather than hidden, so nobody wonders whether the house
takes cards at all.

| Needed | Where it comes from |
|---|---|
| `RAZORPAY_KEY_ID` | Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | shown once, at the moment the key is generated |
| `RAZORPAY_WEBHOOK_SECRET` | a value **you choose** when creating the webhook |

Plus one dashboard setting, which is not an environment variable and is easy to forget:

> **Webhook URL:** `https://<your-domain>/api/webhooks/razorpay`
> **Events:** `payment.captured` and `payment.failed`

**Start in test mode.** Test keys begin `rzp_test_`, live keys `rzp_live_`. The app logs an error at
every boot if a test key is used in production — that combination takes no money while appearing to
work perfectly, which is the single most expensive way to get this wrong.

The webhook is what actually completes an order — a customer whose UPI app swallows the redirect
never returns to the site, and their order must still complete. If the webhook is never configured,
payments still succeed at Razorpay but orders sit unpaid until a reconciliation job notices, which
it does every ten minutes with a loud warning. That is a safety net, not a substitute.

### A8 · The Journal ☑ *(nothing needed to launch)*

Live at `/admin/journal`. The three existing essays are already loaded and editable; new ones are
written, previewed and published from there, and appear on the site within seconds.

Two things worth knowing rather than deciding:

- **Imagery is placed by path, not uploaded.** Each essay names a file that ships with the site
  (e.g. `/journal/essay-1.webp`). Send new photography to the developer, who adds the file and gives
  you the path to paste in. This keeps essay imagery inside the same art direction as the rest of
  the site; an upload button is a half-day's work if you would rather have it.
- **The editor is deliberately plain** — bold, italic, one heading level, a quote, lists, a rule.
  It is not a page builder, because the page design is fixed and an essay should not carry its own.

### A9 · The store is open at checkout ⚠ ☐ — **read this before launch**

As of S5 a visitor can place a real, fulfillable order and you will be emailed about it. Three
things follow, and all three are yours to decide rather than ours:

| | |
|---|---|
| **Prices are still ₹1,899 placeholders** | §A1 — this is now what a customer actually pays |
| **Stock is not tracked** | Every SKU is always buyable. Turn tracking on per SKU in `/admin/prices` once real counts exist; until then nothing can read "sold out" by accident |
| **`store_open` closes checkout instantly** | One setting, no deploy — useful around a drop, or if fulfilment falls behind |
| **Card and UPI arrive the moment the keys do** | §A7. Nothing else changes, and cash on delivery keeps working either way |

### A10 · Courier and despatch ☐ *(new at S7)*

You can now run an order end to end from `/admin/orders`: **start packing → mark shipped → mark
delivered**, with cancel and "came back to us" where they apply. Marking it shipped emails the
customer with whatever courier name, tracking number and tracking link you typed, and the same
details appear on their own order page.

| Needed | Why it is being asked |
|---|---|
| Which courier(s) will you use? | So the tracking link can be built for you instead of pasted each time |
| Do you have an account with them yet? | Nothing in the site depends on it, but nothing ships without it |
| Who does the packing — you, or someone else? | If it is someone else, they currently need an **owner** login, which also sees prices and refunds |

**No courier API is integrated, on purpose.** At this volume, typing a tracking number takes seconds
a day; an integration is a per-courier contract, a set of credentials, and a new way for despatch to
break at four in the afternoon. If volume grows enough that it stops being seconds, it is a
self-contained piece of work to add later.

**If a separate packer login is wanted**, that is a third role (owner / editor / fulfilment) and
roughly half a day. It was left out because two or three staff do not need it — but it is the right
answer the moment somebody who should not see refunds is doing the packing.

---

## §B — Needed from the deployment team

### B1 · Runtime ☐

- **Node.js 22+** (built and tested on 22.17)
- **PostgreSQL 13+** — `gen_random_uuid()` is used for primary keys
- A process supervisor that restarts the app (systemd, pm2, Docker restart policy)

### B2 · Environment variables ☐

Full contract with explanations is in **`.env.example`** — that file is the source of truth and is
kept current. The ones that need a real decision:

| Variable | Why it matters |
|---|---|
| `DATABASE_URL` | Postgres connection. Use the **direct** endpoint, not a PgBouncer/pooled one — migrations and advisory locks need it |
| `DATABASE_SSL` | `true` if the database requires TLS |
| `DATABASE_SSL_INSECURE` | **Only** for a self-signed / internal CA certificate. Turns off certificate verification — encrypted but no longer proving who is on the other end |
| `APP_URL` | Absolute public origin, no trailing slash. Every emailed link is built from it: get it wrong and **sign-in links point at the wrong host** |
| `SESSION_SECRET` | ≥32 chars of randomness: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Rotating it signs everyone out |
| `TRUSTED_PROXY_HOPS` | **See B3 — easy to get dangerously wrong** |
| `SMTP_*`, `MAIL_FROM` | See B4 |
| `ORDERS_EMAIL` | Where the studio is told an order arrived. **Until the admin order screens ship this is the only notification** — point it at a monitored mailbox. Unset falls back to the `MAIL_FROM` address |
| `RAZORPAY_*` | See §A7. All three together, or card/UPI stays closed. Also needs a webhook configured in their dashboard — the variable alone is not enough |
| `SENTRY_DSN` | Optional. Absent = structured logs only, which is supported |

**One thing about the webhook that is easy to miss:** `/api/webhooks/razorpay` must be reachable
from the public internet and must **not** sit behind basic auth, an IP allow-list, or a WAF rule
that strips request bodies. Its signature covers the raw body byte for byte, so anything in front
of the app that reformats JSON will make every genuine delivery fail verification.

### B3 · Reverse proxy and client IPs ⚠ ☐

`TRUSTED_PROXY_HOPS` is the number of proxies in front of the app. **nginx alone = 1.**
Cloudflare + nginx = 2.

- **Too low (or 0):** client IPs cannot be determined, so IP rate limits collapse into one shared
  bucket. Over-restrictive, but safe.
- **Too high:** a caller can spoof `X-Forwarded-For` and **walk through every rate limit**. This is
  the dangerous direction.

The app logs a warning at boot if this is left at 0 in production.

### B4 · Email ⚠ ☐ — **the app is useless without it**

The client chose company SMTP over a transactional provider. That is workable, but:

**Order confirmations and admin sign-in links are functional email, not marketing.** If they land in
spam, a customer believes their order failed and **an admin cannot get into the site at all** —
sign-in links are the only way in. There is no password fallback, by design.

| Needed | Notes |
|---|---|
| SMTP host, port, username, password | Port 587 uses STARTTLS → `SMTP_SECURE=false`. Port 465 is implicit TLS → `true` |
| `MAIL_FROM` address | Must be on a domain this server is authorised to send for |
| **SPF, DKIM and DMARC** on the sending domain | Non-optional in practice |
| A delivery test to Gmail **and** Outlook before launch | The two that matter most |

With no `SMTP_HOST`, the app **logs mail instead of sending it** and warns at boot. Correct for
development; in production it means nothing ever arrives.

### B5 · Deploy procedure ☐

```bash
npm ci
npm run build
npm run db:migrate     # explicit step — migrations deliberately do NOT run at boot
npm start
```

Migrations are a separate step on purpose: several instances starting at once would otherwise
migrate concurrently. Run it **once** per deploy, before the new version serves traffic.

### B6 · First admin account ☐

There is no sign-up page and no way to grant yourself access through the web — deliberate.

```bash
npm run admin:create -- someone@beyondthebody.com owner "Their Name"
```

Roles: `owner` (prices, refunds, subscriber export) · `editor` (journal and media only).
This grants no password — the person signs in via an emailed link, so **B4 must work first**.

Create at least two: one `owner` for whoever runs the business, and an `editor` for whoever writes
the Journal. Give `owner` only where prices and the subscriber list are genuinely part of the job.

### B7 · Operations ☐

- **`GET /api/health`** → `200 {"status":"ok"}`, or `503` when the database is unreachable. Point
  the load balancer at it.
- **Logs** are one JSON object per line on stdout — ship them with whatever you already run.
  **Two lines are worth an alert rule**, because nothing else will tell you:
  `"msg":"inventory.drift"` — the stock counter and the stock ledger disagree, checked daily. It
  means a sale or a restock did not land where it should have, and the count on the site is now
  fiction. It reports and never repairs, so somebody has to look.
  `"msg":"boot.razorpay_test_keys_in_production"` — payments will appear to succeed and no money
  will ever arrive.
- **Backups**: nightly `pg_dump` at minimum, and **rehearse a restore** before launch.
- **Multiple instances are safe** if you want them: job claiming uses `FOR UPDATE SKIP LOCKED` and
  rate limiting is an atomic upsert, so nothing needs leader election.
  **One caveat, and it is visible to the client:** Next's page cache is per-instance on local disk,
  so publishing an essay or saving a price only refreshes the instance that handled the request.
  Other instances keep serving the previous version until their **1-hour** backstop expires — the
  client presses Publish, sees it live, refreshes, and sees it gone. If you run more than one
  instance, either pin `/admin` to one via a sticky route, or ask for a shared cache handler
  (roughly a day's work). **A single instance has none of this** and is the expected shape here.
- **TLS** terminates at your proxy. `APP_URL` must be `https://` in production or session cookies
  will not be sent.

---

## §C — Launch blockers

Everything else can follow the site live. These cannot:

1. **§B4 · SMTP working, with SPF/DKIM/DMARC.** Without it nobody can sign into admin and no
   confirmation email arrives — **and since S5, no order confirmation either.** A customer who
   orders and hears nothing assumes it failed. *Deployment team.*
2. **§B2 · `APP_URL` correct.** Every emailed link is built from it, including the customer's own
   order page. *Deployment team.*
3. **§B2 · `ORDERS_EMAIL` pointing at a monitored mailbox.** The order screens exist now, but this
   is still what tells the house to go and look at them. *Deployment team.*
4. **§B3 · `TRUSTED_PROXY_HOPS` matching the real topology.** *Deployment team.*
5. **§B6 · At least one owner account created.** *Deployment team.*
6. **§A1 · Real prices.** ₹1,899 is a placeholder, and checkout now charges it. *Client.*
7. **§A5 · Legal pages published** — blocks Razorpay activation, so it blocks prepaid payment.
   Does **not** block a COD-only store. *Client.*
8. **§A2 · GST**, if the client is registered — invoices are wrong without it. *Client's accountant.*

---

## Resolved — kept so they are not re-asked

| Item | Resolution | Date |
|---|---|---|
| Commerce build vs buy | Custom + Razorpay | 2026-08-11 |
| Customer accounts | None. Guest checkout only | 2026-08-11 |
| Payment methods | Prepaid **and** COD | 2026-08-11 |
| Product content editing | Developer, in code — part of the visual system | 2026-08-11 |
| Price editing | Client, via admin | 2026-08-11 |
| Journal | Custom blog portal, client publishes | 2026-08-11 |
| Email | Company SMTP, not a provider | 2026-08-11 |
| Hosting | Client's own servers, not Vercel | 2026-08-11 |
| Discount codes | None — the brand forbids deal/urgency language | 2026-08-11 |
