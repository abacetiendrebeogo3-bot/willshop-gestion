"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  ArrowLeft,
  Search,
  MessageSquare,
  Flame,
  Clock,
  HelpCircle,
  ShoppingCart,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Plus,
  Send,
  Paperclip,
  Smile,
  Bot,
  X,
  Sparkles,
  Phone,
  Tag,
  Filter,
  CheckCheck,
  Check,
} from "lucide-react";

type TagType =
  | "ALL"
  | "TO_RELANCE"
  | "HOT_INTENT"
  | "SKEPTICAL"
  | "WAITING"
  | "READY_TO_ORDER"
  | "ORDER_IN_PROGRESS";

interface ConversationItem {
  id: string;
  customerName: string;
  avatarBg: string;
  avatarText: string;
  phone: string;
  lastMessage: string;
  time: string;
  tag: TagType;
  tagLabel: string;
  tagStyle: string;
  tagIcon: any;
  unread: boolean;
  productName?: string;
  productPrice?: string;
}

export default function ConversationsCRMPage() {
  const router = useRouter();

  // Search & Tag Filter state
  const [activeTag, setActiveTag] = useState<TagType>("ALL");
  const [periodFilter, setPeriodFilter] = useState<string>("TODAY");
  const [hourFilter, setHourFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // Selected Conversation for Chat Thread View (Screen 3)
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  // Floating Assistant Overlay state (Screen 5)
  const [showAssistantOverlay, setShowAssistantOverlay] = useState<boolean>(false);
  const [assistantQuestion, setAssistantQuestion] = useState<string>("");
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [assistantHasNotification, setAssistantHasNotification] = useState<boolean>(true);

  // Chat message input for selected conversation
  const [chatInputText, setChatInputText] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: "CLIENT" | "COMMERCIAL"; text: string; time: string }[]
  >([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConvs, setIsLoadingConvs] = useState<boolean>(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setIsLoadingConvs(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoadingConvs(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      const orgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
      if (!orgId) {
        setIsLoadingConvs(false);
        return;
      }

      const { data: convsData } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });

      if (convsData && convsData.length > 0) {
        const formatted: ConversationItem[] = convsData.map((c: any) => {
          const name = c.customer_name || c.phone_number || "Client WhatsApp";
          const initials = name.substring(0, 2).toUpperCase();

          let tagType: TagType = "ALL";
          let tagLabel = "Information";
          let tagStyle = "bg-stone-100 text-stone-700 border border-stone-200";
          let tagIcon: any = MessageSquare;

          if (c.tag === "TRES_INTERESSES" || c.tag === "HOT_INTENT") {
            tagType = "HOT_INTENT";
            tagLabel = "Très intéressé";
            tagStyle = "bg-rose-50 text-rose-700 border border-rose-200";
            tagIcon = Flame;
          } else if (c.tag === "PRETS_A_COMMANDER" || c.tag === "READY_TO_ORDER") {
            tagType = "READY_TO_ORDER";
            tagLabel = "Prêt à commander";
            tagStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200";
            tagIcon = CheckCircle2;
          } else if (c.tag === "A_RELANCER" || c.tag === "TO_RELANCE") {
            tagType = "TO_RELANCE";
            tagLabel = "À relancer";
            tagStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200";
            tagIcon = CheckCircle2;
          } else if (c.tag === "SCEPTIQUES" || c.tag === "SKEPTICAL") {
            tagType = "SKEPTICAL";
            tagLabel = "Sceptique";
            tagStyle = "bg-purple-50 text-purple-700 border border-purple-200";
            tagIcon = HelpCircle;
          } else if (c.tag === "EN_ATTENTE" || c.tag === "WAITING") {
            tagType = "WAITING";
            tagLabel = "En attente";
            tagStyle = "bg-amber-50 text-amber-700 border border-amber-200";
            tagIcon = Clock;
          }

          return {
            id: c.id,
            customerName: name,
            avatarBg: "bg-[#800020]/10 text-[#800020]",
            avatarText: initials,
            phone: c.phone_number || "",
            lastMessage: c.last_message || "Aucun message récent",
            time: c.updated_at ? new Date(c.updated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
            tag: tagType,
            tagLabel,
            tagStyle,
            tagIcon,
            unread: Boolean(c.unread_count && c.unread_count > 0),
          };
        });
        setConversations(formatted);
      } else {
        setConversations([]);
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
      setConversations([]);
    } finally {
      setIsLoadingConvs(false);
    }
  };

  const rawConversations = conversations;

  // Filtered conversations
  const filteredConvs = useMemo(() => {
    return rawConversations.filter((c) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.customerName.toLowerCase().includes(q);
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchMsg = c.lastMessage.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchMsg) return false;
      }

      // Tag filter
      if (activeTag === "ALL") return true;
      return c.tag === activeTag;
    });
  }, [rawConversations, activeTag, searchQuery]);

  // Load chat messages when selecting a conversation
  useEffect(() => {
    if (selectedConv) {
      setChatMessages([
        {
          id: "m-init",
          sender: "CLIENT",
          text: selectedConv.lastMessage,
          time: selectedConv.time || "Maintenant",
        },
      ]);
    }
  }, [selectedConv]);

  const handleSendManualChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !selectedConv) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: "m-" + Date.now(),
        sender: "COMMERCIAL",
        text: chatInputText.trim(),
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setChatInputText("");
    showToast("✓ Message envoyé sur WhatsApp");
  };

  const handleAssistantAsk = (q: string) => {
    setAssistantQuestion(q);
    if (conversations.length === 0) {
      setAssistantAnswer("Aucune conversation active pour le moment dans votre espace d'entreprise.");
      return;
    }
    if (q.includes("réponse")) {
      const unreplied = conversations.filter((c) => c.unread);
      if (unreplied.length > 0) {
        setAssistantAnswer(`${unreplied.length} conversation(s) en attente de réponse : ${unreplied.map((c) => c.customerName).join(", ")}.`);
      } else {
        setAssistantAnswer("Toutes les conversations enregistrées ont déjà reçu une réponse !");
      }
    } else if (q.includes("relancer")) {
      const relances = conversations.filter((c) => c.tag === "TO_RELANCE");
      if (relances.length > 0) {
        setAssistantAnswer(`Client(s) à relancer : ${relances.map((c) => c.customerName).join(", ")}.`);
      } else {
        setAssistantAnswer("Aucun client marqué à relancer actuellement.");
      }
    } else if (q.includes("prêts")) {
      const prets = conversations.filter((c) => c.tag === "READY_TO_ORDER" || c.tag === "HOT_INTENT");
      if (prets.length > 0) {
        setAssistantAnswer(`Client(s) prêts à commander : ${prets.map((c) => c.customerName).join(", ")}.`);
      } else {
        setAssistantAnswer("Aucun client identifié comme prêt à commander pour l'instant.");
      }
    } else {
      setAssistantAnswer(`Analyse des conversations : ${conversations.length} discussion(s) active(s) au total.`);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-24 animate-fade-in-up relative min-h-[90vh]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#1F1917] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: CONVERSATIONS LIST SCREEN (Matching Screen 2 in input_file_0.png) */}
      {/* ==================================================================== */}
      {!selectedConv && (
        <div className="space-y-4">
          {/* HEADER BAR */}
          <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-[#EBE5DA] shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-xl hover:bg-[#F8F5EE] text-stone-600 transition-colors"
                aria-label="Retour"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-black text-[#1F1917]">Conversations</h1>
            </div>

            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className="p-2 rounded-xl bg-[#F8F5EE] border border-[#EBE5DA] text-stone-600 hover:text-[#1F1917]"
              aria-label="Recherche"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* SEARCH INPUT (Toggled on search icon click) */}
          {showSearchInput && (
            <div className="relative animate-fade-in">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
              <input
                type="text"
                placeholder="Rechercher un client, un numéro, un message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#EBE5DA] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#1F1917] outline-none focus:border-[#800020] font-medium"
              />
            </div>
          )}

          {/* HORIZONTAL SCROLLABLE TAG FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 no-scrollbar">
            {/* Tag: Toutes */}
            <button
              onClick={() => setActiveTag("ALL")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "ALL"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-stone-700 border-[#EBE5DA] hover:bg-[#F8F5EE]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Toutes</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTag === "ALL" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"}`}>
                {rawConversations.length}
              </span>
            </button>

            {/* Tag: À relancer */}
            <button
              onClick={() => setActiveTag("TO_RELANCE")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "TO_RELANCE"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>À relancer</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
                3
              </span>
            </button>

            {/* Tag: Très intéressés */}
            <button
              onClick={() => setActiveTag("HOT_INTENT")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "HOT_INTENT"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-rose-800 border-rose-200 hover:bg-rose-50"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>Très intéressés</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-100 text-rose-800">
                2
              </span>
            </button>

            {/* Tag: En attente */}
            <button
              onClick={() => setActiveTag("WAITING")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "WAITING"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>En attente</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800">
                1
              </span>
            </button>

            {/* Tag: Sceptiques */}
            <button
              onClick={() => setActiveTag("SKEPTICAL")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "SKEPTICAL"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-purple-800 border-purple-200 hover:bg-purple-50"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
              <span>Sceptiques</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-100 text-purple-800">
                1
              </span>
            </button>

            {/* Tag: Prêts à commander */}
            <button
              onClick={() => setActiveTag("READY_TO_ORDER")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition-all shrink-0 shadow-2xs ${
                activeTag === "READY_TO_ORDER"
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              <span>Prêts à commander</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
                2
              </span>
            </button>
          </div>

          {/* TWO COMPACT SELECTORS SIDE BY SIDE */}
          <div className="grid grid-cols-2 gap-3">
            {/* Period Selector */}
            <div className="relative">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-[#EBE5DA] rounded-2xl px-3.5 py-2.5 text-xs text-[#1F1917] font-bold focus:border-[#800020] outline-none cursor-pointer shadow-2xs pr-8"
              >
                <option value="TODAY">📅 Aujourd'hui (26 Sept)</option>
                <option value="YESTERDAY">Hier</option>
                <option value="WEEK">Cette semaine</option>
                <option value="MONTH">Ce mois</option>
                <option value="CUSTOM">Période personnalisée</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-stone-400 pointer-events-none" />
            </div>

            {/* Hour Selector */}
            <div className="relative">
              <select
                value={hourFilter}
                onChange={(e) => setHourFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-[#EBE5DA] rounded-2xl px-3.5 py-2.5 text-xs text-[#1F1917] font-bold focus:border-[#800020] outline-none cursor-pointer shadow-2xs pr-8"
              >
                <option value="ALL">🕒 Toutes les heures</option>
                <option value="MORNING">Matin (08h-12h)</option>
                <option value="AFTERNOON">Après-midi (12h-18h)</option>
                <option value="EVENING">Soir (18h-22h)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-stone-400 pointer-events-none" />
            </div>
          </div>

          {/* CONVERSATIONS LIST */}
          <div className="space-y-2 pt-1">
            {filteredConvs.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-[#EBE5DA] text-center text-xs text-stone-500 font-semibold space-y-2">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Aucune conversation ne correspond à ce filtre.</p>
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const TagIcon = conv.tagIcon;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className="bg-white p-4 rounded-3xl border border-[#EBE5DA] shadow-2xs hover:border-[#800020]/40 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar Circle */}
                      <div
                        className={`w-11 h-11 rounded-full ${conv.avatarBg} flex items-center justify-center font-black text-xs shrink-0 shadow-2xs`}
                      >
                        {conv.avatarText}
                      </div>

                      {/* Info & Last Message */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-[#1F1917] text-sm truncate">
                            {conv.customerName}
                          </h3>
                        </div>

                        <p className="text-xs text-stone-600 font-medium truncate max-w-xs">
                          {conv.lastMessage}
                        </p>

                        {/* Tag Badge Pill Under Preview */}
                        <div className="pt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${conv.tagStyle}`}
                          >
                            <TagIcon className="w-3 h-3" />
                            <span>{conv.tagLabel}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Time & Right Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-stone-500 block font-semibold">
                          {conv.time}
                        </span>
                        {/* WhatsApp Green Icon Badge */}
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold ml-auto mt-0.5">
                          💬
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#800020] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: FULL CHAT THREAD SCREEN (Matching Screen 3 in input_file_0.png) */}
      {/* ==================================================================== */}
      {selectedConv && (
        <div className="bg-white rounded-3xl border border-[#EBE5DA] shadow-xs overflow-hidden flex flex-col h-[640px] animate-scale-up">
          {/* CHAT HEADER */}
          <div className="p-4 border-b border-[#EBE5DA] flex items-center justify-between bg-[#F8F5EE]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConv(null)}
                className="p-1.5 rounded-xl hover:bg-stone-200/50 text-stone-600 transition-colors"
                aria-label="Retour aux conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div
                className={`w-10 h-10 rounded-full ${selectedConv.avatarBg} flex items-center justify-center font-black text-xs`}
              >
                {selectedConv.avatarText}
              </div>
              <div>
                <h3 className="font-extrabold text-[#1F1917] text-sm">{selectedConv.customerName}</h3>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  En ligne • WhatsApp
                </span>
              </div>
            </div>

            <button className="p-1.5 text-stone-400 hover:text-[#1F1917]">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* PRODUCT INTENT CARD (If applicable) */}
          {selectedConv.productName && (
            <div className="bg-[#F8F5EE] p-3.5 mx-4 mt-3 rounded-2xl border border-[#EBE5DA] flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  📦
                </div>
                <div>
                  <h4 className="font-extrabold text-[#1F1917] text-xs">{selectedConv.productName}</h4>
                  <span className="text-xs font-mono font-black text-[#800020]">
                    {selectedConv.productPrice}
                  </span>
                </div>
              </div>
              <Link
                href="/orders/new"
                className="px-3 py-1.5 rounded-xl bg-[#800020] text-white text-[11px] font-extrabold hover:bg-[#590C1D] transition-all flex items-center gap-1 shadow-2xs"
              >
                <span>Voir produit</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* CHAT MESSAGES AREA */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8F5EE]/30">
            <div className="text-center">
              <span className="text-[10px] font-mono font-bold bg-[#EBE5DA] text-stone-600 px-3 py-0.5 rounded-full">
                Aujourd'hui
              </span>
            </div>

            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "COMMERCIAL" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`p-3.5 rounded-2xl text-xs max-w-[85%] font-medium leading-relaxed ${
                    m.sender === "COMMERCIAL"
                      ? "bg-[#800020] text-white rounded-br-none shadow-2xs"
                      : "bg-white text-[#1F1917] rounded-bl-none border border-[#EBE5DA] shadow-2xs"
                  }`}
                >
                  <p>{m.text}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-stone-400 font-mono mt-0.5 px-1">
                  <span>{m.time}</span>
                  {m.sender === "COMMERCIAL" && (
                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* QUICK ACTIONS BAR AT BOTTOM (4 Buttons matching Screen 3) */}
          <div className="p-2 border-t border-[#EBE5DA] bg-white grid grid-cols-4 gap-1 text-center border-b">
            <Link
              href="/orders/new"
              className="p-2 rounded-xl bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] text-[10px] font-extrabold text-[#1F1917] flex flex-col items-center gap-1 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-[#800020]" />
              <span>Créer commande</span>
            </Link>
            <button
              onClick={() => showToast("⏰ Relance programmée !")}
              className="p-2 rounded-xl bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] text-[10px] font-extrabold text-[#1F1917] flex flex-col items-center gap-1 transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Programmer relance</span>
            </button>
            <button
              onClick={() => showToast("🏷️ Tag mis à jour !")}
              className="p-2 rounded-xl bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] text-[10px] font-extrabold text-[#1F1917] flex flex-col items-center gap-1 transition-all"
            >
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Ajouter un tag</span>
            </button>
            <button
              onClick={() => showToast("... Menu d'actions secondaires")}
              className="p-2 rounded-xl bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] text-[10px] font-extrabold text-[#1F1917] flex flex-col items-center gap-1 transition-all"
            >
              <MoreVertical className="w-3.5 h-3.5 text-stone-500" />
              <span>Plus d'actions</span>
            </button>
          </div>

          {/* CHAT INPUT BAR */}
          <form onSubmit={handleSendManualChat} className="p-3 bg-white flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-stone-400 cursor-pointer" />
            <input
              type="text"
              placeholder="Écrire un message..."
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              className="flex-1 bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-4 py-2.5 text-xs text-[#1F1917] focus:border-[#800020] outline-none font-medium placeholder:text-stone-400"
            />
            <Smile className="w-4 h-4 text-stone-400 cursor-pointer" />
            <button
              type="submit"
              disabled={!chatInputText.trim()}
              className="p-2.5 bg-[#800020] hover:bg-[#590C1D] disabled:opacity-40 text-white rounded-xl transition-all shadow-2xs"
              aria-label="Envoyer le message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FLOATING ASSISTANT BUTTON & OVERLAY (Matching Screen 5 in input_file_0.png) */}
      {/* ==================================================================== */}

      {/* FLOATING ROUND ASSISTANT BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setShowAssistantOverlay(true);
            setAssistantHasNotification(false);
          }}
          className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-400 text-amber-900 shadow-xl flex items-center justify-center hover:scale-105 transition-transform relative ring-4 ring-amber-200/50"
          aria-label="Assistant WILLShop"
        >
          <Bot className="w-7 h-7 text-amber-800" />
          {assistantHasNotification && (
            <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-rose-600 border-2 border-white animate-pulse" />
          )}
        </button>
      </div>

      {/* ASSISTANT CHAT OVERLAY MODAL */}
      {showAssistantOverlay && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EBE5DA] w-full max-w-md p-6 rounded-3xl space-y-5 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowAssistantOverlay(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-[#1F1917] p-1.5 rounded-xl hover:bg-stone-100"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Assistant Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold">
                <Bot className="w-7 h-7 text-amber-800" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1F1917] text-base">Assistant WILLShop</h3>
                <p className="text-xs text-stone-500 font-medium">Analyseur de conversations en direct</p>
              </div>
            </div>

            {/* AI Answer Display */}
            {assistantAnswer && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs space-y-1 animate-fade-in">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Analyse :</span>
                </div>
                <p className="text-amber-900 font-medium">{assistantAnswer}</p>
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (assistantQuestion.trim()) handleAssistantAsk(assistantQuestion);
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                placeholder="Posez votre question sur les conversations..."
                value={assistantQuestion}
                onChange={(e) => setAssistantQuestion(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-2xl pl-4 pr-12 py-3 text-xs text-[#1F1917] outline-none focus:border-[#800020] font-medium placeholder:text-stone-400"
              />
              <button
                type="submit"
                disabled={!assistantQuestion.trim()}
                className="w-8 h-8 rounded-full bg-[#800020] text-white flex items-center justify-center absolute right-2 hover:bg-[#590C1D] transition-all disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Quick Suggestions Pills */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-extrabold text-stone-400 uppercase tracking-wider block">
                Questions suggérées :
              </span>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleAssistantAsk("Quelles conversations n'ont pas eu de réponse ?")}
                  className="w-full text-left bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] p-2.5 rounded-xl text-xs font-semibold text-[#1F1917] transition-all"
                >
                  💬 Quelles conversations n'ont pas eu de réponse ?
                </button>
                <button
                  onClick={() => handleAssistantAsk("Qui dois-je relancer aujourd'hui ?")}
                  className="w-full text-left bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] p-2.5 rounded-xl text-xs font-semibold text-[#1F1917] transition-all"
                >
                  ⏰ Qui dois-je relancer aujourd'hui ?
                </button>
                <button
                  onClick={() => handleAssistantAsk("Quels clients sont prêts à commander ?")}
                  className="w-full text-left bg-[#F8F5EE] hover:bg-[#F2ECE1] border border-[#EBE5DA] p-2.5 rounded-xl text-xs font-semibold text-[#1F1917] transition-all"
                >
                  🛒 Quels clients sont prêts à commander ?
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
