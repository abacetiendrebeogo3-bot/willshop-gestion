import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { SidebarProvider } from "@/src/context/SidebarContext";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

export const viewport: Viewport = {
  themeColor: "#800020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "WILLShop OS — Cockpit Intelligent CEO",
  description: "Le système d'exploitation commercial de votre entreprise.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WILLShop OS",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "application-name": "WILLShop",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-background text-foreground antialiased flex min-h-screen">
        <SidebarProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
            <Navbar />
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">{children}</main>
          </div>
          <ServiceWorkerRegister />
          <PwaInstallPrompt />
        </SidebarProvider>
      </body>
    </html>
  );
}
