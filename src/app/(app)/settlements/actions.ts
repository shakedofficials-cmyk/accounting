"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/errors";
import { rerunSettlement } from "@/modules/settlements/server/settlements.service";

export async function rerunSettlementAction(formData: FormData) {
  const user = await requireUser("settlements:manage");
  const periodKey = String(formData.get("periodKey") ?? "");
  let redirectUrl: Parameters<typeof redirect>[0] = "/settlements?rerun=1";

  try {
    await rerunSettlement(periodKey, user.id);
  } catch (error) {
    redirectUrl = `/settlements?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to rerun settlement."))}`;
  }

  redirect(redirectUrl);
}
