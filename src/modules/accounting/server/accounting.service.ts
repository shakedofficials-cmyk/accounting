import type { LedgerAccountType } from "@prisma/client";

import { db } from "@/lib/db";
import { buildProfitAndLoss, calculateNaturalBalance } from "@/modules/accounting/domain/statements";

export async function getAccountingOverview() {
  const journalLines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
      },
    },
    include: {
      account: true,
      journalEntry: true,
    },
    orderBy: [{ journalEntry: { entryDate: "desc" } }],
  });

  const balances = Object.values(
    journalLines.reduce<
      Record<
        string,
        {
          accountId: string;
          code: string;
          name: string;
          type: string;
          debit: number;
          credit: number;
        }
      >
    >((acc, line) => {
      const current = acc[line.accountId] ?? {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      acc[line.accountId] = current;
      return acc;
    }, {}),
  );

  const trialBalance = balances.map((line) => ({
    ...line,
    balance: calculateNaturalBalance(line.type as LedgerAccountType, line.debit, line.credit),
  }));

  const profitAndLoss = buildProfitAndLoss(
    trialBalance
      .filter((line) =>
        ["REVENUE", "CONTRA_REVENUE", "COGS", "EXPENSE"].includes(line.type),
      )
      .map((line) => ({
        type: line.type as "REVENUE" | "CONTRA_REVENUE" | "COGS" | "EXPENSE",
        amount: line.balance,
      })),
  );

  return {
    journalLines,
    trialBalance,
    profitAndLoss,
  };
}
