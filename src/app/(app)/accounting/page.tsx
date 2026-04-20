import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate } from "@/lib/utils";
import { getAccountingOverview } from "@/modules/accounting/server/accounting.service";

export default async function AccountingPage() {
  await requireUser("accounting:view");
  const { trialBalance, profitAndLoss, journalLines } = await getAccountingOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Accounting</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Trial balance and P&amp;L</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          ["Revenue", formatMoney(Number(profitAndLoss.revenue))],
          ["Net sales", formatMoney(Number(profitAndLoss.netSales))],
          ["Gross profit", formatMoney(Number(profitAndLoss.grossProfit))],
          ["Net profit", formatMoney(Number(profitAndLoss.netProfit))],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Trial balance</CardTitle>
            <CardDescription>Natural balances by account from posted entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Account</Th>
                    <Th>Type</Th>
                    <Th>Balance</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {trialBalance.map((line) => (
                    <tr key={line.accountId}>
                      <Td>{line.code}</Td>
                      <Td>{line.name}</Td>
                      <Td><Badge>{line.type}</Badge></Td>
                      <Td>{formatMoney(line.balance)}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Posted journal feed</CardTitle>
            <CardDescription>Line-level ledger detail backing the financial statements.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Account</Th>
                    <Th>Debit</Th>
                    <Th>Credit</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {journalLines.slice(0, 20).map((line) => (
                    <tr key={line.id}>
                      <Td>{formatShortDate(line.journalEntry.entryDate)}</Td>
                      <Td>{line.account.name}</Td>
                      <Td>{formatMoney(line.debit.toNumber())}</Td>
                      <Td>{formatMoney(line.credit.toNumber())}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
