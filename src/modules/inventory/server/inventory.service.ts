import { db } from "@/lib/db";
import { detectLowStock, detectUpcomingExpiry } from "@/modules/inventory/domain/movements";

export async function getInventoryOverview() {
  const [lots, balances, locations, trackedVariants] = await Promise.all([
    db.inventoryLot.findMany({
      include: {
        productVariant: {
          include: {
            flavor: true,
          },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { receivedAt: "desc" }],
    }),
    db.inventoryBalance.findMany({
      include: {
        location: true,
        lot: {
          include: {
            productVariant: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.location.findMany({
      orderBy: { name: "asc" },
    }),
    db.productVariant.findMany({
      where: {
        active: true,
        tracksInventory: true,
      },
      include: {
        product: true,
        flavor: true,
      },
      orderBy: [{ variantType: "asc" }, { name: "asc" }],
    }),
  ]);

  const stockByVariant = Object.values(
    balances.reduce<Record<string, { variantId: string; name: string; onHand: number; threshold: number }>>((acc, balance) => {
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
    }, {}),
  );

  return {
    lots,
    balances,
    locations,
    trackedVariants,
    lowStockAlerts: detectLowStock(stockByVariant),
    upcomingExpiries: detectUpcomingExpiry(
      lots
        .filter((lot) => lot.expiryDate)
        .map((lot) => ({
          lotId: lot.lotCode,
          sku: lot.productVariant.sku,
          expiryDate: lot.expiryDate!,
        })),
      new Date(),
      60,
    ),
  };
}
