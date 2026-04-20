"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Boxes,
  ClipboardList,
  FileBarChart,
  FileStack,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Settings,
  ShieldCheck,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconByPath: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/orders": ClipboardList,
  "/inventory": Boxes,
  "/production": Wrench,
  "/products": PackageSearch,
  "/expenses": Wallet,
  "/accounting": FileStack,
  "/settlements": ShieldCheck,
  "/reports": FileBarChart,
  "/settings": Settings,
  "/audit-log": Activity,
};

type MobileNavProps = {
  pathname: string;
  userPermissions: string[];
};

export function MobileNav({ pathname, userPermissions }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const items = navigationItems.filter((item) =>
    userPermissions.includes(item.permission),
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
                  S
                </div>
                <p className="font-display text-sm font-bold tracking-tight">SHAKED Finance OS</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = iconByPath[item.href] ?? LayoutDashboard;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
