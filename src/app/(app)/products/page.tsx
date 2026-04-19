import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getCatalogOverview } from "@/modules/catalog/server/catalog.service";

export default async function ProductsPage() {
  await requireUser("inventory:view");
  const { products, bundleDefinitions, boms, flavors } = await getCatalogOverview();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Products</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Flavors, bundles, and BOM structure</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {flavors.map((flavor) => (
          <Card key={flavor.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: flavor.colorHex }} />
                <p className="font-medium">{flavor.name}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Code {flavor.code}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>Product families and their sellable variants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.code}</p>
                  </div>
                  <Badge>{product.type}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <Badge key={variant.id} variant="success">
                      {variant.sku}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bundle logic</CardTitle>
            <CardDescription>Commercial bundles decomposed into finished sachet inventory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bundleDefinitions.map((bundle) => (
              <div key={bundle.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{bundle.variant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {bundle.allowFlavorMix ? "Flexible flavor mix" : "Fixed composition"}
                    </p>
                  </div>
                  <Badge>{bundle.type}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bundle.lines.map((line) => (
                    <Badge key={line.id}>
                      {line.flavor?.name ?? line.componentVariant?.name}: {Number(line.quantity)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bills of materials</CardTitle>
          <CardDescription>Flavor-specific production recipes and overhead structure.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {boms.map((bom) => (
            <div key={bom.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{bom.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {bom.code} · batch size {Number(bom.batchSize)}
                  </p>
                </div>
                <Badge>{bom.productVariant.name}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {bom.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <span>{line.componentVariant?.name ?? line.description}</span>
                    <span className="text-muted-foreground">{Number(line.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
