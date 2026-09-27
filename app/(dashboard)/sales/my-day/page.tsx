"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sun,
  Bot,
  Paperclip,
  Send,
  MessageSquare,
  ShoppingCart,
  Truck,
  Phone,
  ChevronRight,
  Play,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/src/infrastructure/supabase/client";

export default function CommercialHomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Commercial");
  const [questionText, setQuestionText] = useState<string>("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [convCount, setConvCount] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [todayDateStr, setTodayDateStr] = useState<string>("");

  useEffect(() => {
    const today = new Date();
    setTodayDateStr(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));

    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Query team_employees for first_name
          const cleanPhone = user.user_metadata?.phone || user.phone || "";
          const cleanDigits = (cleanPhone || user.email?.split("@")[0] || "").replace(/[^\d]/g, "");

          const { data: emp } = await supabase
            .from("team_employees")
            .select("first_name, last_name")
            .or(`user_id.eq.${user.id},phone.eq.${cleanPhone},phone.eq.+${cleanDigits}`)
            .limit(1)
            .maybeSingle();

          if (emp && emp.first_name) {
            setUserName(emp.first_name);
          } else if (user.user_metadata?.first_name) {
            setUserName(user.user_metadata.first_name);
          } else if (user.user_metadata?.full_name) {
            setUserName(user.user_metadata.full_name.split(" ")[0]);
          } else if (user.email && !user.email.endsWith("@willshop.bf")) {
            const prefix = user.email.split("@")[0];
            setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          } else {
            setUserName("Yasmine");
          }
        }

        const { data: roleData } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user?.id || "")
          .is("deleted_at", null)
          .limit(1);

        const orgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;

        if (orgId) {
          const { count: cCount } = await supabase
            .from("whatsapp_conversations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId);
          setConvCount(cCount || 0);

          const { count: oCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId);
          setOrderCount(oCount || 0);
        }
      } catch (_e) {
        // Fallback gracefully
      }
    }

    loadData();
  }, []);

  const handleAskQuestion = (q: string) => {
    setQuestionText(q);
    if (q.includes("conversations")) {
      setAssistantResponse(
        convCount > 0
          ? `Vous avez ${convCount} conversation(s) enregistrée(s) dans votre espace d'entreprise.`
          : "Aucune conversation WhatsApp enregistrée pour le moment."
      );
    } else if (q.includes("commandes")) {
      setAssistantResponse(
        orderCount > 0
          ? `Vous avez ${orderCount} commande(s) active(s) enregistrée(s).`
          : "Aucune commande enregistrée pour le moment."
      );
    } else if (q.includes("relances")) {
      setAssistantResponse("Aucune relance automatique à effectuer pour l'instant.");
    } else {
      setAssistantResponse(`Bienvenue ${userName} ! Votre tableau de bord est synchronisé en temps réel avec votre base de données.`);
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
            Salut {userName} !
          </h1>
          <p className="text-sm text-stone-500 font-semibold mt-1">
            Comment puis-je vous aider aujourd'hui ?
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-600 bg-white border border-[#EBE5DA] px-3.5 py-1.5 rounded-full shadow-2xs">
          <Sun className="w-4 h-4 text-amber-500" />
          <span className="capitalize">{todayDateStr || "Aujourd'hui"}</span>
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
              Je suis là pour vous accompagner tout au long de votre journée. Que souhaitez-vous faire maintenant ?
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
              <span>Réponse de l'Assistant :</span>
            </div>
            <p className="text-amber-900 font-medium">{assistantResponse}</p>
          </div>
        )}

        {/* 4 Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAskQuestion("Mes conversations en attente")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Mes conversations en attente
          </button>
          <button
            onClick={() => handleAskQuestion("Mes commandes du jour")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Mes commandes du jour
          </button>
          <button
            onClick={() => handleAskQuestion("Mes relances")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Mes relances
          </button>
          <button
            onClick={() => handleAskQuestion("Mon activité aujourd'hui")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Mon activité aujourd'hui
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: NAVIGATION CARDS GRID ("Vos actions du jour") */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1F1917]">Vos actions du jour</h2>
          <Link
            href="/sales"
            className="text-xs font-extrabold text-[#800020] hover:underline flex items-center gap-1"
          >
            <span>Voir tout</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Voir les conversations */}
          <Link
            href="/sales"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group relative"
          >
            {/* Colored Icon Circle with Red Badge */}
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <MessageSquare className="w-7 h-7" />
              </div>
              {convCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-white shadow-2xs">
                  {convCount}
                </span>
              )}
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les conversations
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

          {/* Card 4: Voir les relances */}
          <Link
            href="/sales/followups"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Phone className="w-7 h-7" />
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les relances
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
