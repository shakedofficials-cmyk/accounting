import { db } from "@/lib/db";

export async function getCatalogOverview() {
  const [products, bundleDefinitions, boms, flavors] = await Promise.all([
    db.product.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        variants: {
          include: {
            flavor: true,
          },
        },
      },
    }),
    db.bundleDefinition.findMany({
      include: {
        variant: true,
        lines: {
          include: {
            flavor: true,
            componentVariant: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.billOfMaterial.findMany({
      include: {
        productVariant: true,
        lines: {
          include: {
            componentVariant: true,
          },
        },
      },
    }),
    db.flavor.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    products,
    bundleDefinitions,
    boms,
    flavors,
  };
}
