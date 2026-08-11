/* Schema barrel. Later phases add modules here:
 *   phase 4 → journal.ts     (post, media)
 *   phase 5 → commerce.ts    (order, order_item, inventory_movement)
 *   phase 6 → payments.ts    (payment, webhook_event, refund) */

export * from "./platform";
export * from "./newsletter";
export * from "./catalogue";
