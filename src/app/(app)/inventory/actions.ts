"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/errors";
import { createOpeningInventoryLot } from "@/modules/inventory/server/inventory-opening.service";

export async function createOpeningInventoryLotAction(formData: FormData) {
  const user = await requireUser("inventory:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/inventory?lotCreated=1";

  try {
    await createOpeningInventoryLot(
      {
        productVariantId: String(formData.get("productVariantId") ?? ""),
        locationId: String(formData.get("locationId") ?? ""),
        lotCode: String(formData.get("lotCode") ?? ""),
        quantity: Number(formData.get("quantity") ?? 0),
        unitCost: Number(formData.get("unitCost") ?? 0),
        qcStatus: String(formData.get("qcStatus") ?? "RELEASED") as
          | "HOLD"
          | "RELEASED"
          | "QUARANTINED",
        manufactureDate: String(formData.get("manufactureDate") ?? ""),
        expiryDate: String(formData.get("expiryDate") ?? ""),
        receivedAt: String(formData.get("receivedAt") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      },
      user.id,
    );
  } catch (error) {
    redirectUrl = `/inventory?error=${encodeURIComponent(
      getActionErrorMessage(error, "Unable to load opening inventory."),
    )}`;
  }

  redirect(redirectUrl);
}
