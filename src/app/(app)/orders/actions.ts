"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/errors";
import { createManualOrder } from "@/modules/orders/server/orders.service";
import { syncRecentShopifyOrders } from "@/modules/orders/server/shopify-sync.service";

export async function createManualOrderAction(formData: FormData) {
  const user = await requireUser("orders:manage");

  let redirectUrl: Parameters<typeof redirect>[0] = "/orders?created=1";

  try {
    await createManualOrder(
      {
        customerName: String(formData.get("customerName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        city: String(formData.get("city") ?? ""),
        sourceTag: String(formData.get("sourceTag") ?? ""),
        productVariantId: String(formData.get("productVariantId") ?? ""),
        bundleQuantity: Number(formData.get("bundleQuantity") ?? 1),
        deliveryCost: Number(formData.get("deliveryCost") ?? 0),
        paymentFee: Number(formData.get("paymentFee") ?? 0),
        paymentMethodCode: String(formData.get("paymentMethodCode") ?? "CASH") as "CASH" | "WHISH" | "CARD",
        markAsPaid: formData.get("markAsPaid") === "on",
        notes: String(formData.get("notes") ?? ""),
        flavorMix: {
          chocolate: Number(formData.get("flavorChocolate") ?? 0),
          strawberry: Number(formData.get("flavorStrawberry") ?? 0),
          vanilla: Number(formData.get("flavorVanilla") ?? 0),
          coffee: Number(formData.get("flavorCoffee") ?? 0),
        },
      },
      user.id,
    );
  } catch (error) {
    redirectUrl = `/orders?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to create order."))}`;
  }

  redirect(redirectUrl);
}

export async function syncShopifyOrdersAction(formData: FormData) {
  const user = await requireUser("orders:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/orders?shopifySync=1";

  try {
    const result = await syncRecentShopifyOrders({
      actorId: user.id,
      daysBack: Number(formData.get("daysBack") ?? 60),
      limit: Number(formData.get("limit") ?? 100),
    });

    redirectUrl = `/orders?shopifySync=1&shopifyImported=${result.imported}&shopifySkipped=${result.skipped}`;
  } catch (error) {
    redirectUrl = `/orders?error=${encodeURIComponent(
      getActionErrorMessage(error, "Unable to sync Shopify orders."),
    )}`;
  }

  redirect(redirectUrl);
}
