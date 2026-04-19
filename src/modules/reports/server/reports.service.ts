import type { LedgerAccountType } from "@prisma/client";

import { db } from "@/lib/db";
import { buildProfitAndLoss, calculateNaturalBalance } from "@/modules/accounting/domain/statements";

export async function getSalesBySkuReport() {
  const lines = await db.orderLine.findMany({
    include: {
      productVariant: true,
      salesOrder: {
        include: {
          salesChannel: true,
        },
      },
    },
  });

  return Object.values(
    lines.reduce<
      Record<
        string,
        {
          sku: string;
          name: string;
          channel: string;
          unitsSold: number;
          revenue: number;
        }
      >
    >((acc, line) => {
      const key = `${line.productVariant.sku}:${line.salesOrder.salesChannel.name}`;
      const current = acc[key] ?? {
        sku: line.productVariant.sku,
        name: line.productVariant.name,
        channel: line.salesOrder.salesChannel.name,
        unitsSold: 0,
        revenue: 0,
      };
      current.unitsSold += Number(line.quantity);
      current.revenue += Number(line.lineTotal);
      acc[key] = current;
      return acc;
    }, {}),
  );
}

export async function getStockOnHandReport() {
  const balances = await db.inventoryBalance.findMany({
    include: {
      location: true,
      lot: {
        include: {
          productVariant: true,
        },
      },
    },
  });

  return balances.map((balance) => ({
    sku: balance.lot.productVariant.sku,
    product: balance.lot.productVariant.name,
    lotCode: balance.lot.lotCode,
    location: balance.location.name,
    quantity: Number(balance.quantity),
    unitCost: Number(balance.lot.costPerUnit),
    stockValue: Number(balance.quantity) * Number(balance.lot.costPerUnit),
    expiryDate: balance.lot.expiryDate?.toISOString().slice(0, 10) ?? "",
  }));
}

export async function getExpiryReport() {
  const balances = await db.inventoryBalance.findMany({
    where: {
      quantity: { gt: 0 },
      lot: {
        expiryDate: { not: null },
      },
    },
    include: {
      location: true,
      lot: {
        include: {
          productVariant: true,
        },
      },
    },
    orderBy: [{ lot: { expiryDate: "asc" } }, { location: { name: "asc" } }],
  });

  const today = new Date();

  return balances.map((balance) => {
    const expiryDate = balance.lot.expiryDate!;
    const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      sku: balance.lot.productVariant.sku,
      product: balance.lot.productVariant.name,
      lotCode: balance.lot.lotCode,
      location: balance.location.name,
      quantity: Number(balance.quantity),
      expiryDate: expiryDate.toISOString().slice(0, 10),
      daysToExpiry,
      status: daysToExpiry < 0 ? "Expired" : daysToExpiry <= 30 ? "Due Soon" : "Healthy",
    };
  });
}

export async function getInventoryMovementLedgerReport() {
  const movements = await db.inventoryMovement.findMany({
    include: {
      productVariant: true,
      lot: true,
      fromLocation: true,
      toLocation: true,
      createdBy: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });

  return movements.map((movement) => ({
    movementDate: movement.occurredAt.toISOString(),
    movementType: movement.movementType,
    reason: movement.reason ?? "",
    sku: movement.productVariant.sku,
    product: movement.productVariant.name,
    lotCode: movement.lot?.lotCode ?? "",
    fromLocation: movement.fromLocation?.name ?? "",
    toLocation: movement.toLocation?.name ?? "",
    quantity: Number(movement.quantity),
    unitCost: Number(movement.unitCost ?? 0),
    extendedCost: Number(movement.quantity) * Number(movement.unitCost ?? 0),
    referenceType: movement.referenceType ?? "",
    referenceId: movement.referenceId ?? "",
    actor: movement.createdBy?.name ?? "",
  }));
}

export async function getTrialBalanceReport() {
  const journalLines = await db.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "POSTED",
      },
    },
    include: {
      account: true,
    },
  });

  return buildTrialBalanceRows(journalLines);
}

export async function getProfitAndLossReport() {
  const trialBalance = await getTrialBalanceReport();
  const statement = buildProfitAndLoss(
    trialBalance
      .filter((line) =>
        ["REVENUE", "CONTRA_REVENUE", "COGS", "EXPENSE"].includes(line.type),
      )
      .map((line) => ({
        type: line.type as "REVENUE" | "CONTRA_REVENUE" | "COGS" | "EXPENSE",
        amount: line.balance,
      })),
  );

  return [
    { section: "Revenue", amount: Number(statement.revenue) },
    { section: "Contra revenue", amount: Number(statement.contraRevenue) },
    { section: "Net sales", amount: Number(statement.netSales) },
    { section: "COGS", amount: Number(statement.cogs) },
    { section: "Gross profit", amount: Number(statement.grossProfit) },
    { section: "Operating expenses", amount: Number(statement.operatingExpenses) },
    { section: "Net profit", amount: Number(statement.netProfit) },
  ];
}

export async function getSettlementStatementsReport() {
  const periods = await db.settlementPeriod.findMany({
    include: {
      partner: true,
    },
    orderBy: [{ periodStart: "desc" }, { version: "desc" }],
  });

  return periods.map((period) => ({
    periodKey: period.periodKey,
    periodType: period.periodType,
    version: period.version,
    partner: period.partner?.name ?? "Factory partner",
    revenue: Number(period.revenue),
    netSales: Number(period.netSales),
    cogs: Number(period.cogs),
    deliveryCosts: Number(period.deliveryCosts),
    paymentFees: Number(period.paymentFees),
    includedOpex: Number(period.includedOpex),
    netProfit: Number(period.netProfit),
    factoryShare: Number(period.factoryShare),
    originsShare: Number(period.originsShare),
    createdAt: period.createdAt.toISOString(),
  }));
}

function buildTrialBalanceRows(
  journalLines: Array<{
    accountId: string;
    debit: { toNumber(): number } | number;
    credit: { toNumber(): number } | number;
    account: { code: string; name: string; type: LedgerAccountType };
  }>,
) {
  return Object.values(
    journalLines.reduce<
      Record<
        string,
        {
          accountId: string;
          code: string;
          name: string;
          type: LedgerAccountType;
          debit: number;
          credit: number;
          balance: number;
        }
      >
    >((acc, line) => {
      const current = acc[line.accountId] ?? {
        accountId: line.accountId,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
        balance: 0,
      };

      current.debit += Number(line.debit);
      current.credit += Number(line.credit);
      current.balance = calculateNaturalBalance(current.type, current.debit, current.credit);
      acc[line.accountId] = current;

      return acc;
    }, {}),
  ).sort((left, right) => left.code.localeCompare(right.code));
}
