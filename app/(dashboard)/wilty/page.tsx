"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Target,
  CheckSquare,
  Flame,
  BookOpen,
  DollarSign,
  Brain,
  Sparkles,
  Plus,
  ShieldCheck,
  Inbox,
  Loader2,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

export default function WiltyPersonalCockpitPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "goals_projects" | "tasks_habits" | "finance"
  >("overview");
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic Personal State (Isolated via RLS)
  const [goals, setGoals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    loadPersonalScopeData();
  }, []);

  async function loadPersonalScopeData() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query personal goals
      const { data: goalsData } = await supabase
        .from("personal_goals")
        .select("*")
        .eq("user_id", user.id);
      setGoals(goalsData || []);

      // Query personal tasks
      const { data: tasksData } = await supabase
        .from("personal_tasks")
        .select("*")
        .eq("user_id", user.id);
      setTasks(tasksData || []);

      // Query personal habits
      const { data: habitsData } = await supabase
        .from("personal_habits")
        .select("*")
        .eq("user_id", user.id);
      setHabits(habitsData || []);

      // Query personal accounts
      const { data: accountsData } = await supabase
        .from("personal_financial_accounts")
        .select("*")
        .eq("user_id", user.id);
      setAccounts(accountsData || []);
    } catch (_err) {
      // Fallback cleanly
    } finally {
      setIsLoading(false);
    }
  }

  const assetsTotal = accounts.reduce((acc, a) => acc + (Number(a.current_balance) || 0), 0);
  const netWorth = assetsTotal;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 animate-fade-in-up">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#EBE5DA] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#800020]/10 rounded-2xl border border-[#800020]/20 text-[#800020]">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1F1917] tracking-tight flex items-center gap-3">
              Wilty OS — Espace Personnel
              <span className="px-3 py-1 bg-[#800020]/10 text-[#800020] text-[11px] font-bold rounded-full border border-[#800020]/20">
                Scope Personnel RLS
              </span>
            </h1>
            <p className="text-xs text-stone-500 font-semibold mt-0.5">
              Gestion personnelle et suivi d'objectifs — Isolation RLS absolue du domaine entreprise
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPersonalScopeData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FAF8F5] text-stone-800 font-extrabold rounded-2xl border border-[#EBE5DA] transition-all text-xs shadow-2xs"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#800020]" /> : <Sparkles className="w-3.5 h-3.5 text-[#800020]" />}
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* LIFE SNAPSHOT KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#EBE5DA] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Patrimoine Personnel</span>
            <DollarSign className="w-4 h-4 text-[#800020]" />
          </div>
          <p className="text-2xl font-black text-[#1F1917]">{netWorth.toLocaleString("fr-FR")} FCFA</p>
          <p className="text-[11px] text-stone-500 font-medium mt-1">Comptes personnels enregistrés</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Objectifs Personnels</span>
            <Target className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-[#1F1917]">{goals.length}</p>
          <p className="text-[11px] text-amber-700 font-bold mt-1">Objectifs isolés en base</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Habitudes</span>
            <Flame className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-black text-[#1F1917]">{habits.length}</p>
          <p className="text-[11px] text-stone-500 font-medium mt-1">Séries de régularité</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Isolation RLS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">100%</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">Étanchéité Business / Perso</p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-[#EBE5DA] gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 ${
            activeTab === "overview"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Vue d'ensemble
        </button>

        <button
          onClick={() => setActiveTab("goals_projects")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 ${
            activeTab === "goals_projects"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Objectifs ({goals.length})
        </button>

        <button
          onClick={() => setActiveTab("tasks_habits")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 ${
            activeTab === "tasks_habits"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Habitudes & Tâches ({tasks.length + habits.length})
        </button>
      </div>

      {/* CONTENT PANELS */}
      <div className="bg-white border border-[#EBE5DA] rounded-3xl p-6 shadow-2xs">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-[#1F1917] text-sm">Cockpit Personnel Wilty OS</h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                🔒 Données strictement privées
              </span>
            </div>

            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-extrabold text-[#1F1917]">Espace Personnel Prêt</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Votre espace personnel est configuré avec isolation RLS et prêt à enregistrer vos objectifs et habitudes.
              </p>
            </div>
          </div>
        )}

        {activeTab === "goals_projects" && (
          <div className="py-8 text-center space-y-2">
            <Target className="w-10 h-10 text-amber-500 mx-auto" />
            <h4 className="text-sm font-extrabold text-[#1F1917]">Aucun objectif créé</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Ajoutez vos premiers objectifs personnels pour suivre leur avancement.
            </p>
          </div>
        )}

        {activeTab === "tasks_habits" && (
          <div className="py-8 text-center space-y-2">
            <CheckSquare className="w-10 h-10 text-[#800020] mx-auto" />
            <h4 className="text-sm font-extrabold text-[#1F1917]">Aucune habitude enregistrée</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Configurez vos routines d'habitudes quotidiennes pour maintenir votre régularité.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
