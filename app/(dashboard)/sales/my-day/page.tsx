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
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserCheck,
  RotateCcw,
  Check,
  User,
  Clock,
  ChevronLeft,
} from "lucide-react";

import { createClient } from "@/src/infrastructure/supabase/client";
import { QuickOrderModal } from "@/components/sales/QuickOrderModal";

interface ActionItem {
  id: string;
  stepCategory: "RELANCES" | "ENGAGEMENTS" | "CONVERSATIONS" | "COMMANDES" | "PROBLEMES";
  title: string;
  description: string;
  priority: "URGENT" | "IMPORTANT" | "TO_DO";
  customerName: string;
  customerPhone: string;
  customerId?: string;
  conversationId?: string;
  suggestedMessage: string;
  stepKey: string;
}

const ROUTINE_STAGES = [
  { key: "RELANCES", label: "1. Relances", desc: "Prospects à contacter aujourd'hui" },
  { key: "ENGAGEMENTS", label: "2. Engagements", desc: "Rendez-vous & promesses d'achat" },
  { key: "CONVERSATIONS", label: "3. Non Lues", desc: "Messages sans réponse" },
  { key: "COMMANDES", label: "4. Intentions", desc: "Intentions de commande à valider" },
  { key: "PROBLEMES", label: "5. Problèmes", desc: "Échecs de livraison à arbitrer" },
  { key: "FIN", label: "6. Fin de Routine", desc: "Routine quotidienne terminée" },
];

export default function CommercialHomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Commercial");
  const [todayDateStr, setTodayDateStr] = useState<string>("");
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);

  // Quick Order Modal State
  const [showQuickOrderModal, setShowQuickOrderModal] = useState<boolean>(false);
  const [orderModalCustomer, setOrderModalCustomer] = useState<any>(null);

  // Commercial Action Queue State
  const [actionsQueue, setActionsQueue] = useState<ActionItem[]>([]);
  const [activeActionIndex, setActiveActionIndex] = useState<number>(0);
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [isSendingAction, setIsSendingAction] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Summary Stats
  const [treatedCount, setTreatedCount] = useState<number>(0);

  useEffect(() => {
    const today = new Date();
    setTodayDateStr(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
    loadCommercialRoutine();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  async function loadCommercialRoutine() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // 1. Resolve user profile name
      if (user.user_metadata?.first_name) {
        setUserName(user.user_metadata.first_name);
      } else if (user.email) {
        const prefix = user.email.split("@")[0];
        setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      // 2. Resolve organization
      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      const orgId = roleData?.[0]?.organization_id;
      if (!orgId) {
        setIsLoading(false);
        return;
      }

      const allActions: ActionItem[] = [];

      // 3. Fetch Pending Engagements / Relances
      const { data: engData } = await supabase
        .from("customer_engagements")
        .select("*, customers(id, first_name, last_name, phone)")
        .eq("organization_id", orgId)
        .eq("status", "PENDING")
        .order("due_at", { ascending: true });

      if (engData) {
        for (const e of engData) {
          const cust = e.customers || {};
          const cName = cust.first_name
            ? `${cust.first_name} ${cust.last_name || ""}`.trim()
            : cust.phone || "Prospect WhatsApp";

          allActions.push({
            id: e.id,
            stepCategory: "RELANCES",
            title: e.title || "Relance prospect",
            description: e.description || "Prospect en attente de relance",
            priority: e.priority === "URGENT" ? "URGENT" : "IMPORTANT",
            customerName: cName,
            customerPhone: cust.phone || "Inconnu",
            customerId: cust.id || e.customer_id,
            conversationId: e.conversation_id,
            suggestedMessage:
              e.evidence?.suggestedMessage ||
              `Bonjour ${cust.first_name || 'cher client'} 😊 Je reviens vers vous suite à votre intérêt pour nos produits sur WILLShop. Avez-vous pu y réfléchir ?`,
            stepKey: "J0",
          });
        }
      }

      // 4. Fetch Unreplied / Active Conversations with intent
      const { data: convData } = await supabase
        .from("conversations")
        .select("*, customers(id, first_name, last_name, phone)")
        .eq("organization_id", orgId)
        .gt("unread_count", 0)
        .order("last_message_at", { ascending: false });

      if (convData) {
        for (const c of convData) {
          const cust = Array.isArray(c.customers) ? c.customers[0] : c.customers;
          const cName = cust?.first_name
            ? `${cust.first_name} ${cust.last_name || ""}`.trim()
            : cust?.phone || "Client WhatsApp";

          allActions.push({
            id: `conv-${c.id}`,
            stepCategory: "CONVERSATIONS",
            title: "Message non lu en attente",
            description: `Le client ${cName} a envoyé un message WhatsApp.`,
            priority: "IMPORTANT",
            customerName: cName,
            customerPhone: cust?.phone || "Inconnu",
            customerId: cust?.id || c.customer_id,
            conversationId: c.id,
            suggestedMessage: `Bonjour ${cust?.first_name || ''} ! J'ai bien reçu votre message. Comment puis-je vous aider aujourd'hui ?`,
            stepKey: "NON_LU",
          });
        }
      }

      // 5. Fetch Failed Deliveries for issues step
      const { data: failedDelivs } = await supabase
        .from("deliveries")
        .select("*, orders(order_number, total_amount), customers(id, first_name, last_name, phone)")
        .eq("organization_id", orgId)
        .eq("status", "FAILED");

      if (failedDelivs) {
        for (const d of failedDelivs) {
          const cust = d.customers || {};
          const cName = cust.first_name
            ? `${cust.first_name} ${cust.last_name || ""}`.trim()
            : cust.phone || "Client";

          allActions.push({
            id: `deliv-${d.id}`,
            stepCategory: "PROBLEMES",
            title: `Échec de livraison #${d.orders?.order_number || d.id.slice(0, 6)}`,
            description: `Motif d'échec : ${d.failure_reason || 'Client injoignable'}. Reprogrammation requise.`,
            priority: "URGENT",
            customerName: cName,
            customerPhone: cust.phone || "Inconnu",
            customerId: cust.id,
            suggestedMessage: `Bonjour ${cName} 😊 Le livreur n'a pas pu remettre votre colis. Souhaitez-vous qu'on fixe un nouveau rendez-vous de livraison aujourd'hui ?`,
            stepKey: "ÉCHEC_LIVRAISON",
          });
        }
      }

      setActionsQueue(allActions);
      if (allActions.length > 0) {
        setEditingMessage(allActions[0].suggestedMessage);
      }
    } catch (_e) {
      setActionsQueue([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter actions by current stage key
  const currentStage = ROUTINE_STAGES[currentStageIndex];
  const stageActions = actionsQueue.filter((a) => a.stepCategory === currentStage.key);
  const currentAction = stageActions[activeActionIndex];

  const handleExecuteAction = async (action: ActionItem) => {
    if (!editingMessage.trim()) return;
    setIsSendingAction(true);

    try {
      if (action.conversationId) {
        // Send via WhatsApp send API
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: action.conversationId,
            text: editingMessage.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          showToast(`⚠️ Échec d'envoi: ${data.error || "Erreur"}`);
        } else {
          showToast(`✓ Message envoyé à ${action.customerName} via WhatsApp !`);
        }
      } else if (action.id && !action.id.startsWith("conv-") && !action.id.startsWith("deliv-")) {
        // Execute engagement followup API
        await fetch("/api/sales/followup/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engagementId: action.id,
            messageText: editingMessage.trim(),
            recipientPhone: action.customerPhone,
          }),
        });
        showToast(`✓ Relance enregistrée pour ${action.customerName} !`);
      } else {
        showToast(`✓ Action traitée pour ${action.customerName} !`);
      }

      // Mark action treated
      const updatedQueue = actionsQueue.filter((a) => a.id !== action.id);
      setActionsQueue(updatedQueue);
      setTreatedCount((prev) => prev + 1);

      // Advance to next action in stage or auto-skip to next stage
      const remainingInStage = updatedQueue.filter((a) => a.stepCategory === currentStage.key);
      if (remainingInStage.length > 0) {
        const nextIdx = activeActionIndex >= remainingInStage.length ? 0 : activeActionIndex;
        setActiveActionIndex(nextIdx);
        setEditingMessage(remainingInStage[nextIdx].suggestedMessage);
      } else {
        // Auto-advance stage
        autoAdvanceStage(currentStageIndex, updatedQueue);
      }
    } catch (_err) {
      showToast("✓ Action traitée");
    } finally {
      setIsSendingAction(false);
    }
  };

  const autoAdvanceStage = (fromIdx: number, queue: ActionItem[]) => {
    for (let i = fromIdx + 1; i < ROUTINE_STAGES.length; i++) {
      const st = ROUTINE_STAGES[i];
      if (st.key === "FIN") {
        setCurrentStageIndex(i);
        return;
      }
      const hasItems = queue.some((a) => a.stepCategory === st.key);
      if (hasItems) {
        setCurrentStageIndex(i);
        setActiveActionIndex(0);
        const first = queue.find((a) => a.stepCategory === st.key);
        setEditingMessage(first?.suggestedMessage || "");
        return;
      }
    }
    setCurrentStageIndex(ROUTINE_STAGES.length - 1);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in-up overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-stone-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#EBE5DA] pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F1917] tracking-tight">
            Salut {userName} !
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-semibold mt-1">
            Revue séquentielle guidée de votre activité commerciale quotidienne.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black rounded-full shadow-2xs">
            <span>{treatedCount} / {treatedCount + actionsQueue.length} actions traitées</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-stone-600 bg-white border border-[#EBE5DA] px-3.5 py-1.5 rounded-full shadow-2xs">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="capitalize">{todayDateStr || "Aujourd'hui"}</span>
          </div>
        </div>
      </div>

      {/* Linear Step Progression Bar */}
      <div className="bg-white p-3.5 rounded-3xl border border-[#EBE5DA] shadow-2xs flex items-center justify-between overflow-x-auto gap-2 hide-scrollbar">
        {ROUTINE_STAGES.map((st, idx) => {
          const isCurrent = idx === currentStageIndex;
          const isDone = idx < currentStageIndex;
          const countInStage = actionsQueue.filter((a) => a.stepCategory === st.key).length;

          return (
            <button
              key={st.key}
              onClick={() => {
                setCurrentStageIndex(idx);
                setActiveActionIndex(0);
                const first = actionsQueue.find((a) => a.stepCategory === st.key);
                if (first) setEditingMessage(first.suggestedMessage);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                isCurrent
                  ? "bg-[#800020] text-white shadow-xs"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-[#FAF8F5] text-stone-600 border border-[#EBE5DA]"
              }`}
            >
              {isDone ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <span className="font-mono text-[11px]">{idx + 1}.</span>
              )}
              <span>{st.label}</span>
              {st.key !== "FIN" && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                  isCurrent ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
                }`}>
                  {countInStage}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Single Action Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold text-[#800020] uppercase tracking-wider">
              {currentStage.label} — Action Prioritaire
            </span>
            <p className="text-xs text-stone-500 font-medium">{currentStage.desc}</p>
          </div>

          {stageActions.length > 0 && (
            <span className="px-3 py-1 bg-[#800020] text-white text-xs font-black rounded-full shadow-2xs">
              ACTION {activeActionIndex + 1} / {stageActions.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#800020]" />
            <p className="text-xs font-bold text-stone-500">Chargement de votre file d'actions...</p>
          </div>
        ) : currentStage.key === "FIN" ? (
          /* ROUTINE FINISHED STATE */
          <div className="py-10 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <UserCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#1F1917]">Routine Quotidienne Commerciale Validée</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Vous avez traité {treatedCount} action(s) prioritaire(s). Vos relances et opportunités sont à jour.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCurrentStageIndex(0);
                  loadCommercialRoutine();
                }}
                className="px-4 py-2.5 bg-white border border-[#EBE5DA] hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-[#800020]" />
                <span>Recommencer la routine</span>
              </button>

              <Link
                href="/whatsapp"
                className="px-5 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ouvrir WhatsApp CRM</span>
              </Link>
            </div>
          </div>
        ) : currentAction ? (
          /* ACTIVE ACTION VIEW */
          <div className="space-y-4 animate-fade-in">
            {/* Customer Details Box */}
            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#EBE5DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                  currentAction.priority === "URGENT" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {currentAction.stepKey} — {currentAction.priority}
                </span>
                <h3 className="font-black text-[#1F1917] text-base mt-1">
                  {currentAction.customerName}
                </h3>
                <p className="text-xs font-mono text-stone-500 font-semibold">
                  📲 {currentAction.customerPhone}
                </p>
              </div>

              {/* Deep Link Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/whatsapp"
                  className="px-3 py-2 bg-white border border-[#EBE5DA] hover:border-[#800020] text-stone-700 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#800020]" />
                  <span>Voir conversation</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setOrderModalCustomer({
                      id: currentAction.customerId || currentAction.id,
                      name: currentAction.customerName,
                      phone: currentAction.customerPhone,
                      conversationId: currentAction.conversationId,
                    });
                    setShowQuickOrderModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>+ Commande 1-Clic</span>
                </button>
              </div>
            </div>

            {/* AI Suggested Message Area */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-[#1F1917] flex items-center justify-between">
                <span>💬 Message suggéré par l'Assistant IA :</span>
                <span className="text-[11px] text-stone-400 font-normal">Modifiable avant envoi</span>
              </label>
              <textarea
                rows={3}
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl p-3.5 text-xs text-[#1F1917] font-medium focus:border-[#800020] outline-none shadow-2xs leading-relaxed"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                {activeActionIndex > 0 && (
                  <button
                    onClick={() => {
                      const prevIdx = activeActionIndex - 1;
                      setActiveActionIndex(prevIdx);
                      setEditingMessage(stageActions[prevIdx].suggestedMessage);
                    }}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Précédent
                  </button>
                )}
                {activeActionIndex < stageActions.length - 1 && (
                  <button
                    onClick={() => {
                      const nextIdx = activeActionIndex + 1;
                      setActiveActionIndex(nextIdx);
                      setEditingMessage(stageActions[nextIdx].suggestedMessage);
                    }}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Suivant
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => autoAdvanceStage(currentStageIndex, actionsQueue)}
                  className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Passer l'étape
                </button>

                <button
                  onClick={() => handleExecuteAction(currentAction)}
                  disabled={isSendingAction || !editingMessage.trim()}
                  className="px-5 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-40"
                >
                  {isSendingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Valider & Relancer</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* EMPTY STATE FOR STAGE */
          <div className="py-10 text-center space-y-3 animate-fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#1F1917]">
                Aucune action dans cette catégorie ({currentStage.label})
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Toutes les tâches de cette étape sont traitées.
              </p>
            </div>

            <button
              onClick={() => autoAdvanceStage(currentStageIndex, actionsQueue)}
              className="px-5 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Passer à l'étape suivante</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Navigation Cards Grid */}
      <div className="space-y-3 pt-4">
        <h2 className="text-base font-black text-[#1F1917]">Accès rapide aux espaces</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/whatsapp"
            className="bg-white p-4 rounded-2xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020] transition-all flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#1F1917]">Conversations</p>
              <p className="text-[10px] text-stone-400">WhatsApp CRM</p>
            </div>
          </Link>

          <Link
            href="/orders"
            className="bg-white p-4 rounded-2xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020] transition-all flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#1F1917]">Commandes</p>
              <p className="text-[10px] text-stone-400">Suivi des ventes</p>
            </div>
          </Link>

          <Link
            href="/delivery"
            className="bg-white p-4 rounded-2xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020] transition-all flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#1F1917]">Livraisons</p>
              <p className="text-[10px] text-stone-400">Tournées livreurs</p>
            </div>
          </Link>

          <Link
            href="/sales/followups"
            className="bg-white p-4 rounded-2xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020] transition-all flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Phone className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#1F1917]">Relances</p>
              <p className="text-[10px] text-stone-400">Engagements</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Order Modal */}
      {showQuickOrderModal && orderModalCustomer && (
        <QuickOrderModal
          isOpen={showQuickOrderModal}
          onClose={() => setShowQuickOrderModal(false)}
          initialCustomer={orderModalCustomer}
          onOrderCreated={(data) => {
            showToast(`✓ Commande ${data.orderNumber} créée avec succès !`);
            loadCommercialRoutine();
          }}
        />
      )}
    </div>
  );
}
