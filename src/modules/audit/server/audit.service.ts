import { db } from "@/lib/db";

export async function getAuditLogOverview() {
  return db.auditLog.findMany({
    include: {
      actor: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
