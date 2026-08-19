/* Reading an order number back off a customer's screen.
 *
 * The lookup bar in the bag is only as good as this function: a customer reading
 * "BTB-2026-0507" off a phone will type it in a dozen shapes, and every shape that fails
 * to parse is a person who concludes the shop lost their order. */

import { describe, expect, it } from "vitest";
import { formatOrderNumber, normaliseOrderNumber } from "@/lib/orders";

describe("normaliseOrderNumber", () => {
  it.each([
    ["BTB-2026-0507", "the canonical form"],
    ["btb-2026-0507", "lowercased"],
    ["  BTB-2026-0507  ", "with the spaces a copy-paste brings"],
    ["BTB 2026 0507", "spaces instead of hyphens"],
    ["BTB20260507", "no separators at all"],
    ["2026-0507", "without the house prefix"],
    ["20260507", "digits only"],
    ["BTB–2026–0507", "en dashes, as a phone keyboard autocorrects them"],
  ])("reads %s (%s)", (input) => {
    expect(normaliseOrderNumber(input)).toBe("BTB-2026-0507");
  });

  it("pads a short sequence the way formatOrderNumber pads it", () => {
    expect(normaliseOrderNumber("BTB-2026-7")).toBe("BTB-2026-0007");
    expect(normaliseOrderNumber("BTB-2026-7")).toBe(
      formatOrderNumber(7, new Date("2026-06-01T12:00:00Z"))
    );
  });

  it("leaves a sequence past four digits alone", () => {
    expect(normaliseOrderNumber("BTB-2026-10432")).toBe("BTB-2026-10432");
  });

  it.each([
    [""],
    ["   "],
    ["BTB"],
    ["2026"],
    ["not an order"],
    ["BTB-2026-"],
    ["BTB-2026-0507-EXTRA"],
    ["'; drop table \"order\"; --"],
  ])("refuses %s", (input) => {
    expect(normaliseOrderNumber(input)).toBeNull();
  });
});
