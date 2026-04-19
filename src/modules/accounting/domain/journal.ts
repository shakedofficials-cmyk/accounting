import { money } from "@/lib/money";

export type JournalLineInput = {
  accountId: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "CONTRA_REVENUE" | "COGS" | "EXPENSE";
  debit: number;
  credit: number;
};

export function assertJournalBalanced(lines: JournalLineInput[]) {
  const totals = lines.reduce(
    (acc, line) => ({
      debit: acc.debit + line.debit,
      credit: acc.credit + line.credit,
    }),
    { debit: 0, credit: 0 },
  );

  if (!money(totals.debit).eq(money(totals.credit))) {
    throw new Error("Journal entry is not balanced.");
  }

  return {
    debit: money(totals.debit),
    credit: money(totals.credit),
  };
}

export function buildTrialBalance(lines: JournalLineInput[]) {
  const grouped = new Map<string, JournalLineInput & { balance: number }>();

  for (const line of lines) {
    const existing = grouped.get(line.accountId);
    const balance = (existing?.balance ?? 0) + line.debit - line.credit;
    grouped.set(line.accountId, {
      ...line,
      balance,
    });
  }

  return Array.from(grouped.values()).map((line) => ({
    accountId: line.accountId,
    code: line.code,
    name: line.name,
    type: line.type,
    debit: line.balance > 0 ? money(line.balance) : money(0),
    credit: line.balance < 0 ? money(Math.abs(line.balance)) : money(0),
  }));
}
