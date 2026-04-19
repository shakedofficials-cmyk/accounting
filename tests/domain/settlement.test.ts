import { describe, expect, it } from "vitest";

import { calculateSettlement, nextSettlementVersion } from "@/modules/settlements/domain/settlement-engine";

describe("settlement engine", () => {
  it("calculates partner profit sharing", () => {
    const result = calculateSettlement({
      revenue: 1000,
      discounts: 50,
      refunds: 0,
      cogs: 250,
      deliveryCosts: 40,
      paymentFees: 10,
      includedOpex: 100,
      factorySharePercent: 0.6,
    });

    expect(Number(result.netProfit)).toBe(550);
    expect(Number(result.factoryShare)).toBe(330);
    expect(Number(result.originsShare)).toBe(220);
  });

  it("applies positive adjustments to net profit", () => {
    const result = calculateSettlement({
      revenue: 1000,
      discounts: 0,
      refunds: 0,
      cogs: 600,
      deliveryCosts: 0,
      paymentFees: 0,
      includedOpex: 0,
      adjustments: 50,
      factorySharePercent: 0.5,
    });

    // netProfit = 1000 - 600 + 50 = 450
    expect(Number(result.netProfit)).toBe(450);
    expect(Number(result.factoryShare)).toBe(225);
    expect(Number(result.originsShare)).toBe(225);
  });

  it("applies negative adjustments (deductions) to net profit", () => {
    const result = calculateSettlement({
      revenue: 1000,
      discounts: 0,
      refunds: 0,
      cogs: 600,
      deliveryCosts: 0,
      paymentFees: 0,
      includedOpex: 0,
      adjustments: -100,
      factorySharePercent: 0.5,
    });

    // netProfit = 1000 - 600 - 100 = 300
    expect(Number(result.netProfit)).toBe(300);
  });

  it("handles a loss scenario (negative net profit)", () => {
    const result = calculateSettlement({
      revenue: 500,
      discounts: 0,
      refunds: 0,
      cogs: 600,
      deliveryCosts: 50,
      paymentFees: 0,
      includedOpex: 0,
      factorySharePercent: 0.6,
    });

    // netProfit = 500 - 600 - 50 = -150
    expect(Number(result.netProfit)).toBe(-150);
    expect(Number(result.factoryShare)).toBe(-90);
    expect(Number(result.originsShare)).toBe(-60);
  });

  it("calculates correctly with 100% factory share", () => {
    const result = calculateSettlement({
      revenue: 1000,
      discounts: 0,
      refunds: 0,
      cogs: 400,
      deliveryCosts: 0,
      paymentFees: 0,
      includedOpex: 0,
      factorySharePercent: 1.0,
    });

    expect(Number(result.factoryShare)).toBe(600);
    expect(Number(result.originsShare)).toBe(0);
  });

  it("calculates net sales correctly deducting discounts and refunds", () => {
    const result = calculateSettlement({
      revenue: 2000,
      discounts: 200,
      refunds: 100,
      cogs: 0,
      deliveryCosts: 0,
      paymentFees: 0,
      includedOpex: 0,
      factorySharePercent: 0.6,
    });

    expect(Number(result.netSales)).toBe(1700);
  });

  it("handles zero revenue", () => {
    const result = calculateSettlement({
      revenue: 0,
      discounts: 0,
      refunds: 0,
      cogs: 0,
      deliveryCosts: 0,
      paymentFees: 0,
      includedOpex: 0,
      factorySharePercent: 0.6,
    });

    expect(Number(result.netProfit)).toBe(0);
    expect(Number(result.factoryShare)).toBe(0);
    expect(Number(result.originsShare)).toBe(0);
  });

  it("increments rerun versions immutably", () => {
    expect(nextSettlementVersion([1, 2, 3])).toBe(4);
  });

  it("starts at version 1 when no prior versions exist", () => {
    expect(nextSettlementVersion([])).toBe(1);
  });

  it("handles non-sequential existing versions by taking the max", () => {
    expect(nextSettlementVersion([1, 5, 3])).toBe(6);
  });
});
