import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col justify-center">
          <div className="h-1 w-10 rounded bg-primary" />
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight">
            SHAKED<br />Finance OS
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Inventory, accounting, and settlement in one place — built for operators who need the truth fast.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {[
              ["Double-entry accounting", "Every order, expense, and settlement posts traceable journal entries."],
              ["Lot-aware inventory", "FEFO stock deduction, expiry tracking, and controlled locations."],
              ["Factory settlement", "Configurable profit sharing with versioned partner statements."],
              ["Full export suite", "P&L, trial balance, stock, and settlement CSVs on demand."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-lg border border-border/70 p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
