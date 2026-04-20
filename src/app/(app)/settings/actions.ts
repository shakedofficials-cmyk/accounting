"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/errors";
import { clearOperationalData } from "@/modules/settings/server/operational-reset.service";
import { replaceSettlementConfig, updateCompanyProfile } from "@/modules/settings/server/settings.service";

const companySettingsSchema = z.object({
  legalName: z.string().min(2, "Legal name is required."),
  brandName: z.string().min(2, "Brand name is required."),
  baseCurrency: z.literal("USD"),
  country: z.string().min(2, "Country is required."),
  timezone: z.string().min(2, "Timezone is required."),
  defaultCourierFee: z.coerce.number().min(0, "Default courier fee must be zero or greater."),
  settlementNotes: z.string().max(2000, "Settlement notes are too long.").optional(),
});

const settlementConfigSchema = z.object({
  partnerSharePercent: z.coerce
    .number()
    .min(0, "Factory share must be at least 0.")
    .max(1, "Factory share must be 1 or less."),
  includedExpenseCategoryIds: z.array(z.string()),
});

const operationalResetSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === "RESET LIVE DATA", {
      message: 'Type "RESET LIVE DATA" to confirm.',
    }),
});

export async function updateCompanyProfileAction(formData: FormData) {
  const user = await requireUser("settings:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/settings?companyUpdated=1";

  try {
    const payload = companySettingsSchema.parse({
      legalName: String(formData.get("legalName") ?? ""),
      brandName: String(formData.get("brandName") ?? ""),
      baseCurrency: String(formData.get("baseCurrency") ?? "USD"),
      country: String(formData.get("country") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      defaultCourierFee: Number(formData.get("defaultCourierFee") ?? 0),
      settlementNotes: String(formData.get("settlementNotes") ?? ""),
    });

    await updateCompanyProfile({
      actorId: user.id,
      ...payload,
      settlementNotes: payload.settlementNotes?.trim() || undefined,
    });
  } catch (error) {
    redirectUrl = `/settings?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to update company settings."))}`;
  }

  redirect(redirectUrl);
}

export async function updateSettlementConfigAction(formData: FormData) {
  const user = await requireUser("settings:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/settings?settlementUpdated=1";

  try {
    const payload = settlementConfigSchema.parse({
      partnerSharePercent: Number(formData.get("partnerSharePercent") ?? 0.6),
      includedExpenseCategoryIds: formData.getAll("includedExpenseCategoryIds").map(String),
    });

    await replaceSettlementConfig({
      createdById: user.id,
      partnerSharePercent: payload.partnerSharePercent,
      includedExpenseCategoryIds: payload.includedExpenseCategoryIds,
    });
  } catch (error) {
    redirectUrl = `/settings?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to save settlement configuration."))}`;
  }

  redirect(redirectUrl);
}

export async function clearOperationalDataAction(formData: FormData) {
  const user = await requireUser("settings:manage");
  let redirectUrl: Parameters<typeof redirect>[0] = "/settings?operationalReset=1";

  try {
    operationalResetSchema.parse({
      confirmation: String(formData.get("confirmation") ?? ""),
    });

    await clearOperationalData(user.id);
  } catch (error) {
    redirectUrl = `/settings?error=${encodeURIComponent(
      getActionErrorMessage(error, "Unable to clear operational data."),
    )}`;
  }

  redirect(redirectUrl);
}
