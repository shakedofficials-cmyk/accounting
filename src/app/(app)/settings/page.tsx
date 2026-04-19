import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth/session";
import { getQueryValue } from "@/lib/utils";
import { getSettingsOverview } from "@/modules/settings/server/settings.service";
import { updateCompanyProfileAction, updateSettlementConfigAction } from "@/app/(app)/settings/actions";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await requireUser("settings:manage");

  const params = (await searchParams) ?? {};
  const { company, activeConfig, categories } = await getSettingsOverview();
  const includedIds = (activeConfig?.includedExpenseCategoryIds as string[]) ?? [];
  const error = getQueryValue(params.error);
  const companyUpdated = getQueryValue(params.companyUpdated) === "1";
  const settlementUpdated = getQueryValue(params.settlementUpdated) === "1";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Settings</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Company and settlement configuration</h1>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {companyUpdated ? <Notice variant="success">Company settings were updated and audited.</Notice> : null}
      {settlementUpdated ? <Notice variant="success">Settlement inclusion policy was versioned successfully.</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Company profile</CardTitle>
            <CardDescription>Core legal and operating defaults used across orders and settlement reporting.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCompanyProfileAction} className="space-y-4">
              <input type="hidden" name="baseCurrency" value="USD" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal entity</Label>
                  <Input id="legalName" name="legalName" defaultValue={company?.legalName ?? ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input id="brandName" name="brandName" defaultValue={company?.brandName ?? ""} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" defaultValue={company?.country ?? "Lebanon"} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" name="timezone" defaultValue={company?.timezone ?? "Asia/Beirut"} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="baseCurrency">Base currency</Label>
                  <Input id="baseCurrency" value={company?.baseCurrency ?? "USD"} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultCourierFee">Default courier fee</Label>
                  <Input
                    id="defaultCourierFee"
                    name="defaultCourierFee"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={Number(company?.defaultCourierFee ?? 4)}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">VAT rate</p>
                <p className="mt-2 text-lg font-semibold">{Number(company?.vatRate ?? 0) * 100}%</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settlementNotes">Default settlement notes</Label>
                <Textarea
                  id="settlementNotes"
                  name="settlementNotes"
                  defaultValue={company?.settlementNotes ?? ""}
                  placeholder="Partner agreement reminders, payment timing, or statement footer notes."
                />
              </div>
              <Button type="submit">Save company settings</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settlement inclusion policy</CardTitle>
            <CardDescription>Change which opex categories are included in profit sharing without editing code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSettlementConfigAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="partnerSharePercent">Factory share percent</Label>
                <Input
                  id="partnerSharePercent"
                  name="partnerSharePercent"
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  defaultValue={Number(activeConfig?.partnerSharePercent ?? 0.6)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                    <input
                      type="checkbox"
                      name="includedExpenseCategoryIds"
                      value={category.id}
                      defaultChecked={includedIds.includes(category.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">{category.code}</p>
                    </div>
                  </label>
                ))}
              </div>
              <Button type="submit">Save settlement config</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
