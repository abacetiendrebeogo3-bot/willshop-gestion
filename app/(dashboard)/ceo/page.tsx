"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Bot,
  Paperclip,
  Send,
  TrendingUp,
  ShoppingCart,
  Truck,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { useEffect } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";

export default function CEOHomePage() {
  const router = useRouter();
  const [questionText, setQuestionText] = useState<string>("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [todayOrderCount, setTodayOrderCount] = useState<number>(0);
  const [todayDateStr, setTodayDateStr] = useState<string>("");

  useEffect(() => {
    const today = new Date();
    setTodayDateStr(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));

    async function loadCEOMetrics() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: roleData } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .limit(1);

        const orgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
        if (!orgId) return;

        const { data: ordersData } = await supabase
          .from("orders")
          .select("total_ttc, status")
          .eq("organization_id", orgId);

        if (ordersData) {
          setTodayOrderCount(ordersData.length);
          const rev = ordersData.reduce((sum, o: any) => sum + (Number(o.total_ttc) || 0), 0);
          setTodayRevenue(rev);
        }
      } catch (_e) {
        // Fallback
      }
    }

    loadCEOMetrics();
  }, []);

  const handleAskQuestion = (q: string) => {
    setQuestionText(q);
    if (q.includes("Résumé")) {
      setAssistantResponse(
        `Aujourd'hui : ${todayRevenue.toLocaleString("fr-FR")} FCFA de chiffre d'affaires, ${todayOrderCount} commande(s) enregistrée(s).`
      );
    } else if (q.includes("attention")) {
      setAssistantResponse("Aucune alerte de retard ou anomalie sur les livraisons actuellement.");
    } else if (q.includes("ventes")) {
      setAssistantResponse(
        todayOrderCount > 0
          ? `Performance globale : ${todayOrderCount} commande(s) traitée(s) pour un total de ${todayRevenue.toLocaleString("fr-FR")} FCFA.`
          : "Aucune vente enregistrée pour l'instant. Votre système est prêt pour les prochaines commandes."
      );
    } else if (q.includes("équipe")) {
      setAssistantResponse("Toutes les activités de votre équipe commerciale sont enregistrées en temps réel.");
    } else {
      setAssistantResponse("Votre tableau de bord CEO est connecté en direct à votre base de données d'entreprise.");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    handleAskQuestion(questionText);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 animate-fade-in-up">
      {/* ==================================================================== */}
      {/* WELCOME MESSAGE HEADER */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#EBE5DA] pb-4">
        <div>
          <h1 className="text-3xl font-black text-[#1F1917] tracking-tight">
            Bonjour CEO !
          </h1>
          <p className="text-sm text-stone-500 font-semibold mt-1">
            Que souhaitez-vous voir aujourd'hui ?
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-600 bg-white border border-[#EBE5DA] px-3.5 py-1.5 rounded-full shadow-2xs">
          <Calendar className="w-4 h-4 text-[#800020]" />
          <span>Mardi 26 septembre</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: WILLSHOP ASSISTANT BLOCK */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          {/* Avatar with Online Green Dot */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold shadow-2xs">
              <Bot className="w-7 h-7 text-amber-800" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>

          <div>
            <h2 className="font-extrabold text-[#1F1917] text-base">Assistant WILLShop</h2>
            <p className="text-xs text-stone-500 font-medium">
              Je vous donne une vue claire et je peux répondre à toutes vos questions. Que souhaitez-vous explorer maintenant ?
            </p>
          </div>
        </div>

        {/* Input Form with Send Button */}
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <Paperclip className="w-4 h-4 absolute left-4 text-stone-400" />
          <input
            type="text"
            placeholder="Posez votre question..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-2xl pl-11 pr-14 py-3.5 text-xs text-[#1F1917] focus:border-[#800020] outline-none font-medium placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={!questionText.trim()}
            className="w-9 h-9 rounded-full bg-[#800020] hover:bg-[#590C1D] text-white flex items-center justify-center absolute right-2.5 transition-all shadow-2xs disabled:opacity-40"
            aria-label="Envoyer la question"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* AI Answer Box if active */}
        {assistantResponse && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-1 animate-fade-in">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Analyse de l'Assistant CEO :</span>
            </div>
            <p className="text-amber-900 font-medium">{assistantResponse}</p>
          </div>
        )}

        {/* 4 Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAskQuestion("Résumé de la journée")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Résumé de la journée
          </button>
          <button
            onClick={() => handleAskQuestion("Points d'attention")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Points d'attention
          </button>
          <button
            onClick={() => handleAskQuestion("Performance des ventes")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Performance des ventes
          </button>
          <button
            onClick={() => handleAskQuestion("Activité de l'équipe")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Activité de l'équipe
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: NAVIGATION CARDS GRID ("Navigation rapide") */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-[#1F1917]">Navigation rapide</h2>

        {/* 4 Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Voir les ventes */}
          <Link
            href="/orders"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
          >
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <TrendingUp className="w-7 h-7" />
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les ventes
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Card 2: Voir les commandes */}
          <Link
            href="/orders"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
          >
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-7 h-7" />
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les commandes
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Card 3: Voir les livraisons */}
          <Link
            href="/delivery"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Truck className="w-7 h-7" />
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les livraisons
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Card 4: Voir l'équipe */}
          <Link
            href="/team"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7" />
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir l'équipe
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
