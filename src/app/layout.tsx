import type { Metadata } from "next";
import { IBM_Plex_Sans, Montserrat } from "next/font/google";

import "@/app/globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHAKED Finance OS",
  description: "Internal finance and operations console for SHAKED.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${ibmPlexSans.variable}`}>{children}</body>
    </html>
  );
}
