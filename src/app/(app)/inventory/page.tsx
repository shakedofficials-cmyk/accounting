import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate } from "@/lib/utils";
import { getInventoryOverview } from "@/modules/inventory/server/inventory.service";

export default async function InventoryPage() {
  await requireUser("inventory:view");
  const { balances, lowStockAlerts, upcomingExpiries } = await getInventoryOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Inventory</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Lots, locations, and sellable stock</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
            <CardDescription>Threshold breaches across tracked variants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockAlerts.map((item) => (
              <div key={item.variantId} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="warning">Alert</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  On hand {Number(item.onHand).toFixed(2)} against threshold {Number(item.threshold).toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Expiry watch</CardTitle>
            <CardDescription>Released lots coming due within 60 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Lot</Th>
                    <Th>SKU</Th>
                    <Th>Status</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {upcomingExpiries.map((item) => (
                    <tr key={item.lotId}>
                      <Td>{item.lotId}</Td>
                      <Td>{item.sku}</Td>
                      <Td>
                        <Badge variant={item.status === "EXPIRED" ? "danger" : "warning"}>{item.status}</Badge>
                      </Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock ledger</CardTitle>
          <CardDescription>Current lot balances across internal locations.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Lot</Th>
                  <Th>Location</Th>
                  <Th>Quantity</Th>
                  <Th>Unit cost</Th>
                  <Th>Stock value</Th>
                  <Th>Expiry</Th>
                </tr>
              </TableHead>
              <TableBody>
                {balances.map((balance) => (
                  <tr key={balance.id}>
                    <Td>{balance.lot.productVariant.sku}</Td>
                    <Td>{balance.lot.lotCode}</Td>
                    <Td>{balance.location.name}</Td>
                    <Td>{Number(balance.quantity).toFixed(2)}</Td>
                    <Td>{formatMoney(balance.lot.costPerUnit.toNumber())}</Td>
                    <Td>{formatMoney(balance.quantity.toNumber() * balance.lot.costPerUnit.toNumber())}</Td>
                    <Td>{balance.lot.expiryDate ? formatShortDate(balance.lot.expiryDate) : "N/A"}</Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </div>
  );
}
