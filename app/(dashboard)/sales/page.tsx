"use client";

import React from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import { TrendingUp, Users, ShoppingCart, Target } from "lucide-react";

export default function SalesDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto pb-24 animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-[#1F1917]">Tableau de bord Ventes</h1>
          <p className="text-stone-500 text-sm mt-1">
            Suivi des performances commerciales et du pipeline
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { title: "Chiffre d'affaires", value: "2.4M FCFA", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100" },
          { title: "Commandes", value: "128", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100" },
          { title: "Nouveaux prospects", value: "34", icon: Users, color: "text-amber-600", bg: "bg-amber-100" },
          { title: "Taux de conversion", value: "18%", icon: Target, color: "text-rose-600", bg: "bg-rose-100" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <h3 className="text-xs font-bold text-stone-500 uppercase">{stat.title}</h3>
            </div>
            <p className="text-2xl font-black text-[#1F1917]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-[#EBE5DA] p-8 text-center text-stone-500">
        <p>Le détail du pipeline de vente et des performances des commerciaux s'affichera ici.</p>
      </div>
    </div>
  );
}
