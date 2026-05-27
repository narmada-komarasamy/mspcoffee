import type { Metadata } from "next";
import { Exo_2, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// ── Primary UI font — used everywhere via var(--t-font) ────────────────────
const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

// ── Display serif — for elegant page titles (e.g. Rainfall, Home) ──────────
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
});

// ── Monospace — for timestamps, log entries, numeric displays ──────────────
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MSP Coffee",
  description: "Plantation management dashboard for MSP Coffee estates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${exo2.variable} ${cormorant.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
