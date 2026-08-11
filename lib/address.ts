/* Shipping details — validation, normalisation, and the state list.
 *
 * India-only, because the house ships India-only. Making this generic now would mean
 * guessing at address shapes nobody has asked for; the day they ship abroad, a country
 * field and a looser postcode rule is a small change.
 *
 * The state list is geography, not tax law. The numeric GST state codes that decide
 * CGST/SGST vs IGST are a regulated set and are deliberately NOT encoded here — see
 * HANDOVER §A2. Place of supply is recorded as the state's name, which is unambiguous
 * and can be mapped to a code on the day GST is actually switched on. */

import { z } from "zod";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** Indian mobile numbers are ten digits beginning 6–9. Accepts the forms people actually
 *  type — `+91 98765 43210`, `098765-43210` — and stores one canonical shape. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const local = digits.length > 10 && digits.startsWith("91")
    ? digits.slice(-10)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

/** Display form: `98765 43210`. Never used as a key — normalisePhone's output is. */
export const formatPhone = (local: string) => `${local.slice(0, 5)} ${local.slice(5)}`;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const AddressSchema = z.object({
  name: trimmed(120),
  line1: trimmed(180),
  line2: z.string().trim().max(180).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: trimmed(80),
  state: z.enum(INDIAN_STATES, { message: "Choose a state or union territory." }),
  /* Indian PIN codes never begin with 0. */
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "That doesn't look like a PIN code."),
  country: z.literal("IN").default("IN"),
});

export type Address = z.infer<typeof AddressSchema>;

export const PhoneSchema = z
  .string()
  .trim()
  .transform((v) => normalisePhone(v))
  .refine((v): v is string => v !== null, {
    message: "Enter a 10-digit Indian mobile number.",
  });

/** One-line rendering for emails and the order page. */
export function formatAddress(address: Address): string[] {
  return [
    address.name,
    address.line1,
    address.line2 || null,
    address.landmark || null,
    `${address.city}, ${address.state} ${address.pincode}`,
  ].filter((line): line is string => Boolean(line));
}
