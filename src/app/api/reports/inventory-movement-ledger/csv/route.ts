import { requireUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { getInventoryMovementLedgerReport } from "@/modules/reports/server/reports.service";

export async function GET() {
  await requireUser("reports:view");
  const rows = await getInventoryMovementLedgerReport();
  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventory-movement-ledger.csv"',
    },
  });
}
