import { money, percent, type DecimalLike } from "@/lib/money";

export type SettlementMathInput = {
  revenue: DecimalLike;
  discounts: DecimalLike;
  refunds: DecimalLike;
  cogs: DecimalLike;
  deliveryCosts: DecimalLike;
  paymentFees: DecimalLike;
  includedOpex: DecimalLike;
  adjustments?: DecimalLike;
  factorySharePercent: DecimalLike;
};

export function calculateSettlement(input: SettlementMathInput) {
  const revenue = money(input.revenue);
  const discounts = money(input.discounts);
  const refunds = money(input.refunds);
  const cogs = money(input.cogs);
  const deliveryCosts = money(input.deliveryCosts);
  const paymentFees = money(input.paymentFees);
  const includedOpex = money(input.includedOpex);
  const adjustments = money(input.adjustments ?? 0);
  const factorySharePercent = percent(input.factorySharePercent);
  const originsSharePercent = percent(1).minus(factorySharePercent);

  const netSales = revenue.minus(discounts).minus(refunds);
  const netProfit = netSales
    .minus(cogs)
    .minus(deliveryCosts)
    .minus(paymentFees)
    .minus(includedOpex)
    .plus(adjustments);
  const factoryShare = money(netProfit.mul(factorySharePercent));
  const originsShare = money(netProfit.mul(originsSharePercent));

  return {
    revenue,
    discounts,
    refunds,
    netSales: money(netSales),
    cogs,
    deliveryCosts,
    paymentFees,
    includedOpex,
    adjustments,
    netProfit: money(netProfit),
    factoryShare,
    originsShare,
  };
}

export function nextSettlementVersion(existingVersions: number[]) {
  if (existingVersions.length === 0) {
    return 1;
  }

  return Math.max(...existingVersions) + 1;
}
