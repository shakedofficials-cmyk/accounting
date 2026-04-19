import { describe, expect, it } from "vitest";

import {
  applyInventoryMovement,
  detectLowStock,
  detectUpcomingExpiry,
} from "@/modules/inventory/domain/movements";

describe("inventory movements", () => {
  it("transfers stock between locations", () => {
    const balances = applyInventoryMovement(
      [{ lotId: "lot-1", locationId: "sellable", quantity: 10 }],
      { lotId: "lot-1", fromLocationId: "sellable", toLocationId: "reserved", quantity: 4 },
    );

    const sellable = balances.find((b) => b.locationId === "sellable")!;
    const reserved = balances.find((b) => b.locationId === "reserved")!;
    expect(Number(sellable.quantity)).toBe(6);
    expect(Number(reserved.quantity)).toBe(4);
  });

  it("adds to an existing destination balance", () => {
    const balances = applyInventoryMovement(
      [
        { lotId: "lot-1", locationId: "sellable", quantity: 20 },
        { lotId: "lot-1", locationId: "reserved", quantity: 5 },
      ],
      { lotId: "lot-1", fromLocationId: "sellable", toLocationId: "reserved", quantity: 10 },
    );

    const reserved = balances.find((b) => b.locationId === "reserved")!;
    expect(Number(reserved.quantity)).toBe(15);
  });

  it("handles receipt-only movement (no fromLocation)", () => {
    const balances = applyInventoryMovement(
      [],
      { lotId: "lot-new", toLocationId: "factory-finished", quantity: 500 },
    );

    expect(balances).toHaveLength(1);
    expect(Number(balances[0]!.quantity)).toBe(500);
    expect(balances[0]!.locationId).toBe("factory-finished");
  });

  it("handles write-off movement (no toLocation)", () => {
    const balances = applyInventoryMovement(
      [{ lotId: "lot-1", locationId: "damaged", quantity: 10 }],
      { lotId: "lot-1", fromLocationId: "damaged", quantity: 10 },
    );

    const damaged = balances.find((b) => b.locationId === "damaged")!;
    expect(Number(damaged.quantity)).toBe(0);
  });

  it("throws when movement would result in negative stock", () => {
    expect(() =>
      applyInventoryMovement(
        [{ lotId: "lot-1", locationId: "sellable", quantity: 5 }],
        { lotId: "lot-1", fromLocationId: "sellable", toLocationId: "reserved", quantity: 10 },
      ),
    ).toThrow("Inventory movement would result in negative stock.");
  });

  it("throws when movement quantity is zero", () => {
    expect(() =>
      applyInventoryMovement(
        [{ lotId: "lot-1", locationId: "sellable", quantity: 10 }],
        { lotId: "lot-1", fromLocationId: "sellable", toLocationId: "reserved", quantity: 0 },
      ),
    ).toThrow("Inventory movement quantity must be positive.");
  });

  it("throws when movement quantity is negative", () => {
    expect(() =>
      applyInventoryMovement(
        [{ lotId: "lot-1", locationId: "sellable", quantity: 10 }],
        { lotId: "lot-1", fromLocationId: "sellable", quantity: -5 },
      ),
    ).toThrow("Inventory movement quantity must be positive.");
  });
});

describe("low stock detection", () => {
  it("flags variants at or below threshold", () => {
    const alerts = detectLowStock([
      { variantId: "sku-choc", name: "Chocolate Sachet", onHand: 8, threshold: 10 },
      { variantId: "sku-van", name: "Vanilla Sachet", onHand: 25, threshold: 10 },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.variantId).toBe("sku-choc");
  });

  it("flags variants exactly at the threshold", () => {
    const alerts = detectLowStock([
      { variantId: "sku-straw", name: "Strawberry Sachet", onHand: 10, threshold: 10 },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.variantId).toBe("sku-straw");
  });

  it("returns empty array when all variants are above threshold", () => {
    const alerts = detectLowStock([
      { variantId: "sku-choc", name: "Chocolate", onHand: 100, threshold: 10 },
      { variantId: "sku-van", name: "Vanilla", onHand: 50, threshold: 10 },
    ]);

    expect(alerts).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(detectLowStock([])).toHaveLength(0);
  });
});

describe("expiry detection", () => {
  const NOW = new Date("2026-04-18T00:00:00.000Z");

  it("classifies expiring lots within the window", () => {
    const items = detectUpcomingExpiry(
      [
        { lotId: "lot-soon", sku: "SKU-1", expiryDate: "2026-05-01T00:00:00.000Z" },
        { lotId: "lot-safe", sku: "SKU-2", expiryDate: "2026-07-01T00:00:00.000Z" },
      ],
      NOW,
      30,
    );

    expect(items.map((item) => item.lotId)).toContain("lot-soon");
    expect(items.map((item) => item.lotId)).not.toContain("lot-safe");
  });

  it("classifies already-expired lots as EXPIRED", () => {
    const items = detectUpcomingExpiry(
      [{ lotId: "lot-expired", sku: "SKU-OLD", expiryDate: "2026-01-01T00:00:00.000Z" }],
      NOW,
      30,
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("EXPIRED");
  });

  it("classifies lots expiring within the window as UPCOMING", () => {
    const items = detectUpcomingExpiry(
      [{ lotId: "lot-upcoming", sku: "SKU-U", expiryDate: "2026-05-10T00:00:00.000Z" }],
      NOW,
      30,
    );

    expect(items[0]!.status).toBe("UPCOMING");
  });

  it("excludes healthy lots from results", () => {
    const items = detectUpcomingExpiry(
      [{ lotId: "lot-healthy", sku: "SKU-H", expiryDate: "2026-12-31T00:00:00.000Z" }],
      NOW,
      30,
    );

    expect(items).toHaveLength(0);
  });

  it("uses the default 30-day window when daysAhead is omitted", () => {
    // Expiry is 20 days out — should be flagged with default 30-day window
    const items = detectUpcomingExpiry(
      [{ lotId: "lot-near", sku: "SKU-N", expiryDate: "2026-05-08T00:00:00.000Z" }],
      NOW,
    );

    expect(items).toHaveLength(1);
  });

  it("accepts Date objects as well as ISO strings", () => {
    const items = detectUpcomingExpiry(
      [{ lotId: "lot-date", sku: "SKU-D", expiryDate: new Date("2026-05-01T00:00:00.000Z") }],
      NOW,
      30,
    );

    expect(items).toHaveLength(1);
  });
});
