import type { Route } from "next";

import type { PermissionKey } from "@/lib/auth/permissions";

export type NavigationItem = {
  href: Route;
  label: string;
  description: string;
  permission: PermissionKey;
};

export const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Sales, profit, and alerts", permission: "dashboard:view" },
  { href: "/orders", label: "Orders", description: "Manual and Shopify orders", permission: "orders:view" },
  { href: "/inventory", label: "Inventory", description: "Lots, balances, and expiries", permission: "inventory:view" },
  { href: "/production", label: "Production", description: "BOMs and production runs", permission: "production:view" },
  { href: "/products", label: "Products", description: "Flavors, bundles, and SKUs", permission: "inventory:view" },
  { href: "/expenses", label: "Expenses", description: "Vendor bills and spend", permission: "expenses:view" },
  { href: "/accounting", label: "Accounting", description: "Ledger and financials", permission: "accounting:view" },
  { href: "/settlements", label: "Settlements", description: "Factory profit sharing", permission: "settlements:view" },
  { href: "/reports", label: "Reports", description: "Exports and snapshots", permission: "reports:view" },
  { href: "/settings", label: "Settings", description: "Company and settlement config", permission: "settings:manage" },
  { href: "/audit-log", label: "Audit Log", description: "Sensitive action history", permission: "audit:view" },
];
