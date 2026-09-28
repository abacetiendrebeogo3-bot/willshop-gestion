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
  AlertCircle,
  Loader2,
  ArrowRight,
  UserCheck,
} from "lucide-react";

import { createClient } from "@/src/infrastructure/supabase/client";
import { QuickOrderModal } from "@/components/sales/QuickOrderModal";

interface FollowupTask {
  id: string;
  customerId?: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  priority: string;
  customerName: string;
  customerPhone: string;
  conversationId?: string;
  suggestedMessage: string;
  stepKey: string;
}

export default function CommercialHomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Commercial");
  const [questionText, setQuestionText] = useState<string>("");
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [convCount, setConvCount] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [todayDateStr, setTodayDateStr] = useState<string>("");

  // Quick Order Modal State
  const [showQuickOrderModal, setShowQuickOrderModal] = useState<boolean>(false);
  const [orderModalCustomer, setOrderModalCustomer] = useState<any>(null);

  // Commercial Followup Queue State
  const [followupTasks, setFollowupTasks] = useState<FollowupTask[]>([]);
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [isSendingFollowup, setIsSendingFollowup] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoadingFollowups, setIsLoadingFollowups] = useState<boolean>(true);

  useEffect(() => {
    const today = new Date();
    setTodayDateStr(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  async function loadData() {
    setIsLoadingFollowups(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
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

        const { data: roleData } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
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

          // Trigger worker evaluation in background to ensure up-to-date queue
          fetch(`/api/cron/workflows?orgId=${orgId}`, { method: "POST" }).catch(() => {});

          // Fetch pending customer engagements for this organization
          const { data: engData } = await supabase
            .from("customer_engagements")
            .select("*, customers(first_name, last_name, phone)")
            .eq("organization_id", orgId)
            .eq("status", "PENDING")
            .order("due_at", { ascending: true });

          if (engData && engData.length > 0) {
            const mapped: FollowupTask[] = engData.map((e: any) => {
              const cust = e.customers || {};
              const custName = cust.first_name
                ? `${cust.first_name} ${cust.last_name || ""}`.trim()
                : cust.phone || "Client Intéressé";

              const evidence = e.evidence || {};
              const suggested = evidence.suggestedMessage ||
                `Bonjour ${cust.first_name || 'cher client'}, je reviens vers vous suite à votre intérêt pour nos produits sur WILLShop. Avez-vous des questions ?`;

              return {
                id: e.id,
                title: e.title,
                description: e.description || "",
                dueAt: e.due_at,
                status: e.status,
                priority: e.priority || "IMPORTANT",
                customerName: custName,
                customerPhone: cust.phone || "+226 70 00 00 00",
                conversationId: e.conversation_id,
                suggestedMessage: suggested,
                stepKey: evidence.stepKey || "J0",
              };
            });

            setFollowupTasks(mapped);
            setEditingMessage(mapped[0]?.suggestedMessage || "");
          } else {
            setFollowupTasks([]);
          }
        }
      }
    } catch (_e) {
      // Fallback
    } finally {
      setIsLoadingFollowups(false);
    }
  }

  const handleSendFollowup = async (task: FollowupTask) => {
    if (!editingMessage.trim()) return;
    setIsSendingFollowup(true);

    try {
      const res = await fetch("/api/sales/followup/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId: task.id,
          messageText: editingMessage.trim(),
          recipientPhone: task.customerPhone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "SUCCESS") {
        showToast(`✓ Relance envoyée à ${task.customerName} via WhatsApp !`);
        const updated = followupTasks.filter((t) => t.id !== task.id);
        setFollowupTasks(updated);
        if (updated.length > 0) {
          const nextIdx = activeTaskIndex >= updated.length ? 0 : activeTaskIndex;
          setActiveTaskIndex(nextIdx);
          setEditingMessage(updated[nextIdx].suggestedMessage);
        }
      } else {
        showToast(`⚠ ${data.error || "Erreur lors de l'envoi WhatsApp"}`);
      }
    } catch (err: any) {
      showToast("Erreur lors de l'envoi de la relance.");
    } finally {
      setIsSendingFollowup(false);
    }
  };

  const currentTask = followupTasks[activeTaskIndex];

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
      setAssistantResponse(
        followupTasks.length > 0
          ? `Vous avez ${followupTasks.length} relance(s) commerciale(s) prioritaire(s) à traiter dans votre file du jour.`
          : "Toutes vos relances du jour sont à jour !"
      );
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-stone-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WELCOME MESSAGE HEADER */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#EBE5DA] pb-4">
        <div>
          <h1 className="text-3xl font-black text-[#1F1917] tracking-tight">
            Salut {userName} !
          </h1>
          <p className="text-sm text-stone-500 font-semibold mt-1">
            Voici vos relances et actions commerciales du jour.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-600 bg-white border border-[#EBE5DA] px-3.5 py-1.5 rounded-full shadow-2xs">
          <Sun className="w-4 h-4 text-amber-500" />
          <span className="capitalize">{todayDateStr || "Aujourd'hui"}</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: GUIDED COMMERCIAL FOLLOWUP QUEUE ("Ma Journée") */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center font-bold">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-[#1F1917] text-sm">
                Relances Commerciales à Effectuer
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                {followupTasks.length > 0
                  ? `${followupTasks.length} relance(s) en attente de validation`
                  : "Toutes les relances de la journée sont effectuées !"}
              </p>
            </div>
          </div>

          {followupTasks.length > 0 && (
            <span className="px-3 py-1 bg-[#800020] text-white text-xs font-black rounded-full shadow-2xs">
              RELANCE {activeTaskIndex + 1} / {followupTasks.length}
            </span>
          )}
        </div>

        {isLoadingFollowups ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#800020]" />
            <p className="text-xs font-bold text-stone-500">Chargement de votre file de relances...</p>
          </div>
        ) : currentTask ? (
          <div className="space-y-4 animate-fade-in">
            {/* Customer Details Header */}
            <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#EBE5DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md uppercase">
                  {currentTask.stepKey} — {currentTask.priority}
                </span>
                <h3 className="font-black text-[#1F1917] text-base mt-1">
                  {currentTask.customerName}
                </h3>
                <p className="text-xs font-mono text-stone-500 font-semibold">
                  📲 WhatsApp: {currentTask.customerPhone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/whatsapp"
                  className="px-3 py-2 bg-white border border-[#EBE5DA] hover:border-[#800020] text-stone-700 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#800020]" />
                  <span>Voir conversation</span>
                </Link>
              </div>
            </div>

            {/* AI Suggestion Box */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-[#1F1917]">
                💬 Message de relance (Message suggéré par l'Assistant IA) :
              </label>
              <textarea
                rows={3}
                value={editingMessage}
                onChange={(e) => setEditingMessage(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl p-3.5 text-xs text-[#1F1917] font-medium focus:border-[#800020] outline-none shadow-2xs leading-relaxed"
                placeholder="Préparez ou modifiez votre message..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {activeTaskIndex > 0 && (
                  <button
                    onClick={() => {
                      const prevIdx = activeTaskIndex - 1;
                      setActiveTaskIndex(prevIdx);
                      setEditingMessage(followupTasks[prevIdx].suggestedMessage);
                    }}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Précédent
                  </button>
                )}
                {activeTaskIndex < followupTasks.length - 1 && (
                  <button
                    onClick={() => {
                      const nextIdx = activeTaskIndex + 1;
                      setActiveTaskIndex(nextIdx);
                      setEditingMessage(followupTasks[nextIdx].suggestedMessage);
                    }}
                    className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    Suivant
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderModalCustomer({
                      id: currentTask.customerId || currentTask.id,
                      name: currentTask.customerName,
                      phone: currentTask.customerPhone,
                      conversationId: currentTask.conversationId,
                    });
                    setShowQuickOrderModal(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Créer Commande 1-Clic</span>
                </button>

                <button
                  onClick={() => handleSendFollowup(currentTask)}
                  disabled={isSendingFollowup || !editingMessage.trim()}
                  className="px-5 py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-40"
                >
                  {isSendingFollowup ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Relancer maintenant</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-2">
            <UserCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-extrabold text-[#1F1917]">Aucune relance en attente</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Toutes vos relances reprogrammées pour vos prospects et clients sont à jour. Excellent travail !
            </p>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: WILLSHOP ASSISTANT BLOCK */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-xs space-y-5">
        <div className="flex items-center gap-3">
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

        {assistantResponse && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-1 animate-fade-in">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Réponse de l'Assistant :</span>
            </div>
            <p className="text-amber-900 font-medium">{assistantResponse}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAskQuestion("Mes relances")}
            className="bg-[#F8F5EE] hover:bg-[#F2ECE1] text-stone-700 hover:text-[#1F1917] border border-[#EBE5DA] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs"
          >
            Mes relances
          </button>
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
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 3: NAVIGATION CARDS GRID ("Vos actions du jour") */}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/sales"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group relative"
          >
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

          <Link
            href="/sales/followups"
            className="bg-white p-5 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center justify-between text-center min-h-[160px] group relative"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                <Phone className="w-7 h-7" />
              </div>
              {followupTasks.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#800020] text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-white shadow-2xs">
                  {followupTasks.length}
                </span>
              )}
            </div>

            <span className="font-extrabold text-[#1F1917] text-xs max-w-[110px] leading-tight">
              Voir les relances ({followupTasks.length})
            </span>

            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Quick Order 1-Click Modal */}
      {showQuickOrderModal && orderModalCustomer && (
        <QuickOrderModal
          isOpen={showQuickOrderModal}
          onClose={() => setShowQuickOrderModal(false)}
          initialCustomer={orderModalCustomer}
          onOrderCreated={(data) => {
            showToast(`✓ Commande ${data.orderNumber} créée avec succès !`);
            loadData();
          }}
        />
      )}
    </div>
  );
}
