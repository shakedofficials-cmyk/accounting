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
import { Card } from "@/components/ui/card";
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-[300px] shrink-0 lg:block">
          <Card className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden">
            <div className="border-b border-border/70 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
                  SH
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">SHAKED Finance OS</p>
                  <p className="text-sm text-muted-foreground">Origins s.a.r.l. internal console</p>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge>{user.roleName.replace("_", " ")}</Badge>
                  <Badge variant="success">USD only</Badge>
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {items.map((item) => {
                const Icon = iconByPath[item.href] ?? LayoutDashboard;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-transparent px-4 py-3 transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "hover:border-border/60 hover:bg-muted/30",
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border/70 p-4">
              <LogoutButton action={handleSignOut} />
            </div>
          </Card>
        </aside>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
