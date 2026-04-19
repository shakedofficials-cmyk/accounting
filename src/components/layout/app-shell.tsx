import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Boxes,
  ClipboardList,
  FileBarChart,
  FileStack,
  LayoutDashboard,
  PackageSearch,
  Settings,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";

import { LogoutButton } from "@/components/layout/logout-button";
import { Badge } from "@/components/ui/badge";
import { navigationItems } from "@/lib/navigation";
import { hasPermission, type AuthUser } from "@/lib/auth/permissions";
import { signOut } from "@/lib/auth/session";
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

type AppShellProps = {
  user: AuthUser;
  pathname: string;
  children: React.ReactNode;
};

export async function AppShell({ user, pathname, children }: AppShellProps) {
  const items = navigationItems.filter((item) => hasPermission(user, item.permission));

  async function handleSignOut() {
    "use server";
    await signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-[240px] shrink-0 border-r border-border lg:flex lg:flex-col">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="border-b border-border px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-white font-display">
                  S
                </div>
                <p className="font-display text-sm font-bold tracking-tight">SHAKED Finance OS</p>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = iconByPath[item.href] ?? LayoutDashboard;
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
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
            </nav>

            <div className="border-t border-border p-4">
              <div className="mb-3">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <Badge className="mt-2 text-xs">{user.roleName.replace("_", " ")}</Badge>
              </div>
              <LogoutButton action={handleSignOut} />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
