import { db } from "@/lib/db";

export async function clearOperationalData(actorId: string) {
  const summary = {
    inventoryLots: await db.inventoryLot.count(),
    inventoryBalances: await db.inventoryBalance.count(),
    inventoryMovements: await db.inventoryMovement.count(),
    productionRuns: await db.productionRun.count(),
    salesOrders: await db.salesOrder.count(),
    shopifyOrders: await db.shopifyOrder.count(),
    vendorBills: await db.vendorBill.count(),
    journalEntries: await db.journalEntry.count(),
    settlementPeriods: await db.settlementPeriod.count(),
    reportSnapshots: await db.reportSnapshot.count(),
    auditLogs: await db.auditLog.count(),
  };

  return db.$transaction(async (trx) => {
    await trx.ledgerAccount.upsert({
      where: { code: "3300" },
      update: {
        name: "Opening Balance Equity",
        type: "EQUITY",
        isActive: true,
        allowManualPostings: true,
      },
      create: {
        code: "3300",
        name: "Opening Balance Equity",
        type: "EQUITY",
        isActive: true,
        allowManualPostings: true,
      },
    });

    await trx.fileReference.deleteMany({});
    await trx.reportSnapshot.deleteMany({});
    await trx.settlementLine.deleteMany({});
    await trx.settlementPeriod.deleteMany({});
    await trx.journalEntryLine.deleteMany({});
    await trx.journalEntry.deleteMany({});
    await trx.payment.deleteMany({});
    await trx.vendorBillLine.deleteMany({});
    await trx.vendorBill.deleteMany({});
    await trx.shopifyOrderLine.deleteMany({});
    await trx.shopifyOrder.deleteMany({});
    await trx.manualOrder.deleteMany({});
    await trx.fulfillment.deleteMany({});
    await trx.orderLine.deleteMany({});
    await trx.salesOrder.deleteMany({});
    await trx.customer.deleteMany({});
    await trx.expiryRecord.deleteMany({});
    await trx.inventoryMovement.deleteMany({});
    await trx.inventoryBalance.deleteMany({});
    await trx.productionRunConsumption.deleteMany({});
    await trx.productionRunOutput.deleteMany({});
    await trx.inventoryLot.deleteMany({});
    await trx.productionRun.deleteMany({});
    await trx.auditLog.deleteMany({});

    await trx.auditLog.create({
      data: {
        actorId,
        entityType: "system",
        entityId: "operational-reset",
        action: "operational_data.reset",
        metadata: summary,
      },
    });

    return summary;
  }, { timeout: 60_000 });
}
