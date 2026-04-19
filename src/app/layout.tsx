import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "SHAKED Finance OS",
  description: "Internal finance and operations console for SHAKED by Origins s.a.r.l.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
