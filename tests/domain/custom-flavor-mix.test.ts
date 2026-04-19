import { describe, expect, it } from "vitest";

import { buildCustomFlavorMixConsumption, calculateCustomOrderPrice } from "@/modules/orders/domain/custom-flavor-mix";

describe("custom flavor mix consumption", () => {
  it("converts flavor selections into flavor-specific sachet consumption", () => {
    const result = buildCustomFlavorMixConsumption({
      minimumSachets: 4,
      flavors: [
        { flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 2 },
        { flavorId: "flavor-van", flavorName: "Vanilla", variantId: "sku-van", quantity: 2 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.variantId).toBe("sku-choc");
    expect(Number(result[0]?.quantity)).toBe(2);
    expect(result[1]?.variantId).toBe("sku-van");
    expect(Number(result[1]?.quantity)).toBe(2);
  });

  it("returns exact quantities, not just any value", () => {
    const result = buildCustomFlavorMixConsumption({
      minimumSachets: 4,
      flavors: [
        { flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 3 },
        { flavorId: "flavor-straw", flavorName: "Strawberry", variantId: "sku-straw", quantity: 5 },
      ],
    });

    expect(Number(result[0]?.quantity)).toBe(3);
    expect(Number(result[1]?.quantity)).toBe(5);
  });

  it("throws when total sachets are below minimum", () => {
    expect(() =>
      buildCustomFlavorMixConsumption({
        minimumSachets: 4,
        flavors: [
          { flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 1 },
          { flavorId: "flavor-van", flavorName: "Vanilla", variantId: "sku-van", quantity: 2 },
        ],
      }),
    ).toThrow(/at least 4 sachets/);
  });

  it("throws when total sachets equal minimum minus one", () => {
    expect(() =>
      buildCustomFlavorMixConsumption({
        minimumSachets: 4,
        flavors: [{ flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 3 }],
      }),
    ).toThrow(/at least 4 sachets/);
  });

  it("accepts exactly the minimum quantity", () => {
    const result = buildCustomFlavorMixConsumption({
      minimumSachets: 4,
      flavors: [
        { flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 2 },
        { flavorId: "flavor-van", flavorName: "Vanilla", variantId: "sku-van", quantity: 2 },
      ],
    });

    expect(result).toHaveLength(2);
  });

  it("preserves flavorId and flavorName on each line", () => {
    const result = buildCustomFlavorMixConsumption({
      minimumSachets: 4,
      flavors: [
        { flavorId: "flavor-coffee", flavorName: "Coffee", variantId: "sku-coffee", quantity: 4 },
      ],
    });

    expect(result[0]?.flavorId).toBe("flavor-coffee");
    expect(result[0]?.flavorName).toBe("Coffee");
  });

  it("handles large quantities without precision errors", () => {
    const result = buildCustomFlavorMixConsumption({
      minimumSachets: 4,
      flavors: [{ flavorId: "flavor-choc", flavorName: "Chocolate", variantId: "sku-choc", quantity: 100 }],
    });

    expect(Number(result[0]?.quantity)).toBe(100);
  });
});

describe("custom order price calculation", () => {
  it("multiplies sachets by price per sachet", () => {
    const price = calculateCustomOrderPrice(8, 3);
    expect(Number(price)).toBe(24);
  });

  it("rounds to 2 decimal places", () => {
    const price = calculateCustomOrderPrice(3, 1.005);
    expect(Number(price)).toBe(3.02);
  });

  it("returns zero for zero sachets", () => {
    const price = calculateCustomOrderPrice(0, 3);
    expect(Number(price)).toBe(0);
  });

  it("handles decimal sachet counts", () => {
    const price = calculateCustomOrderPrice(4.5, 2);
    expect(Number(price)).toBe(9);
  });
});
