import { headers } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "/dashboard";

  return <AppShell user={user} pathname={pathname}>{children}</AppShell>;
}
