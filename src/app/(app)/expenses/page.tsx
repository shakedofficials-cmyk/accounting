import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate } from "@/lib/utils";
import { getExpenseOverview } from "@/modules/expenses/server/expenses.service";

export default async function ExpensesPage() {
  await requireUser("expenses:view");
  const { vendorBills, categories } = await getExpenseOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Expenses</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Vendor bills and expense categories</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Vendor bills</CardTitle>
            <CardDescription>Posted and pending bills with payment exposure.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Bill</Th>
                    <Th>Vendor</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                    <Th>Issue date</Th>
                    <Th>Total</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {vendorBills.map((bill) => (
                    <tr key={bill.id}>
                      <Td>{bill.billNumber}</Td>
                      <Td>{bill.vendor.name}</Td>
                      <Td>{bill.expenseCategory.name}</Td>
                      <Td><Badge>{bill.status}</Badge></Td>
                      <Td>{formatShortDate(bill.issueDate)}</Td>
                      <Td>{formatMoney(bill.total.toNumber())}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense inclusion policy</CardTitle>
            <CardDescription>Which categories flow into partner-sharing calculations by default.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{category.name}</p>
                  <Badge variant={category.includedInSettlement ? "success" : "default"}>
                    {category.includedInSettlement ? "Included" : "Excluded"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{category.defaultAccount.name}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
