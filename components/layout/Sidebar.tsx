"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Settings,
  Zap,
  X,
  ShoppingCart,
  Truck,
  MapPin,
  Clock,
  ChevronDown,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useSidebar } from "@/src/context/SidebarContext";

type ActiveSpace = "CEO" | "COMMERCIAL" | "LIVREUR";

function getSpaceFromPathname(pathname: string): ActiveSpace {
  if (pathname.startsWith("/delivery")) {
    return "LIVREUR";
  }
  if (
    pathname.startsWith("/sales/my-day") ||
    pathname === "/sales" ||
    pathname.startsWith("/sales/my-activity") ||
    pathname.startsWith("/sales/followups")
  ) {
    return "COMMERCIAL";
  }
  // All management, CEO, team, orders, finance, settings, products, marketing routes default to CEO
  return "CEO";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, closeSidebar } = useSidebar();
  const [activeSpace, setActiveSpace] = useState<ActiveSpace>(() => getSpaceFromPathname(pathname));
  const [userRole, setUserRole] = useState<ActiveSpace | null>(null);
  const [userName, setUserName] = useState<string>("Wilfried Tiendrebeogo");

  // Fetch real user role from Supabase (Source of Truth)
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const cleanPhone = user.user_metadata?.phone || user.phone || "";
          const cleanDigits = (cleanPhone || user.email?.split("@")[0] || "").replace(/[^\d]/g, "");

          const { data: emp } = await supabase
            .from("team_employees")
            .select("first_name, last_name")
            .or(`user_id.eq.${user.id},phone.eq.${cleanPhone},phone.eq.+${cleanDigits}`)
            .limit(1)
            .maybeSingle();

          if (emp && emp.first_name) {
            setUserName(`${emp.first_name} ${emp.last_name || ""}`.trim());
          } else {
            const meta = user.user_metadata;
            if (meta?.first_name || meta?.last_name) {
              setUserName(`${meta.first_name || ""} ${meta.last_name || ""}`.trim());
            }
          }

          const { data: roleRows } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", user.id)
            .is("deleted_at", null);

          if (roleRows && roleRows.length > 0) {
            const r = roleRows[0].role;
            if (r === "LIVREUR" || r === "DRIVER") setUserRole("LIVREUR");
            else if (r === "COMMERCIAL" || r === "SALES") setUserRole("COMMERCIAL");
            else setUserRole("CEO");
          }
        }
      } catch (_err) {
        // Fallback
      }
    }
    fetchUserRole();
  }, []);

  // Synchronize active space: User role has priority, fallback to route-based mapping
  useEffect(() => {
    if (userRole) {
      setActiveSpace(userRole);
    } else {
      setActiveSpace(getSpaceFromPathname(pathname));
    }
  }, [pathname, userRole]);

  const CEO_ITEMS = [
    { name: "Accueil", href: "/ceo", icon: LayoutDashboard },
    { name: "Ventes", href: "/sales", icon: TrendingUp },
    { name: "WhatsApp CRM", href: "/whatsapp", icon: MessageSquare },
    { name: "Commandes", href: "/orders", icon: ShoppingCart },
    { name: "Livraisons", href: "/delivery", icon: Truck },
    { name: "Équipe", href: "/team", icon: Users },
    { name: "Clients", href: "/sales/customers", icon: Users },
    { name: "Finance", href: "/finance", icon: Wallet },
    { name: "Rapports", href: "/bi", icon: BrainCircuit },
    { name: "Paramètres", href: "/settings", icon: Settings },
  ];

  const COMMERCIAL_ITEMS = [
    { name: "Accueil", href: "/sales/my-day", icon: Sun },
    { name: "WhatsApp CRM", href: "/whatsapp", icon: MessageSquare },
    { name: "Conversations", href: "/sales", icon: MessageSquare },
    { name: "Clients", href: "/sales/customers", icon: Users },
    { name: "Commandes", href: "/orders", icon: ShoppingCart },
    { name: "Mon Activité", href: "/sales/my-activity", icon: Zap },
  ];

  const LIVREUR_ITEMS = [
    { name: "Mes Livraisons", href: "/delivery/my-deliveries", icon: Truck },
    { name: "Carte & Itinéraire", href: "/delivery", icon: MapPin },
  ];

  const currentNavItems =
    activeSpace === "CEO" ? CEO_ITEMS : activeSpace === "COMMERCIAL" ? COMMERCIAL_ITEMS : LIVREUR_ITEMS;

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

      {/* Desktop & Mobile Drawer Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-[#F8F5EE] border-r border-[#EBE5DA] flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-2xs ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header Branding matching WILLShop identity */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#EBE5DA] bg-[#F8F5EE] shrink-0">
            <div className="flex items-center gap-3">
              {/* Circular Bordeaux Logo Badge with Gold Bag Icon */}
              <div className="w-9 h-9 rounded-full bg-[#800020] flex items-center justify-center text-[#D4A843] shadow-xs ring-2 ring-[#D4A843]/40">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-black text-[#1F1917] text-sm tracking-tight flex items-center gap-1">
                  WILLShop <span className="text-[#800020]">OS</span>
                </h1>
                <p className="text-[10px] text-stone-500 font-bold">Système Commercial</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={closeSidebar}
              className="md:hidden text-stone-500 hover:text-[#1F1917] p-1.5 rounded-lg hover:bg-[#EFEADF] transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SPACE / ROLE DISPLAY SECTION (Non-clickable) */}
          <div className="p-4 border-b border-[#EBE5DA] bg-[#F2ECE1]/60 shrink-0">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider block mb-1.5 px-1">
              Espace actif
            </label>

            <div className="w-full bg-[#800020] text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between shadow-xs select-none">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#D4A843]"></span>
                <span>
                  {activeSpace === "CEO"
                    ? "Ma Direction (CEO)"
                    : activeSpace === "COMMERCIAL"
                    ? "Ma Journée (Commercial)"
                    : "Mes Livraisons (Livreur)"}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 flex-1">
            <div className="text-[10px] font-black text-stone-400 uppercase tracking-wider px-3 pt-2 pb-1">
              {activeSpace === "CEO" ? "Menu Direction" : activeSpace === "COMMERCIAL" ? "Menu Commercial" : "Menu Livreur"}
            </div>

            {currentNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={`${activeSpace}-${item.name}`}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 ${
                    isActive
                      ? "bg-[#800020] text-white shadow-2xs"
                      : "text-stone-700 hover:text-[#1F1917] hover:bg-[#EFEADF]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? "text-[#D4A843]" : "text-stone-400 group-hover:text-[#1F1917]"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer User & Org Badge */}
          <div className="p-4 border-t border-[#EBE5DA] bg-[#F2ECE1]/40 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="truncate">
                <p className="font-extrabold text-[#1F1917] truncate">WILLShop OS</p>
                <p className="text-[10px] text-stone-500 font-bold">Ouagadougou • XOF</p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#800020]/10 text-[#800020] border border-[#800020]/20 shrink-0">
                {activeSpace}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
