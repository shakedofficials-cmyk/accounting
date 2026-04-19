import { endOfMonth, startOfMonth } from "date-fns";

import { db } from "@/lib/db";
import { calculateSettlement, nextSettlementVersion } from "@/modules/settlements/domain/settlement-engine";

export async function getSettlementOverview() {
  const [periods, activeConfig, categories, partner] = await Promise.all([
    db.settlementPeriod.findMany({
      include: {
        partner: true,
      },
      orderBy: [{ periodStart: "desc" }, { version: "desc" }],
    }),
    db.settlementConfig.findFirst({
      where: { active: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.expenseCategory.findMany({
      orderBy: { name: "asc" },
    }),
    db.partner.findFirst({
      where: { type: "FACTORY", active: true },
    }),
  ]);

  return {
    periods,
    activeConfig,
    categories,
    partner,
  };
}

export async function rerunSettlement(periodKey: string, createdById: string) {
  const [activeConfig, categories, existingPeriods] = await Promise.all([
    db.settlementConfig.findFirst({
      where: { active: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.expenseCategory.findMany(),
    db.settlementPeriod.findMany({
      where: { periodKey, periodType: "MONTHLY" },
      orderBy: { version: "desc" },
    }),
  ]);

  if (!activeConfig) {
    throw new Error("No active settlement configuration found.");
  }

  const periodStart = startOfMonth(new Date(`${periodKey}-01T00:00:00.000Z`));
  const periodEnd = endOfMonth(periodStart);
  const accountIds = {
    revenue: activeConfig.revenueAccountIds as string[],
    discounts: activeConfig.discountAccountIds as string[],
    refunds: activeConfig.refundAccountIds as string[],
    cogs: activeConfig.cogsAccountIds as string[],
    delivery: activeConfig.deliveryAccountIds as string[],
    paymentFees: activeConfig.paymentFeeAccountIds as string[],
  };
  const includedCategoryIds = activeConfig.includedExpenseCategoryIds as string[];
  const includedAccountIds = categories
    .filter((category) => includedCategoryIds.includes(category.id))
    .map((category) => category.defaultAccountId);

  const [journalLines, partner] = await Promise.all([
    db.journalEntryLine.findMany({
      where: {
        journalEntry: {
          status: "POSTED",
          entryDate: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      },
    }),
    db.partner.findFirst({
      where: { type: "FACTORY", active: true },
    }),
  ]);

  const sumBalance = (ids: string[], natural: "credit" | "debit") =>
    journalLines
      .filter((line) => ids.includes(line.accountId))
      .reduce((sum, line) => sum + (natural === "credit" ? Number(line.credit) - Number(line.debit) : Number(line.debit) - Number(line.credit)), 0);

  const math = calculateSettlement({
    revenue: sumBalance(accountIds.revenue, "credit"),
    discounts: sumBalance(accountIds.discounts, "debit"),
    refunds: sumBalance(accountIds.refunds, "debit"),
    cogs: sumBalance(accountIds.cogs, "debit"),
    deliveryCosts: sumBalance(accountIds.delivery, "debit"),
    paymentFees: sumBalance(accountIds.paymentFees, "debit"),
    includedOpex: sumBalance(includedAccountIds, "debit"),
    factorySharePercent: Number(activeConfig.partnerSharePercent),
  });

  const version = nextSettlementVersion(existingPeriods.map((period) => period.version));

  return db.$transaction(async (trx) => {
    const settlementPeriod = await trx.settlementPeriod.create({
      data: {
        periodKey,
        periodType: "MONTHLY",
        periodStart,
        periodEnd,
        version,
        configId: activeConfig.id,
        partnerId: partner?.id,
        revenue: math.revenue,
        discounts: math.discounts,
        refunds: math.refunds,
        netSales: math.netSales,
        cogs: math.cogs,
        deliveryCosts: math.deliveryCosts,
        paymentFees: math.paymentFees,
        includedOpex: math.includedOpex,
        netProfit: math.netProfit,
        factoryShare: math.factoryShare,
        originsShare: math.originsShare,
        createdById,
        notes: `Rerun generated on ${new Date().toISOString()}.`,
        lines: {
          create: [
            { lineType: "GROSS_SALES", label: "Gross Sales", amount: math.revenue },
            { lineType: "DISCOUNT", label: "Discounts", amount: math.discounts },
            { lineType: "REFUND", label: "Refunds", amount: math.refunds },
            { lineType: "NET_SALES", label: "Net Sales", amount: math.netSales },
            { lineType: "COGS", label: "Product COGS", amount: math.cogs },
            { lineType: "DELIVERY", label: "Direct Delivery Cost", amount: math.deliveryCosts },
            { lineType: "PAYMENT_FEE", label: "Payment Fees", amount: math.paymentFees },
            { lineType: "OPEX", label: "Included Operating Expenses", amount: math.includedOpex },
            { lineType: "FACTORY_SHARE", label: "Factory Share", amount: math.factoryShare },
            { lineType: "ORIGINS_SHARE", label: "Origins Share", amount: math.originsShare },
          ],
        },
      },
    });

    await trx.auditLog.create({
      data: {
        actorId: createdById,
        entityType: "settlement_period",
        entityId: settlementPeriod.id,
        action: "settlement.rerun",
        metadata: { periodKey, version },
      },
    });

    return settlementPeriod;
  });
}
