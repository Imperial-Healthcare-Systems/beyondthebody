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

  /* 3 · Jobs. Handlers must be registered before the worker can claim their rows —
     an unknown kind is parked as failed rather than retried. */
  registerMaintenanceJobs();
  registerMailJobs();

  if (env.WORKER_ENABLED) {
    try {
      await seedSettings();
      await ensureRecurringJobs();
      startWorker();
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
