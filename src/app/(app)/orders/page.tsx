import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, getQueryValue } from "@/lib/utils";
import { getOrdersOverview } from "@/modules/orders/server/orders.service";
import { createManualOrderAction } from "@/app/(app)/orders/actions";
import { OrdersTable } from "@/app/(app)/orders/orders-table";

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireUser("orders:view");
  const params = (await searchParams) ?? {};
  const { orders, bundleVariants, paymentMethods } = await getOrdersOverview();
  const created = getQueryValue(params.created) === "1";
  const error = getQueryValue(params.error);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Orders</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Manual order console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create direct orders with real stock deduction, payment handling, and journal postings.
        </p>
      </div>

      {error ? <Notice variant="error">{error}</Notice> : null}
      {created ? <Notice variant="success">Manual order posted successfully.</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create manual order</CardTitle>
            <CardDescription>
              Discovery packs can ignore flavor quantities. Training, monthly, and custom orders should specify a flavor mix.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createManualOrderAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer name</Label>
                  <Input id="customerName" name="customerName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceTag">Source tag</Label>
                  <Input id="sourceTag" name="sourceTag" placeholder="WhatsApp / Instagram / Direct" defaultValue="WhatsApp" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="productVariantId">Product</Label>
                  <select
                    id="productVariantId"
                    name="productVariantId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={bundleVariants[0]?.id}
                  >
                    {bundleVariants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundleQuantity">Bundle quantity</Label>
                  <Input id="bundleQuantity" name="bundleQuantity" type="number" min={1} defaultValue={1} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="flavorChocolate">Chocolate</Label>
                  <Input id="flavorChocolate" name="flavorChocolate" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flavorStrawberry">Strawberry</Label>
                  <Input id="flavorStrawberry" name="flavorStrawberry" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flavorVanilla">Vanilla</Label>
                  <Input id="flavorVanilla" name="flavorVanilla" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flavorCoffee">Coffee</Label>
                  <Input id="flavorCoffee" name="flavorCoffee" type="number" min={0} defaultValue={0} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="deliveryCost">Delivery cost</Label>
                  <Input id="deliveryCost" name="deliveryCost" type="number" min={0} step="0.01" defaultValue={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentFee">Payment fee</Label>
                  <Input id="paymentFee" name="paymentFee" type="number" min={0} step="0.01" defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethodCode">Payment method</Label>
                  <select
                    id="paymentMethodCode"
                    name="paymentMethodCode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={paymentMethods[0]?.code}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.code}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
                <input id="markAsPaid" name="markAsPaid" type="checkbox" className="h-4 w-4 rounded border-border" />
                <Label htmlFor="markAsPaid">Mark order as paid now</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Courier notes, COD details, or source context." />
              </div>
              <Button type="submit">Create and post order</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Read-only order feed from both manual and Shopify channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="mt-2 text-2xl font-semibold">{orders.length}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Paid revenue</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatMoney(
                    orders
                      .filter((order) => order.paymentState === "PAID")
                      .reduce((sum, order) => sum + Number(order.subtotal), 0),
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Pending collection</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatMoney(
                    orders
                      .filter((order) => order.paymentState !== "PAID")
                      .reduce((sum, order) => sum + Number(order.netTotal), 0),
                  )}
                </p>
              </div>
            </div>
            <OrdersTable
              data={orders.map((order) => ({
                orderNumber: order.orderNumber,
                customer: order.customer?.name ?? "Guest",
                source: order.salesChannel.name,
                status: order.status,
                paymentState: order.paymentState,
                subtotal: Number(order.subtotal),
                orderDate: order.orderDate.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
