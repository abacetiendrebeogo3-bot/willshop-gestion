import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { SidebarProvider } from "@/src/context/SidebarContext";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { FloatingAIAssistant } from "@/components/ai/FloatingAIAssistant";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"] });

export const viewport: Viewport = {
  themeColor: "#800020",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "WILLShop OS — Système d'Exploitation Commercial",
  description: "Votre activité commercial, plus simple.",
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
    <html lang="fr" className={`light ${inter.variable} ${playfair.variable}`}>
      <body className="bg-[#F8F5EE] text-[#1F1917] antialiased flex min-h-screen font-sans">
        <SidebarProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden bg-[#F8F5EE]">
            <Navbar />
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">{children}</main>
          </div>
          <ServiceWorkerRegister />
          <PwaInstallPrompt />
          <FloatingAIAssistant />
        </SidebarProvider>
      </body>
    </html>
  );
}
