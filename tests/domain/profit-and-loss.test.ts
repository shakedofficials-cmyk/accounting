import { describe, expect, it } from "vitest";

import { buildProfitAndLoss, calculateNaturalBalance } from "@/modules/accounting/domain/statements";

describe("profit and loss", () => {
  it("builds a P&L summary from ledger balances", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 1000 },
      { type: "CONTRA_REVENUE", amount: 50 },
      { type: "COGS", amount: 300 },
      { type: "EXPENSE", amount: 200 },
    ]);

    expect(Number(statement.netSales)).toBe(950);
    expect(Number(statement.grossProfit)).toBe(650);
    expect(Number(statement.netProfit)).toBe(450);
  });

  it("treats contra revenue as a debit-natural balance", () => {
    expect(calculateNaturalBalance("CONTRA_REVENUE", 50, 0)).toBe(50);
    expect(calculateNaturalBalance("CONTRA_REVENUE", 0, 50)).toBe(-50);
  });

  it("returns zero for all fields when input is empty", () => {
    const statement = buildProfitAndLoss([]);

    expect(Number(statement.revenue)).toBe(0);
    expect(Number(statement.netSales)).toBe(0);
    expect(Number(statement.grossProfit)).toBe(0);
    expect(Number(statement.netProfit)).toBe(0);
  });

  it("handles a loss scenario (expenses exceed gross profit)", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 500 },
      { type: "COGS", amount: 300 },
      { type: "EXPENSE", amount: 400 },
    ]);

    expect(Number(statement.grossProfit)).toBe(200);
    expect(Number(statement.netProfit)).toBe(-200);
  });

  it("handles a negative gross profit (COGS exceeds net sales)", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 300 },
      { type: "COGS", amount: 500 },
    ]);

    expect(Number(statement.grossProfit)).toBe(-200);
    expect(Number(statement.netProfit)).toBe(-200);
  });

  it("sums multiple lines of the same type", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 600 },
      { type: "REVENUE", amount: 400 },
      { type: "COGS", amount: 200 },
      { type: "COGS", amount: 300 },
    ]);

    expect(Number(statement.revenue)).toBe(1000);
    expect(Number(statement.cogs)).toBe(500);
    expect(Number(statement.grossProfit)).toBe(500);
  });

  it("deducts contra revenue (discounts/refunds) from revenue to get net sales", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 1000 },
      { type: "CONTRA_REVENUE", amount: 150 },
    ]);

    expect(Number(statement.revenue)).toBe(1000);
    expect(Number(statement.contraRevenue)).toBe(150);
    expect(Number(statement.netSales)).toBe(850);
  });

  it("correctly isolates operatingExpenses from cogs", () => {
    const statement = buildProfitAndLoss([
      { type: "REVENUE", amount: 1000 },
      { type: "COGS", amount: 400 },
      { type: "EXPENSE", amount: 100 },
      { type: "EXPENSE", amount: 50 },
    ]);

    expect(Number(statement.cogs)).toBe(400);
    expect(Number(statement.operatingExpenses)).toBe(150);
    expect(Number(statement.grossProfit)).toBe(600);
    expect(Number(statement.netProfit)).toBe(450);
  });
});

describe("calculateNaturalBalance", () => {
  it("ASSET: debit-normal (debit increases balance)", () => {
    expect(calculateNaturalBalance("ASSET", 200, 50)).toBe(150);
  });

  it("LIABILITY: credit-normal (credit increases balance)", () => {
    expect(calculateNaturalBalance("LIABILITY", 50, 200)).toBe(150);
  });

  it("EQUITY: credit-normal", () => {
    expect(calculateNaturalBalance("EQUITY", 0, 500)).toBe(500);
  });

  it("REVENUE: credit-normal", () => {
    expect(calculateNaturalBalance("REVENUE", 0, 1000)).toBe(1000);
  });

  it("CONTRA_REVENUE: debit-normal", () => {
    expect(calculateNaturalBalance("CONTRA_REVENUE", 50, 0)).toBe(50);
  });

  it("COGS: debit-normal", () => {
    expect(calculateNaturalBalance("COGS", 300, 0)).toBe(300);
  });

  it("EXPENSE: debit-normal", () => {
    expect(calculateNaturalBalance("EXPENSE", 100, 0)).toBe(100);
  });

  it("returns zero when debits and credits are equal for debit-normal accounts", () => {
    expect(calculateNaturalBalance("ASSET", 100, 100)).toBe(0);
    expect(calculateNaturalBalance("EXPENSE", 75, 75)).toBe(0);
  });

  it("returns zero when debits and credits are equal for credit-normal accounts", () => {
    expect(calculateNaturalBalance("LIABILITY", 100, 100)).toBe(0);
    expect(calculateNaturalBalance("REVENUE", 200, 200)).toBe(0);
  });
});
