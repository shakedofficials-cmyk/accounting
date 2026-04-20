import { subDays } from "date-fns";

import { shopifyAdminRequest, type ShopifyOrderPayload } from "@/lib/shopify-client";
import { importShopifyOrder } from "@/modules/orders/server/shopify-order.service";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;

export async function syncRecentShopifyOrders(input: {
  actorId: string;
  daysBack?: number;
  limit?: number;
}) {
  const daysBack = Math.max(1, Math.min(input.daysBack ?? 60, 365));
  const limit = Math.max(1, Math.min(input.limit ?? 100, 1_000));
  const createdAfter = subDays(new Date(), daysBack).toISOString();

  let nextPageInfo: string | null = null;
  let remaining = limit;
  let imported = 0;
  let skipped = 0;

  while (remaining > 0) {
    const pageSize = Math.min(remaining, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const path = nextPageInfo
      ? `orders.json?limit=${pageSize}&status=any&financial_status=paid&page_info=${encodeURIComponent(nextPageInfo)}`
      : `orders.json?limit=${pageSize}&status=any&financial_status=paid&created_at_min=${encodeURIComponent(createdAfter)}&order=created_at asc`;

    const response = await shopifyAdminRequest(path, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Shopify order sync failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { orders: ShopifyOrderPayload[] };

    for (const order of data.orders) {
      if (remaining <= 0) {
        break;
      }

      const result = await importShopifyOrder(order, input.actorId);
      if (result.status === "imported") {
        imported += 1;
      } else {
        skipped += 1;
      }

      remaining -= 1;
    }

    nextPageInfo = parseNextPageInfo(response.headers.get("link"));
    if (!nextPageInfo || data.orders.length === 0) {
      break;
    }
  }

  return {
    imported,
    skipped,
    daysBack,
    limit,
  };
}

function parseNextPageInfo(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));

  if (!nextLink) {
    return null;
  }

  const match = nextLink.match(/[?&]page_info=([^>&]+)/);
  return match?.[1] ?? null;
}
