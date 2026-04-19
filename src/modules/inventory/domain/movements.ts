import { z } from "zod";

import { decimal, quantity, type DecimalLike } from "@/lib/money";

export type BalanceKey = `${string}:${string}`;

export type InventoryBalanceState = {
  lotId: string;
  locationId: string;
  quantity: DecimalLike;
};

export type InventoryMovementInput = {
  lotId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: DecimalLike;
};

export type StockThreshold = {
  variantId: string;
  name: string;
  onHand: DecimalLike;
  threshold: DecimalLike;
};

export type ExpiryCheckInput = {
  lotId: string;
  sku: string;
  expiryDate: Date | string;
};

const movementSchema = z.object({
  lotId: z.string(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  quantity: z.union([z.number(), z.string()]),
});

const keyFor = (lotId: string, locationId: string) => `${lotId}:${locationId}` as BalanceKey;

export function applyInventoryMovement(
  balances: InventoryBalanceState[],
  movementInput: InventoryMovementInput,
) {
  const movement = movementSchema.parse(movementInput);
  const next = new Map(
    balances.map((balance) => [
      keyFor(balance.lotId, balance.locationId),
      quantity(balance.quantity),
    ]),
  );
  const moveQty = quantity(movement.quantity);

  if (moveQty.lte(0)) {
    throw new Error("Inventory movement quantity must be positive.");
  }

  if (movement.fromLocationId) {
    const fromKey = keyFor(movement.lotId, movement.fromLocationId);
    const current = next.get(fromKey) ?? quantity(0);

    if (current.lt(moveQty)) {
      throw new Error("Inventory movement would result in negative stock.");
    }

    next.set(fromKey, quantity(current.minus(moveQty)));
  }

  if (movement.toLocationId) {
    const toKey = keyFor(movement.lotId, movement.toLocationId);
    const current = next.get(toKey) ?? quantity(0);
    next.set(toKey, quantity(current.plus(moveQty)));
  }

  return Array.from(next.entries()).map(([compoundKey, value]) => {
    const [lotId, locationId] = compoundKey.split(":");
    return {
      lotId,
      locationId,
      quantity: value,
    };
  });
}

export function detectLowStock(items: StockThreshold[]) {
  return items.filter((item) => decimal(item.onHand).lte(item.threshold));
}

export function detectUpcomingExpiry(items: ExpiryCheckInput[], now: Date, daysAhead = 30) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return items
    .map((item) => {
      const expiryDate = typeof item.expiryDate === "string" ? new Date(item.expiryDate) : item.expiryDate;
      return {
        ...item,
        expiryDate,
        status: expiryDate < now ? "EXPIRED" : expiryDate <= cutoff ? "UPCOMING" : "HEALTHY",
      } as const;
    })
    .filter((item) => item.status !== "HEALTHY");
}
