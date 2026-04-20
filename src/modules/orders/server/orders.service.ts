import { Prisma, type JournalSourceType } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { hasShopifyConnectionEnv } from "@/lib/env";
import { decomposeBundle } from "@/modules/catalog/domain/bundles";
import { buildCustomFlavorMixConsumption } from "@/modules/orders/domain/custom-flavor-mix";
import { assertJournalBalanced } from "@/modules/accounting/domain/journal";

const manualOrderSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(4),
  city: z.string().optional(),
  sourceTag: z.string().min(2),
  productVariantId: z.string().min(1),
  bundleQuantity: z.coerce.number().min(1).default(1),
  deliveryCost: z.coerce.number().min(0).default(0),
  paymentFee: z.coerce.number().min(0).default(0),
  paymentMethodCode: z.enum(["CASH", "WHISH", "CARD"]),
  markAsPaid: z.coerce.boolean().default(false),
  notes: z.string().optional(),
  flavorMix: z.object({
    chocolate: z.coerce.number().min(0).default(0),
    strawberry: z.coerce.number().min(0).default(0),
    vanilla: z.coerce.number().min(0).default(0),
    coffee: z.coerce.number().min(0).default(0),
  }),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

export async function getOrdersOverview() {
  const [orders, bundleVariants, flavors, paymentMethods, latestShopifySync] = await Promise.all([
    db.salesOrder.findMany({
      include: {
        customer: true,
        salesChannel: true,
        payments: {
          include: {
            paymentMethod: true,
          },
        },
        lines: {
          include: {
            productVariant: true,
          },
        },
      },
      orderBy: { orderDate: "desc" },
    }),
    db.productVariant.findMany({
      where: {
        variantType: {
          in: ["DISCOVERY_PACK", "TRAINING_BOX", "MONTHLY_BUNDLE", "CUSTOM_SACHET"],
        },
      },
      include: {
        bundleDefinition: {
          include: {
            lines: {
              include: {
                flavor: true,
                componentVariant: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.flavor.findMany({ orderBy: { name: "asc" } }),
    db.paymentMethod.findMany({ orderBy: { name: "asc" } }),
    db.shopifyOrder.findFirst({
      orderBy: { syncedAt: "desc" },
    }),
  ]);

  return {
    orders,
    bundleVariants,
    flavors,
    paymentMethods,
    shopifyConfigured: hasShopifyConnectionEnv(),
    lastShopifySyncAt: latestShopifySync?.syncedAt ?? null,
    shopifyOrderCount: orders.filter((order) => order.sourceType === "SHOPIFY").length,
  };
}

export async function createManualOrder(input: ManualOrderInput, actorId: string) {
  const payload = manualOrderSchema.parse(input);
  const selectedVariant = await db.productVariant.findUnique({
    where: { id: payload.productVariantId },
    include: {
      product: true,
      bundleDefinition: {
        include: {
          lines: {
            include: {
              flavor: true,
              componentVariant: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!selectedVariant || !selectedVariant.bundleDefinition) {
    throw new Error("Selected order product is invalid.");
  }

  const bundleType = selectedVariant.variantType as "DISCOVERY_PACK" | "TRAINING_BOX" | "MONTHLY_BUNDLE" | "CUSTOM_SACHET";

  const mixEntries = Object.entries(payload.flavorMix)
    .filter(([, quantity]) => quantity > 0)
    .map(([flavorKey, quantity]) => ({
      flavorId:
        selectedVariant.bundleDefinition?.lines.find((line) => line.flavor?.name.toLowerCase() === flavorKey)?.flavorId ??
        "",
      quantity,
    }))
    .filter((entry) => entry.flavorId);

  const subtotal =
    selectedVariant.variantType === "CUSTOM_SACHET"
      ? mixEntries.reduce((sum, entry) => sum + entry.quantity, 0) * Number(selectedVariant.product.defaultUnitPrice ?? 3)
      : payload.bundleQuantity * Number(selectedVariant.defaultPrice ?? selectedVariant.product.defaultUnitPrice ?? 0);
  const vatRate = Number(selectedVariant.product.vatRate ?? 0);
  const vatTotal = subtotal * vatRate;
  const totalCollected = subtotal + vatTotal;

  const consumptionPlan =
    selectedVariant.variantType === "CUSTOM_SACHET"
      ? buildCustomFlavorMixConsumption({
          minimumSachets: Number(selectedVariant.bundleDefinition.minimumUnits ?? 4),
          flavors: selectedVariant.bundleDefinition.lines
            .filter((line) => mixEntries.some((entry) => entry.flavorId === line.flavorId))
            .map((line) => ({
              flavorId: line.flavorId!,
              flavorName: line.flavor?.name ?? line.componentVariant?.name ?? "Flavor",
              variantId: line.componentVariantId!,
              quantity: mixEntries.find((entry) => entry.flavorId === line.flavorId)?.quantity ?? 0,
            })),
        }).map((line) => ({
          variantId: line.variantId,
          quantity: Number(line.quantity),
          flavorId: line.flavorId,
          flavorName: line.flavorName,
        }))
      : decomposeBundle(
          {
            bundleVariantId: selectedVariant.id,
            type: bundleType,
            minimumUnits: selectedVariant.bundleDefinition.minimumUnits?.toString(),
            fixedPrice: selectedVariant.bundleDefinition.fixedPrice?.toString(),
            allowFlavorMix: selectedVariant.bundleDefinition.allowFlavorMix,
            lines: selectedVariant.bundleDefinition.lines.map((line) => ({
              componentVariantId: line.componentVariantId!,
              quantity: line.quantity.toString(),
              flavorId: line.flavorId,
              isFlexible: line.isFlexible,
            })),
          },
          payload.bundleQuantity,
          mixEntries,
        ).map((line) => ({
          variantId: line.componentVariantId,
          quantity: Number(line.quantity),
          flavorId: line.flavorId ?? undefined,
          flavorName:
            selectedVariant.bundleDefinition?.lines.find((definitionLine) => definitionLine.componentVariantId === line.componentVariantId)
              ?.flavor?.name ?? "Flavor",
        }));

  if (selectedVariant.bundleDefinition.allowFlavorMix && mixEntries.length === 0 && selectedVariant.variantType !== "DISCOVERY_PACK") {
    throw new Error("This bundle requires a flavor mix.");
  }

  const salesChannel = await db.salesChannel.findUnique({ where: { code: "MANUAL" } });
  const paymentMethod = await db.paymentMethod.findUnique({
    where: { code: payload.paymentMethodCode },
  });
  const ledgerAccounts = await db.ledgerAccount.findMany({
    where: {
      code: {
        in: ["1110", "1130", "1140", "1150", "2120", "4110", "5100", "5110", "5120", "1230", "2130"],
      },
    },
  });

  if (!salesChannel || !paymentMethod) {
    throw new Error("Manual order dependencies are not seeded correctly.");
  }

  const accountByCode = Object.fromEntries(ledgerAccounts.map((account) => [account.code, account]));

  return db.$transaction(async (trx) => {
    const existingCustomer = await trx.customer.findFirst({
      where: {
        OR: [{ phone: payload.phone }, { name: payload.customerName }],
      },
    });
    const customer =
      existingCustomer ??
      (await trx.customer.create({
        data: {
          code: `CUST-MAN-${String((await trx.customer.count()) + 1).padStart(4, "0")}`,
          name: payload.customerName,
          phone: payload.phone,
          city: payload.city,
        },
      }));

    const orderNumber = `SO-M-${String((await trx.salesOrder.count()) + 1).padStart(4, "0")}`;
    const paymentState = payload.markAsPaid ? "PAID" : "PENDING";
    const lineQuantity =
      selectedVariant.variantType === "CUSTOM_SACHET"
        ? consumptionPlan.reduce((sum, line) => sum + line.quantity, 0)
        : payload.bundleQuantity;

    const order = await trx.salesOrder.create({
      data: {
        orderNumber,
        sourceType: "MANUAL",
        salesChannelId: salesChannel.id,
        customerId: customer.id,
        status: "FULFILLED",
        paymentState,
        fulfillmentStatus: "FULFILLED",
        orderDate: new Date(),
        subtotal,
        discountTotal: 0,
        refundTotal: 0,
        shippingFee: 0,
        deliveryCost: payload.deliveryCost,
        paymentFee: payload.paymentFee,
        vatTotal,
        grossTotal: subtotal,
        netTotal: totalCollected,
        notes: payload.notes,
        createdById: actorId,
        lines: {
          create: {
            productVariantId: selectedVariant.id,
            description: selectedVariant.name,
            lineType: selectedVariant.variantType === "CUSTOM_SACHET" ? "CUSTOM_FLAVOR_BUNDLE" : "STANDARD",
            quantity: lineQuantity,
            unitPrice:
              selectedVariant.variantType === "CUSTOM_SACHET"
                ? Number(selectedVariant.product.defaultUnitPrice ?? 3)
                : Number(selectedVariant.defaultPrice ?? selectedVariant.product.defaultUnitPrice ?? 0),
            lineTotal: subtotal,
            vatTotal,
            flavorMix: consumptionPlan.map((line) => ({
              flavorId: line.flavorId,
              flavorName: line.flavorName,
              quantity: line.quantity,
            })),
          },
        },
        manualOrder: {
          create: {
            sourceTag: payload.sourceTag,
            requestedDeliveryFee: payload.deliveryCost,
            notes: payload.notes,
          },
        },
        fulfillments: {
          create: {
            status: "FULFILLED",
            courierName: "Pending courier assignment",
            actualDeliveryCost: payload.deliveryCost,
          },
        },
      },
      include: {
        lines: true,
      },
    });

    let cogs = 0;
    const sellableLocation = await trx.location.findUnique({
      where: { code: "SELLABLE" },
    });

    if (!sellableLocation) {
      throw new Error("Sellable location is missing.");
    }

    for (const line of consumptionPlan) {
      let remaining = line.quantity;
      const balances = await trx.inventoryBalance.findMany({
        where: {
          locationId: sellableLocation.id,
          quantity: { gt: 0 },
          lot: {
            productVariantId: line.variantId,
            qcStatus: "RELEASED",
          },
        },
        include: {
          lot: true,
        },
        orderBy: [{ lot: { expiryDate: "asc" } }, { lot: { receivedAt: "asc" } }],
      });

      for (const balance of balances) {
        if (remaining <= 0) {
          break;
        }
        const available = Number(balance.quantity);
        if (available <= 0) {
          continue;
        }
        const allocated = Math.min(available, remaining);
        remaining -= allocated;
        cogs += allocated * Number(balance.lot.costPerUnit);

        await trx.inventoryBalance.update({
          where: {
            lotId_locationId: {
              lotId: balance.lotId,
              locationId: sellableLocation.id,
            },
          },
          data: {
            quantity: { decrement: allocated },
          },
        });

        await trx.inventoryMovement.create({
          data: {
            movementType: "SALE_DEDUCTION",
            reason: "Manual order fulfillment",
            productVariantId: line.variantId,
            lotId: balance.lotId,
            fromLocationId: sellableLocation.id,
            quantity: allocated,
            unitCost: balance.lot.costPerUnit,
            referenceType: "sales_order",
            referenceId: order.id,
            createdById: actorId,
          },
        });
      }

      if (remaining > 0) {
        throw new Error(`Insufficient released stock for ${line.flavorName}.`);
      }
    }

    if (payload.markAsPaid) {
      await trx.payment.create({
        data: {
          salesOrderId: order.id,
          paymentMethodId: paymentMethod.id,
          status: "PAID",
          amount: totalCollected,
          paidAt: new Date(),
        },
      });
    }

    const revenueLines = [];
    if (payload.markAsPaid) {
      const clearingAccount =
        payload.paymentMethodCode === "CASH"
          ? accountByCode["1110"]
          : payload.paymentMethodCode === "WHISH"
            ? accountByCode["1130"]
            : accountByCode["1140"];

      revenueLines.push(
        accountLine(clearingAccount.id, totalCollected - payload.paymentFee, 0),
      );

      if (payload.paymentFee > 0) {
        revenueLines.push(accountLine(accountByCode["5120"].id, payload.paymentFee, 0));
      }
    } else {
      revenueLines.push(accountLine(accountByCode["1150"].id, totalCollected, 0));
    }

    revenueLines.push(accountLine(accountByCode["4110"].id, 0, subtotal));
    revenueLines.push(accountLine(accountByCode["2120"].id, 0, vatTotal));

    await createPostedJournalEntry(trx, {
      entryNumber: `JE-ORDER-${orderNumber}`,
      entryDate: new Date(),
      sourceType: "MANUAL_ORDER",
      sourceId: order.id,
      memo: `Manual order ${order.orderNumber} revenue`,
      fiscalPeriodId: null,
      createdById: actorId,
      lines: revenueLines,
    });

    await createPostedJournalEntry(trx, {
      entryNumber: `JE-ORDER-${orderNumber}-COGS`,
      entryDate: new Date(),
      sourceType: "MANUAL_ORDER",
      sourceId: `${order.id}-cogs`,
      memo: `Manual order ${order.orderNumber} COGS`,
      fiscalPeriodId: null,
      createdById: actorId,
      lines: [
        accountLine(accountByCode["5100"].id, cogs, 0),
        accountLine(accountByCode["1230"].id, 0, cogs),
        ...(payload.deliveryCost > 0
          ? [
              accountLine(accountByCode["5110"].id, payload.deliveryCost, 0),
              accountLine(accountByCode["2130"].id, 0, payload.deliveryCost),
            ]
          : []),
      ],
    });

    await trx.auditLog.create({
      data: {
        actorId,
        entityType: "manual_order",
        entityId: order.id,
        action: "manual_order.created",
        metadata: {
          orderNumber: order.orderNumber,
          sourceTag: payload.sourceTag,
          paymentState,
        },
      },
    });

    return order;
  });
}

async function createPostedJournalEntry(
  trx: Prisma.TransactionClient,
  input: {
    entryNumber: string;
    entryDate: Date;
    sourceType: JournalSourceType;
    sourceId: string;
    memo: string;
    fiscalPeriodId: string | null;
    createdById: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
  },
) {
  assertJournalBalanced(
    input.lines.map((line) => ({
      accountId: line.accountId,
      code: line.accountId,
      name: line.accountId,
      type: "ASSET",
      debit: line.debit,
      credit: line.credit,
    })),
  );

  return trx.journalEntry.create({
    data: {
      entryNumber: input.entryNumber,
      entryDate: input.entryDate,
      status: "POSTED",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      memo: input.memo,
      fiscalPeriodId: input.fiscalPeriodId,
      createdById: input.createdById,
      postedAt: input.entryDate,
      lines: {
        create: input.lines,
      },
    },
  });
}

function accountLine(accountId: string, debit: number, credit: number) {
  return { accountId, debit, credit };
}
