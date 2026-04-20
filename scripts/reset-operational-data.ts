import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const actor = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!actor) {
    throw new Error("No user found to attribute the reset action.");
  }

  const summary = {
    inventoryLots: await prisma.inventoryLot.count(),
    inventoryBalances: await prisma.inventoryBalance.count(),
    inventoryMovements: await prisma.inventoryMovement.count(),
    productionRuns: await prisma.productionRun.count(),
    salesOrders: await prisma.salesOrder.count(),
    shopifyOrders: await prisma.shopifyOrder.count(),
    vendorBills: await prisma.vendorBill.count(),
    journalEntries: await prisma.journalEntry.count(),
    settlementPeriods: await prisma.settlementPeriod.count(),
    reportSnapshots: await prisma.reportSnapshot.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  await prisma.$transaction(async (trx) => {
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
        actorId: actor.id,
        entityType: "system",
        entityId: "operational-reset",
        action: "operational_data.reset",
        metadata: summary,
      },
    });
  }, { timeout: 60_000 });

  console.log("Operational data cleared:");
  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
