import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Dashboard Patroli Kesling & K3 — RSOMH",
  description:
    "Dashboard pemantauan kepatuhan patroli Keselamatan Lingkungan dan K3 Rumah Sakit Otak Muhammad Hatta (RSOMH). Monitoring 17 topik patroli keselamatan berbasis data Google Forms.",
  keywords: ["K3", "Kesling", "safety patrol", "RSOMH", "keselamatan", "dashboard"],
  authors: [{ name: "Tim Kesling & K3 RSOMH" }],
  icons: {
    icon: "/K3_logo.png",
    apple: "/K3_logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    title: "Patroli K3",
    statusBarStyle: "default",
    capable: true,
  },
};

export const viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-[var(--bg-base)] text-[var(--text-main)] transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
