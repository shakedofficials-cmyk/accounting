import { AlertTriangle, DollarSign, Factory, Package2, TrendingUp } from "lucide-react";

import { DashboardSalesChart } from "@/components/charts/dashboard-sales-chart";
import { FlavorMixChart } from "@/components/charts/flavor-mix-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { getDashboardData } from "@/modules/dashboard/server/queries";

const statCards = [
  { key: "salesToday", label: "Sales Today", icon: DollarSign },
  { key: "salesMtd", label: "Sales MTD", icon: TrendingUp },
  { key: "stockValue", label: "Stock Value", icon: Package2 },
  { key: "factoryShareAccrued", label: "Factory Share Accrued", icon: Factory },
] as const;

export default async function DashboardPage() {
  await requireUser("dashboard:view");
  const { metrics, lowStockAlerts, upcomingExpiries, recentActivity, unresolvedIssues, salesSeries, flavorSeries } =
    await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Operator overview</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Today’s commercial pulse, inventory pressure, and partner-sharing signals in one place.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-3 font-display text-3xl font-semibold">
                  {formatMoney(metrics[key])}
                </p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>14-day sales trend</CardTitle>
            <CardDescription>Subtotal revenue captured across manual and Shopify orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardSalesChart data={salesSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flavor mix</CardTitle>
            <CardDescription>Units sold by flavor from recorded order composition.</CardDescription>
          </CardHeader>
          <CardContent>
            <FlavorMixChart data={flavorSeries} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="success">Top flavor: {metrics.topFlavor}</Badge>
              <Badge>Top product: {metrics.topProductType}</Badge>
              <Badge>Units sold: {metrics.unitsSold}</Badge>
              <Badge>AOV: {formatMoney(metrics.averageOrderValue)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
            <CardDescription>Threshold-based alerts from current on-hand balances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No low stock alerts right now.</p>
            ) : (
              lowStockAlerts.map((item) => (
                <div key={item.variantId} className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{item.name}</p>
                    <Badge variant="warning">Needs replenishment</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    On hand {Number(item.onHand).toFixed(2)} vs threshold {Number(item.threshold).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming expiries</CardTitle>
            <CardDescription>Released lots nearing expiry so we can pull them forward.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingExpiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lots are approaching expiry.</p>
            ) : (
              upcomingExpiries.map((item) => (
                <div key={item.lotId} className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.lotId}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <Badge variant={item.status === "EXPIRED" ? "danger" : "warning"}>{item.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Unresolved issues</CardTitle>
            <CardDescription>Short operational queue requiring finance or ops attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unresolvedIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unresolved issues in the current dataset.</p>
            ) : (
              unresolvedIssues.map((issue) => (
                <div key={issue} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <p className="text-sm">{issue}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>High-signal operational and finance events from the audit log.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>Timestamp</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {recentActivity.map((event) => (
                    <tr key={event.id}>
                      <Td>{event.action}</Td>
                      <Td>{event.entityType}</Td>
                      <Td>{formatDateTime(event.createdAt)}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Snapshot highlights</CardTitle>
            <CardDescription>Fast context for the current month and partner bridge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["Gross profit estimate", formatMoney(metrics.grossProfitEstimate)],
              ["Net profit estimate", formatMoney(metrics.netProfitEstimate)],
              ["Top flavor", metrics.topFlavor],
              ["Top product type", metrics.topProductType],
              ["Upcoming stock rotation", `${upcomingExpiries.length} lots`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
