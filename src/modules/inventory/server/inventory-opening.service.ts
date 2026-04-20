import { type JournalSourceType, type QcStatus, type VariantType } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { assertJournalBalanced } from "@/modules/accounting/domain/journal";

const openingInventorySchema = z.object({
  productVariantId: z.string().min(1, "Product is required."),
  locationId: z.string().min(1, "Location is required."),
  lotCode: z.string().trim().min(3, "Lot code is required."),
  quantity: z.coerce.number().gt(0, "Quantity must be greater than zero."),
  unitCost: z.coerce.number().gt(0, "Unit cost must be greater than zero."),
  qcStatus: z.enum(["HOLD", "RELEASED", "QUARANTINED"]),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  receivedAt: z.string().optional(),
  notes: z.string().trim().max(2_000, "Notes are too long.").optional(),
});

export type OpeningInventoryInput = z.infer<typeof openingInventorySchema>;

export async function createOpeningInventoryLot(
  input: OpeningInventoryInput,
  actorId: string,
) {
  const payload = openingInventorySchema.parse(input);
  const lotCode = payload.lotCode.toUpperCase();
  const manufactureDate = parseOptionalDate(payload.manufactureDate, "Manufacture date");
  const expiryDate = parseOptionalDate(payload.expiryDate, "Expiry date");
  const receivedAt = parseOptionalDate(payload.receivedAt, "Received date") ?? new Date();

  const [variant, location, existingLot, ledgerAccounts, fiscalPeriod] = await Promise.all([
    db.productVariant.findUnique({
      where: { id: payload.productVariantId },
      include: { product: true, flavor: true },
    }),
    db.location.findUnique({
      where: { id: payload.locationId },
      include: { warehouse: true },
    }),
    db.inventoryLot.findUnique({ where: { lotCode } }),
    db.ledgerAccount.findMany({
      where: { code: { in: ["1210", "1220", "1230", "3300"] } },
    }),
    db.fiscalPeriod.findFirst({
      where: {
        startDate: { lte: receivedAt },
        endDate: { gte: receivedAt },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  if (!variant || !variant.product.tracksInventory || !variant.tracksInventory) {
    throw new Error("Selected variant does not support inventory.");
  }

  if (!location) {
    throw new Error("Selected location was not found.");
  }

  if (existingLot) {
    throw new Error(`Lot code ${lotCode} already exists.`);
  }

  if ((variant.expiryTracked || variant.product.isExpiryTracked) && !expiryDate) {
    throw new Error("Expiry date is required for expiry-tracked inventory.");
  }

  if (location.isSellable && payload.qcStatus !== "RELEASED") {
    throw new Error("Sellable stock must be loaded as RELEASED QC status.");
  }

  if (manufactureDate && expiryDate && manufactureDate >= expiryDate) {
    throw new Error("Expiry date must be after the manufacture date.");
  }

  const accountByCode = Object.fromEntries(
    ledgerAccounts.map((account) => [account.code, account]),
  );
  const inventoryAccountCode = inventoryAccountCodeForVariant(variant.variantType);
  const inventoryAccount = accountByCode[inventoryAccountCode];
  const openingBalanceAccount = accountByCode["3300"];

  if (!inventoryAccount || !openingBalanceAccount) {
    throw new Error("Inventory opening accounts are not configured.");
  }

  return db.$transaction(async (trx) => {
    const lot = await trx.inventoryLot.create({
      data: {
        productVariantId: variant.id,
        lotCode,
        manufactureDate,
        expiryDate,
        receivedAt,
        qcStatus: payload.qcStatus as QcStatus,
        costPerUnit: payload.unitCost,
        notes: payload.notes || null,
      },
    });

    await trx.inventoryBalance.create({
      data: {
        lotId: lot.id,
        locationId: location.id,
        quantity: payload.quantity,
        reservedQty: 0,
      },
    });

    await trx.inventoryMovement.create({
      data: {
        movementType: "RECEIPT",
        reason: "Opening balance load",
        productVariantId: variant.id,
        lotId: lot.id,
        toLocationId: location.id,
        quantity: payload.quantity,
        unitCost: payload.unitCost,
        referenceType: "opening_balance",
        referenceId: lot.id,
        notes: payload.notes || null,
        createdById: actorId,
      },
    });

    const totalValue = Number(payload.quantity) * Number(payload.unitCost);
    const journalLines = [
      accountLine(inventoryAccount.id, totalValue, 0),
      accountLine(openingBalanceAccount.id, 0, totalValue),
    ];

    assertJournalBalanced(
      journalLines.map((line) => ({
        accountId: line.accountId,
        code: line.accountId,
        name: line.accountId,
        type: "ASSET" as const,
        debit: line.debit,
        credit: line.credit,
      })),
    );

    const journalCount = await trx.journalEntry.count();

    await trx.journalEntry.create({
      data: {
        entryNumber: `JE-OPEN-${String(journalCount + 1).padStart(4, "0")}`,
        entryDate: receivedAt,
        status: "POSTED",
        sourceType: "INVENTORY" as JournalSourceType,
        sourceId: lot.id,
        memo: `Opening inventory loaded for ${lotCode}`,
        fiscalPeriodId: fiscalPeriod?.id ?? null,
        createdById: actorId,
        postedAt: receivedAt,
        lines: {
          create: journalLines,
        },
      },
    });

    await trx.auditLog.create({
      data: {
        actorId,
        entityType: "inventory_lot",
        entityId: lot.id,
        action: "inventory.opening_balance_loaded",
        after: {
          sku: variant.sku,
          lotCode,
          quantity: payload.quantity,
          unitCost: payload.unitCost,
          qcStatus: payload.qcStatus,
          location: location.code,
        },
      },
    });

    return lot;
  });
}

function inventoryAccountCodeForVariant(variantType: VariantType) {
  switch (variantType) {
    case "RAW_MATERIAL":
      return "1210";
    case "PACKAGING_MATERIAL":
      return "1220";
    case "FINISHED_SACHET":
      return "1230";
    default:
      throw new Error("Opening inventory is only supported for stocked raw, packaging, and finished sachet variants.");
  }
}

function parseOptionalDate(value: string | undefined, label: string) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return parsed;
}

function accountLine(accountId: string, debit: number, credit: number) {
  return {
    accountId,
    debit,
    credit,
  };
}
