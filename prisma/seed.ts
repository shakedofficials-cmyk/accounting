import { addDays, endOfMonth, startOfMonth } from "date-fns";
import { hash } from "bcryptjs";
import {
  Prisma,
  PrismaClient,
  type ExpenseCategoryType,
  type JournalSourceType,
  type LedgerAccountType,
  type LocationType,
  type PaymentMethodCode,
  type SalesChannelType,
  type VariantType,
} from "@prisma/client";

import { assertJournalBalanced } from "../src/modules/accounting/domain/journal";
import { calculateBatchCost } from "../src/modules/production/domain/batch-costing";
import { calculateSettlement } from "../src/modules/settlements/domain/settlement-engine";

const prisma = new PrismaClient();

const dec = (value: number | string) => new Prisma.Decimal(value);

type JournalSeedLine = Parameters<typeof assertJournalBalanced>[0][number];

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "FileReference",
      "AuditLog",
      "ReportSnapshot",
      "SettlementLine",
      "SettlementPeriod",
      "SettlementConfig",
      "JournalEntryLine",
      "JournalEntry",
      "FiscalPeriod",
      "VendorBillLine",
      "Payment",
      "VendorBill",
      "ExpenseCategory",
      "PaymentMethod",
      "ShopifyOrderLine",
      "ShopifyOrder",
      "ManualOrder",
      "Fulfillment",
      "OrderLine",
      "SalesOrder",
      "SalesChannel",
      "Partner",
      "Customer",
      "ExpiryRecord",
      "ProductionRunConsumption",
      "ProductionRunOutput",
      "InventoryMovement",
      "InventoryBalance",
      "InventoryLot",
      "ProductionRun",
      "BillOfMaterialLine",
      "BillOfMaterial",
      "BundleDefinitionLine",
      "BundleDefinition",
      "ProductVariant",
      "Product",
      "Flavor",
      "Location",
      "Warehouse",
      "Company",
      "LedgerAccount",
      "Session",
      "RolePermission",
      "Permission",
      "Role",
      "User",
      "Vendor"
    RESTART IDENTITY CASCADE;
  `);

  const sessionPassword = process.env.DEFAULT_USER_PASSWORD ?? "ChangeMe123!";
  const founderHash = await hash(sessionPassword, 12);
  const operatorHash = await hash(sessionPassword, 12);

  const permissions = await Promise.all(
    [
      { key: "dashboard:view", label: "View dashboard" },
      { key: "orders:view", label: "View orders" },
      { key: "orders:manage", label: "Manage orders" },
      { key: "inventory:view", label: "View inventory" },
      { key: "inventory:manage", label: "Manage inventory" },
      { key: "production:view", label: "View production" },
      { key: "production:manage", label: "Manage production" },
      { key: "expenses:view", label: "View expenses" },
      { key: "expenses:manage", label: "Manage expenses" },
      { key: "accounting:view", label: "View accounting" },
      { key: "accounting:manage", label: "Manage accounting" },
      { key: "settlements:view", label: "View settlements" },
      { key: "settlements:manage", label: "Manage settlements" },
      { key: "reports:view", label: "View reports" },
      { key: "settings:manage", label: "Manage settings" },
      { key: "audit:view", label: "View audit log" },
    ].map((permission) => prisma.permission.create({ data: permission })),
  );
  const permissionByKey = Object.fromEntries(permissions.map((permission) => [permission.key, permission]));

  const founderRole = await prisma.role.create({
    data: {
      name: "founder_admin",
      description: "Full founder access to finance and operations.",
      permissions: {
        create: permissions.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
  });

  const operatorPermissionKeys = [
    "dashboard:view",
    "orders:view",
    "orders:manage",
    "inventory:view",
    "inventory:manage",
    "production:view",
    "production:manage",
    "expenses:view",
    "expenses:manage",
    "accounting:view",
    "settlements:view",
    "reports:view",
    "audit:view",
  ];

  const operatorRole = await prisma.role.create({
    data: {
      name: "cofounder_operator",
      description: "Day-to-day operations with read-only finance oversight.",
      permissions: {
        create: operatorPermissionKeys.map((key) => ({
          permissionId: permissionByKey[key].id,
        })),
      },
    },
  });

  const founder = await prisma.user.create({
    data: {
      email: process.env.DEFAULT_ADMIN_EMAIL ?? "shaked.officials@gmail.com",
      name: "SHAKED Founder",
      passwordHash: founderHash,
      roleId: founderRole.id,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: process.env.DEFAULT_OPERATOR_EMAIL ?? "ops@shaked.lb",
      name: "SHAKED Operator",
      passwordHash: operatorHash,
      roleId: operatorRole.id,
    },
  });

  await prisma.company.create({
    data: {
      legalName: "Origins s.a.r.l.",
      brandName: "SHAKED",
      baseCurrency: "USD",
      vatRate: dec(0.11),
      country: "Lebanon",
      timezone: "Asia/Beirut",
      defaultCourierFee: dec(4),
      settlementNotes: "UBSA receives 60% of net profit per settlement agreement.",
    },
  });

  const accounts = await Promise.all(
    [
      ["1110", "Cash on Hand", "ASSET"],
      ["1120", "Bank USD", "ASSET"],
      ["1130", "Whish Clearing", "ASSET"],
      ["1140", "Card Clearing", "ASSET"],
      ["1150", "Accounts Receivable", "ASSET"],
      ["1210", "Inventory Raw Materials", "ASSET"],
      ["1220", "Inventory Packaging", "ASSET"],
      ["1230", "Inventory Finished Goods", "ASSET"],
      ["1240", "VAT Receivable", "ASSET"],
      ["1250", "Prepaid Expenses", "ASSET"],
      ["2110", "Accounts Payable", "LIABILITY"],
      ["2120", "VAT Payable", "LIABILITY"],
      ["2130", "Accrued Courier Fees", "LIABILITY"],
      ["2140", "Factory Profit Share Payable", "LIABILITY"],
      ["3100", "Share Capital", "EQUITY"],
      ["3200", "Retained Earnings", "EQUITY"],
      ["4100", "Shopify Sales", "REVENUE"],
      ["4110", "Manual Sales", "REVENUE"],
      ["4120", "Wholesale Sales", "REVENUE"],
      ["4190", "Discounts", "CONTRA_REVENUE"],
      ["4195", "Refunds", "CONTRA_REVENUE"],
      ["5100", "Product COGS", "COGS"],
      ["5110", "Delivery Expense", "COGS"],
      ["5120", "Payment Processing Fees", "COGS"],
      ["5130", "Inventory Write-offs", "COGS"],
      ["5140", "Damaged Stock Expense", "COGS"],
      ["5150", "Expired Stock Expense", "COGS"],
      ["6100", "Marketing Expense", "EXPENSE"],
      ["6110", "Software Expense", "EXPENSE"],
      ["6120", "Salaries", "EXPENSE"],
      ["6130", "Professional Fees", "EXPENSE"],
      ["6140", "Admin Expense", "EXPENSE"],
      ["6150", "Misc Operating Expenses", "EXPENSE"],
    ].map(([code, name, type]) =>
      prisma.ledgerAccount.create({
        data: {
          code,
          name,
          type: type as LedgerAccountType,
        },
      }),
    ),
  );
  const accountByCode = Object.fromEntries(accounts.map((account) => [account.code, account]));

  const paymentMethods = await Promise.all(
    [
      { code: "CASH", name: "Cash", clearingAccountId: accountByCode["1110"].id },
      { code: "WHISH", name: "Whish", clearingAccountId: accountByCode["1130"].id },
      { code: "CARD", name: "Card", clearingAccountId: accountByCode["1140"].id },
    ].map((method) =>
      prisma.paymentMethod.create({
        data: {
          code: method.code as PaymentMethodCode,
          name: method.name,
          clearingAccountId: method.clearingAccountId,
        },
      }),
    ),
  );
  const paymentMethodByCode = Object.fromEntries(paymentMethods.map((method) => [method.code, method]));

  const expenseCategories = await Promise.all(
    [
      {
        code: "DELIVERY",
        name: "Direct Delivery",
        type: "DIRECT_DELIVERY",
        defaultAccountId: accountByCode["5110"].id,
        includedInSettlement: false,
      },
      {
        code: "PAYMENT_FEES",
        name: "Payment Processing Fees",
        type: "PAYMENT_FEE",
        defaultAccountId: accountByCode["5120"].id,
        includedInSettlement: false,
      },
      {
        code: "MARKETING",
        name: "Marketing",
        type: "MARKETING",
        defaultAccountId: accountByCode["6100"].id,
        includedInSettlement: false,
      },
      {
        code: "SOFTWARE",
        name: "Software",
        type: "SOFTWARE",
        defaultAccountId: accountByCode["6110"].id,
        includedInSettlement: true,
      },
      {
        code: "SALARIES",
        name: "Salaries",
        type: "SALARIES",
        defaultAccountId: accountByCode["6120"].id,
        includedInSettlement: true,
      },
      {
        code: "PROFESSIONAL",
        name: "Professional Fees",
        type: "PROFESSIONAL_FEES",
        defaultAccountId: accountByCode["6130"].id,
        includedInSettlement: true,
      },
      {
        code: "ADMIN",
        name: "Admin Expense",
        type: "ADMIN",
        defaultAccountId: accountByCode["6140"].id,
        includedInSettlement: true,
      },
      {
        code: "MISC",
        name: "Misc Operating Expense",
        type: "MISC",
        defaultAccountId: accountByCode["6150"].id,
        includedInSettlement: true,
      },
    ].map((category) =>
      prisma.expenseCategory.create({
        data: {
          code: category.code,
          name: category.name,
          type: category.type as ExpenseCategoryType,
          defaultAccountId: category.defaultAccountId,
          includedInSettlement: category.includedInSettlement,
        },
      }),
    ),
  );
  const categoryByCode = Object.fromEntries(expenseCategories.map((category) => [category.code, category]));

  const warehouse = await prisma.warehouse.create({
    data: {
      code: "LB-MAIN",
      name: "Lebanon Operations",
    },
  });

  const locations = await Promise.all(
    [
      { code: "FACTORY-RAW", name: "Factory Raw Materials", type: "FACTORY_RAW", isSellable: false, isReserved: false, isDamaged: false, isQuarantine: false },
      { code: "FACTORY-FG", name: "Factory Finished Goods", type: "FACTORY_FINISHED", isSellable: false, isReserved: false, isDamaged: false, isQuarantine: false },
      { code: "SELLABLE", name: "Origins Sellable Stock", type: "ORIGINS_SELLABLE", isSellable: true, isReserved: false, isDamaged: false, isQuarantine: false },
      { code: "RESERVED", name: "Reserved", type: "RESERVED", isSellable: false, isReserved: true, isDamaged: false, isQuarantine: false },
      { code: "DAMAGED", name: "Damaged", type: "DAMAGED", isSellable: false, isReserved: false, isDamaged: true, isQuarantine: false },
      { code: "QUARANTINE", name: "Expired / Quarantine", type: "QUARANTINE", isSellable: false, isReserved: false, isDamaged: false, isQuarantine: true },
      { code: "SAMPLES", name: "Samples", type: "SAMPLES", isSellable: false, isReserved: false, isDamaged: false, isQuarantine: false },
      { code: "RETURNS", name: "Returns Inspection", type: "RETURNS_INSPECTION", isSellable: false, isReserved: false, isDamaged: false, isQuarantine: false },
    ].map((location) =>
      prisma.location.create({
        data: {
          warehouseId: warehouse.id,
          code: location.code,
          name: location.name,
          type: location.type as LocationType,
          isSellable: location.isSellable,
          isReserved: location.isReserved,
          isDamaged: location.isDamaged,
          isQuarantine: location.isQuarantine,
        },
      }),
    ),
  );
  const locationByCode = Object.fromEntries(locations.map((location) => [location.code, location]));

  const flavors = await Promise.all(
    [
      ["Chocolate", "CHOC", "#6F4E37"],
      ["Strawberry", "STRAW", "#D94668"],
      ["Vanilla", "VAN", "#D6B97B"],
      ["Coffee", "COFF", "#4A3326"],
    ].map(([name, code, colorHex]) =>
      prisma.flavor.create({
        data: { name, code, colorHex },
      }),
    ),
  );
  const flavorByCode = Object.fromEntries(flavors.map((flavor) => [flavor.code, flavor]));

  const rawProductDefs = [
    // Costs sourced from UBSA supplier invoices: protein $45/62 units, milk $5/66, creatine $25/200
    ["RM-PROTEIN", "Protein Base", 0.7258, 120, "Inventory Raw Materials"],
    ["RM-CREATINE", "Creatine Base", 0.125, 50, "Inventory Raw Materials"],
    ["RM-MILK", "Milk Powder", 0.0758, 40, "Inventory Raw Materials"],
    ["RM-COCOA", "Cocoa Flavor", 18, 20, "Inventory Raw Materials"],
    ["RM-STRAWBERRY", "Strawberry Flavor", 18, 20, "Inventory Raw Materials"],
    ["RM-VANILLA", "Vanilla Flavor", 16, 20, "Inventory Raw Materials"],
    ["RM-COFFEE", "Coffee Flavor", 22, 20, "Inventory Raw Materials"],
  ] as const;
  const packagingDefs = [
    ["PK-SACHET", "Sachet Film", 0.08, 400],
    ["PK-CARTON", "Carton Sleeve", 0.45, 100],
  ] as const;

  const rawProducts = [];
  for (const [code, name, defaultUnitCost, lowStockThreshold] of rawProductDefs) {
    const product = await prisma.product.create({
      data: {
        code,
        name,
        type: "RAW_MATERIAL",
        vatRate: dec(0.11),
        defaultUnitCost: dec(defaultUnitCost),
        lowStockThreshold: dec(lowStockThreshold),
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `${code}-STD`,
        name,
        variantType: "RAW_MATERIAL",
        defaultPrice: null,
        lowStockThreshold: dec(lowStockThreshold),
      },
    });
    rawProducts.push({ product, variant });
  }

  const packagingProducts = [];
  for (const [code, name, defaultUnitCost, lowStockThreshold] of packagingDefs) {
    const product = await prisma.product.create({
      data: {
        code,
        name,
        type: "PACKAGING_MATERIAL",
        vatRate: dec(0.11),
        defaultUnitCost: dec(defaultUnitCost),
        lowStockThreshold: dec(lowStockThreshold),
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `${code}-STD`,
        name,
        variantType: "PACKAGING_MATERIAL",
        lowStockThreshold: dec(lowStockThreshold),
      },
    });
    packagingProducts.push({ product, variant });
  }

  const finishedProduct = await prisma.product.create({
    data: {
      code: "FG-SACHETS",
      name: "SHAKED Protein Sachets",
      type: "FINISHED_SACHET",
      vatRate: dec(0.11),
      defaultUnitPrice: dec(3),
      defaultUnitCost: dec(1.3),
      lowStockThreshold: dec(80),
      isExpiryTracked: true,
    },
  });

  const flavorVariants = await Promise.all(
    flavors.map((flavor, index) =>
      prisma.productVariant.create({
        data: {
          productId: finishedProduct.id,
          sku: `SHAKED-SACHET-${flavor.code}`,
          name: `${flavor.name} Sachet`,
          variantType: "FINISHED_SACHET",
          flavorId: flavor.id,
          defaultPrice: dec(3),
          lowStockThreshold: dec(index === 0 ? 120 : 90),
          expiryTracked: true,
        },
      }),
    ),
  );
  const bundleProducts = [
    {
      code: "BND-DISCOVERY",
      name: "Discovery Pack",
      sku: "SHAKED-DISCOVERY-PACK",
      variantType: "DISCOVERY_PACK",
      price: 10.99,
      minimumUnits: 4,
      allowFlavorMix: false,
      lines: flavors.map((flavor) => ({
        flavorId: flavor.id,
        componentVariantId: flavorVariants.find((variant) => variant.flavorId === flavor.id)?.id as string,
        quantity: 1,
        isFlexible: false,
      })),
    },
    {
      code: "BND-TRAINING",
      name: "Training Box",
      sku: "SHAKED-TRAINING-BOX",
      variantType: "TRAINING_BOX",
      price: 30.99,
      minimumUnits: 12,
      allowFlavorMix: true,
      lines: flavors.map((flavor) => ({
        flavorId: flavor.id,
        componentVariantId: flavorVariants.find((variant) => variant.flavorId === flavor.id)?.id as string,
        quantity: 1,
        isFlexible: true,
      })),
    },
    {
      code: "BND-MONTHLY",
      name: "Monthly Bundle",
      sku: "SHAKED-MONTHLY-BUNDLE",
      variantType: "MONTHLY_BUNDLE",
      price: 65.99,
      minimumUnits: 30,
      allowFlavorMix: true,
      lines: flavors.map((flavor) => ({
        flavorId: flavor.id,
        componentVariantId: flavorVariants.find((variant) => variant.flavorId === flavor.id)?.id as string,
        quantity: 1,
        isFlexible: true,
      })),
    },
    {
      code: "BND-CUSTOM",
      name: "Custom Sachet Order",
      sku: "SHAKED-CUSTOM-SACHET",
      variantType: "CUSTOM_SACHET",
      price: 3,
      minimumUnits: 4,
      allowFlavorMix: true,
      lines: flavors.map((flavor) => ({
        flavorId: flavor.id,
        componentVariantId: flavorVariants.find((variant) => variant.flavorId === flavor.id)?.id as string,
        quantity: 1,
        isFlexible: true,
      })),
    },
  ] as const;

  const bundleVariants = [];
  for (const definition of bundleProducts) {
    const product = await prisma.product.create({
      data: {
        code: definition.code,
        name: definition.name,
        type: "BUNDLE",
        vatRate: dec(0.11),
        defaultUnitPrice: dec(definition.price),
        isLotTracked: false,
        isExpiryTracked: false,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: definition.sku,
        name: definition.name,
        variantType: definition.variantType as VariantType,
        tracksInventory: false,
        lotTracked: false,
        expiryTracked: false,
        defaultPrice: dec(definition.price),
      },
    });
    const bundleDefinition = await prisma.bundleDefinition.create({
      data: {
        variantId: variant.id,
        type: definition.variantType as VariantType,
        minimumUnits: dec(definition.minimumUnits),
        fixedPrice: dec(definition.price),
        allowFlavorMix: definition.allowFlavorMix,
        lines: {
          create: definition.lines.map((line, sortOrder) => ({
            componentVariantId: line.componentVariantId,
            flavorId: line.flavorId,
            quantity: dec(line.quantity),
            isFlexible: line.isFlexible,
            sortOrder,
          })),
        },
      },
    });
    bundleVariants.push({ product, variant, bundleDefinition });
  }

  const productVariantBySku = Object.fromEntries(
    [...rawProducts, ...packagingProducts, ...bundleVariants.map((item) => ({ variant: item.variant }))].map((item) => [
      item.variant.sku,
      item.variant,
    ]),
  );
  for (const variant of flavorVariants) {
    productVariantBySku[variant.sku] = variant;
  }

  const rawVariantByCode = Object.fromEntries(rawProducts.map((item) => [item.product.code, item.variant]));
  const packagingVariantByCode = Object.fromEntries(packagingProducts.map((item) => [item.product.code, item.variant]));

  const bomFlavorIngredients = {
    CHOC: rawVariantByCode["RM-COCOA"],
    STRAW: rawVariantByCode["RM-STRAWBERRY"],
    VAN: rawVariantByCode["RM-VANILLA"],
    COFF: rawVariantByCode["RM-COFFEE"],
  } as const;

  const boms = [];
  for (const variant of flavorVariants) {
    const flavorCode = variant.sku.split("-").at(-1) as keyof typeof bomFlavorIngredients;
    const bom = await prisma.billOfMaterial.create({
      data: {
        code: `BOM-${flavorCode}`,
        name: `${variant.name} Standard BOM`,
        productVariantId: variant.id,
        batchSize: dec(400),
        lines: {
          create: [
            { lineType: "RAW_MATERIAL", componentVariantId: rawVariantByCode["RM-PROTEIN"].id, quantity: dec(10) },
            { lineType: "RAW_MATERIAL", componentVariantId: rawVariantByCode["RM-CREATINE"].id, quantity: dec(2.4) },
            { lineType: "RAW_MATERIAL", componentVariantId: rawVariantByCode["RM-MILK"].id, quantity: dec(6) },
            { lineType: "RAW_MATERIAL", componentVariantId: bomFlavorIngredients[flavorCode].id, quantity: dec(0.8) },
            { lineType: "PACKAGING", componentVariantId: packagingVariantByCode["PK-SACHET"].id, quantity: dec(400) },
            {
              lineType: "OVERHEAD",
              description: "Factory mixing and sealing",
              quantity: dec(400),
              unitCost: dec(0.22),
            },
          ],
        },
      },
    });
    boms.push(bom);
  }
  const bomByVariantId = Object.fromEntries(boms.map((bom) => [bom.productVariantId, bom]));

  const vendors = await Promise.all(
    [
      { code: "VEND-COURIER", name: "Lebanon Courier Network", type: "Courier" },
      { code: "VEND-SOFT", name: "Operations Stack Ltd", type: "Software" },
      { code: "VEND-PRO", name: "Lebanon Finance Advisory", type: "Consulting" },
    ].map((vendor) =>
      prisma.vendor.create({
        data: {
          ...vendor,
          currency: "USD",
        },
      }),
    ),
  );
  const vendorByCode = Object.fromEntries(vendors.map((vendor) => [vendor.code, vendor]));

  const customers = await Promise.all(
    [
      { code: "CUST-SHOPIFY-001", name: "Maya Khoury", phone: "+96170000111", city: "Beirut" },
      { code: "CUST-WHATSAPP-002", name: "Karim Haddad", phone: "+96170000222", city: "Jounieh" },
      { code: "CUST-INSTA-003", name: "Rita Nader", phone: "+96170000333", city: "Metn" },
    ].map((customer) =>
      prisma.customer.create({
        data: customer,
      }),
    ),
  );
  const customerByCode = Object.fromEntries(customers.map((customer) => [customer.code, customer]));

  const salesChannels = await Promise.all(
    [
      { code: "SHOPIFY", name: "Shopify Store", type: "SHOPIFY" },
      { code: "MANUAL", name: "Manual Orders", type: "MANUAL" },
      { code: "WHOLESALE", name: "Wholesale", type: "WHOLESALE" },
    ].map((channel) =>
      prisma.salesChannel.create({
        data: {
          code: channel.code,
          name: channel.name,
          type: channel.type as SalesChannelType,
        },
      }),
    ),
  );
  const channelByCode = Object.fromEntries(salesChannels.map((channel) => [channel.code, channel]));

  const partner = await prisma.partner.create({
    data: {
      name: "UBSA",
      type: "FACTORY",
      sharePercent: dec(0.6),
      payableAccountId: accountByCode["2140"].id,
    },
  });

  const fiscalPeriod = await prisma.fiscalPeriod.create({
    data: {
      name: "FY2026",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      status: "OPEN",
    },
  });

  const rawLots = await Promise.all(
    [
      { lotCode: "LOT-RM-PROTEIN-001", productVariantId: rawVariantByCode["RM-PROTEIN"].id, quantityOnHand: 85, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-CREATINE-001", productVariantId: rawVariantByCode["RM-CREATINE"].id, quantityOnHand: 40, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-MILK-001", productVariantId: rawVariantByCode["RM-MILK"].id, quantityOnHand: 55, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-COCOA-001", productVariantId: rawVariantByCode["RM-COCOA"].id, quantityOnHand: 10, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-STRAW-001", productVariantId: rawVariantByCode["RM-STRAWBERRY"].id, quantityOnHand: 9, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-VAN-001", productVariantId: rawVariantByCode["RM-VANILLA"].id, quantityOnHand: 9, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-RM-COFF-001", productVariantId: rawVariantByCode["RM-COFFEE"].id, quantityOnHand: 8, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-PK-SACHET-001", productVariantId: packagingVariantByCode["PK-SACHET"].id, quantityOnHand: 1800, locationCode: "FACTORY-RAW" },
      { lotCode: "LOT-PK-CARTON-001", productVariantId: packagingVariantByCode["PK-CARTON"].id, quantityOnHand: 180, locationCode: "FACTORY-RAW" },
    ].map(async (rawLot) => {
      const lot = await prisma.inventoryLot.create({
        data: {
          lotCode: rawLot.lotCode,
          productVariantId: rawLot.productVariantId,
          receivedAt: new Date("2026-04-01T00:00:00.000Z"),
          costPerUnit: dec(1),
          qcStatus: "RELEASED",
        },
      });
      await prisma.inventoryBalance.create({
        data: {
          lotId: lot.id,
          locationId: locationByCode[rawLot.locationCode].id,
          quantity: dec(rawLot.quantityOnHand),
          reservedQty: dec(0),
        },
      });
      return lot;
    }),
  );
  const rawLotByCode = Object.fromEntries(rawLots.map((lot) => [lot.lotCode, lot]));

  const productionRuns = [];
  const finishedLots = [];
  for (const variant of flavorVariants) {
    const batchCost = calculateBatchCost(
      [
        { description: "Protein Base", quantity: 10, unitCost: 0.7258 },
        { description: "Creatine Base", quantity: 2.4, unitCost: 0.125 },
        { description: "Milk Powder", quantity: 6, unitCost: 0.0758 },
        { description: "Flavoring", quantity: 0.8, unitCost: 12 },
        { description: "Sachet Film", quantity: 400, unitCost: 0.08 },
        { description: "Factory mixing and sealing", quantity: 400, unitCost: 0.22 },
      ],
      400,
    );
    const runDate: Date = new Date(`2026-04-${10 + productionRuns.length}T00:00:00.000Z`);
    const productionRun = await prisma.productionRun.create({
      data: {
        code: `PR-${variant.sku.split("-").at(-1)}`,
        batchNumber: `BATCH-${variant.sku.split("-").at(-1)}-202604`,
        bomId: bomByVariantId[variant.id].id,
        warehouseId: warehouse.id,
        runDate,
        expiryDate: addDays(runDate, 365),
        plannedQuantity: dec(420),
        actualQuantity: dec(400),
        qcStatus: "RELEASED",
        status: "COMPLETED",
        notes: "Factory output received and QC released.",
        createdById: founder.id,
      },
    });
    productionRuns.push(productionRun);

    const lot = await prisma.inventoryLot.create({
      data: {
        productVariantId: variant.id,
        lotCode: `LOT-${variant.sku.split("-").at(-1)}-APR-01`,
        manufactureDate: runDate,
        expiryDate: addDays(runDate, 365),
        receivedAt: runDate,
        qcStatus: "RELEASED",
        costPerUnit: dec(batchCost.unitCost.toString()),
        productionRunId: productionRun.id,
        notes: "Released for sale.",
      },
    });
    finishedLots.push(lot);

    await prisma.productionRunOutput.create({
      data: {
        productionRunId: productionRun.id,
        lotId: lot.id,
        productVariantId: variant.id,
        quantity: dec(400),
        unitCost: dec(batchCost.unitCost.toString()),
      },
    });

    await prisma.inventoryBalance.createMany({
      data: [
        {
          lotId: lot.id,
          locationId: locationByCode["FACTORY-FG"].id,
          quantity: dec(70),
          reservedQty: dec(0),
        },
        {
          lotId: lot.id,
          locationId: locationByCode["SELLABLE"].id,
          quantity: dec(330),
          reservedQty: dec(0),
        },
      ],
    });

    const flavorCode = variant.sku.split("-").at(-1) as "CHOC" | "STRAW" | "VAN" | "COFF";
    const consumptionLotCodes = {
      RM_PROTEIN: "LOT-RM-PROTEIN-001",
      RM_CREATINE: "LOT-RM-CREATINE-001",
      RM_MILK: "LOT-RM-MILK-001",
      RM_FLAVOR:
        flavorCode === "CHOC"
          ? "LOT-RM-COCOA-001"
          : flavorCode === "STRAW"
            ? "LOT-RM-STRAW-001"
            : flavorCode === "VAN"
              ? "LOT-RM-VAN-001"
              : "LOT-RM-COFF-001",
      RM_PACK: "LOT-PK-SACHET-001",
    } as const;

    for (const [lotCode, qty] of [
      [consumptionLotCodes.RM_PROTEIN, 10],
      [consumptionLotCodes.RM_CREATINE, 2.4],
      [consumptionLotCodes.RM_MILK, 6],
      [consumptionLotCodes.RM_FLAVOR, 0.8],
      [consumptionLotCodes.RM_PACK, 400],
    ] as const) {
      await prisma.productionRunConsumption.create({
        data: {
          productionRunId: productionRun.id,
          productVariantId: rawLotByCode[lotCode].productVariantId,
          lotId: rawLotByCode[lotCode].id,
          quantity: dec(qty),
          unitCost: dec(1),
        },
      });
    }
  }

  const finishedLotByVariantId = Object.fromEntries(finishedLots.map((lot) => [lot.productVariantId, lot]));

  for (const [lotCode, qty, reason] of [
    ["LOT-RM-PROTEIN-001", 40, "April production consumption"],
    ["LOT-RM-CREATINE-001", 9.6, "April production consumption"],
    ["LOT-RM-MILK-001", 24, "April production consumption"],
    ["LOT-RM-COCOA-001", 0.8, "Chocolate production consumption"],
    ["LOT-RM-STRAW-001", 0.8, "Strawberry production consumption"],
    ["LOT-RM-VAN-001", 0.8, "Vanilla production consumption"],
    ["LOT-RM-COFF-001", 0.8, "Coffee production consumption"],
    ["LOT-PK-SACHET-001", 1600, "April production consumption"],
  ] as const) {
    await prisma.inventoryMovement.create({
      data: {
        movementType: "PRODUCTION_CONSUMPTION",
        reason,
        productVariantId: rawLotByCode[lotCode].productVariantId,
        lotId: rawLotByCode[lotCode].id,
        fromLocationId: locationByCode["FACTORY-RAW"].id,
        quantity: dec(qty),
        unitCost: dec(1),
        referenceType: "production_run",
        referenceId: productionRuns[0].id,
        createdById: founder.id,
      },
    });
  }

  for (const lot of finishedLots) {
    await prisma.inventoryMovement.createMany({
      data: [
        {
          movementType: "PRODUCTION_OUTPUT",
          reason: "Factory output receipt",
          productVariantId: lot.productVariantId,
          lotId: lot.id,
          toLocationId: locationByCode["FACTORY-FG"].id,
          quantity: dec(400),
          unitCost: lot.costPerUnit,
          referenceType: "production_run",
          referenceId: lot.productionRunId!,
          createdById: founder.id,
        },
        {
          movementType: "TRANSFER",
          reason: "Released to sellable stock",
          productVariantId: lot.productVariantId,
          lotId: lot.id,
          fromLocationId: locationByCode["FACTORY-FG"].id,
          toLocationId: locationByCode["SELLABLE"].id,
          quantity: dec(330),
          unitCost: lot.costPerUnit,
          referenceType: "production_run",
          referenceId: lot.productionRunId!,
          createdById: founder.id,
        },
      ],
    });
  }

  const shopifyOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-0001",
      sourceType: "SHOPIFY",
      salesChannelId: channelByCode["SHOPIFY"].id,
      customerId: customerByCode["CUST-SHOPIFY-001"].id,
      status: "DELIVERED",
      paymentState: "PAID",
      fulfillmentStatus: "DELIVERED",
      externalReference: "#1001",
      orderDate: new Date("2026-04-12T09:00:00.000Z"),
      subtotal: dec(10.99),
      discountTotal: dec(0),
      refundTotal: dec(0),
      shippingFee: dec(0),
      deliveryCost: dec(4),
      paymentFee: dec(0.42),
      vatTotal: dec(1.21),
      grossTotal: dec(10.99),
      netTotal: dec(12.2),
      notes: "Discovery pack via Shopify.",
      createdById: founder.id,
      lines: {
        create: [
          {
            productVariantId: bundleVariants.find((bundle) => bundle.variant.variantType === "DISCOVERY_PACK")!.variant.id,
            description: "Discovery Pack",
            quantity: dec(1),
            unitPrice: dec(10.99),
            lineTotal: dec(10.99),
            vatTotal: dec(1.21),
          },
        ],
      },
      fulfillments: {
        create: {
          status: "DELIVERED",
          shippedAt: new Date("2026-04-13T08:00:00.000Z"),
          deliveredAt: new Date("2026-04-14T12:00:00.000Z"),
          courierName: "Lebanon Courier Network",
          trackingNumber: "LCN-1001",
          actualDeliveryCost: dec(4),
        },
      },
    },
    include: { lines: true },
  });

  await prisma.shopifyOrder.create({
    data: {
      salesOrderId: shopifyOrder.id,
      externalId: "gid://shopify/Order/1001",
      orderNumber: "SHOPIFY-1001",
      orderDate: shopifyOrder.orderDate,
      rawPayload: {
        source: "fixture",
        financial_status: "paid",
      },
      syncedAt: new Date("2026-04-12T09:05:00.000Z"),
      lines: {
        create: {
          orderLineId: shopifyOrder.lines[0]!.id,
          productVariantId: shopifyOrder.lines[0]!.productVariantId,
          sku: "SHAKED-DISCOVERY-PACK",
          title: "Discovery Pack",
          quantity: dec(1),
          unitPrice: dec(10.99),
          netAmount: dec(10.99),
        },
      },
    },
  });

  const manualCustomOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-0002",
      sourceType: "MANUAL",
      salesChannelId: channelByCode["MANUAL"].id,
      customerId: customerByCode["CUST-WHATSAPP-002"].id,
      status: "DELIVERED",
      paymentState: "PAID",
      fulfillmentStatus: "DELIVERED",
      orderDate: new Date("2026-04-15T12:00:00.000Z"),
      subtotal: dec(18),
      discountTotal: dec(0),
      refundTotal: dec(0),
      shippingFee: dec(0),
      deliveryCost: dec(4),
      paymentFee: dec(0),
      vatTotal: dec(1.98),
      grossTotal: dec(18),
      netTotal: dec(19.98),
      notes: "WhatsApp custom order, 3 chocolate / 3 vanilla.",
      createdById: operator.id,
      lines: {
        create: {
          productVariantId: bundleVariants.find((bundle) => bundle.variant.variantType === "CUSTOM_SACHET")!.variant.id,
          description: "Custom Sachet Order",
          lineType: "CUSTOM_FLAVOR_BUNDLE",
          quantity: dec(6),
          unitPrice: dec(3),
          lineTotal: dec(18),
          vatTotal: dec(1.98),
          flavorMix: [
            { flavorId: flavorByCode["CHOC"].id, flavorName: "Chocolate", quantity: 3 },
            { flavorId: flavorByCode["VAN"].id, flavorName: "Vanilla", quantity: 3 },
          ],
        },
      },
      manualOrder: {
        create: {
          sourceTag: "WhatsApp",
          requestedDeliveryFee: dec(4),
          notes: "Customer wanted half chocolate and half vanilla.",
        },
      },
      fulfillments: {
        create: {
          status: "DELIVERED",
          shippedAt: new Date("2026-04-15T15:00:00.000Z"),
          deliveredAt: new Date("2026-04-15T19:00:00.000Z"),
          courierName: "Lebanon Courier Network",
          actualDeliveryCost: dec(4),
        },
      },
    },
    include: { lines: true },
  });

  const manualTrainingOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-0003",
      sourceType: "MANUAL",
      salesChannelId: channelByCode["MANUAL"].id,
      customerId: customerByCode["CUST-INSTA-003"].id,
      status: "FULFILLED",
      paymentState: "PENDING",
      fulfillmentStatus: "FULFILLED",
      orderDate: new Date("2026-04-16T10:00:00.000Z"),
      subtotal: dec(30.99),
      discountTotal: dec(2),
      refundTotal: dec(0),
      shippingFee: dec(0),
      deliveryCost: dec(4.5),
      paymentFee: dec(0),
      vatTotal: dec(3.19),
      grossTotal: dec(30.99),
      netTotal: dec(32.18),
      notes: "Instagram training box pending COD collection.",
      createdById: operator.id,
      lines: {
        create: {
          productVariantId: bundleVariants.find((bundle) => bundle.variant.variantType === "TRAINING_BOX")!.variant.id,
          description: "Training Box",
          quantity: dec(1),
          unitPrice: dec(30.99),
          discountTotal: dec(2),
          lineTotal: dec(28.99),
          vatTotal: dec(3.19),
          flavorMix: [
            { flavorId: flavorByCode["CHOC"].id, flavorName: "Chocolate", quantity: 4 },
            { flavorId: flavorByCode["STRAW"].id, flavorName: "Strawberry", quantity: 2 },
            { flavorId: flavorByCode["VAN"].id, flavorName: "Vanilla", quantity: 3 },
            { flavorId: flavorByCode["COFF"].id, flavorName: "Coffee", quantity: 3 },
          ],
        },
      },
      manualOrder: {
        create: {
          sourceTag: "Instagram",
          requestedDeliveryFee: dec(4.5),
          instagramHandle: "@rita.trains",
        },
      },
      fulfillments: {
        create: {
          status: "FULFILLED",
          shippedAt: new Date("2026-04-16T13:00:00.000Z"),
          courierName: "Lebanon Courier Network",
          actualDeliveryCost: dec(4.5),
        },
      },
    },
    include: { lines: true },
  });

  await Promise.all(
    [
      {
        salesOrderId: shopifyOrder.id,
        paymentMethodId: paymentMethodByCode["CARD"].id,
        status: "PAID",
        amount: dec(12.2),
        paidAt: new Date("2026-04-12T09:00:00.000Z"),
        externalReference: "shopify-capture-1001",
      },
      {
        salesOrderId: manualCustomOrder.id,
        paymentMethodId: paymentMethodByCode["CASH"].id,
        status: "PAID",
        amount: dec(19.98),
        paidAt: new Date("2026-04-15T19:00:00.000Z"),
      },
    ].map((payment) => prisma.payment.create({ data: payment })),
  );

  const chocolateLot = finishedLotByVariantId[flavorVariants.find((variant) => variant.flavorId === flavorByCode["CHOC"].id)!.id];
  const strawberryLot = finishedLotByVariantId[flavorVariants.find((variant) => variant.flavorId === flavorByCode["STRAW"].id)!.id];
  const vanillaLot = finishedLotByVariantId[flavorVariants.find((variant) => variant.flavorId === flavorByCode["VAN"].id)!.id];
  const coffeeLot = finishedLotByVariantId[flavorVariants.find((variant) => variant.flavorId === flavorByCode["COFF"].id)!.id];

  await prisma.inventoryMovement.createMany({
    data: [
      {
        movementType: "SALE_DEDUCTION",
        reason: "Shopify discovery pack consumption",
        productVariantId: chocolateLot.productVariantId,
        lotId: chocolateLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(1),
        unitCost: chocolateLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: shopifyOrder.id,
        createdById: founder.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Shopify discovery pack consumption",
        productVariantId: strawberryLot.productVariantId,
        lotId: strawberryLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(1),
        unitCost: strawberryLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: shopifyOrder.id,
        createdById: founder.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Shopify discovery pack consumption",
        productVariantId: vanillaLot.productVariantId,
        lotId: vanillaLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(1),
        unitCost: vanillaLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: shopifyOrder.id,
        createdById: founder.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Shopify discovery pack consumption",
        productVariantId: coffeeLot.productVariantId,
        lotId: coffeeLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(1),
        unitCost: coffeeLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: shopifyOrder.id,
        createdById: founder.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Manual custom order consumption",
        productVariantId: chocolateLot.productVariantId,
        lotId: chocolateLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(3),
        unitCost: chocolateLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualCustomOrder.id,
        createdById: operator.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Manual custom order consumption",
        productVariantId: vanillaLot.productVariantId,
        lotId: vanillaLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(3),
        unitCost: vanillaLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualCustomOrder.id,
        createdById: operator.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Training box consumption",
        productVariantId: chocolateLot.productVariantId,
        lotId: chocolateLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(4),
        unitCost: chocolateLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualTrainingOrder.id,
        createdById: operator.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Training box consumption",
        productVariantId: strawberryLot.productVariantId,
        lotId: strawberryLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(2),
        unitCost: strawberryLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualTrainingOrder.id,
        createdById: operator.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Training box consumption",
        productVariantId: vanillaLot.productVariantId,
        lotId: vanillaLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(3),
        unitCost: vanillaLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualTrainingOrder.id,
        createdById: operator.id,
      },
      {
        movementType: "SALE_DEDUCTION",
        reason: "Training box consumption",
        productVariantId: coffeeLot.productVariantId,
        lotId: coffeeLot.id,
        fromLocationId: locationByCode["SELLABLE"].id,
        quantity: dec(3),
        unitCost: coffeeLot.costPerUnit,
        referenceType: "sales_order",
        referenceId: manualTrainingOrder.id,
        createdById: operator.id,
      },
    ],
  });

  const currentSellableBalances = [
    [chocolateLot.id, 322],
    [strawberryLot.id, 327],
    [vanillaLot.id, 326],
    [coffeeLot.id, 326],
  ] as const;
  for (const [lotId, qty] of currentSellableBalances) {
    await prisma.inventoryBalance.update({
      where: {
        lotId_locationId: {
          lotId,
          locationId: locationByCode["SELLABLE"].id,
        },
      },
      data: {
        quantity: dec(qty),
      },
    });
  }

  const courierBill = await prisma.vendorBill.create({
    data: {
      billNumber: "VB-2026-0001",
      vendorId: vendorByCode["VEND-COURIER"].id,
      expenseCategoryId: categoryByCode["DELIVERY"].id,
      issueDate: new Date("2026-04-16T00:00:00.000Z"),
      dueDate: new Date("2026-04-30T00:00:00.000Z"),
      status: "POSTED",
      subtotal: dec(12.5),
      vatTotal: dec(0),
      total: dec(12.5),
      notes: "Courier settlement for fulfilled orders.",
      createdById: founder.id,
      lines: {
        create: [
          {
            description: "April courier accrual clearing",
            quantity: dec(1),
            unitCost: dec(12.5),
            lineTotal: dec(12.5),
            accountId: accountByCode["2130"].id,
          },
        ],
      },
    },
  });

  const softwareBill = await prisma.vendorBill.create({
    data: {
      billNumber: "VB-2026-0002",
      vendorId: vendorByCode["VEND-SOFT"].id,
      expenseCategoryId: categoryByCode["SOFTWARE"].id,
      issueDate: new Date("2026-04-10T00:00:00.000Z"),
      dueDate: new Date("2026-04-20T00:00:00.000Z"),
      status: "POSTED",
      subtotal: dec(49),
      vatTotal: dec(5.39),
      total: dec(54.39),
      notes: "Admin stack subscription.",
      createdById: founder.id,
      lines: {
        create: [
          {
            description: "ERP and storefront tooling",
            quantity: dec(1),
            unitCost: dec(49),
            lineTotal: dec(49),
            accountId: accountByCode["6110"].id,
          },
        ],
      },
    },
  });

  const professionalBill = await prisma.vendorBill.create({
    data: {
      billNumber: "VB-2026-0003",
      vendorId: vendorByCode["VEND-PRO"].id,
      expenseCategoryId: categoryByCode["PROFESSIONAL"].id,
      issueDate: new Date("2026-04-18T00:00:00.000Z"),
      dueDate: new Date("2026-05-05T00:00:00.000Z"),
      status: "APPROVED",
      subtotal: dec(75),
      vatTotal: dec(0),
      total: dec(75),
      notes: "Monthly finance review.",
      createdById: founder.id,
      lines: {
        create: [
          {
            description: "Monthly finance review",
            quantity: dec(1),
            unitCost: dec(75),
            lineTotal: dec(75),
            accountId: accountByCode["6130"].id,
          },
        ],
      },
    },
  });

  const journalEntries = [
    {
      entryNumber: "JE-2026-0001",
      entryDate: shopifyOrder.orderDate,
      sourceType: "SHOPIFY_ORDER",
      sourceId: shopifyOrder.id,
      memo: "Shopify order #1001 revenue and payment posting",
      createdById: founder.id,
      lines: [
        accountLine(accountByCode["1140"], 11.78, 0),
        accountLine(accountByCode["5120"], 0.42, 0),
        accountLine(accountByCode["4100"], 0, 10.99),
        accountLine(accountByCode["2120"], 0, 1.21),
      ],
    },
    {
      entryNumber: "JE-2026-0002",
      entryDate: shopifyOrder.orderDate,
      sourceType: "SHOPIFY_ORDER",
      sourceId: `${shopifyOrder.id}-cogs`,
      memo: "Shopify order #1001 COGS and courier accrual",
      createdById: founder.id,
      lines: [
        accountLine(accountByCode["5100"], 5.24, 0),
        accountLine(accountByCode["5110"], 4, 0),
        accountLine(accountByCode["1230"], 0, 5.24),
        accountLine(accountByCode["2130"], 0, 4),
      ],
    },
    {
      entryNumber: "JE-2026-0003",
      entryDate: manualCustomOrder.orderDate,
      sourceType: "MANUAL_ORDER",
      sourceId: manualCustomOrder.id,
      memo: "Manual order revenue and payment posting",
      createdById: operator.id,
      lines: [
        accountLine(accountByCode["1110"], 19.98, 0),
        accountLine(accountByCode["4110"], 0, 18),
        accountLine(accountByCode["2120"], 0, 1.98),
      ],
    },
    {
      entryNumber: "JE-2026-0004",
      entryDate: manualCustomOrder.orderDate,
      sourceType: "MANUAL_ORDER",
      sourceId: `${manualCustomOrder.id}-cogs`,
      memo: "Manual order COGS and courier accrual",
      createdById: operator.id,
      lines: [
        accountLine(accountByCode["5100"], 7.86, 0),
        accountLine(accountByCode["5110"], 4, 0),
        accountLine(accountByCode["1230"], 0, 7.86),
        accountLine(accountByCode["2130"], 0, 4),
      ],
    },
    {
      entryNumber: "JE-2026-0005",
      entryDate: manualTrainingOrder.orderDate,
      sourceType: "MANUAL_ORDER",
      sourceId: manualTrainingOrder.id,
      memo: "Manual training box revenue posting",
      createdById: operator.id,
      lines: [
        accountLine(accountByCode["1150"], 32.18, 0),
        accountLine(accountByCode["4190"], 2, 0),
        accountLine(accountByCode["4110"], 0, 30.99),
        accountLine(accountByCode["2120"], 0, 3.19),
      ],
    },
    {
      entryNumber: "JE-2026-0006",
      entryDate: manualTrainingOrder.orderDate,
      sourceType: "MANUAL_ORDER",
      sourceId: `${manualTrainingOrder.id}-cogs`,
      memo: "Training box COGS and courier accrual",
      createdById: operator.id,
      lines: [
        accountLine(accountByCode["5100"], 15.72, 0),
        accountLine(accountByCode["5110"], 4.5, 0),
        accountLine(accountByCode["1230"], 0, 15.72),
        accountLine(accountByCode["2130"], 0, 4.5),
      ],
    },
    {
      entryNumber: "JE-2026-0007",
      entryDate: courierBill.issueDate,
      sourceType: "VENDOR_BILL",
      sourceId: courierBill.id,
      memo: "Courier bill clears accrued delivery costs",
      createdById: founder.id,
      lines: [
        accountLine(accountByCode["2130"], 12.5, 0),
        accountLine(accountByCode["2110"], 0, 12.5),
      ],
    },
    {
      entryNumber: "JE-2026-0008",
      entryDate: softwareBill.issueDate,
      sourceType: "VENDOR_BILL",
      sourceId: softwareBill.id,
      memo: "Software expense bill",
      createdById: founder.id,
      lines: [
        accountLine(accountByCode["6110"], 49, 0),
        accountLine(accountByCode["1240"], 5.39, 0),
        accountLine(accountByCode["2110"], 0, 54.39),
      ],
    },
    {
      entryNumber: "JE-2026-0009",
      entryDate: professionalBill.issueDate,
      sourceType: "VENDOR_BILL",
      sourceId: professionalBill.id,
      memo: "Professional fee bill",
      createdById: founder.id,
      lines: [
        accountLine(accountByCode["6130"], 75, 0),
        accountLine(accountByCode["2110"], 0, 75),
      ],
    },
  ] satisfies Array<{
    entryNumber: string;
    entryDate: Date;
    sourceType: JournalSourceType;
    sourceId: string;
    memo: string;
    createdById: string;
    lines: JournalSeedLine[];
  }>;

  for (const entry of journalEntries) {
    assertJournalBalanced(entry.lines);
    await prisma.journalEntry.create({
      data: {
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        status: "POSTED",
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        memo: entry.memo,
        fiscalPeriodId: fiscalPeriod.id,
        createdById: entry.createdById,
        postedAt: entry.entryDate,
        lines: {
          create: entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: dec(line.debit),
            credit: dec(line.credit),
            description: line.name,
          })),
        },
      },
    });
  }

  const settlementConfig = await prisma.settlementConfig.create({
    data: {
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      partnerSharePercent: dec(0.6),
      originsSharePercent: dec(0.4),
      includedExpenseCategoryIds: [categoryByCode["SOFTWARE"].id, categoryByCode["PROFESSIONAL"].id, categoryByCode["ADMIN"].id],
      revenueAccountIds: [accountByCode["4100"].id, accountByCode["4110"].id, accountByCode["4120"].id],
      discountAccountIds: [accountByCode["4190"].id],
      refundAccountIds: [accountByCode["4195"].id],
      cogsAccountIds: [accountByCode["5100"].id],
      deliveryAccountIds: [accountByCode["5110"].id],
      paymentFeeAccountIds: [accountByCode["5120"].id],
      notes: "April configuration includes software and professional fees in shared profit.",
      active: true,
    },
  });

  const settlementMath = calculateSettlement({
    revenue: 59.98,
    discounts: 2,
    refunds: 0,
    cogs: 28.82,
    deliveryCosts: 12.5,
    paymentFees: 0.42,
    includedOpex: 124,
    factorySharePercent: 0.6,
  });

  const aprilSettlement = await prisma.settlementPeriod.create({
    data: {
      periodKey: "2026-04",
      periodType: "MONTHLY",
      periodStart: startOfMonth(new Date("2026-04-01T00:00:00.000Z")),
      periodEnd: endOfMonth(new Date("2026-04-01T00:00:00.000Z")),
      version: 1,
      status: "FINALIZED",
      configId: settlementConfig.id,
      partnerId: partner.id,
      revenue: dec(settlementMath.revenue.toString()),
      discounts: dec(settlementMath.discounts.toString()),
      refunds: dec(settlementMath.refunds.toString()),
      netSales: dec(settlementMath.netSales.toString()),
      cogs: dec(settlementMath.cogs.toString()),
      deliveryCosts: dec(settlementMath.deliveryCosts.toString()),
      paymentFees: dec(settlementMath.paymentFees.toString()),
      includedOpex: dec(settlementMath.includedOpex.toString()),
      netProfit: dec(settlementMath.netProfit.toString()),
      factoryShare: dec(settlementMath.factoryShare.toString()),
      originsShare: dec(settlementMath.originsShare.toString()),
      adjustments: dec(0),
      notes: "April settlement seeded from sample operational data.",
      createdById: founder.id,
      lines: {
        create: [
          { lineType: "GROSS_SALES", label: "Gross Sales", amount: dec(settlementMath.revenue.toString()) },
          { lineType: "DISCOUNT", label: "Discounts", amount: dec(settlementMath.discounts.toString()) },
          { lineType: "REFUND", label: "Refunds", amount: dec(settlementMath.refunds.toString()) },
          { lineType: "NET_SALES", label: "Net Sales", amount: dec(settlementMath.netSales.toString()) },
          { lineType: "COGS", label: "Product COGS", amount: dec(settlementMath.cogs.toString()) },
          { lineType: "DELIVERY", label: "Direct Delivery Cost", amount: dec(settlementMath.deliveryCosts.toString()) },
          { lineType: "PAYMENT_FEE", label: "Payment Fees", amount: dec(settlementMath.paymentFees.toString()) },
          { lineType: "OPEX", label: "Included Operating Expenses", amount: dec(settlementMath.includedOpex.toString()) },
          { lineType: "FACTORY_SHARE", label: "Factory Share", amount: dec(settlementMath.factoryShare.toString()) },
          { lineType: "ORIGINS_SHARE", label: "Origins Share", amount: dec(settlementMath.originsShare.toString()) },
        ],
      },
    },
  });

  await prisma.reportSnapshot.create({
    data: {
      reportType: "dashboard",
      periodStart: startOfMonth(new Date("2026-04-01T00:00:00.000Z")),
      periodEnd: endOfMonth(new Date("2026-04-01T00:00:00.000Z")),
      generatedById: founder.id,
      payload: {
        salesMtd: 59.98,
        netProfitEstimate: -107.76,
        stockValueEstimate: 1694.4,
        topFlavor: "Chocolate",
      },
    },
  });

  await prisma.fileReference.createMany({
    data: [
      {
        storageKey: "vendor-bills/vb-2026-0002.pdf",
        fileName: "operations-stack-april.pdf",
        mimeType: "application/pdf",
        byteSize: 138240,
        relatedType: "VENDOR_BILL",
        relatedId: softwareBill.id,
        uploadedById: founder.id,
      },
      {
        storageKey: "settlements/2026-04-statement.html",
        fileName: "april-settlement-statement.html",
        mimeType: "text/html",
        byteSize: 42210,
        relatedType: "SETTLEMENT",
        relatedId: aprilSettlement.id,
        uploadedById: founder.id,
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: founder.id,
        entityType: "production_run",
        entityId: productionRuns[0]!.id,
        action: "production.completed",
        metadata: { batch: productionRuns[0]!.batchNumber },
      },
      {
        actorId: operator.id,
        entityType: "manual_order",
        entityId: manualCustomOrder.id,
        action: "manual_order.created",
        metadata: { source: "WhatsApp" },
      },
      {
        actorId: founder.id,
        entityType: "settlement_period",
        entityId: aprilSettlement.id,
        action: "settlement.finalized",
        metadata: { periodKey: "2026-04", version: 1 },
      },
      {
        actorId: founder.id,
        entityType: "settings",
        entityId: settlementConfig.id,
        action: "settlement_config.updated",
        metadata: { includedExpenseCategories: ["SOFTWARE", "PROFESSIONAL", "ADMIN"] },
      },
    ],
  });

  console.log("Seed completed.");
}

function accountLine(account: { id: string; code: string; name: string; type: string }, debit: number, credit: number) {
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    debit,
    credit,
  } satisfies JournalSeedLine;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
