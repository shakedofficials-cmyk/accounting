"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getActionErrorMessage } from "@/lib/errors";
import { calculateBatchCost } from "@/modules/production/domain/batch-costing";

const productionRunSchema = z.object({
  bomId: z.string().min(1, "Bill of materials is required."),
  batchNumber: z.string().trim().min(2, "Batch number is required."),
  outputLotCode: z.string().trim().min(2, "Output lot code is required."),
  outputLocationId: z.string().min(1, "Output location is required."),
  actualQuantity: z.coerce.number().gt(0, "Output quantity must be greater than zero."),
  runDate: z.string().min(1, "Run date is required."),
  notes: z.string().trim().max(2000).optional(),
});

export async function createProductionRunAction(formData: FormData) {
  const user = await requireUser("production:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/production?created=1";

  try {
    const payload = productionRunSchema.parse({
      bomId: String(formData.get("bomId") ?? ""),
      batchNumber: String(formData.get("batchNumber") ?? ""),
      outputLotCode: String(formData.get("outputLotCode") ?? "").toUpperCase(),
      outputLocationId: String(formData.get("outputLocationId") ?? ""),
      actualQuantity: formData.get("actualQuantity"),
      runDate: String(formData.get("runDate") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });

    const runDate = new Date(payload.runDate);

    const [bom, outputLocation] = await Promise.all([
      db.billOfMaterial.findUniqueOrThrow({
        where: { id: payload.bomId },
        include: {
          productVariant: true,
          lines: {
            include: { componentVariant: true },
          },
        },
      }),
      db.location.findUniqueOrThrow({
        where: { id: payload.outputLocationId },
        include: { warehouse: true },
      }),
    ]);

    const existingRun = await db.productionRun.findUnique({ where: { batchNumber: payload.batchNumber } });
    if (existingRun) throw new Error(`Batch number ${payload.batchNumber} already exists.`);

    const existingLot = await db.inventoryLot.findUnique({ where: { lotCode: payload.outputLotCode } });
    if (existingLot) throw new Error(`Lot code ${payload.outputLotCode} already exists.`);

    const materialLines = bom.lines.filter((l) => l.componentVariantId !== null);

    const consumptions = await Promise.all(
      materialLines.map(async (line) => {
        const consumed = Number(line.quantity) * payload.actualQuantity;
        const lotBal = await db.inventoryBalance.findFirst({
          where: {
            lot: { productVariantId: line.componentVariantId!, qcStatus: "RELEASED" },
            quantity: { gt: 0 },
          },
          include: { lot: true },
          orderBy: [{ lot: { expiryDate: "asc" } }, { lot: { receivedAt: "asc" } }],
        });
        return {
          variantId: line.componentVariantId!,
          quantity: consumed,
          unitCost: lotBal ? Number(lotBal.lot.costPerUnit) : 0,
          description: line.componentVariant?.sku ?? line.description ?? "",
        };
      }),
    );

    const { unitCost } = calculateBatchCost(
      consumptions.map((c) => ({ description: c.description, quantity: c.quantity, unitCost: c.unitCost })),
      payload.actualQuantity,
    );

    const runCount = await db.productionRun.count();
    const runCode = `PR-${String(runCount + 1).padStart(4, "0")}`;

    await db.$transaction(async (trx) => {
      const run = await trx.productionRun.create({
        data: {
          code: runCode,
          batchNumber: payload.batchNumber,
          bomId: bom.id,
          warehouseId: outputLocation.warehouseId,
          runDate,
          plannedQuantity: payload.actualQuantity,
          actualQuantity: payload.actualQuantity,
          status: "COMPLETED",
          qcStatus: "RELEASED",
          notes: payload.notes ?? null,
          createdById: user.id,
        },
      });

      for (const c of consumptions) {
        await trx.productionRunConsumption.create({
          data: {
            productionRunId: run.id,
            productVariantId: c.variantId,
            quantity: c.quantity,
            unitCost: c.unitCost,
          },
        });
      }

      const lot = await trx.inventoryLot.create({
        data: {
          productVariantId: bom.productVariantId,
          lotCode: payload.outputLotCode,
          receivedAt: runDate,
          qcStatus: "RELEASED",
          costPerUnit: unitCost.toNumber(),
          productionRunId: run.id,
          notes: payload.notes ?? null,
        },
      });

      await trx.inventoryBalance.create({
        data: {
          lotId: lot.id,
          locationId: outputLocation.id,
          quantity: payload.actualQuantity,
          reservedQty: 0,
        },
      });

      await trx.productionRunOutput.create({
        data: {
          productionRunId: run.id,
          lotId: lot.id,
          productVariantId: bom.productVariantId,
          quantity: payload.actualQuantity,
          unitCost: unitCost.toNumber(),
        },
      });

      await trx.auditLog.create({
        data: {
          actorId: user.id,
          entityType: "production_run",
          entityId: run.id,
          action: "production.run_created",
          after: {
            runCode,
            batchNumber: payload.batchNumber,
            sku: bom.productVariant.sku,
            quantity: payload.actualQuantity,
            unitCost: unitCost.toNumber(),
          },
        },
      });
    });
  } catch (error) {
    redirectUrl = `/production?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to create production run."))}`;
  }

  redirect(redirectUrl);
}
