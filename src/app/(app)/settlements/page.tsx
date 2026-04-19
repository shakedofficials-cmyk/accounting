import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, getQueryValue } from "@/lib/utils";
import { getSettlementOverview } from "@/modules/settlements/server/settlements.service";
import { rerunSettlementAction } from "@/app/(app)/settlements/actions";

type SettlementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettlementsPage({ searchParams }: SettlementsPageProps) {
  await requireUser("settlements:view");
  const params = (await searchParams) ?? {};
  const { periods, activeConfig, categories } = await getSettlementOverview();
  const rerun = getQueryValue(params.rerun) === "1";
  const error = getQueryValue(params.error);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Settlements</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Factory profit share engine</h1>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {rerun ? <Notice variant="success">Settlement rerun created a new immutable version.</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active config</CardTitle>
            <CardDescription>Current inclusion policy for net profit sharing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">Factory share</p>
              <p className="mt-2 text-2xl font-semibold">{Number(activeConfig?.partnerSharePercent ?? 0) * 100}%</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-sm text-muted-foreground">Included categories</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories
                  .filter((category) => (activeConfig?.includedExpenseCategoryIds as string[]).includes(category.id))
                  .map((category) => (
                    <span key={category.id} className="rounded-full border border-border px-3 py-1 text-sm">
                      {category.name}
                    </span>
                  ))}
              </div>
            </div>
            <form action={rerunSettlementAction} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="font-medium">Rerun monthly settlement</p>
              <p className="mt-2 text-sm text-muted-foreground">Creates a new immutable version from posted ledger data.</p>
              <div className="mt-4 flex gap-3">
                <input
                  name="periodKey"
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit">Rerun</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Settlement history</CardTitle>
            <CardDescription>Immutable runs with versioned bridge metrics.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Version</Th>
                    <Th>Net sales</Th>
                    <Th>Net profit</Th>
                    <Th>Factory share</Th>
                    <Th>Origins share</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <Td>{period.periodKey}</Td>
                      <Td>v{period.version}</Td>
                      <Td>{formatMoney(period.netSales.toNumber())}</Td>
                      <Td>{formatMoney(period.netProfit.toNumber())}</Td>
                      <Td>{formatMoney(period.factoryShare.toNumber())}</Td>
                      <Td>{formatMoney(period.originsShare.toNumber())}</Td>
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
