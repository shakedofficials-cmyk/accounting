import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));

export const formatNumber = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value));

export const formatShortDate = (value: Date | string) =>
  format(typeof value === "string" ? new Date(value) : value, "dd MMM yyyy");

export const formatDateTime = (value: Date | string) =>
  format(typeof value === "string" ? new Date(value) : value, "dd MMM yyyy HH:mm");

export const getQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
