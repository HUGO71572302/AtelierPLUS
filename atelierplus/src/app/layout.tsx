import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../styles/readability.css";
import "../styles/recovery.css";
import "../styles/tools.css";
import "../styles/catalog.css";
import { AppProviders } from "@/app/providers";

export const metadata: Metadata = {
  title: "AtelierPLUS — Votre atelier, au clair",
  description: "Clients, mensurations, commandes et paiements pour votre atelier de couture. Même hors-ligne.",
  applicationName: "AtelierPLUS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "AtelierPLUS",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#293a32",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
