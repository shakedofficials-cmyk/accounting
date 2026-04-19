import { addDays, format, startOfDay, startOfMonth, subDays } from "date-fns";

import { db } from "@/lib/db";
import { detectLowStock, detectUpcomingExpiry } from "@/modules/inventory/domain/movements";

export async function getDashboardData() {
  const today = new Date();
  const startToday = startOfDay(today);
  const startMonth = startOfMonth(today);

  const [ordersToday, ordersMtd, orderLinesMtd, currentSettlement, recentActivity, inventoryBalances, vendorBills, lots] =
    await Promise.all([
      db.salesOrder.findMany({
        where: {
          orderDate: { gte: startToday },
          status: { not: "CANCELLED" },
        },
        include: { lines: true },
      }),
      db.salesOrder.findMany({
        where: {
          orderDate: { gte: startMonth },
          status: { not: "CANCELLED" },
        },
        include: { lines: true },
      }),
      db.orderLine.findMany({
        where: {
          salesOrder: {
            orderDate: { gte: startMonth },
            status: { not: "CANCELLED" },
          },
        },
        include: {
          productVariant: {
            include: {
              flavor: true,
            },
          },
        },
      }),
      db.settlementPeriod.findFirst({
        orderBy: [{ periodStart: "desc" }, { version: "desc" }],
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.inventoryBalance.findMany({
        include: {
          lot: {
            include: {
              productVariant: true,
            },
          },
        },
      }),
      db.vendorBill.findMany({
        where: {
          status: { in: ["DRAFT", "APPROVED"] },
        },
      }),
      db.inventoryLot.findMany({
        where: {
          expiryDate: {
            gte: today,
            lte: addDays(today, 45),
          },
        },
        include: {
          productVariant: true,
        },
        orderBy: {
          expiryDate: "asc",
        },
      }),
    ]);

  const salesToday = ordersToday.reduce((sum, order) => sum + Number(order.subtotal), 0);
  const salesMtd = ordersMtd.reduce((sum, order) => sum + Number(order.subtotal), 0);
  const unitsSold = orderLinesMtd.reduce((sum, line) => sum + Number(line.quantity), 0);
  const averageOrderValue = ordersMtd.length === 0 ? 0 : salesMtd / ordersMtd.length;
  const grossProfitEstimate = currentSettlement ? Number(currentSettlement.netSales) - Number(currentSettlement.cogs) : 0;
  const netProfitEstimate = currentSettlement ? Number(currentSettlement.netProfit) : 0;
  const factoryShareAccrued = currentSettlement ? Number(currentSettlement.factoryShare) : 0;
  const stockValue = inventoryBalances.reduce(
    (sum, balance) => sum + Number(balance.quantity) * Number(balance.lot.costPerUnit),
    0,
  );

  const flavorUnits = orderLinesMtd.reduce<Record<string, number>>((acc, line) => {
    const mix = Array.isArray(line.flavorMix) ? line.flavorMix : [];
    if (mix.length > 0) {
      for (const item of mix) {
        const flavorName = typeof item === "object" && item && "flavorName" in item ? String(item.flavorName) : "Unknown";
        const quantity = typeof item === "object" && item && "quantity" in item ? Number(item.quantity) : 0;
        acc[flavorName] = (acc[flavorName] ?? 0) + quantity;
      }
      return acc;
    }

    const fallbackFlavor = line.productVariant.flavor?.name ?? line.productVariant.name;
    acc[fallbackFlavor] = (acc[fallbackFlavor] ?? 0) + Number(line.quantity);
    return acc;
  }, {});

  const productTypeUnits = orderLinesMtd.reduce<Record<string, number>>((acc, line) => {
    acc[line.productVariant.variantType] = (acc[line.productVariant.variantType] ?? 0) + Number(line.quantity);
    return acc;
  }, {});

  const topFlavor = Object.entries(flavorUnits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
  const topProductType = Object.entries(productTypeUnits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
  const salesSeries = Array.from({ length: 14 }, (_, index) => {
    const date = subDays(today, 13 - index);
    const key = format(date, "yyyy-MM-dd");
    const total = ordersMtd
      .filter((order) => format(order.orderDate, "yyyy-MM-dd") === key)
      .reduce((sum, order) => sum + Number(order.subtotal), 0);

    return {
      day: format(date, "dd MMM"),
      sales: total,
    };
  });

  const flavorSeries = Object.entries(flavorUnits).map(([name, units]) => ({
    name,
    units,
  }));

  const lowStockAlerts = detectLowStock(
    Object.values(
      inventoryBalances.reduce<Record<string, { variantId: string; name: string; onHand: number; threshold: number }>>(
        (acc, balance) => {
          const variant = balance.lot.productVariant;
          if (!variant.lowStockThreshold) {
            return acc;
          }
          const current = acc[variant.id] ?? {
            variantId: variant.id,
            name: variant.name,
            onHand: 0,
            threshold: Number(variant.lowStockThreshold),
          };
          current.onHand += Number(balance.quantity);
          acc[variant.id] = current;
          return acc;
        },
        {},
      ),
    ),
  );

  const upcomingExpiries = detectUpcomingExpiry(
    lots.map((lot) => ({
      lotId: lot.lotCode,
      sku: lot.productVariant.sku,
      expiryDate: lot.expiryDate ?? today,
    })),
    today,
    45,
  );

  const unresolvedIssues = [
    vendorBills.length > 0 ? `${vendorBills.length} vendor bills need posting or payment` : null,
    lowStockAlerts.length > 0 ? `${lowStockAlerts.length} low stock alerts need attention` : null,
    upcomingExpiries.length > 0 ? `${upcomingExpiries.length} lots are approaching expiry` : null,
  ].filter(Boolean) as string[];

  return {
    metrics: {
      salesToday,
      salesMtd,
      orderCount: ordersMtd.length,
      averageOrderValue,
      unitsSold,
      grossProfitEstimate,
      netProfitEstimate,
      factoryShareAccrued,
      stockValue,
      topFlavor,
      topProductType,
    },
    lowStockAlerts,
    upcomingExpiries,
    recentActivity,
    unresolvedIssues,
    salesSeries,
    flavorSeries,
  };
}
