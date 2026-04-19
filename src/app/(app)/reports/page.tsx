import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney, formatNumber, formatShortDate } from "@/lib/utils";
import {
  getExpiryReport,
  getInventoryMovementLedgerReport,
  getProfitAndLossReport,
  getSalesBySkuReport,
  getSettlementStatementsReport,
  getStockOnHandReport,
  getTrialBalanceReport,
} from "@/modules/reports/server/reports.service";

export default async function ReportsPage() {
  await requireUser("reports:view");

  const [salesBySku, stockOnHand, expiryReport, movementLedger, profitAndLoss, trialBalance, settlementStatements] =
    await Promise.all([
      getSalesBySkuReport(),
      getStockOnHandReport(),
      getExpiryReport(),
      getInventoryMovementLedgerReport(),
      getProfitAndLossReport(),
      getTrialBalanceReport(),
      getSettlementStatementsReport(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Reports</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Exports and reproducible snapshots</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every export is derived from posted journals, recorded orders, and append-only inventory state.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by SKU</CardTitle>
            <CardDescription>Exportable summary of recorded line sales by channel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/api/reports/sales-by-sku/csv" className={buttonVariants()}>
              Download CSV
            </Link>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Channel</Th>
                    <Th>Units</Th>
                    <Th>Revenue</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {salesBySku.slice(0, 8).map((row) => (
                    <tr key={`${row.sku}-${row.channel}`}>
                      <Td>{row.sku}</Td>
                      <Td>{row.channel}</Td>
                      <Td>{row.unitsSold.toFixed(2)}</Td>
                      <Td>{formatMoney(row.revenue)}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock on hand</CardTitle>
            <CardDescription>Location-aware inventory valuation export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/api/reports/stock-on-hand/csv" className={buttonVariants()}>
              Download CSV
            </Link>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Lot</Th>
                    <Th>Location</Th>
                    <Th>Quantity</Th>
                    <Th>Value</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {stockOnHand.slice(0, 8).map((row) => (
                    <tr key={`${row.lotCode}-${row.location}`}>
                      <Td>{row.sku}</Td>
                      <Td>{row.lotCode}</Td>
                      <Td>{row.location}</Td>
                      <Td>{row.quantity.toFixed(2)}</Td>
                      <Td>{formatMoney(row.stockValue)}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiry watch</CardTitle>
            <CardDescription>Upcoming and expired lots with sellable quantity still on hand.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/api/reports/expiry-report/csv" className={buttonVariants()}>
              Download CSV
            </Link>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Lot</Th>
                    <Th>Expiry</Th>
                    <Th>Days</Th>
                    <Th>Status</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {expiryReport.slice(0, 8).map((row) => (
                    <tr key={`${row.lotCode}-${row.location}`}>
                      <Td>{row.sku}</Td>
                      <Td>{row.lotCode}</Td>
                      <Td>{row.expiryDate}</Td>
                      <Td>{formatNumber(row.daysToExpiry)}</Td>
                      <Td>{row.status}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory movement ledger</CardTitle>
            <CardDescription>Recent stock movements with quantity, lot, and reference traceability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/api/reports/inventory-movement-ledger/csv" className={buttonVariants()}>
              Download CSV
            </Link>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>SKU</Th>
                    <Th>Quantity</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {movementLedger.slice(0, 8).map((row) => (
                    <tr key={`${row.movementDate}-${row.referenceId}-${row.sku}`}>
                      <Td>{formatDateTime(row.movementDate)}</Td>
                      <Td>{row.movementType}</Td>
                      <Td>{row.sku}</Td>
                      <Td>{formatNumber(row.quantity)}</Td>
                      <Td>{row.fromLocation || "-"}</Td>
                      <Td>{row.toLocation || "-"}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finance exports</CardTitle>
            <CardDescription>Download P&amp;L and trial balance directly from posted ledger lines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Link href="/api/reports/profit-and-loss/csv" className={buttonVariants()}>
                P&amp;L CSV
              </Link>
              <Link href="/api/reports/trial-balance/csv" className={buttonVariants({ variant: "outline" })}>
                Trial balance CSV
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {profitAndLoss.map((row) => (
                <div key={row.section} className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <p className="text-sm text-muted-foreground">{row.section}</p>
                  <p className="mt-2 text-lg font-semibold">{formatMoney(row.amount)}</p>
                </div>
              ))}
            </div>
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
                  {trialBalance.slice(0, 8).map((row) => (
                    <tr key={row.accountId}>
                      <Td>{row.code}</Td>
                      <Td>{row.name}</Td>
                      <Td>{row.type}</Td>
                      <Td>{formatMoney(row.balance)}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settlement statements</CardTitle>
            <CardDescription>Versioned factory-share runs generated from ledger-backed profitability bridges.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/api/reports/settlement-statements/csv" className={buttonVariants()}>
              Download CSV
            </Link>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Version</Th>
                    <Th>Created</Th>
                    <Th>Net sales</Th>
                    <Th>Net profit</Th>
                    <Th>Factory share</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {settlementStatements.slice(0, 8).map((row) => (
                    <tr key={`${row.periodKey}-${row.version}`}>
                      <Td>{row.periodKey}</Td>
                      <Td>v{row.version}</Td>
                      <Td>{formatShortDate(row.createdAt)}</Td>
                      <Td>{formatMoney(row.netSales)}</Td>
                      <Td>{formatMoney(row.netProfit)}</Td>
                      <Td>{formatMoney(row.factoryShare)}</Td>
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
