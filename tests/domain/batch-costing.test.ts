import { describe, expect, it } from "vitest";

import { calculateBatchCost } from "@/modules/production/domain/batch-costing";

describe("batch costing", () => {
  it("calculates total and unit cost from production inputs", () => {
    const result = calculateBatchCost(
      [
        { description: "Protein base", quantity: 5, unitCost: 20 },
        { description: "Packaging", quantity: 100, unitCost: 0.1 },
      ],
      100,
    );

    expect(Number(result.totalCost)).toBe(110);
    expect(Number(result.unitCost)).toBe(1.1);
  });

  it("throws when actual output quantity is zero", () => {
    expect(() =>
      calculateBatchCost([{ description: "Protein base", quantity: 10, unitCost: 5 }], 0),
    ).toThrow("Actual production quantity must be greater than zero.");
  });

  it("throws when actual output quantity is negative", () => {
    expect(() =>
      calculateBatchCost([{ description: "Protein base", quantity: 10, unitCost: 5 }], -1),
    ).toThrow("Actual production quantity must be greater than zero.");
  });

  it("returns zero cost when there are no consumption lines", () => {
    const result = calculateBatchCost([], 100);

    expect(Number(result.totalCost)).toBe(0);
    expect(Number(result.unitCost)).toBe(0);
  });

  it("handles a single consumption line", () => {
    const result = calculateBatchCost(
      [{ description: "Sachet pouches", quantity: 200, unitCost: 0.05 }],
      200,
    );

    expect(Number(result.totalCost)).toBe(10);
    expect(Number(result.unitCost)).toBe(0.05);
  });

  it("rounds unit cost to 2 decimal places", () => {
    // Total: 10, Output: 3 => 3.3333... rounds to 3.33
    const result = calculateBatchCost(
      [{ description: "Raw material", quantity: 1, unitCost: 10 }],
      3,
    );

    expect(Number(result.unitCost)).toBe(3.33);
  });

  it("handles decimal quantities and costs", () => {
    const result = calculateBatchCost(
      [{ description: "Flavoring", quantity: 2.5, unitCost: 4.0 }],
      50,
    );

    // Total: 10, Unit: 0.20
    expect(Number(result.totalCost)).toBe(10);
    expect(Number(result.unitCost)).toBe(0.2);
  });
});
