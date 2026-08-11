/* The transition table, checked as a table.
 *
 * These are properties of the map itself rather than of any one move, which is the point:
 * the expensive mistakes here are structural — a terminal status that quietly gains an
 * exit, a returned order that can be shipped, a typo that names a status the enum does not
 * have. None of those show up when you test one transition at a time. */

import { describe, expect, it } from "vitest";
import { orderStatus } from "@/db/schema";
import { ALLOWED_TRANSITIONS, canTransition, readable, type OrderStatus } from "@/lib/fulfilment";

const ALL = orderStatus.enumValues as readonly OrderStatus[];

/* Ends of the road. Nothing may leave these — money and stock have both settled, and a
   further move would either double-restock or resurrect a cancelled sale. */
const TERMINAL: OrderStatus[] = [
  "delivered",
  "cancelled",
  "refunded",
  "failed",
  "expired",
  "rto_returned",
];

describe("the order transition table", () => {
  it("covers every status the database can hold", () => {
    for (const status of ALL) {
      expect(ALLOWED_TRANSITIONS[status], `no entry for ${status}`).toBeDefined();
    }
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it("only ever points at real statuses", () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of targets) {
        expect(ALL, `${from} → ${to} is not a status`).toContain(to);
      }
    }
  });

  it("lets nothing out of a terminal status", () => {
    for (const status of TERMINAL) {
      expect(ALLOWED_TRANSITIONS[status], `${status} should be terminal`).toEqual([]);
    }
  });

  it("never lets an order move to itself", () => {
    for (const status of ALL) {
      expect(canTransition(status, status), `${status} → ${status}`).toBe(false);
    }
  });

  it("only ships something that was being packed", () => {
    const sources = ALL.filter((s) => canTransition(s, "shipped"));
    expect(sources).toEqual(["processing"]);
  });

  it("only accepts a return of something that went out", () => {
    const sources = ALL.filter((s) => canTransition(s, "rto_returned"));
    expect(sources).toEqual(["shipped"]);
  });

  it("cannot cancel an order that has already left", () => {
    for (const status of ["shipped", "delivered"] as const) {
      expect(canTransition(status, "cancelled")).toBe(false);
    }
  });

  it("keeps the two payment methods on their own rails until they converge", () => {
    /* pending_payment is prepaid's alone: a COD order is confirmed from the start and must
       never be reachable by, or reachable from, the unpaid state. */
    expect(canTransition("pending_payment", "confirmed")).toBe(false);
    expect(canTransition("confirmed", "pending_payment")).toBe(false);
    /* …and both arrive at the same packing bench. */
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("confirmed", "processing")).toBe(true);
  });

  it("never takes money's word for where the parcel is", () => {
    /* Marking a prepaid order paid is a payment event, not an admin transition — nothing
       in the table may reach `paid`, or two systems would own the same field. */
    expect(ALL.filter((s) => canTransition(s, "paid"))).toEqual([]);
    /* Same for a refund: it is recorded against an order, not walked to. */
    expect(ALL.filter((s) => canTransition(s, "refunded"))).toEqual([]);
  });

  it("has a human phrase for every status", () => {
    for (const status of ALL) {
      /* readable() falls back to the raw value, so what this catches is an untranslated
         status reaching the screen as a snake_case identifier. Statuses that are already
         plain English — "paid", "shipped" — are allowed to map to themselves. */
      expect(readable(status), `${status} has no phrase`).not.toMatch(/_/);
    }
  });
});
