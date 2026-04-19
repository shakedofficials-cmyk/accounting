import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, formatShortDate } from "@/lib/utils";
import { getProductionOverview } from "@/modules/production/server/production.service";

export default async function ProductionPage() {
  await requireUser("production:view");
  const { runs } = await getProductionOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Production</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Manufacturing receipts and batch costing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production runs</CardTitle>
          <CardDescription>Factory outputs with BOM linkage, batch numbers, and release state.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHead>
                <tr>
                  <Th>Run</Th>
                  <Th>SKU</Th>
                  <Th>Batch</Th>
                  <Th>Run date</Th>
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
                      <Badge variant={run.qcStatus === "RELEASED" ? "success" : "warning"}>{run.qcStatus}</Badge>
                    </Td>
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
