import { z } from "zod";

import { quantity, sumQuantity, type DecimalLike } from "@/lib/money";

export const customFlavorMixSchema = z.object({
  minimumSachets: z.union([z.number(), z.string()]).default(4),
  flavors: z
    .array(
      z.object({
        flavorId: z.string(),
        flavorName: z.string(),
        variantId: z.string(),
        quantity: z.union([z.number(), z.string()]),
      }),
    )
    .min(1),
});

export type CustomFlavorMixInput = z.infer<typeof customFlavorMixSchema>;

export function buildCustomFlavorMixConsumption(input: CustomFlavorMixInput) {
  const payload = customFlavorMixSchema.parse(input);
  const minimumSachets = quantity(payload.minimumSachets);
  const totalUnits = sumQuantity(payload.flavors.map((flavor) => flavor.quantity));

  if (totalUnits.lt(minimumSachets)) {
    throw new Error(`Custom flavor orders must contain at least ${minimumSachets.toFixed(0)} sachets.`);
  }

  return payload.flavors.map((flavor) => ({
    flavorId: flavor.flavorId,
    flavorName: flavor.flavorName,
    variantId: flavor.variantId,
    quantity: quantity(flavor.quantity),
  }));
}

export function calculateCustomOrderPrice(totalSachets: DecimalLike, pricePerSachet: DecimalLike) {
  return quantity(totalSachets).mul(pricePerSachet).toDecimalPlaces(2);
}
