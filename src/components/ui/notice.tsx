import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type NoticeVariant = "info" | "success" | "error";

const variantClasses: Record<NoticeVariant, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export function Notice({
  className,
  variant = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: NoticeVariant }) {
  return (
    <div
      className={cn("rounded-xl border px-4 py-3 text-sm", variantClasses[variant], className)}
      {...props}
    />
  );
}
