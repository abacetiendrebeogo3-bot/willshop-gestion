"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Sun,
  LayoutDashboard,
  MessageSquare,
  Package,
  Wallet,
  Megaphone,
  Users,
  BrainCircuit,
  Target,
  UserCheck,
  Settings,
  ShieldCheck,
  Zap,
  X,
  ShoppingCart,
  Truck,
  Bot,
  User,
  MapPin,
  Clock,
} from "lucide-react";
import { useSidebar } from "@/src/context/SidebarContext";

const COMMERCIAL_NAV_ITEMS = [
  { name: "☀️ Ma Journée", href: "/sales/my-day", icon: Sun },
  { name: "💬 Conversations", href: "/sales", icon: MessageSquare },
  { name: "👥 Mes Clients", href: "/sales/customers", icon: Users },
  { name: "🛒 Commandes", href: "/orders", icon: ShoppingCart },
  { name: "📊 Mon Activité", href: "/sales/my-activity", icon: Zap },
];

const LIVREUR_NAV_ITEMS = [
  { name: "🚚 Mes Livraisons", href: "/delivery/my-deliveries", icon: Truck },
  { name: "📍 Carte & Itinéraire", href: "/delivery", icon: MapPin },
  { name: "📜 Historique", href: "/delivery", icon: Clock },
];

const CEO_NAV_ITEMS = [
  { name: "🧭 Ma Direction", href: "/ceo", icon: LayoutDashboard },
  { name: "☀️ Ma Journée", href: "/sales/my-day", icon: Sun },
  { name: "💬 Conversations", href: "/sales", icon: MessageSquare },
  { name: "🛒 Ventes & Commandes", href: "/orders", icon: ShoppingCart },
  { name: "🚚 Livraisons", href: "/delivery", icon: Truck },
  { name: "📦 Stock & Produits", href: "/operations/products", icon: Package },
  { name: "💰 Finance", href: "/finance", icon: Wallet },
  { name: "📣 Marketing", href: "/marketing", icon: Megaphone },
  { name: "👥 Équipe", href: "/team", icon: Users },
  { name: "🧠 Intelligence", href: "/intelligence", icon: BrainCircuit },
  { name: "🎯 Stratégie", href: "/strategy", icon: Target },
  { name: "⚙️ Paramètres", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, closeSidebar } = useSidebar();
  const [userRole, setUserRole] = useState<string>("COMMERCIAL");

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: roleRows } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", user.id)
            .is("deleted_at", null);

          if (roleRows && roleRows.length > 0) {
            setUserRole(roleRows[0].role || "COMMERCIAL");
          }
        }
      } catch (_err) {
        // Fallback default
      }
    };

    fetchUserRole();
  }, []);

  const navItems =
    userRole === "LIVREUR"
      ? LIVREUR_NAV_ITEMS
      : userRole === "COMMERCIAL"
      ? COMMERCIAL_NAV_ITEMS
      : CEO_NAV_ITEMS;

  const mobileBottomItems =
    userRole === "LIVREUR"
      ? [
          { name: "Livraisons", href: "/delivery/my-deliveries", icon: Truck },
          { name: "Aujourd'hui", href: "/delivery", icon: MapPin },
          { name: "Historique", href: "/delivery", icon: Clock },
        ]
      : userRole === "COMMERCIAL"
      ? [
          { name: "Ma Journée", href: "/sales/my-day", icon: Sun },
          { name: "Conversations", href: "/sales", icon: MessageSquare },
          { name: "Commandes", href: "/orders", icon: ShoppingCart },
        ]
      : [
          { name: "Ma Direction", href: "/ceo", icon: LayoutDashboard },
          { name: "Ventes", href: "/orders", icon: ShoppingCart },
          { name: "Équipe", href: "/team", icon: Users },
        ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-fade-in transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Desktop & Drawer Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div>
          {/* Header Branding */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold font-mono text-white text-lg shadow-sm border border-blue-600">
                W
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm tracking-wide">WILLShop OS</h1>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {userRole === "LIVREUR"
                    ? "Espace Livreur"
                    : userRole === "COMMERCIAL"
                    ? "Espace Commercial"
                    : "Cockpit Dirigeant"}
                </div>
              </div>
            </div>

            {/* Mobile Close Drawer Button */}
            <button
              onClick={closeSidebar}
              className="md:hidden text-gray-500 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#2563EB] text-white font-semibold shadow-xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-700"}`} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Org & Profile Badge */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#2563EB]" />
              <div>
                <p className="font-semibold text-gray-900">WillShop OS</p>
                <p className="text-[10px] text-gray-500 font-mono">Burkina Faso • XOF</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
              {userRole}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center justify-around py-2 px-3 shadow-lg">
        {mobileBottomItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-[#2563EB] font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
