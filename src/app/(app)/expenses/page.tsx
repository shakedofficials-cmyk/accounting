import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate, getQueryValue } from "@/lib/utils";
import { getExpenseOverview } from "@/modules/expenses/server/expenses.service";
import { createExpenseAction } from "@/app/(app)/expenses/actions";

type ExpensesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requireUser("expenses:view");
  const { vendorBills, categories } = await getExpenseOverview();

  const params = (await searchParams) ?? {};
  const error = getQueryValue(params.error);
  const created = getQueryValue(params.created) === "1";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Expenses</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Vendor bills and expenses</h1>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {created ? <Notice variant="success">Expense recorded and journal entry posted.</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Record expense</CardTitle>
            <CardDescription>Creates a vendor bill and posts Dr expense / Cr accounts payable.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createExpenseAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vendorName">Vendor name</Label>
                  <Input id="vendorName" name="vendorName" placeholder="Supplier or service provider" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expenseCategoryId">Category</Label>
                  <select
                    id="expenseCategoryId"
                    name="expenseCategoryId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" placeholder="What was purchased" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue date</Label>
                  <Input id="issueDate" name="issueDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Optional reference or context" />
                </div>
              </div>
              <Button type="submit" className="w-fit">Record expense</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor bills</CardTitle>
            <CardDescription>Posted bills ordered by date.</CardDescription>
          </CardHeader>
          <CardContent>
            {vendorBills.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                No expenses recorded yet.
              </p>
            ) : (
              <TableWrapper>
                <Table>
                  <TableHead>
                    <tr>
                      <Th>Bill</Th>
                      <Th>Vendor</Th>
                      <Th>Category</Th>
                      <Th>Date</Th>
                      <Th>Total</Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {vendorBills.map((bill) => (
                      <tr key={bill.id}>
                        <Td>{bill.billNumber}</Td>
                        <Td>{bill.vendor.name}</Td>
                        <Td>{bill.expenseCategory.name}</Td>
                        <Td>{formatShortDate(bill.issueDate)}</Td>
                        <Td>{formatMoney(bill.total.toNumber())}</Td>
                      </tr>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
