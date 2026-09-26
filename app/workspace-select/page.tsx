"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sun,
  Truck,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function WorkspaceSelectPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#1F1917] flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in-up">
      {/* Container matching Screen 2 in input_file_0.png */}
      <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl border border-[#EBE5DA] shadow-sm space-y-6 text-center relative overflow-hidden">
        {/* Brand Badge */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#800020] text-[#D4A843] flex items-center justify-center font-black shadow-2xs">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="font-black text-[#1F1917] text-sm">
            WILLShop <span className="text-[#800020]">OS</span>
          </span>
        </div>

        {/* User Greeting & Avatar */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-full bg-[#800020] text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-md ring-4 ring-[#D4A843]/30">
            YD
          </div>
          <h1 className="text-2xl font-black text-[#1F1917]">Bonjour Yasmine !</h1>
          <p className="text-xs font-semibold text-stone-500">Quel est votre espace aujourd'hui ?</p>
        </div>

        {/* 3 Interactive Choice Cards matching Screen 2 in input_file_0.png */}
        <div className="space-y-3 text-left">
          {/* Card 1: Ma Direction */}
          <Link
            href="/ceo"
            className="p-4 rounded-2xl border border-[#EBE5DA] bg-[#FAF8F3] hover:bg-[#F2ECE1] hover:border-[#800020]/30 transition-all flex items-center justify-between gap-4 group shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#D4A843]/20 text-[#800020] flex items-center justify-center shrink-0 border border-[#D4A843]/30">
                <LayoutDashboard className="w-5 h-5 text-[#800020]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1F1917] text-sm group-hover:text-[#800020] transition-colors">
                  Ma Direction
                </h3>
                <p className="text-xs text-stone-500 font-medium">Voir l'essentiel et décider</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:translate-x-1 group-hover:text-[#800020] transition-all" />
          </Link>

          {/* Card 2: Ma Journée */}
          <Link
            href="/sales/my-day"
            className="p-4 rounded-2xl border border-[#EBE5DA] bg-[#FAF8F3] hover:bg-[#F2ECE1] hover:border-[#800020]/30 transition-all flex items-center justify-between gap-4 group shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center shrink-0 border border-[#800020]/20">
                <Sun className="w-5 h-5 text-[#800020]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1F1917] text-sm group-hover:text-[#800020] transition-colors">
                  Ma Journée
                </h3>
                <p className="text-xs text-stone-500 font-medium">Vendre et suivre mes clients</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:translate-x-1 group-hover:text-[#800020] transition-all" />
          </Link>

          {/* Card 3: Mes Livraisons */}
          <Link
            href="/delivery/my-deliveries"
            className="p-4 rounded-2xl border border-[#EBE5DA] bg-[#FAF8F3] hover:bg-[#F2ECE1] hover:border-[#800020]/30 transition-all flex items-center justify-between gap-4 group shadow-2xs"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                <Truck className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1F1917] text-sm group-hover:text-[#800020] transition-colors">
                  Mes Livraisons
                </h3>
                <p className="text-xs text-stone-500 font-medium">Livrer facilement</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:translate-x-1 group-hover:text-[#800020] transition-all" />
          </Link>
        </div>

        {/* Footer */}
        <div className="pt-2 text-[11px] text-stone-400 font-medium">
          WILLShop OS • Burkina Faso
        </div>
      </div>
    </div>
  );
}
