import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate, getQueryValue } from "@/lib/utils";
import { createOpeningInventoryLotAction } from "@/app/(app)/inventory/actions";
import { getInventoryOverview } from "@/modules/inventory/server/inventory.service";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requireUser("inventory:view");

  const params = (await searchParams) ?? {};
  const { balances, locations, trackedVariants, lowStockAlerts, upcomingExpiries } =
    await getInventoryOverview();

  const error = getQueryValue(params.error);
  const lotCreated = getQueryValue(params.lotCreated) === "1";
  const defaultSellableLocation =
    locations.find((location) => location.code === "SELLABLE")?.id ?? locations[0]?.id;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Inventory</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Lots, locations, and sellable stock
        </h1>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {lotCreated ? (
        <Notice variant="success">
          Opening inventory was loaded with stock movement, valuation, and audit trail.
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Load opening inventory</CardTitle>
            <CardDescription>
              Replace fake stock with real lots. Each entry creates a lot, on-hand balance, posted
              movement, and opening-balance journal entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createOpeningInventoryLotAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="productVariantId">SKU</Label>
                  <select
                    id="productVariantId"
                    name="productVariantId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={trackedVariants[0]?.id}
                  >
                    {trackedVariants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.sku} - {variant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationId">Location</Label>
                  <select
                    id="locationId"
                    name="locationId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={defaultSellableLocation}
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="lotCode">Lot code</Label>
                  <Input id="lotCode" name="lotCode" placeholder="LOT-CHOC-2026-04-A" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" name="quantity" type="number" min={0.01} step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitCost">Unit cost</Label>
                  <Input id="unitCost" name="unitCost" type="number" min={0.0001} step="0.0001" required />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="qcStatus">QC status</Label>
                  <select
                    id="qcStatus"
                    name="qcStatus"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="RELEASED"
                  >
                    <option value="RELEASED">Released</option>
                    <option value="HOLD">Hold</option>
                    <option value="QUARANTINED">Quarantined</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receivedAt">Received date</Label>
                  <Input id="receivedAt" name="receivedAt" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufactureDate">Manufacture date</Label>
                  <Input id="manufactureDate" name="manufactureDate" type="date" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry date</Label>
                  <Input id="expiryDate" name="expiryDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Factory handover context, QC notes, or import reference."
                  />
                </div>
              </div>

              <Button type="submit">Load inventory lot</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
              <CardDescription>Threshold breaches across tracked variants.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockAlerts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                  No low-stock alerts yet. Once you load real inventory, this list will light up
                  automatically.
                </p>
              ) : (
                lowStockAlerts.map((item) => (
                  <div
                    key={item.variantId}
                    className="rounded-xl border border-border/70 bg-background/70 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="warning">Alert</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      On hand {Number(item.onHand).toFixed(2)} against threshold{" "}
                      {Number(item.threshold).toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expiry watch</CardTitle>
              <CardDescription>Released lots coming due within 60 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingExpiries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                  No upcoming expiries yet.
                </p>
              ) : (
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
                            <Badge
                              variant={item.status === "EXPIRED" ? "danger" : "warning"}
                            >
                              {item.status}
                            </Badge>
                          </Td>
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

      <Card>
        <CardHeader>
          <CardTitle>Stock ledger</CardTitle>
          <CardDescription>Current lot balances across internal locations.</CardDescription>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
              No inventory has been loaded yet. Use the opening inventory form above to enter your
              real lots and on-hand stock.
            </p>
          ) : (
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
                      <Td>
                        {formatMoney(
                          balance.quantity.toNumber() * balance.lot.costPerUnit.toNumber(),
                        )}
                      </Td>
                      <Td>
                        {balance.lot.expiryDate
                          ? formatShortDate(balance.lot.expiryDate)
                          : "N/A"}
                      </Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
