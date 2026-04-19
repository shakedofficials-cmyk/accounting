import { describe, expect, it } from "vitest";

import { decomposeBundle } from "@/modules/catalog/domain/bundles";

const DISCOVERY_LINES = [
  { componentVariantId: "sku-choc", flavorId: "flavor-choc", quantity: 1, isFlexible: false },
  { componentVariantId: "sku-straw", flavorId: "flavor-straw", quantity: 1, isFlexible: false },
  { componentVariantId: "sku-van", flavorId: "flavor-van", quantity: 1, isFlexible: false },
  { componentVariantId: "sku-coffee", flavorId: "flavor-coffee", quantity: 1, isFlexible: false },
];

describe("bundle decomposition", () => {
  it("decomposes the discovery pack into one sachet of each flavor", () => {
    const result = decomposeBundle(
      { bundleVariantId: "bundle-discovery", type: "DISCOVERY_PACK", allowFlavorMix: false, lines: DISCOVERY_LINES },
      1,
    );

    expect(result).toHaveLength(4);
    expect(result.map((line) => Number(line.quantity))).toEqual([1, 1, 1, 1]);
  });

  it("multiplies quantities correctly for 2 discovery packs", () => {
    const result = decomposeBundle(
      { bundleVariantId: "bundle-discovery", type: "DISCOVERY_PACK", allowFlavorMix: false, lines: DISCOVERY_LINES },
      2,
    );

    expect(result).toHaveLength(4);
    expect(result.map((line) => Number(line.quantity))).toEqual([2, 2, 2, 2]);
  });

  it("decomposes a training box with fixed quantities", () => {
    const result = decomposeBundle(
      {
        bundleVariantId: "bundle-training",
        type: "TRAINING_BOX",
        allowFlavorMix: false,
        lines: [
          { componentVariantId: "sku-choc", flavorId: "flavor-choc", quantity: 4, isFlexible: false },
          { componentVariantId: "sku-van", flavorId: "flavor-van", quantity: 4, isFlexible: false },
        ],
      },
      1,
    );

    expect(result).toHaveLength(2);
    expect(result.map((line) => Number(line.quantity))).toEqual([4, 4]);
  });

  it("scales training box quantities by bundle quantity", () => {
    const result = decomposeBundle(
      {
        bundleVariantId: "bundle-training",
        type: "TRAINING_BOX",
        allowFlavorMix: false,
        lines: [
          { componentVariantId: "sku-choc", flavorId: "flavor-choc", quantity: 4, isFlexible: false },
          { componentVariantId: "sku-van", flavorId: "flavor-van", quantity: 4, isFlexible: false },
        ],
      },
      3,
    );

    expect(result.map((line) => Number(line.quantity))).toEqual([12, 12]);
  });

  it("throws when bundle quantity is zero", () => {
    expect(() =>
      decomposeBundle(
        { bundleVariantId: "bundle-discovery", type: "DISCOVERY_PACK", allowFlavorMix: false, lines: DISCOVERY_LINES },
        0,
      ),
    ).toThrow("Bundle quantity must be positive.");
  });

  it("throws when bundle quantity is negative", () => {
    expect(() =>
      decomposeBundle(
        { bundleVariantId: "bundle-discovery", type: "DISCOVERY_PACK", allowFlavorMix: false, lines: DISCOVERY_LINES },
        -2,
      ),
    ).toThrow("Bundle quantity must be positive.");
  });

  it("preserves flavor IDs in decomposed lines", () => {
    const result = decomposeBundle(
      { bundleVariantId: "bundle-discovery", type: "DISCOVERY_PACK", allowFlavorMix: false, lines: DISCOVERY_LINES },
      1,
    );

    expect(result[0]?.flavorId).toBe("flavor-choc");
    expect(result[1]?.flavorId).toBe("flavor-straw");
  });
});

describe("custom sachet (flavor mix) decomposition", () => {
  const CUSTOM_SACHET_DEF = {
    bundleVariantId: "bundle-custom",
    type: "CUSTOM_SACHET" as const,
    allowFlavorMix: true,
    minimumUnits: 4,
    lines: [
      { componentVariantId: "sku-choc", flavorId: "flavor-choc", quantity: 1, isFlexible: true },
      { componentVariantId: "sku-van", flavorId: "flavor-van", quantity: 1, isFlexible: true },
      { componentVariantId: "sku-straw", flavorId: "flavor-straw", quantity: 1, isFlexible: true },
    ],
  };

  it("decomposes a custom mix when flavors are provided", () => {
    const result = decomposeBundle(
      CUSTOM_SACHET_DEF,
      1,
      [
        { flavorId: "flavor-choc", quantity: 2 },
        { flavorId: "flavor-van", quantity: 2 },
      ],
    );

    expect(result).toHaveLength(2);
    const choc = result.find((r) => r.componentVariantId === "sku-choc")!;
    const van = result.find((r) => r.componentVariantId === "sku-van")!;
    expect(Number(choc.quantity)).toBe(2);
    expect(Number(van.quantity)).toBe(2);
  });

  it("throws when custom sachet mix is empty", () => {
    expect(() =>
      decomposeBundle(CUSTOM_SACHET_DEF, 1, []),
    ).toThrow("Custom sachet orders require a flavor mix.");
  });

  it("throws when total sachets are below minimum", () => {
    expect(() =>
      decomposeBundle(
        CUSTOM_SACHET_DEF,
        1,
        [{ flavorId: "flavor-choc", quantity: 2 }], // 2 < minimum 4
      ),
    ).toThrow(/at least 4 sachets/);
  });

  it("throws when a requested flavor is not in the bundle definition", () => {
    expect(() =>
      decomposeBundle(
        CUSTOM_SACHET_DEF,
        1,
        [
          { flavorId: "flavor-choc", quantity: 2 },
          { flavorId: "flavor-unknown", quantity: 2 }, // not in bundle
        ],
      ),
    ).toThrow(/not allowed/);
  });
});
