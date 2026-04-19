import { requireUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { getSettlementStatementsReport } from "@/modules/reports/server/reports.service";

export async function GET() {
  await requireUser("reports:view");
  const rows = await getSettlementStatementsReport();
  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="settlement-statements.csv"',
    },
  });
}
