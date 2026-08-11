# Handover checklist — what the backend needs from you

**Living document.** Updated at every safepoint as phases land. Last updated: **2026-08-11 (S3)**.

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

**Not a launch blocker** — these are now editable at `/admin/prices` (owner role) and go live within seconds, no deploy. But
shipping the placeholder to a live storefront is a commercial decision, not a technical one.

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

### A5 · Legal pages ☐ — **blocks Razorpay**

Razorpay will not activate a live account without these published. They are currently inert `#`
placeholders in the footer, so this is on the critical path to taking payment.

- Privacy policy · Terms · **Refund / cancellation policy** · Shipping policy · Contact

Who writes them, and do they get the house's editorial treatment or plain legal pages?

### A6 · Real contact details ☐

Still flagged as placeholders in the code:

- **`hello@beyondthebody.com`** — is this the real address?
- Instagram and LinkedIn URLs — currently placeholder links

### A7 · Razorpay ☐ *(needed at S6, not before)*

Key ID, key secret, and webhook secret, for **test mode first**. S5 delivers a working COD store
with no Razorpay account at all, so this does not gate commerce going live.

---

## §B — Needed from the deployment team

### B1 · Runtime ☐

- **Node.js 22+** (built and tested on 22.17)
- **PostgreSQL 13+** — `gen_random_uuid()` is used for primary keys
- A process supervisor that restarts the app (systemd, pm2, Docker restart policy)
- A **writable directory for uploads** once the journal portal lands at S4

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
| `SENTRY_DSN` | Optional. Absent = structured logs only, which is supported |

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

### B7 · Operations ☐

- **`GET /api/health`** → `200 {"status":"ok"}`, or `503` when the database is unreachable. Point
  the load balancer at it.
- **Logs** are one JSON object per line on stdout — ship them with whatever you already run.
- **Backups**: nightly `pg_dump` at minimum, and **rehearse a restore** before launch.
- **Multiple instances are safe** if you want them: job claiming uses `FOR UPDATE SKIP LOCKED` and
  rate limiting is an atomic upsert, so nothing needs leader election. Two caveats: uploads need
  shared storage, and Next's ISR cache is per-instance on local disk.
- **TLS** terminates at your proxy. `APP_URL` must be `https://` in production or session cookies
  will not be sent.

---

## §C — Launch blockers

Everything else can follow the site live. These cannot:

1. **§B4 · SMTP working, with SPF/DKIM/DMARC.** Without it nobody can sign into admin and no
   confirmation email arrives. *Deployment team.*
2. **§B2 · `APP_URL` correct.** Every emailed link is built from it. *Deployment team.*
3. **§B3 · `TRUSTED_PROXY_HOPS` matching the real topology.** *Deployment team.*
4. **§B6 · At least one owner account created.** *Deployment team.*
5. **§A5 · Legal pages published** — blocks Razorpay activation, so it blocks prepaid payment.
   Does **not** block a COD-only store. *Client.*
6. **§A2 · GST**, if the client is registered — invoices are wrong without it. *Client's accountant.*

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
