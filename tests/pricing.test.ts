/* The quote engine, without a database.
 *
 * This is where money is decided, so the cases below are mostly about the ways a total
 * can be quietly wrong: tax added twice, a stale browser price believed, a duplicate line
 * walking past the per-line cap, floating point creeping into rupees. */

import { describe, expect, it } from "vitest";
import {
  MAX_QTY_PER_LINE,
  priceCart,
  splitTax,
  taxForAmount,
  type SkuRow,
} from "@/lib/pricing";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { normalisePhone, formatPhone, AddressSchema } from "@/lib/address";
import { formatOrderNumber } from "@/lib/orders";

const sku = (over: Partial<SkuRow> = {}): SkuRow => ({
  sku: "MA-100",
  productSlug: "mon-amour",
  name: "Mon Amour",
  sizeLabel: "100 ml",
  priceMinor: 189_900,
  status: "active",
  stockQty: 0,
  stockTracked: false,
  hsnCode: null,
  ...over,
});

const index = (...rows: SkuRow[]) => new Map(rows.map((r) => [r.sku, r]));
const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe("pricing · lines", () => {
  it("prices from the catalogue, not from the browser", () => {
    /* The whole point of the endpoint. A bag claiming ₹1 must be charged ₹1,899. */
    const quote = priceCart(
      [{ sku: "MA-100", qty: 1, expectedPriceMinor: 100 }],
      index(sku()),
      settings()
    );

    expect(quote.lines[0].unitPriceMinor).toBe(189_900);
    expect(quote.subtotalMinor).toBe(189_900);
  });

  it("warns when the price moved under the customer", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 1, expectedPriceMinor: 149_900 }],
      index(sku()),
      settings()
    );

    expect(quote.lines[0].issues[0]).toMatchObject({
      code: "price_changed",
      previousPriceMinor: 149_900,
    });
    /* needsReview is what stops checkout committing a total the customer never saw. */
    expect(quote.needsReview).toBe(true);
  });

  it("stays quiet when the price is unchanged", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 2, expectedPriceMinor: 189_900 }],
      index(sku()),
      settings()
    );
    expect(quote.needsReview).toBe(false);
    expect(quote.lines[0].lineTotalMinor).toBe(379_800);
  });

  it("merges duplicate lines before applying the cap", () => {
    /* Two entries for one SKU are one line. Without the merge, six plus six would be
       twelve bottles in an order capped at ten. */
    const quote = priceCart(
      [
        { sku: "MA-100", qty: 6 },
        { sku: "MA-100", qty: 6 },
      ],
      index(sku()),
      settings()
    );

    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0].qty).toBe(MAX_QTY_PER_LINE);
    expect(quote.lines[0].issues[0].code).toBe("qty_reduced");
  });

  it("drops a SKU it has never heard of", () => {
    /* The legacy static site shipped nine SKUs that no longer exist; someone's bag still
       has them. That is a stale bag, not an attack — say so and move on. */
    const quote = priceCart([{ sku: "GONE-9", qty: 1 }], index(sku()), settings());

    expect(quote.lines).toHaveLength(0);
    expect(quote.dropped[0]).toMatchObject({ sku: "GONE-9", reason: "unknown_sku" });
  });

  it.each(["sold_out", "hidden", "discontinued"])("drops a %s variant", (status) => {
    const quote = priceCart([{ sku: "MA-100", qty: 1 }], index(sku({ status })), settings());
    expect(quote.lines).toHaveLength(0);
    expect(quote.dropped).toHaveLength(1);
  });

  it("refuses to charge for something with no price", () => {
    /* "Price on request" is a legitimate display state and an impossible charge. */
    const quote = priceCart([{ sku: "MA-100", qty: 1 }], index(sku({ priceMinor: null })), settings());
    expect(quote.dropped[0].reason).toBe("price_unset");
  });
});

describe("pricing · stock", () => {
  it("ignores stock for a SKU that does not track it", () => {
    /* The default while the house fulfils by hand. Tracking from day one would read
       sold-out on every SKU the moment commerce went live. */
    const quote = priceCart([{ sku: "MA-100", qty: 5 }], index(sku({ stockQty: 0 })), settings());
    expect(quote.lines[0].qty).toBe(5);
  });

  it("drops a tracked SKU with nothing left", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 1 }],
      index(sku({ stockTracked: true, stockQty: 0 })),
      settings()
    );
    expect(quote.dropped[0].reason).toBe("out_of_stock");
  });

  it("reduces the quantity to what is actually there", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 4 }],
      index(sku({ stockTracked: true, stockQty: 2 })),
      settings()
    );
    expect(quote.lines[0].qty).toBe(2);
    expect(quote.lines[0].lineTotalMinor).toBe(379_800);
    expect(quote.needsReview).toBe(true);
  });
});

describe("pricing · shipping", () => {
  it("charges the flat rate", () => {
    const quote = priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), settings());
    expect(quote.shippingMinor).toBe(9_900);
    expect(quote.totalMinor).toBe(189_900 + 9_900);
  });

  it("charges nothing on an empty bag", () => {
    const quote = priceCart([], index(sku()), settings());
    expect(quote.shippingMinor).toBe(0);
    expect(quote.totalMinor).toBe(0);
  });

  it("waives it above the threshold, when there is one", () => {
    const free = settings({ shipping_free_above_minor: 150_000 });
    expect(priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), free).shippingMinor).toBe(0);
  });

  it("keeps charging when the threshold is null", () => {
    /* Null means never free — it must not read as zero and waive everything. */
    expect(DEFAULT_SETTINGS.shipping_free_above_minor).toBeNull();
    const quote = priceCart([{ sku: "MA-100", qty: 10 }], index(sku()), settings());
    expect(quote.shippingMinor).toBe(9_900);
  });
});

describe("pricing · cash on delivery", () => {
  it("adds the fee only when COD is chosen", () => {
    const withFee = settings({ cod_fee_minor: 5_000 });
    const cod = priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), withFee, { paymentMethod: "cod" });
    const prepaid = priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), withFee, { paymentMethod: "prepaid" });

    expect(cod.codFeeMinor).toBe(5_000);
    expect(prepaid.codFeeMinor).toBe(0);
    expect(cod.totalMinor - prepaid.totalMinor).toBe(5_000);
  });

  it("charges no fee when COD is switched off", () => {
    const off = settings({ cod_enabled: false, cod_fee_minor: 5_000 });
    const quote = priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), off, { paymentMethod: "cod" });
    expect(quote.codAvailable).toBe(false);
    expect(quote.codFeeMinor).toBe(0);
  });

  it("ships with the fee at zero, as the client has not asked for one", () => {
    expect(DEFAULT_SETTINGS.cod_fee_minor).toBe(0);
    expect(DEFAULT_SETTINGS.cod_enabled).toBe(true);
  });
});

describe("pricing · tax", () => {
  it("is switched off until the client's accountant supplies a rate", () => {
    /* Per the calibration ledger, regulated figures are the client's authority. Zero is
       not a placeholder to be improved on — it is the correct value until they speak. */
    expect(DEFAULT_SETTINGS.tax_rate_bp).toBe(0);

    const quote = priceCart([{ sku: "MA-100", qty: 1 }], index(sku()), settings());
    expect(quote.taxMinor).toBe(0);
    expect(quote.taxBreakup).toBeNull();
  });

  /* The rate below is a TEST FIXTURE, not a claim about what the house owes. It exists
     to prove the arithmetic works the day a real rate arrives. */
  const HYPOTHETICAL_BP = 1_800;

  it("extracts tax from an inclusive price rather than adding it", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 1 }],
      index(sku()),
      settings({ tax_rate_bp: HYPOTHETICAL_BP, tax_inclusive: true })
    );

    /* 189900 × 1800 / 11800 = 28967.79… → 28968 */
    expect(quote.taxMinor).toBe(28_968);
    /* Inclusive means the tax is ALREADY in the subtotal. Adding it again would
       overcharge every customer by the rate — the single most expensive way to get this
       backwards. */
    expect(quote.totalMinor).toBe(189_900 + 9_900);
  });

  it("adds tax on top of an exclusive price", () => {
    const quote = priceCart(
      [{ sku: "MA-100", qty: 1 }],
      index(sku()),
      settings({ tax_rate_bp: HYPOTHETICAL_BP, tax_inclusive: false })
    );

    expect(quote.taxMinor).toBe(34_182); // 189900 × .18
    expect(quote.totalMinor).toBe(189_900 + 34_182 + 9_900);
  });

  it("returns nothing at a zero rate", () => {
    expect(taxForAmount(189_900, 0, true)).toBe(0);
    expect(taxForAmount(0, 1_800, false)).toBe(0);
  });

  it("splits within the seller's state and not outside it", () => {
    expect(splitTax(1_000, "Maharashtra", "Maharashtra")).toEqual({
      kind: "cgst_sgst",
      cgstMinor: 500,
      sgstMinor: 500,
    });
    expect(splitTax(1_000, "Maharashtra", "Kerala")).toEqual({ kind: "igst", igstMinor: 1_000 });
  });

  it("splits an odd number of paise without losing one", () => {
    const split = splitTax(1_001, "Goa", "Goa");
    expect(split).toEqual({ kind: "cgst_sgst", cgstMinor: 501, sgstMinor: 500 });
    /* The halves must reconstruct the whole, or an invoice will not foot. */
    expect(split && split.kind === "cgst_sgst" && split.cgstMinor + split.sgstMinor).toBe(1_001);
  });

  it("has nothing to split before the seller's state is known", () => {
    expect(splitTax(1_000, null, "Kerala")).toBeNull();
  });
});

describe("pricing · money is never a float", () => {
  it("keeps totals exact across many lines", () => {
    const quote = priceCart(
      [
        { sku: "MA-100", qty: 3 },
        { sku: "HT-10", qty: 7 },
      ],
      index(sku(), sku({ sku: "HT-10", priceMinor: 89_910, name: "Heartthrob", sizeLabel: "Discovery 10 ml" })),
      settings()
    );

    expect(quote.subtotalMinor).toBe(189_900 * 3 + 89_910 * 7);
    expect(Number.isInteger(quote.totalMinor)).toBe(true);
  });
});

describe("addresses and phone numbers", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+919876543210", "9876543210"],
    ["098765-43210", "9876543210"],
    ["  6123456789  ", "6123456789"],
  ])("normalises %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    ["1234567890", "starts below 6"],
    ["98765", "too short"],
    ["98765432101", "too long"],
    ["abcdefghij", "not digits"],
    ["", "empty"],
  ])("rejects %s (%s)", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });

  it("formats for display without becoming a key", () => {
    expect(formatPhone("9876543210")).toBe("98765 43210");
  });

  it("accepts a real address", () => {
    expect(() =>
      AddressSchema.parse({
        name: "A Person",
        line1: "12 Some Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "IN",
      })
    ).not.toThrow();
  });

  it.each([["012345"], ["12345"], ["1234567"], ["ABC123"]])("rejects PIN code %s", (pincode) => {
    /* Indian PIN codes never begin with 0 and are always six digits. */
    const address = {
      name: "A Person",
      line1: "12 Some Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode,
      country: "IN" as const,
    };
    expect(AddressSchema.safeParse(address).success).toBe(false);
  });

  it("rejects a state that is not one", () => {
    const result = AddressSchema.safeParse({
      name: "A Person",
      line1: "12 Some Street",
      city: "Dubai",
      state: "Dubai",
      pincode: "400001",
      country: "IN",
    });
    expect(result.success).toBe(false);
  });
});

describe("order numbers", () => {
  it("pads the sequence and dates by IST", () => {
    expect(formatOrderNumber(1, new Date("2026-08-11T10:00:00Z"))).toBe("BTB-2026-0001");
    expect(formatOrderNumber(1234, new Date("2026-08-11T10:00:00Z"))).toBe("BTB-2026-1234");
  });

  it("does not roll the year early on a UTC server", () => {
    /* 31 Dec 2026, 20:00 UTC is already 1 Jan 2027 in Kolkata. An order placed then
       belongs to 2027, whatever the server's own clock thinks. */
    expect(formatOrderNumber(7, new Date("2026-12-31T20:00:00Z"))).toBe("BTB-2027-0007");
    /* And the other side of the same boundary stays in 2026. */
    expect(formatOrderNumber(7, new Date("2026-12-31T17:00:00Z"))).toBe("BTB-2026-0007");
  });

  it("keeps growing past four digits rather than wrapping", () => {
    expect(formatOrderNumber(123_456, new Date("2026-08-11T10:00:00Z"))).toBe("BTB-2026-123456");
  });
});
