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
import { getProductionOverview } from "@/modules/production/server/production.service";
import { createProductionRunAction } from "@/app/(app)/production/actions";

type ProductionPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductionPage({ searchParams }: ProductionPageProps) {
  await requireUser("production:view");
  const { runs, boms, locations } = await getProductionOverview();

  const params = (await searchParams) ?? {};
  const error = getQueryValue(params.error);
  const created = getQueryValue(params.created) === "1";

  const sellableLocation = locations.find((l) => l.code === "SELLABLE") ?? locations[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Production</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Manufacturing runs and batch costing</h1>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {created ? <Notice variant="success">Production run recorded. Output lot and inventory balance created.</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Record production run</CardTitle>
            <CardDescription>Creates a run, deducts raw material stock, and adds a finished goods lot.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProductionRunAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bomId">Bill of materials</Label>
                  <select
                    id="bomId"
                    name="bomId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {boms.map((bom) => (
                      <option key={bom.id} value={bom.id}>
                        {bom.productVariant.sku} — {bom.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputLocationId">Output location</Label>
                  <select
                    id="outputLocationId"
                    name="outputLocationId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={sellableLocation?.id}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Batch number</Label>
                  <Input id="batchNumber" name="batchNumber" placeholder="BATCH-CHOC-2026-04" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outputLotCode">Output lot code</Label>
                  <Input id="outputLotCode" name="outputLotCode" placeholder="LOT-CHOC-APR-01" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="actualQuantity">Output quantity</Label>
                  <Input id="actualQuantity" name="actualQuantity" type="number" min={0.01} step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="runDate">Run date</Label>
                  <Input id="runDate" name="runDate" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Factory batch notes or QC context" />
              </div>
              <Button type="submit" className="w-fit">Record run</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production runs</CardTitle>
            <CardDescription>Factory outputs with BOM linkage, batch numbers, and release state.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                No production runs recorded yet.
              </p>
            ) : (
              <TableWrapper>
                <Table>
                  <TableHead>
                    <tr>
                      <Th>Run</Th>
                      <Th>SKU</Th>
                      <Th>Batch</Th>
                      <Th>Date</Th>
                      <Th>Output</Th>
                      <Th>Unit cost</Th>
                      <Th>QC</Th>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <Td>{run.code}</Td>
                        <Td>{run.bom.productVariant.sku}</Td>
                        <Td>{run.batchNumber}</Td>
                        <Td>{formatShortDate(run.runDate)}</Td>
                        <Td>{Number(run.actualQuantity).toFixed(2)}</Td>
                        <Td>{formatMoney(Number(run.outputs[0]?.unitCost ?? 0))}</Td>
                        <Td>
                          <Badge variant={run.qcStatus === "RELEASED" ? "success" : "warning"}>
                            {run.qcStatus}
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
  );
}
