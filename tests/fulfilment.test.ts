/* The transition table, checked as a table.
 *
 * These are properties of the map itself rather than of any one move, which is the point:
 * the expensive mistakes here are structural — a terminal status that quietly gains an
 * exit, a returned order that can be shipped, a typo that names a status the enum does not
 * have. None of those show up when you test one transition at a time. */

import { describe, expect, it } from "vitest";
import { orderStatus } from "@/db/schema";
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  canUndo,
  readable,
  undosFor,
  type OrderStatus,
} from "@/lib/fulfilment";

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

  /* ── corrections ────────────────────────────────────────────────────────────────
     A second, separate table. `delivered` is a human's assertion about the physical
     world made by pressing a button next to another button, and before 2026-08-12 there
     was no way back from a misclick. */

  it("offers a way back from delivered and shipped", () => {
    expect(undosFor({ status: "delivered", paymentMethod: "cod" })).toEqual(["shipped"]);
    expect(undosFor({ status: "shipped", paymentMethod: "cod" })).toEqual(["processing"]);
  });

  it("puts an order back on the rail it came in on", () => {
    /* processing is reached from `paid` on prepaid and `confirmed` on COD; offering both
       would let a COD order be walked into a prepaid-only status. */
    expect(undosFor({ status: "processing", paymentMethod: "prepaid" })).toEqual(["paid"]);
    expect(undosFor({ status: "processing", paymentMethod: "cod" })).toEqual(["confirmed"]);
  });

  it("never undoes anything that put stock back", () => {
    /* cancelled and rto_returned both restock. Reversing one means taking stock out
       again, which can oversell — those are re-orders, not undos. */
    for (const status of ["cancelled", "rto_returned", "expired", "refunded", "failed"] as const) {
      expect(undosFor({ status, paymentMethod: "cod" }), `${status} should have no undo`).toEqual([]);
    }
  });

  it("does not let an undo travel more than one step", () => {
    expect(canUndo({ status: "delivered", paymentMethod: "cod" }, "processing")).toBe(false);
    expect(canUndo({ status: "delivered", paymentMethod: "cod" }, "confirmed")).toBe(false);
    expect(canUndo({ status: "shipped", paymentMethod: "cod" }, "confirmed")).toBe(false);
  });

  it("never lets an order move to itself", () => {
    for (const status of ALL) {
      expect(canTransition(status, status), `${status} → ${status}`).toBe(false);
    }
  });

  it("ships from anywhere the parcel is genuinely in hand", () => {
    /* Was ["processing"] alone. The house packs and hands over in one sitting, so
       requiring a separate "start packing" click first made the common case two clicks
       and two page loads (client, 2026-08-12). `processing` survives as a real state for
       a parcel packed but not yet collected — it is just no longer compulsory. */
    const sources = ALL.filter((s) => canTransition(s, "shipped"));
    expect(sources).toEqual(["paid", "confirmed", "processing"]);
  });

  it("never ships something unpaid, cancelled or already gone", () => {
    /* The half of the old assertion that still matters: widening the entry points must not
       have opened one from a status where there is nothing legitimate to send. */
    for (const status of ["pending_payment", "shipped", "delivered", "cancelled", "refunded", "failed", "expired", "rto_returned"] as const) {
      expect(canTransition(status, "shipped"), `${status} → shipped`).toBe(false);
    }
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
