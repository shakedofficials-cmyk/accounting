import { db } from "@/lib/db";

export async function getProductionOverview() {
  const [runs, boms, locations] = await Promise.all([
    db.productionRun.findMany({
      orderBy: { runDate: "desc" },
      include: {
        bom: { include: { productVariant: true } },
        outputs: { include: { lot: true } },
        consumptions: { include: { productVariant: true } },
      },
    }),
    db.billOfMaterial.findMany({
      where: { status: "ACTIVE" },
      include: { productVariant: true },
      orderBy: { code: "asc" },
    }),
    db.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return { runs, boms, locations };
}
