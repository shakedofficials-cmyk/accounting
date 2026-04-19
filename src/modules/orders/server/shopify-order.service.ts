import { Prisma, type JournalSourceType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireShopifyEnv } from "@/lib/env";
import { type ShopifyOrderPayload } from "@/lib/shopify-client";
import { assertJournalBalanced } from "@/modules/accounting/domain/journal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportResult =
  | { status: "imported"; orderId: string; orderNumber: string }
  | { status: "skipped"; reason: string };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function importShopifyOrder(
  payload: ShopifyOrderPayload,
  actorId: string,
): Promise<ImportResult> {
  const externalId = `gid://shopify/Order/${payload.id}`;

  // Idempotency guard — Shopify may deliver the same webhook more than once
  const existing = await db.shopifyOrder.findUnique({ where: { externalId } });
  if (existing) {
    return { status: "skipped", reason: "already imported" };
  }

  // Resolve SKUs → ProductVariant rows
  const skus = payload.line_items.map((item) => item.sku).filter((sku): sku is string => !!sku);
  if (skus.length === 0) {
    return { status: "skipped", reason: "no line items with SKUs" };
  }

  const variants = await db.productVariant.findMany({
    where: { sku: { in: skus } },
    include: { product: true },
  });
  const variantBySku = Object.fromEntries(variants.map((v) => [v.sku, v]));

  const unknownSkus = skus.filter((sku) => !variantBySku[sku]);
  if (unknownSkus.length > 0) {
    console.warn(`[shopify-sync] Unknown SKUs in order ${payload.name}: ${unknownSkus.join(", ")}`);
  }

  // Resolve required ledger accounts and dependencies once outside the transaction
  const [ledgerAccounts, salesChannel, paymentMethod, sellableLocation] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { code: { in: ["1110", "1130", "1140", "1150", "2120", "4100", "4190", "5100", "5110", "5120", "1230", "2130"] } },
    }),
    db.salesChannel.findUnique({ where: { code: "SHOPIFY" } }),
    db.paymentMethod.findUnique({ where: { code: "CARD" } }),
    db.location.findUnique({ where: { code: "SELLABLE" } }),
  ]);

  if (!salesChannel || !paymentMethod || !sellableLocation) {
    throw new Error("Required seed data (SHOPIFY channel / CARD payment / SELLABLE location) is missing.");
  }

  const accountByCode = Object.fromEntries(ledgerAccounts.map((a) => [a.code, a]));
  const requiredCodes = ["1140", "2120", "4100", "4190", "5100", "5110", "5120", "1230", "2130"];
  for (const code of requiredCodes) {
    if (!accountByCode[code]) throw new Error(`Ledger account ${code} missing from database.`);
  }

  // Compute order financials from Shopify payload
  const subtotal = parseFloat(payload.subtotal_price);
  const vatTotal = parseFloat(payload.total_tax);
  const discountTotal = parseFloat(payload.total_discounts);
  const shippingFee = payload.shipping_lines.reduce((sum, line) => sum + parseFloat(line.price), 0);
  const totalCollected = parseFloat(payload.total_price);
  const { paymentFeeRate } = requireShopifyEnv();
  const isShopifyPayments = payload.payment_gateway_names.some((g) =>
    g.toLowerCase().includes("shopify"),
  );
  const paymentFee = isShopifyPayments ? parseFloat((totalCollected * paymentFeeRate).toFixed(2)) : 0;

  return db.$transaction(async (trx) => {
    // Upsert customer
    const customer = await upsertCustomer(trx, payload);

    // Generate order number
    const orderCount = await trx.salesOrder.count();
    const orderNumber = `SO-SH-${String(orderCount + 1).padStart(4, "0")}`;

    // Create the SalesOrder
    const order = await trx.salesOrder.create({
      data: {
        orderNumber,
        sourceType: "SHOPIFY",
        externalReference: payload.name,
        salesChannelId: salesChannel.id,
        customerId: customer.id,
        status: "FULFILLED",
        paymentState: "PAID",
        fulfillmentStatus: payload.fulfillment_status === "fulfilled" ? "FULFILLED" : "UNFULFILLED",
        orderDate: new Date(payload.created_at),
        subtotal,
        discountTotal,
        refundTotal: 0,
        shippingFee,
        deliveryCost: shippingFee,
        paymentFee,
        vatTotal,
        grossTotal: subtotal,
        netTotal: totalCollected,
        createdById: actorId,
        lines: {
          create: payload.line_items
            .filter((item) => item.sku && variantBySku[item.sku])
            .map((item) => ({
              productVariantId: variantBySku[item.sku!]!.id,
              description: item.variant_title ? `${item.title} – ${item.variant_title}` : item.title,
              quantity: item.quantity,
              unitPrice: parseFloat(item.price),
              discountTotal: parseFloat(item.total_discount),
              lineTotal: parseFloat(item.price) * item.quantity - parseFloat(item.total_discount),
              vatTotal: item.tax_lines.reduce((sum, t) => sum + parseFloat(t.price), 0),
            })),
        },
        fulfillments: {
          create: {
            status: payload.fulfillment_status === "fulfilled" ? "FULFILLED" : "UNFULFILLED",
            actualDeliveryCost: shippingFee,
          },
        },
      },
      include: { lines: true },
    });

    // Record payment
    await trx.payment.create({
      data: {
        salesOrderId: order.id,
        paymentMethodId: paymentMethod.id,
        status: "PAID",
        amount: totalCollected,
        paidAt: new Date(payload.created_at),
        externalReference: `shopify-${payload.id}`,
      },
    });

    // Create ShopifyOrder record (stores raw payload for audit)
    await trx.shopifyOrder.create({
      data: {
        salesOrderId: order.id,
        externalId,
        orderNumber: payload.name,
        orderDate: new Date(payload.created_at),
        rawPayload: payload as unknown as Prisma.InputJsonValue,
        syncedAt: new Date(),
        lines: {
          create: payload.line_items
            .filter((item) => item.sku && variantBySku[item.sku])
            .map((item) => ({
              orderLineId: order.lines.find(
                (l) => l.productVariantId === variantBySku[item.sku!]!.id,
              )!.id,
              productVariantId: variantBySku[item.sku!]!.id,
              sku: item.sku!,
              title: item.title,
              quantity: item.quantity,
              unitPrice: parseFloat(item.price),
              netAmount: parseFloat(item.price) * item.quantity - parseFloat(item.total_discount),
            })),
        },
      },
    });

    // Deduct inventory (FEFO) and accumulate COGS
    let cogs = 0;
    for (const item of payload.line_items) {
      if (!item.sku || !variantBySku[item.sku]) continue;
      const variant = variantBySku[item.sku];
      cogs += await deductFEFO(trx, variant!.id, item.quantity, order.id, sellableLocation.id, actorId);
    }

    // Revenue journal: Dr Card Clearing / Cr Shopify Sales + VAT
    const revenueLines = [
      accountLine(accountByCode["1140"]!.id, totalCollected - paymentFee, 0),
    ];
    if (paymentFee > 0) {
      revenueLines.push(accountLine(accountByCode["5120"]!.id, paymentFee, 0));
    }
    if (discountTotal > 0) {
      revenueLines.push(accountLine(accountByCode["4190"]!.id, discountTotal, 0));
    }
    revenueLines.push(accountLine(accountByCode["4100"]!.id, 0, subtotal + discountTotal));
    revenueLines.push(accountLine(accountByCode["2120"]!.id, 0, vatTotal));

    await postJournalEntry(trx, {
      entryNumber: `JE-SH-${orderNumber}`,
      entryDate: new Date(payload.created_at),
      sourceType: "SHOPIFY_ORDER",
      sourceId: order.id,
      memo: `Shopify order ${payload.name} revenue`,
      createdById: actorId,
      lines: revenueLines,
    });

    // COGS journal: Dr COGS + Delivery / Cr Inventory + Accrued Courier
    const cogsLines = [
      accountLine(accountByCode["5100"]!.id, cogs, 0),
      accountLine(accountByCode["1230"]!.id, 0, cogs),
    ];
    if (shippingFee > 0) {
      cogsLines.push(accountLine(accountByCode["5110"]!.id, shippingFee, 0));
      cogsLines.push(accountLine(accountByCode["2130"]!.id, 0, shippingFee));
    }

    await postJournalEntry(trx, {
      entryNumber: `JE-SH-${orderNumber}-COGS`,
      entryDate: new Date(payload.created_at),
      sourceType: "SHOPIFY_ORDER",
      sourceId: `${order.id}-cogs`,
      memo: `Shopify order ${payload.name} COGS`,
      createdById: actorId,
      lines: cogsLines,
    });

    await trx.auditLog.create({
      data: {
        actorId,
        entityType: "shopify_order",
        entityId: order.id,
        action: "shopify_order.imported",
        metadata: { orderName: payload.name, externalId, cogs },
      },
    });

    return { status: "imported" as const, orderId: order.id, orderNumber };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertCustomer(trx: Prisma.TransactionClient, payload: ShopifyOrderPayload) {
  const phone =
    payload.customer?.phone ??
    payload.shipping_address?.phone ??
    `shopify-${payload.customer?.id ?? payload.id}`;

  const name = payload.customer
    ? [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(" ") ||
      payload.customer.email ||
      `Shopify Customer ${payload.customer.id}`
    : `Shopify Guest ${payload.id}`;

  const city = payload.shipping_address?.city ?? undefined;

  const existing = await trx.customer.findFirst({
    where: {
      OR: [
        { phone },
        ...(payload.customer?.email ? [{ name }] : []),
      ],
    },
  });

  if (existing) return existing;

  const count = await trx.customer.count();
  return trx.customer.create({
    data: {
      code: `CUST-SH-${String(count + 1).padStart(4, "0")}`,
      name,
      phone,
      city,
    },
  });
}

async function deductFEFO(
  trx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
  orderId: string,
  sellableLocationId: string,
  actorId: string,
): Promise<number> {
  let remaining = quantity;
  let totalCogs = 0;

  const balances = await trx.inventoryBalance.findMany({
    where: {
      locationId: sellableLocationId,
      quantity: { gt: 0 },
      lot: { productVariantId: variantId, qcStatus: "RELEASED" },
    },
    include: { lot: true },
    orderBy: [{ lot: { expiryDate: "asc" } }, { lot: { receivedAt: "asc" } }],
  });

  for (const balance of balances) {
    if (remaining <= 0) break;
    const available = Number(balance.quantity);
    const allocated = Math.min(available, remaining);
    remaining -= allocated;
    totalCogs += allocated * Number(balance.lot.costPerUnit);

    await trx.inventoryBalance.update({
      where: { lotId_locationId: { lotId: balance.lotId, locationId: sellableLocationId } },
      data: { quantity: { decrement: allocated } },
    });

    await trx.inventoryMovement.create({
      data: {
        movementType: "SALE_DEDUCTION",
        reason: "Shopify order fulfillment",
        productVariantId: variantId,
        lotId: balance.lotId,
        fromLocationId: sellableLocationId,
        quantity: allocated,
        unitCost: balance.lot.costPerUnit,
        referenceType: "sales_order",
        referenceId: orderId,
        createdById: actorId,
      },
    });
  }

  if (remaining > 0) {
    console.warn(
      `[shopify-sync] Insufficient stock for variant ${variantId} — ${remaining} units not deducted. Order ${orderId} still recorded.`,
    );
  }

  return totalCogs;
}

async function postJournalEntry(
  trx: Prisma.TransactionClient,
  input: {
    entryNumber: string;
    entryDate: Date;
    sourceType: JournalSourceType;
    sourceId: string;
    memo: string;
    createdById: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
  },
) {
  assertJournalBalanced(
    input.lines.map((l) => ({ accountId: l.accountId, code: l.accountId, name: l.accountId, type: "ASSET" as const, debit: l.debit, credit: l.credit })),
  );

  return trx.journalEntry.create({
    data: {
      entryNumber: input.entryNumber,
      entryDate: input.entryDate,
      status: "POSTED",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      memo: input.memo,
      createdById: input.createdById,
      postedAt: input.entryDate,
      lines: { create: input.lines },
    },
  });
}

function accountLine(accountId: string, debit: number, credit: number) {
  return { accountId, debit, credit };
}
