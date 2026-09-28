"use client";

import React, { useState, useEffect } from "react";
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
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wallet,
  Play,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Check,
  Building2,
  Clock,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

interface CEOMetrics {
  yesterdayRevenue: number;
  yesterdayOrdersCount: number;
  todayRevenue: number;
  todayOrdersCount: number;
  cashBalance: number | null;
  orangeMoneyBalance: number | null;
  moovMoneyBalance: number | null;
  treasuryStatus?: "CONFIGURED" | "NOT_CONFIGURED";
  activeTeamCount: number;
  onlineTeamCount: number;
  pendingDeliveriesCount: number;
  deliveredTodayCount: number;
  failedDeliveriesCount: number;
  overdueEngagementsCount: number;
  criticalIssuesCount: number;
  aiRecommendation: string;
}

const REVIEW_STEPS = [
  { key: "HIER", title: "1. Bilan d'Hier", desc: "Chiffre d'affaires et commandes terminées la veille" },
  { key: "ARGENT", title: "2. Trésorerie & Caisse", desc: "Soldes Caisse, Orange Money et Moov Money" },
  { key: "TEAM", title: "3. Équipe & Présence", desc: "Collaborateurs actifs et en ligne" },
  { key: "SALES", title: "4. Ventes & Activité", desc: "Commandes du jour et performances commercial" },
  { key: "DELIVERIES", title: "5. Livraisons du Jour", desc: "Tournées en cours et livraisons effectuées" },
  { key: "PROBLEMS", title: "6. Alerts & Arbitrages", desc: "Livraisons échouées et relances en retard" },
  { key: "FINISH", title: "7. Synthèse & Validation", desc: "Validation de la revue et passage au Dashboard" },
];

export default function CEOHomePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"GUIDED_REVIEW" | "EXECUTIVE_DASHBOARD">("GUIDED_REVIEW");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [todayDateStr, setTodayDateStr] = useState<string>("");

  const [metrics, setMetrics] = useState<CEOMetrics>({
    yesterdayRevenue: 0,
    yesterdayOrdersCount: 0,
    todayRevenue: 0,
    todayOrdersCount: 0,
    cashBalance: null,
    orangeMoneyBalance: null,
    moovMoneyBalance: null,
    treasuryStatus: "NOT_CONFIGURED",
    activeTeamCount: 0,
    onlineTeamCount: 0,
    pendingDeliveriesCount: 0,
    deliveredTodayCount: 0,
    failedDeliveriesCount: 0,
    overdueEngagementsCount: 0,
    criticalIssuesCount: 0,
    aiRecommendation: "Chargement de la vue d'ensemble...",
  });

  const [questionText, setQuestionText] = useState<string>("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
    setTodayDateStr(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));

    // If review already done today, go straight to dashboard
    try {
      const doneKey = localStorage.getItem("ceo_review_done");
      if (doneKey === todayKey) {
        setViewMode("EXECUTIVE_DASHBOARD");
      }
    } catch (_) {}

    loadCEORoutine();
  }, []);

  async function loadCEORoutine() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ceo/routine");
      const data = await res.json();
      if (res.ok && data.status === "SUCCESS") {
        setMetrics(data.metrics);
      }
    } catch (_e) {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }

  const currentStep = REVIEW_STEPS[currentStepIndex];

  const handleNextStep = () => {
    if (currentStepIndex < REVIEW_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Persist today's review as done so it doesn't restart on reload
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        localStorage.setItem("ceo_review_done", todayKey);
      } catch (_) {}
      setViewMode("EXECUTIVE_DASHBOARD");
    }
  };

  const handleAskQuestion = (q: string) => {
    setQuestionText(q);
    if (q.includes("Résumé") || q.includes("journée")) {
      setAssistantResponse(
        `Aujourd'hui : ${metrics.todayRevenue.toLocaleString("fr-FR")} FCFA de CA, ${metrics.todayOrdersCount} commande(s) enregistrée(s).`
      );
    } else if (q.includes("attention") || q.includes("problème")) {
      setAssistantResponse(
        metrics.criticalIssuesCount > 0
          ? `Attention : ${metrics.failedDeliveriesCount} livraison(s) échouée(s) et ${metrics.overdueEngagementsCount} relance(s) en retard.`
          : "Aucune alerte critique enregistrée."
      );
    } else {
      setAssistantResponse(metrics.aiRecommendation);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    handleAskQuestion(questionText);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#EBE5DA] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-black text-[#1F1917] tracking-tight">
              {viewMode === "GUIDED_REVIEW" ? "Ma Direction — Revue Guidée CEO" : "Tableau de Bord Direction"}
            </h1>
          </div>
          <p className="text-sm text-stone-500 font-semibold mt-1">
            {viewMode === "GUIDED_REVIEW"
              ? "Revue séquentielle des opérations (Hier ➔ Trésorerie ➔ Équipe ➔ Ventes ➔ Arbitrages)"
              : "Vue macro synthétique de la performance globale de WILLShop OS"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (viewMode === "EXECUTIVE_DASHBOARD") {
                // When going back to review, clear persistence so it's a fresh start
                try { localStorage.removeItem("ceo_review_done"); } catch (_) {}
                setCurrentStepIndex(0);
              }
              setViewMode(viewMode === "GUIDED_REVIEW" ? "EXECUTIVE_DASHBOARD" : "GUIDED_REVIEW");
            }}
            className="px-3.5 py-1.5 bg-white border border-[#EBE5DA] hover:border-[#800020] text-[#1F1917] font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
          >
            {viewMode === "GUIDED_REVIEW" ? (
              <>
                <Building2 className="w-3.5 h-3.5 text-[#800020]" />
                <span>Voir Dashboard</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5 text-[#800020]" />
                <span>Refaire la Revue</span>
              </>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-stone-600 bg-white border border-[#EBE5DA] px-3.5 py-1.5 rounded-full shadow-2xs">
            <Calendar className="w-4 h-4 text-[#800020]" />
            <span className="capitalize">{todayDateStr || "Aujourd'hui"}</span>
          </div>
          {viewMode === "GUIDED_REVIEW" && (
            <button
              onClick={() => {
                try {
                  const todayKey = new Date().toISOString().slice(0, 10);
                  localStorage.setItem("ceo_review_done", todayKey);
                } catch (_) {}
                setViewMode("EXECUTIVE_DASHBOARD");
              }}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-700 font-extrabold text-xs rounded-xl shadow-2xs transition-all"
            >
              <span>Passer pour aujourd'hui</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: GUIDED CEO REVIEW STEP-BY-STEP */}
      {/* ==================================================================== */}
      {viewMode === "GUIDED_REVIEW" && (
        <div className="space-y-6 animate-fade-in">
          {/* Step Progress Bar */}
          <div className="bg-white p-4 rounded-3xl border border-[#EBE5DA] shadow-2xs flex items-center justify-between overflow-x-auto gap-2 hide-scrollbar">
            {REVIEW_STEPS.map((s, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <button
                  key={s.key}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                    isCurrent
                      ? "bg-[#800020] text-white shadow-sm"
                      : isDone
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-[#FAF8F5] text-stone-600 border border-[#EBE5DA]"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span>{idx + 1}.</span>}
                  <span>{s.key}</span>
                </button>
              );
            })}
          </div>

          {/* Current Step Card */}
          <div className="bg-white p-7 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <span className="text-[11px] font-extrabold text-[#800020] uppercase tracking-wider">
                  ÉTAPE {currentStepIndex + 1} SUR {REVIEW_STEPS.length}
                </span>
                <h2 className="text-xl font-black text-[#1F1917] mt-0.5">{currentStep.title}</h2>
                <p className="text-xs text-stone-500 font-medium">{currentStep.desc}</p>
              </div>

              <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-full">
                Phase d'Arbitrage
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-[#800020]" />
                <p className="text-xs font-bold text-stone-500">Chargement des données Supabase...</p>
              </div>
            ) : (
              <div>
                {/* STEP 1: HIER */}
                {currentStep.key === "HIER" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Chiffre d'Affaires Hier</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.yesterdayRevenue.toLocaleString("fr-FR")} FCFA</p>
                      <p className="text-xs text-stone-500 font-medium">Cumul des ventes validées la veille</p>
                    </div>
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Commandes d'Hier</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.yesterdayOrdersCount} commande(s)</p>
                      <p className="text-xs text-stone-500 font-medium">Taux d'exécution conforme</p>
                    </div>
                  </div>
                )}

                {/* STEP 2: ARGENT */}
                {currentStep.key === "ARGENT" && (
                  <div>
                    {metrics.treasuryStatus === "NOT_CONFIGURED" || metrics.cashBalance === null ? (
                      <div className="p-8 bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center mx-auto">
                          <Building2 className="w-6 h-6 text-amber-700" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-[#1F1917] text-sm">Données de trésorerie non configurées</h4>
                          <p className="text-xs text-stone-500 max-w-md mx-auto">
                            Les soldes de trésorerie (Caisse Espèces, Orange Money, Moov Money) ne sont pas encore reliés à un compte marchand en ligne. Le système n'estime ni n'invente aucune donnée financière.
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-full">
                          <span>MODULE TRÉSORERIE NON CONFIGURÉ</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                          <span className="text-[11px] font-bold text-stone-500 uppercase">Caisse Espèces</span>
                          <p className="text-2xl font-black text-emerald-700">{metrics.cashBalance?.toLocaleString("fr-FR")} FCFA</p>
                          <p className="text-xs text-stone-500 font-medium">Recettes physiques en caisse</p>
                        </div>
                        <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                          <span className="text-[11px] font-bold text-stone-500 uppercase">Orange Money</span>
                          <p className="text-2xl font-black text-amber-700">{metrics.orangeMoneyBalance?.toLocaleString("fr-FR")} FCFA</p>
                          <p className="text-xs text-stone-500 font-medium">Compte marchand OM</p>
                        </div>
                        <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                          <span className="text-[11px] font-bold text-stone-500 uppercase">Moov Money</span>
                          <p className="text-2xl font-black text-blue-700">{metrics.moovMoneyBalance?.toLocaleString("fr-FR")} FCFA</p>
                          <p className="text-xs text-stone-500 font-medium">Compte marchand Moov</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: TEAM */}
                {currentStep.key === "TEAM" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Effectif Total Actif</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.activeTeamCount} collaborateur(s)</p>
                      <p className="text-xs text-stone-500 font-medium">Commerciaux & Livreurs configurés</p>
                    </div>
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Membres Connectés</span>
                      <p className="text-2xl font-black text-emerald-600">{metrics.onlineTeamCount} en ligne</p>
                      <p className="text-xs text-stone-500 font-medium">Présents sur leur espace de travail</p>
                    </div>
                  </div>
                )}

                {/* STEP 4: SALES */}
                {currentStep.key === "SALES" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Ventes du Jour</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.todayRevenue.toLocaleString("fr-FR")} FCFA</p>
                      <p className="text-xs text-stone-500 font-medium">Cumul des ventes aujourd'hui</p>
                    </div>
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Commandes Traitées</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.todayOrdersCount} commande(s)</p>
                      <p className="text-xs text-stone-500 font-medium">Enregistrées en base</p>
                    </div>
                  </div>
                )}

                {/* STEP 5: DELIVERIES */}
                {currentStep.key === "DELIVERIES" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Tournées en Cours</span>
                      <p className="text-2xl font-black text-[#1F1917]">{metrics.pendingDeliveriesCount}</p>
                      <p className="text-xs text-stone-500 font-medium">Livraisons en transit</p>
                    </div>
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Livrées Aujourd'hui</span>
                      <p className="text-2xl font-black text-emerald-600">{metrics.deliveredTodayCount}</p>
                      <p className="text-xs text-stone-500 font-medium">Preuves enregistrées</p>
                    </div>
                    <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EBE5DA] space-y-1">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">Échecs à Reprogrammer</span>
                      <p className="text-2xl font-black text-rose-600">{metrics.failedDeliveriesCount}</p>
                      <p className="text-xs text-stone-500 font-medium">Nécessitent un arbitrage</p>
                    </div>
                  </div>
                )}

                {/* STEP 6: PROBLEMS */}
                {currentStep.key === "PROBLEMS" && (
                  <div className="space-y-3">
                    {metrics.criticalIssuesCount === 0 ? (
                      <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <h4 className="font-extrabold text-[#1F1917] text-sm">Aucun problème bloquant</h4>
                        <p className="text-xs text-emerald-800">Aucun retard de livraison majeur ni relance compromise.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metrics.failedDeliveriesCount > 0 && (
                          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-5 h-5 text-rose-600" />
                              <div>
                                <h4 className="font-extrabold text-rose-950 text-xs">{metrics.failedDeliveriesCount} livraison(s) échouée(s)</h4>
                                <p className="text-[11px] text-rose-800">Motifs : client absent ou injoignable.</p>
                              </div>
                            </div>
                            <Link href="/delivery" className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-2xs">
                              Arbitrer
                            </Link>
                          </div>
                        )}
                        {metrics.overdueEngagementsCount > 0 && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 text-amber-600" />
                              <div>
                                <h4 className="font-extrabold text-amber-950 text-xs">{metrics.overdueEngagementsCount} relance(s) en retard</h4>
                                <p className="text-[11px] text-amber-800">Assignées aux commerciaux.</p>
                              </div>
                            </div>
                            <Link href="/sales/followups" className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-2xs">
                              Voir relances
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 7: FINISH */}
                {currentStep.key === "FINISH" && (
                  <div className="space-y-4">
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 font-extrabold text-amber-950 text-xs">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>Synthèse de l'Assistant Direction :</span>
                      </div>
                      <p className="text-xs text-amber-900 font-medium leading-relaxed">
                        {metrics.aiRecommendation}
                      </p>
                    </div>

                    <div className="p-5 bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                      <h3 className="font-black text-[#1F1917] text-base">Revue Guidée CEO Validée</h3>
                      <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        Vous avez fait le tour complet de la santé opérationnelle de votre entreprise.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step Navigation Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <button
                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                disabled={currentStepIndex === 0}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-30"
              >
                Précédent
              </button>

              <button
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                <span>{currentStepIndex === REVIEW_STEPS.length - 1 ? "Accéder au Dashboard" : "Étape Suivante"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: EXECUTIVE DASHBOARD */}
      {/* ==================================================================== */}
      {viewMode === "EXECUTIVE_DASHBOARD" && (
        <div className="space-y-8 animate-fade-in">
          {/* AI Assistant Block */}
          <div className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold shadow-2xs">
                  <Bot className="w-7 h-7 text-amber-800" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              <div>
                <h2 className="font-extrabold text-[#1F1917] text-base">Assistant WILLShop Direction</h2>
                <p className="text-xs text-stone-500 font-medium">
                  Vue synthétique de votre entreprise. Que souhaitez-vous analyser ?
                </p>
              </div>
            </div>

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
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {assistantResponse && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-1 animate-fade-in">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Analyse de l'Assistant CEO :</span>
                </div>
                <p className="text-amber-900 font-medium">{assistantResponse}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleAskQuestion("Résumé de la journée")}
                className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
              >
                Résumé de la journée
              </button>
              <button
                onClick={() => handleAskQuestion("Points d'attention")}
                className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
              >
                Points d'attention
              </button>
              <button
                onClick={() => handleAskQuestion("Performance des ventes")}
                className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
              >
                Performance des ventes
              </button>
            </div>
          </div>

          {/* Quick Navigation Grid */}
          <div className="space-y-4">
            <h2 className="text-lg font-black text-[#1F1917]">Modules de Gestion</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/sales"
                className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
              >
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
                  CRM & Ventes
                </span>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020]" />
              </Link>

              <Link
                href="/orders"
                className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
              >
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
                  Commandes ({metrics.todayOrdersCount})
                </span>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020]" />
              </Link>

              <Link
                href="/delivery"
                className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
              >
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <Truck className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
                  Livraisons ({metrics.pendingDeliveriesCount})
                </span>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020]" />
              </Link>

              <Link
                href="/team"
                className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <Users className="w-7 h-7" />
                </div>
                <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
                  Équipe ({metrics.activeTeamCount})
                </span>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020]" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
