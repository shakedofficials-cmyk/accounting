import type { LedgerAccountType } from "@prisma/client";

import { money } from "@/lib/money";

type ProfitAndLossLine = {
  type: "REVENUE" | "CONTRA_REVENUE" | "COGS" | "EXPENSE";
  amount: number;
};

export function buildProfitAndLoss(lines: ProfitAndLossLine[]) {
  const revenue = lines
    .filter((line) => line.type === "REVENUE")
    .reduce((sum, line) => sum + line.amount, 0);
  const contraRevenue = lines
    .filter((line) => line.type === "CONTRA_REVENUE")
    .reduce((sum, line) => sum + line.amount, 0);
  const cogs = lines.filter((line) => line.type === "COGS").reduce((sum, line) => sum + line.amount, 0);
  const operatingExpenses = lines
    .filter((line) => line.type === "EXPENSE")
    .reduce((sum, line) => sum + line.amount, 0);

  const netSales = revenue - contraRevenue;
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit - operatingExpenses;

  return {
    revenue: money(revenue),
    contraRevenue: money(contraRevenue),
    netSales: money(netSales),
    cogs: money(cogs),
    grossProfit: money(grossProfit),
    operatingExpenses: money(operatingExpenses),
    netProfit: money(netProfit),
  };
}

export function calculateNaturalBalance(type: LedgerAccountType, debit: number, credit: number) {
  switch (type) {
    case "ASSET":
    case "CONTRA_REVENUE":
    case "COGS":
    case "EXPENSE":
      return debit - credit;
    case "LIABILITY":
    case "EQUITY":
    case "REVENUE":
      return credit - debit;
  }
}
