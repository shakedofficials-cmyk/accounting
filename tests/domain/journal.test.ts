import { describe, expect, it } from "vitest";

import { assertJournalBalanced, buildTrialBalance } from "@/modules/accounting/domain/journal";

describe("journal balancing", () => {
  it("accepts balanced entries", () => {
    const totals = assertJournalBalanced([
      { accountId: "cash", code: "1110", name: "Cash on Hand", type: "ASSET", debit: 100, credit: 0 },
      { accountId: "sales", code: "4100", name: "Shopify Sales", type: "REVENUE", debit: 0, credit: 100 },
    ]);

    expect(Number(totals.debit)).toBe(100);
    expect(Number(totals.credit)).toBe(100);
  });

  it("throws when debits exceed credits", () => {
    expect(() =>
      assertJournalBalanced([
        { accountId: "cash", code: "1110", name: "Cash", type: "ASSET", debit: 150, credit: 0 },
        { accountId: "sales", code: "4110", name: "Sales", type: "REVENUE", debit: 0, credit: 100 },
      ]),
    ).toThrow("Journal entry is not balanced.");
  });

  it("throws when credits exceed debits", () => {
    expect(() =>
      assertJournalBalanced([
        { accountId: "cash", code: "1110", name: "Cash", type: "ASSET", debit: 100, credit: 0 },
        { accountId: "sales", code: "4110", name: "Sales", type: "REVENUE", debit: 0, credit: 150 },
      ]),
    ).toThrow("Journal entry is not balanced.");
  });

  it("accepts a balanced multi-line entry with decimal amounts", () => {
    const totals = assertJournalBalanced([
      { accountId: "ar", code: "1150", name: "Accounts Receivable", type: "ASSET", debit: 113.00, credit: 0 },
      { accountId: "sales", code: "4110", name: "Product Sales", type: "REVENUE", debit: 0, credit: 100.00 },
      { accountId: "vat", code: "2120", name: "VAT Payable", type: "LIABILITY", debit: 0, credit: 13.00 },
    ]);

    expect(Number(totals.debit)).toBe(113);
    expect(Number(totals.credit)).toBe(113);
  });

  it("accepts a balanced COGS entry", () => {
    const totals = assertJournalBalanced([
      { accountId: "cogs", code: "5100", name: "Cost of Goods Sold", type: "COGS", debit: 75, credit: 0 },
      { accountId: "inventory", code: "1230", name: "Finished Goods Inventory", type: "ASSET", debit: 0, credit: 75 },
    ]);

    expect(Number(totals.debit)).toBe(75);
    expect(Number(totals.credit)).toBe(75);
  });

  it("returns zero totals for an empty line array", () => {
    const totals = assertJournalBalanced([]);
    expect(Number(totals.debit)).toBe(0);
    expect(Number(totals.credit)).toBe(0);
  });
});

describe("trial balance", () => {
  it("builds a single-account trial balance with net debit balance", () => {
    const result = buildTrialBalance([
      { accountId: "cash", code: "1110", name: "Cash", type: "ASSET", debit: 500, credit: 0 },
      { accountId: "cash", code: "1110", name: "Cash", type: "ASSET", debit: 0, credit: 200 },
    ]);

    expect(result).toHaveLength(1);
    expect(Number(result[0]!.debit)).toBe(300);
    expect(Number(result[0]!.credit)).toBe(0);
  });

  it("builds a multi-account trial balance", () => {
    const result = buildTrialBalance([
      { accountId: "cash", code: "1110", name: "Cash", type: "ASSET", debit: 1000, credit: 0 },
      { accountId: "sales", code: "4110", name: "Sales", type: "REVENUE", debit: 0, credit: 800 },
      { accountId: "vat", code: "2120", name: "VAT Payable", type: "LIABILITY", debit: 0, credit: 200 },
    ]);

    expect(result).toHaveLength(3);
    const cash = result.find((r) => r.accountId === "cash")!;
    const sales = result.find((r) => r.accountId === "sales")!;
    const vat = result.find((r) => r.accountId === "vat")!;

    expect(Number(cash.debit)).toBe(1000);
    expect(Number(cash.credit)).toBe(0);
    expect(Number(sales.debit)).toBe(0);
    expect(Number(sales.credit)).toBe(800);
    expect(Number(vat.debit)).toBe(0);
    expect(Number(vat.credit)).toBe(200);
  });

  it("nets opposing entries on the same account", () => {
    const result = buildTrialBalance([
      { accountId: "ar", code: "1150", name: "AR", type: "ASSET", debit: 500, credit: 0 },
      { accountId: "ar", code: "1150", name: "AR", type: "ASSET", debit: 0, credit: 500 },
    ]);

    expect(result).toHaveLength(1);
    expect(Number(result[0]!.debit)).toBe(0);
    expect(Number(result[0]!.credit)).toBe(0);
  });

  it("places negative net balance on the credit side", () => {
    // A liability with more credits than debits — net credit balance
    const result = buildTrialBalance([
      { accountId: "vat", code: "2120", name: "VAT Payable", type: "LIABILITY", debit: 0, credit: 300 },
      { accountId: "vat", code: "2120", name: "VAT Payable", type: "LIABILITY", debit: 50, credit: 0 },
    ]);

    expect(result).toHaveLength(1);
    expect(Number(result[0]!.debit)).toBe(0);
    expect(Number(result[0]!.credit)).toBe(250);
  });
});
