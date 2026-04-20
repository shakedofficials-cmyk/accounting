import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableWrapper, Td, Th } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";
import { getAuditLogOverview } from "@/modules/audit/server/audit.service";

export default async function AuditLogPage() {
  await requireUser("audit:view");
  const logs = await getAuditLogOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Audit Log</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Sensitive action history</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Immutable events</CardTitle>
          <CardDescription>Actor, entity, action, and timestamp for high-sensitivity workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Actor</Th>
                  <Th>Entity</Th>
                  <Th>Action</Th>
                </tr>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <Td>{formatDateTime(log.createdAt)}</Td>
                    <Td>{log.actor?.name ?? "System"}</Td>
                    <Td>{log.entityType}</Td>
                    <Td>{log.action}</Td>
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
