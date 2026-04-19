import { money, quantity, type DecimalLike } from "@/lib/money";

export type BatchCostLine = {
  description: string;
  quantity: DecimalLike;
  unitCost: DecimalLike;
};

export function calculateBatchCost(consumptions: BatchCostLine[], actualOutputQty: DecimalLike) {
  const totalCost = consumptions.reduce(
    (sum, line) => sum.plus(quantity(line.quantity).mul(line.unitCost)),
    money(0),
  );
  const outputQty = quantity(actualOutputQty);

  if (outputQty.lte(0)) {
    throw new Error("Actual production quantity must be greater than zero.");
  }

  return {
    totalCost: money(totalCost),
    unitCost: money(totalCost.div(outputQty)),
  };
}
