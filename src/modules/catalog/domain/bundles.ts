import { z } from "zod";

import { decimal, quantity, sumQuantity, type DecimalLike } from "@/lib/money";

export const bundleLineSchema = z.object({
  componentVariantId: z.string(),
  quantity: z.union([z.number(), z.string()]),
  flavorId: z.string().nullable().optional(),
  isFlexible: z.boolean().default(false),
});

export const bundleDefinitionSchema = z.object({
  bundleVariantId: z.string(),
  type: z.enum(["DISCOVERY_PACK", "TRAINING_BOX", "MONTHLY_BUNDLE", "CUSTOM_SACHET"]),
  minimumUnits: z.union([z.number(), z.string()]).optional(),
  fixedPrice: z.union([z.number(), z.string()]).optional(),
  allowFlavorMix: z.boolean().default(false),
  lines: z.array(bundleLineSchema),
});

export type BundleDefinition = z.infer<typeof bundleDefinitionSchema>;

export type DecomposedBundleLine = {
  componentVariantId: string;
  quantity: ReturnType<typeof quantity>;
  flavorId?: string | null;
};

export type FlavorMixEntry = {
  flavorId: string;
  quantity: DecimalLike;
};

export function decomposeBundle(
  definitionInput: BundleDefinition,
  requestedQuantity: DecimalLike,
  mixEntries: FlavorMixEntry[] = [],
): DecomposedBundleLine[] {
  const definition = bundleDefinitionSchema.parse(definitionInput);
  const bundleQty = quantity(requestedQuantity);

  if (bundleQty.lte(0)) {
    throw new Error("Bundle quantity must be positive.");
  }

  if (definition.allowFlavorMix) {
    return decomposeCustomMix(definition, mixEntries, bundleQty);
  }

  return definition.lines.map((line) => ({
    componentVariantId: line.componentVariantId,
    quantity: quantity(decimal(line.quantity).mul(bundleQty)),
    flavorId: line.flavorId,
  }));
}

function decomposeCustomMix(
  definition: BundleDefinition,
  mixEntries: FlavorMixEntry[],
  bundleQty: ReturnType<typeof quantity>,
) {
  if (mixEntries.length === 0) {
    throw new Error("Custom sachet orders require a flavor mix.");
  }

  const minimumUnits = definition.minimumUnits ? quantity(definition.minimumUnits) : quantity(4);
  const totalUnits = sumQuantity(mixEntries.map((entry) => entry.quantity));

  if (totalUnits.lt(minimumUnits.mul(bundleQty))) {
    throw new Error(`Custom sachet orders require at least ${minimumUnits.toFixed(0)} sachets per bundle.`);
  }

  return mixEntries.map((entry) => {
    const template = definition.lines.find((line) => line.flavorId === entry.flavorId);

    if (!template) {
      throw new Error(`Flavor ${entry.flavorId} is not allowed in this bundle.`);
    }

    return {
      componentVariantId: template.componentVariantId,
      quantity: quantity(entry.quantity),
      flavorId: entry.flavorId,
    };
  });
}
