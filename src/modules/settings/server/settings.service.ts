import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function getSettingsOverview() {
  const [company, activeConfig, categories] = await Promise.all([
    db.company.findFirst(),
    db.settlementConfig.findFirst({
      where: { active: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.expenseCategory.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    company,
    activeConfig,
    categories,
  };
}

export async function replaceSettlementConfig(input: {
  createdById: string;
  partnerSharePercent: number;
  includedExpenseCategoryIds: string[];
}) {
  const activeConfig = await db.settlementConfig.findFirst({
    where: { active: true },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!activeConfig) {
    throw new Error("Active settlement config not found.");
  }

  return db.$transaction(async (trx) => {
    await trx.settlementConfig.update({
      where: { id: activeConfig.id },
      data: { active: false },
    });

    const nextConfig = await trx.settlementConfig.create({
      data: {
        effectiveFrom: new Date(),
        partnerSharePercent: input.partnerSharePercent,
        originsSharePercent: 1 - input.partnerSharePercent,
        includedExpenseCategoryIds: input.includedExpenseCategoryIds,
        revenueAccountIds: activeConfig.revenueAccountIds as Prisma.InputJsonValue,
        discountAccountIds: activeConfig.discountAccountIds as Prisma.InputJsonValue,
        refundAccountIds: activeConfig.refundAccountIds as Prisma.InputJsonValue,
        cogsAccountIds: activeConfig.cogsAccountIds as Prisma.InputJsonValue,
        deliveryAccountIds: activeConfig.deliveryAccountIds as Prisma.InputJsonValue,
        paymentFeeAccountIds: activeConfig.paymentFeeAccountIds as Prisma.InputJsonValue,
        notes: "Updated from settings UI.",
        active: true,
      },
    });

    await trx.auditLog.create({
      data: {
        actorId: input.createdById,
        entityType: "settlement_config",
        entityId: nextConfig.id,
        action: "settlement_config.updated",
        metadata: {
          includedExpenseCategoryIds: input.includedExpenseCategoryIds,
          partnerSharePercent: input.partnerSharePercent,
        },
      },
    });

    return nextConfig;
  });
}

export async function updateCompanyProfile(input: {
  actorId: string;
  legalName: string;
  brandName: string;
  baseCurrency: "USD";
  country: string;
  timezone: string;
  defaultCourierFee: number;
  settlementNotes?: string;
}) {
  const company = await db.company.findFirst();

  if (!company) {
    throw new Error("Company profile not found.");
  }

  return db.$transaction(async (trx) => {
    const nextCompany = await trx.company.update({
      where: { id: company.id },
      data: {
        legalName: input.legalName,
        brandName: input.brandName,
        baseCurrency: input.baseCurrency,
        country: input.country,
        timezone: input.timezone,
        defaultCourierFee: input.defaultCourierFee,
        settlementNotes: input.settlementNotes,
      },
    });

    await trx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "company",
        entityId: nextCompany.id,
        action: "company.updated",
        before: {
          legalName: company.legalName,
          brandName: company.brandName,
          baseCurrency: company.baseCurrency,
          country: company.country,
          timezone: company.timezone,
          defaultCourierFee: company.defaultCourierFee.toNumber(),
          settlementNotes: company.settlementNotes,
        },
        after: {
          legalName: nextCompany.legalName,
          brandName: nextCompany.brandName,
          baseCurrency: nextCompany.baseCurrency,
          country: nextCompany.country,
          timezone: nextCompany.timezone,
          defaultCourierFee: nextCompany.defaultCourierFee.toNumber(),
          settlementNotes: nextCompany.settlementNotes,
        },
      },
    });

    return nextCompany;
  });
}
