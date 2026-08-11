/* Server startup — runs once per process via instrumentation.ts.
 *
 * Three jobs: fail fast on a bad environment, warn about configuration that is legal but
 * dangerous, and start the background worker. Deliberately does NOT run migrations:
 * applying schema changes as a side effect of a process starting means a rolling restart
 * can migrate concurrently from several instances. Migrations are an explicit step
 * (`npm run db:migrate`) in the deploy runbook. */

import { loadEnv } from "./env";
import { logger } from "./logger";
import { ensureRecurringJobs, registerMaintenanceJobs, startWorker } from "./jobs";
import { registerMailJobs } from "./mail";
import { registerPaymentJobs } from "./payments";
import { isRazorpayConfigured, isTestMode } from "./razorpay";
import { checkCatalogueParity, seedVariants } from "./catalogue";
import { seedPosts } from "./journal";
import { seedSettings } from "./settings";

let started = false;

export async function startup() {
  if (started) return;
  started = true;

  /* 1 · Environment. Throwing here is correct: a server that boots without a database
     URL or session secret would fail later, per request, in ways that are harder to
     diagnose than a refused start. */
  const env = loadEnv();
  logger.info("boot.env_ok", { nodeEnv: env.NODE_ENV, logLevel: env.LOG_LEVEL });

  /* 2 · Configuration that is valid but risky in production. */
  if (env.NODE_ENV === "production" && env.TRUSTED_PROXY_HOPS === 0) {
    logger.warn("boot.untrusted_proxy_config", {
      detail:
        "TRUSTED_PROXY_HOPS=0 in production. Client IPs cannot be determined behind a " +
        "reverse proxy, so IP rate limits fall back to one shared bucket. Set it to the " +
        "number of proxies in front of this app (nginx alone = 1).",
    });
  }
  if (env.NODE_ENV === "production" && env.APP_URL.startsWith("http://")) {
    logger.warn("boot.insecure_app_url", {
      detail: "APP_URL is http:// in production. Session cookies require https to be sent.",
    });
  }

  if (env.NODE_ENV === "production" && !env.SMTP_HOST) {
    logger.warn("boot.no_smtp", {
      detail:
        "SMTP_HOST is not set in production. Mail is being LOGGED, not sent — newsletter " +
        "confirmations and admin sign-in links will never arrive.",
    });
  }

  /* Razorpay. Absent keys are a supported state — prepaid stays closed and checkout
     offers cash on delivery — so this is informational, not a failure. The dangerous
     case is the opposite: TEST keys on a live site take nobody's money while appearing
     to work perfectly, which can go unnoticed for days. */
  if (!isRazorpayConfigured()) {
    logger.info("boot.razorpay_disabled", {
      detail: "No Razorpay keys — card and UPI are closed, cash on delivery is unaffected.",
    });
  } else if (env.NODE_ENV === "production" && isTestMode()) {
    logger.error("boot.razorpay_test_keys_in_production", {
      detail:
        "RAZORPAY_KEY_ID is an rzp_test_ key in production. Payments will appear to " +
        "succeed and no money will ever arrive.",
    });
  }

  /* 3 · Jobs. Handlers must be registered before the worker can claim their rows —
     an unknown kind is parked as failed rather than retried. */
  registerMaintenanceJobs();
  registerMailJobs();
  registerPaymentJobs();

  if (env.WORKER_ENABLED) {
    try {
      await seedSettings();
      await seedVariants();
      /* Migrates the three frozen essays out of journal-data.ts on first boot. Skips any
         slug already present, so it never overwrites what the client has since edited. */
      await seedPosts();
      await ensureRecurringJobs();
      startWorker();

      /* Catalogue parity. The failure this catches: a developer adds a scent to
         products-data.ts, ships it, and it appears on the site with no commercial row —
         no price, no stock, no HSN code — and nobody notices until someone tries to buy
         it. Reported loudly, but not fatal: refusing to boot over it would take the
         whole editorial site down for one unpriced SKU. */
      const parity = await checkCatalogueParity();
      if (parity.missingInDb.length > 0) {
        logger.error("boot.catalogue_missing_rows", {
          skus: parity.missingInDb,
          detail: "SKUs exist in products-data.ts with no product_variant row.",
        });
      }
      if (parity.orphanedInDb.length > 0) {
        logger.warn("boot.catalogue_orphans", {
          skus: parity.orphanedInDb,
          detail: "product_variant rows with no SKU in code — expected for discontinued scents.",
        });
      }
    } catch (err) {
      /* The database being briefly unavailable at boot must not stop the site from
         serving. The worker's own loop retries, and settings fall back to defaults. */
      logger.error("boot.deferred", {
        err,
        detail: "Database unreachable at startup; serving with defaults and retrying.",
      });
      startWorker();
    }
  } else {
    logger.info("boot.worker_disabled");
  }

  logger.info("boot.ready");
}
