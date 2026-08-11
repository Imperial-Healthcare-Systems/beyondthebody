/* Schema barrel. Later phases add modules here:
 *   phase 5 → commerce.ts    (order, order_item, inventory_movement)
 *   phase 6 → payments.ts    (payment, webhook_event, refund)
 *
 * A module missing from this list is invisible to drizzle-kit, which then reports
 * "no schema changes" and generates nothing — silently, since an unexported table is
 * not an error to it. Add the export in the same commit as the module. */

export * from "./platform";
export * from "./newsletter";
export * from "./catalogue";
export * from "./journal";
