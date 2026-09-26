"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Search, Menu, LogOut } from "lucide-react";
import { useSidebar } from "@/src/context/SidebarContext";
import { createClient } from "@/src/infrastructure/supabase/client";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const [userName, setUserName] = useState<string>("Wilfried Tiendrebeogo");
  const [userRole, setUserRole] = useState<string>("CEO / Owner");
  const [userInitials, setUserInitials] = useState<string>("WT");
  const [unreadNotifications, setUnreadNotifications] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const meta = user.user_metadata;
          const fn = meta?.first_name || "Wilfried";
          const ln = meta?.last_name || "Tiendrebeogo";
          const fullName = `${fn} ${ln}`.trim();
          setUserName(fullName);

          const { data: roleRows } = await supabase
            .from("user_organization_roles")
            .select("role")
            .eq("user_id", user.id)
            .is("deleted_at", null);

          if (roleRows && roleRows.length > 0) {
            const r = roleRows[0].role;
            setUserRole(r === "CEO" || r === "OWNER" ? "CEO / Owner" : r === "COMMERCIAL" ? "Commercial" : "Livreur");
          }

          const init = (fn[0] || "W") + (ln[0] || "T");
          setUserInitials(init.toUpperCase());
        }
      } catch (_err) {
        // Fallback default
      }
    }
    loadUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (_e) {}
    router.push("/login");
  };

  return (
    <header className="h-16 border-b border-[#EBE5DA] bg-[#F8F5EE]/95 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Hamburger & Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 text-stone-600 hover:text-[#1F1917] hover:bg-[#EFEADF] rounded-xl transition-colors focus:outline-none"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un client, une commande, une conversation..."
            className="w-full bg-white border border-[#EBE5DA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#1F1917] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] transition-all font-medium"
          />
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick System Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-900 border border-emerald-300 text-[11px] font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>WILLShop OS • En ligne</span>
        </div>

        {/* Notifications Bell */}
        <button
          className="relative p-2 text-stone-600 hover:text-[#1F1917] hover:bg-[#EFEADF] rounded-xl transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#800020] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* User Account Profile Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#EBE5DA]">
          <div className="w-9 h-9 rounded-full bg-[#800020] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-[#D4A843]/50">
            {userInitials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-extrabold text-[#1F1917] leading-tight">{userName}</p>
            <p className="text-[10px] font-bold text-stone-500">{userRole}</p>
          </div>

          <button
            onClick={handleSignOut}
            title="Déconnexion"
            className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
