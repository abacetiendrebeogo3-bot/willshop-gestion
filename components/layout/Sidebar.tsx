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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, closeSidebar } = useSidebar();
  const [activeSpace, setActiveSpace] = useState<ActiveSpace>("CEO");
  const [showSpaceDropdown, setShowSpaceDropdown] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("Wilfried Tiendrebeogo");

  // Determine current active space from pathname
  useEffect(() => {
    if (pathname.startsWith("/delivery")) {
      setActiveSpace("LIVREUR");
    } else if (pathname.startsWith("/sales/my-day") || pathname === "/sales/customers") {
      setActiveSpace("COMMERCIAL");
    } else if (pathname.startsWith("/ceo") || pathname === "/orders" || pathname === "/finance" || pathname === "/settings") {
      setActiveSpace("CEO");
    }
  }, [pathname]);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const meta = user.user_metadata;
          if (meta?.first_name || meta?.last_name) {
            setUserName(`${meta.first_name || ""} ${meta.last_name || ""}`.trim());
          }

          const { data: roleRows } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", user.id)
            .is("deleted_at", null);

          if (roleRows && roleRows.length > 0) {
            const r = roleRows[0].role;
            if (r === "LIVREUR") setActiveSpace("LIVREUR");
            else if (r === "COMMERCIAL") setActiveSpace("COMMERCIAL");
            else setActiveSpace("CEO");
          }
        }
      } catch (_err) {
        // Fallback default
      }
    }
    fetchUserRole();
  }, []);

  const handleSwitchSpace = (space: ActiveSpace) => {
    setActiveSpace(space);
    setShowSpaceDropdown(false);
    if (space === "CEO") router.push("/ceo");
    else if (space === "COMMERCIAL") router.push("/sales/my-day");
    else if (space === "LIVREUR") router.push("/delivery/my-deliveries");
  };

  const CEO_ITEMS = [
    { name: "Accueil", href: "/ceo", icon: LayoutDashboard },
    { name: "Ventes", href: "/orders", icon: TrendingUp },
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
    { name: "Conversations", href: "/sales", icon: MessageSquare },
    { name: "Clients", href: "/sales/customers", icon: Users },
    { name: "Commandes", href: "/orders", icon: ShoppingCart },
    { name: "Mon Activité", href: "/sales/my-activity", icon: Zap },
  ];

  const LIVREUR_ITEMS = [
    { name: "Mes Livraisons", href: "/delivery/my-deliveries", icon: Truck },
    { name: "Carte & Itinéraire", href: "/delivery", icon: MapPin },
    { name: "Historique", href: "/delivery", icon: Clock },
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

          {/* SPACE / ROLE SWITCHER SECTION */}
          <div className="p-4 border-b border-[#EBE5DA] bg-[#F2ECE1]/60 shrink-0 relative">
            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider block mb-1.5 px-1">
              Espace actif
            </label>

            <button
              onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
              className="w-full bg-[#800020] text-white hover:bg-[#590C1D] px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between shadow-xs transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse"></span>
                <span>
                  {activeSpace === "CEO"
                    ? "Ma Direction (CEO)"
                    : activeSpace === "COMMERCIAL"
                    ? "Ma Journée (Commercial)"
                    : "Mes Livraisons (Livreur)"}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#D4A843] transition-transform ${showSpaceDropdown ? "rotate-180" : ""}`} />
            </button>

            {/* Space Selection Dropdown */}
            {showSpaceDropdown && (
              <div className="absolute left-4 right-4 top-16 bg-white border border-[#EBE5DA] rounded-xl shadow-xl z-50 p-1.5 space-y-1 animate-fade-in">
                <button
                  onClick={() => handleSwitchSpace("CEO")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                    activeSpace === "CEO" ? "bg-[#800020]/10 text-[#800020]" : "text-[#1F1917] hover:bg-[#F8F5EE]"
                  }`}
                >
                  <span>🧭 CEO / Owner (Ma Direction)</span>
                  {activeSpace === "CEO" && <span className="text-[10px] bg-[#800020] text-white px-1.5 py-0.5 rounded font-bold">Actif</span>}
                </button>
                <button
                  onClick={() => handleSwitchSpace("COMMERCIAL")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                    activeSpace === "COMMERCIAL" ? "bg-[#800020]/10 text-[#800020]" : "text-[#1F1917] hover:bg-[#F8F5EE]"
                  }`}
                >
                  <span>☀️ Commercial (Ma Journée)</span>
                  {activeSpace === "COMMERCIAL" && <span className="text-[10px] bg-[#800020] text-white px-1.5 py-0.5 rounded font-bold">Actif</span>}
                </button>
                <button
                  onClick={() => handleSwitchSpace("LIVREUR")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                    activeSpace === "LIVREUR" ? "bg-[#800020]/10 text-[#800020]" : "text-[#1F1917] hover:bg-[#F8F5EE]"
                  }`}
                >
                  <span>🚚 Livreur (Mes Livraisons)</span>
                  {activeSpace === "LIVREUR" && <span className="text-[10px] bg-[#800020] text-white px-1.5 py-0.5 rounded font-bold">Actif</span>}
                </button>
              </div>
            )}
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
                  key={item.href}
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
