import { db } from "@/lib/db";

export async function getProductionOverview() {
  const runs = await db.productionRun.findMany({
    orderBy: { runDate: "desc" },
    include: {
      bom: {
        include: {
          productVariant: true,
        },
      },
      outputs: {
        include: {
          lot: true,
        },
      },
      consumptions: {
        include: {
          productVariant: true,
        },
      },
    },
  });

  return {
    runs,
  };
}
