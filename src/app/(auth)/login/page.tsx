import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-border/60 bg-card/80 p-10 shadow-panel">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-primary">Origins s.a.r.l.</p>
          <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight">
            SHAKED Finance OS is built for operators who need inventory, accounting, and settlement truth in one place.
          </h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["Double-entry ready", "Every order, expense, and settlement is traceable back to posted entries."],
              ["Lot-aware stock", "Finished sachets, expiry, and sellable stock all move through controlled locations."],
              ["Factory settlement", "Profit sharing is configurable and versioned for partner-ready statements."],
              ["Internal speed", "Dense tables, focused workflows, and operator-first summaries across the stack."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-background/80 p-5">
                <h2 className="font-medium">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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
