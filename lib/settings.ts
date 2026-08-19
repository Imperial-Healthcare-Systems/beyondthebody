/* Runtime settings — the knobs the client has not decided yet.
 *
 * Everything here is deliberately NOT a migration: shipping rates, the COD fee, the GST
 * rate and GSTIN are all pending client input (see project/working/backend-architecture.md
 * §12). Each has a working default so the build proceeds, and each becomes a one-field
 * edit in admin when the real value arrives.
 *
 * Money is integer paise everywhere. 9900 = ₹99.00. */

import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { setting } from "@/db/schema";
import { logger } from "./logger";

const SettingsSchema = z.object({
  /* Shipping — flat rate, free above a threshold. Defaults follow the legacy static
     site (₹99), which is precedent rather than invention. Threshold null = never free. */
  shipping_flat_minor: z.number().int().min(0).default(9_900),
  shipping_free_above_minor: z.number().int().min(0).nullable().default(null),

  /* COD. Enabled per client direction — essential in the Indian market. The fee is the
     standard lever toward prepaid; zero until they ask for it. */
  cod_enabled: z.boolean().default(true),
  cod_fee_minor: z.number().int().min(0).default(0),

  /* GST. Tax-ready, switched off: rate stays 0 until the client's accountant supplies
     it. Per calibration ledger #21, regulated figures are the client's authority and
     are never inferred here. */
  tax_inclusive: z.boolean().default(true),
  tax_rate_bp: z.number().int().min(0).max(10_000).default(0), // basis points; 1800 = 18%
  gstin: z.string().nullable().default(null),
  seller_state: z.string().nullable().default(null), // state code → intra vs inter-state GST

  /* Kill switch. Lets the client close checkout without a deploy — useful around a drop
     or if fulfilment falls behind. */
  store_open: z.boolean().default(true),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SettingKey = keyof Settings;

export const SETTING_DESCRIPTIONS: Record<SettingKey, string> = {
  shipping_flat_minor: "Flat shipping charge in paise (9900 = ₹99).",
  shipping_free_above_minor: "Order subtotal in paise above which shipping is free. Null = never.",
  cod_enabled: "Offer Cash on Delivery at checkout.",
  cod_fee_minor: "Extra charge in paise for choosing COD. 0 = none.",
  tax_inclusive: "True if displayed prices already include GST.",
  tax_rate_bp: "GST rate in basis points (1800 = 18%). 0 until the client's CA confirms.",
  gstin: "Seller GSTIN, printed on invoices.",
  seller_state: "Seller's state code — decides CGST/SGST vs IGST.",
  store_open: "False closes checkout without a deploy.",
};

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

const CACHE_MS = 60_000;
let cache: { at: number; value: Settings } | null = null;

/** All settings, DB values layered over defaults. Cached briefly — an admin edit is
 *  visible within a minute, which is the right trade for avoiding a query per request. */
export async function getSettings(force = false): Promise<Settings> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  try {
    const keys = Object.keys(DEFAULT_SETTINGS) as SettingKey[];
    const rows = await db
      .select({ key: setting.key, value: setting.value })
      .from(setting)
      .where(inArray(setting.key, keys));

    const raw: Record<string, unknown> = {};
    for (const row of rows) raw[row.key] = row.value;

    const parsed = SettingsSchema.safeParse(raw);
    if (!parsed.success) {
      /* A bad row must not take checkout down — fall back to defaults and shout. */
      logger.error("settings.invalid", {
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
      cache = { at: Date.now(), value: DEFAULT_SETTINGS };
      return DEFAULT_SETTINGS;
    }

    cache = { at: Date.now(), value: parsed.data };
    return parsed.data;
  } catch (err) {
    logger.error("settings.unavailable", { err });
    return cache?.value ?? DEFAULT_SETTINGS;
  }
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

/** Write one setting. Validates against the schema so admin cannot store a shape that
 *  later fails to parse. Audit logging is the caller's job (phase 2). */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
  updatedBy?: string
): Promise<void> {
  /* Validate against that key's own schema. `.pick()` with a generic key does not type
     cleanly here; reaching into `.shape` is both simpler and exactly as strict. */
  SettingsSchema.shape[key].parse(value);

  await db
    .insert(setting)
    .values({
      key,
      value: value as unknown as object,
      description: SETTING_DESCRIPTIONS[key],
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: setting.key,
      set: { value: value as unknown as object, updatedBy: updatedBy ?? null, updatedAt: new Date() },
    });

  cache = null;
}

/** Insert any setting rows that don't exist yet, without touching ones that do.
 *  Idempotent — runs on every boot. */
export async function seedSettings(): Promise<number> {
  const entries = Object.entries(DEFAULT_SETTINGS) as [SettingKey, unknown][];
  const rows = entries.map(([key, value]) => ({
    key,
    value: value as object,
    description: SETTING_DESCRIPTIONS[key],
  }));

  const inserted = await db
    .insert(setting)
    .values(rows)
    .onConflictDoNothing({ target: setting.key })
    .returning({ key: setting.key });

  return inserted.length;
}

export function __clearSettingsCache() {
  cache = null;
}
