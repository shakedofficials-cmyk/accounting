import Decimal from "decimal.js";

export type DecimalLike = Decimal.Value;

export const decimal = (value: DecimalLike) => new Decimal(value);

export const quantity = (value: DecimalLike) =>
  decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const quantity4 = (value: DecimalLike) =>
  decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

export const money = (value: DecimalLike) =>
  decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const percent = (value: DecimalLike) =>
  decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

export const sumMoney = (values: DecimalLike[]) =>
  values
    .reduce<Decimal>((total, value) => total.plus(value), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sumQuantity = (values: DecimalLike[]) =>
  values
    .reduce<Decimal>((total, value) => total.plus(value), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const isZero = (value: DecimalLike) => decimal(value).eq(0);
