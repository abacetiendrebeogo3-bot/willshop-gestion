"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Search,
  ArrowLeft,
  Bot,
  Send,
  X,
  ChevronDown,
  MessageSquare,
  Loader2,
  Check,
  CheckCheck,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Clock,
  Calendar,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerTag =
  | "TOUTES"
  | "A_RELANCER"
  | "TRES_INTERESSES"
  | "SCEPTIQUES"
  | "EN_ATTENTE"
  | "PRETS_A_COMMANDER";

type PeriodOption = "Aujourd'hui" | "Hier" | "Cette semaine" | "Ce mois" | "Personnalisée";
type HourOption = "Toutes les heures" | "Matin (6h-12h)" | "Après-midi (12h-18h)" | "Soir (18h-23h)";

interface Conversation {
  id: string;
  customerName: string;
  phoneNumber: string;
  lastMessage: string;
  time: string;
  tag: CustomerTag;
  unreadCount: number;
  fromWhatsApp: boolean;
  avatarInitials: string;
  avatarColor: string;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CLIENT" | "AI" | "HUMAN";
  content: string;
  status?: string;
  time: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<CustomerTag, { label: string; color: string; bg: string; border: string; dot: string }> = {
  TOUTES: { label: "Toutes", color: "text-[#1F1917]", bg: "bg-[#1F1917]", border: "border-[#1F1917]", dot: "bg-[#1F1917]" },
  A_RELANCER: { label: "À relancer", color: "text-[#800020]", bg: "bg-[#800020]", border: "border-[#800020]", dot: "bg-[#800020]" },
  TRES_INTERESSES: { label: "Très intéressés", color: "text-orange-600", bg: "bg-orange-500", border: "border-orange-500", dot: "bg-orange-500" },
  SCEPTIQUES: { label: "Sceptiques", color: "text-stone-500", bg: "bg-stone-500", border: "border-stone-500", dot: "bg-stone-500" },
  EN_ATTENTE: { label: "En attente", color: "text-amber-600", bg: "bg-amber-500", border: "border-amber-500", dot: "bg-amber-500" },
  PRETS_A_COMMANDER: { label: "Prêts à commander", color: "text-emerald-600", bg: "bg-emerald-600", border: "border-emerald-600", dot: "bg-emerald-600" },
};

const ASSISTANT_SUGGESTIONS = [
  "Quelles conversations n'ont pas eu de réponse ?",
  "Qui dois-je relancer aujourd'hui ?",
  "Qui est prêt à commander ?",
  "Résume l'activité de la journée",
];

const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-awa-kone",
    customerName: "Awa Koné",
    phoneNumber: "+226 77 12 34 56",
    lastMessage: "Bonjour, est-ce que le riz 5kg est toujours disponible ?",
    time: "10:24",
    tag: "TRES_INTERESSES",
    unreadCount: 1,
    fromWhatsApp: true,
    avatarInitials: "AK",
    avatarColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "conv-moussa-traore",
    customerName: "Moussa Traoré",
    phoneNumber: "+226 78 88 99 00",
    lastMessage: "Je veux 2 cartons d'huile. C'est combien ?",
    time: "11:15",
    tag: "PRETS_A_COMMANDER",
    unreadCount: 0,
    fromWhatsApp: true,
    avatarInitials: "MT",
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "conv-fatou-diarra",
    customerName: "Fatou Diarra",
    phoneNumber: "+226 70 55 44 33",
    lastMessage: "Ma commande est prête ?",
    time: "12:08",
    tag: "A_RELANCER",
    unreadCount: 2,
    fromWhatsApp: true,
    avatarInitials: "FD",
    avatarColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "conv-ibrahim-sanogo",
    customerName: "Ibrahim Sanogo",
    phoneNumber: "+226 70 12 34 56",
    lastMessage: "Vous livrez à Bobo ?",
    time: "09:40",
    tag: "SCEPTIQUES",
    unreadCount: 0,
    fromWhatsApp: false,
    avatarInitials: "IB",
    avatarColor: "bg-purple-100 text-purple-700",
  },
  {
    id: "conv-sofia-compaore",
    customerName: "Sofia Compaoré",
    phoneNumber: "+226 76 34 12 90",
    lastMessage: "C'est vraiment efficace ?",
    time: "Hier",
    tag: "EN_ATTENTE",
    unreadCount: 0,
    fromWhatsApp: true,
    avatarInitials: "SC",
    avatarColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "conv-yacine-k",
    customerName: "Yacine K.",
    phoneNumber: "+226 71 22 44 66",
    lastMessage: "J'attends la confirmation du paiement.",
    time: "Hier",
    tag: "PRETS_A_COMMANDER",
    unreadCount: 1,
    fromWhatsApp: true,
    avatarInitials: "YK",
    avatarColor: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "conv-issa-pare",
    customerName: "Issa Paré",
    phoneNumber: "+226 70 99 88 77",
    lastMessage: "Vous avez un point de vente à Bobo ?",
    time: "Hier",
    tag: "A_RELANCER",
    unreadCount: 0,
    fromWhatsApp: false,
    avatarInitials: "IP",
    avatarColor: "bg-teal-100 text-teal-700",
  },
];

const SEED_MESSAGES: Record<string, Message[]> = {
  "conv-awa-kone": [
    { id: "m1", direction: "INBOUND", senderType: "CLIENT", content: "Bonjour, est-ce que le riz 5kg est toujours disponible ?", time: "10:24" },
    { id: "m2", direction: "OUTBOUND", senderType: "AI", content: "Oui, il est disponible à 12 500 XOF. Souhaitez-vous en prendre ?", status: "READ", time: "10:25" },
    { id: "m3", direction: "INBOUND", senderType: "CLIENT", content: "D'accord, je prends 2 sacs.", time: "10:26" },
  ],
  "conv-moussa-traore": [
    { id: "m4", direction: "INBOUND", senderType: "CLIENT", content: "Je veux 2 cartons d'huile 5L. C'est combien ?", time: "11:15" },
    { id: "m5", direction: "OUTBOUND", senderType: "AI", content: "Bonjour Moussa ! 2 cartons d'huile 5L = 18 000 XOF. Livraison incluse dans Ouaga.", status: "DELIVERED", time: "11:16" },
  ],
  "conv-fatou-diarra": [
    { id: "m6", direction: "INBOUND", senderType: "CLIENT", content: "Ma commande est prête ?", time: "12:08" },
  ],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationsPage() {
  // Filter state
  const [activeTag, setActiveTag] = useState<CustomerTag>("TOUTES");
  const [activePeriod, setActivePeriod] = useState<PeriodOption>("Aujourd'hui");
  const [activeHour, setActiveHour] = useState<HourOption>("Toutes les heures");
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showHourDropdown, setShowHourDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Assistant state
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantHasSuggestion, setAssistantHasSuggestion] = useState(true);
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Bonjour ! Je suis votre assistant WILLShop. Je peux analyser vos conversations et vous aider à prioriser vos actions du jour." },
  ]);

  // New message
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const tagsRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  // Load data from Supabase (with seed fallback)
  useEffect(() => {
    loadConversations();
    // Show assistant suggestion after 2s
    const t = setTimeout(() => setAssistantHasSuggestion(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!member) { setIsLoading(false); return; }

      const { data: convsData } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("organization_id", member.organization_id)
        .order("updated_at", { ascending: false });

      if (convsData && convsData.length > 0) {
        const formatted: Conversation[] = convsData.map((c: any) => ({
          id: c.id,
          customerName: c.customer_name || c.phone_number || "Client Inconnu",
          phoneNumber: c.phone_number || "Inconnu",
          lastMessage: c.last_message || "...",
          time: new Date(c.updated_at || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          tag: (c.tag as CustomerTag) || "EN_ATTENTE",
          unreadCount: c.unread_count || 0,
          fromWhatsApp: true,
          avatarInitials: (c.customer_name || "?").substring(0, 2).toUpperCase(),
          avatarColor: "bg-[#800020]/10 text-[#800020]",
        }));
        setConversations(formatted);
      }
    } catch (e) {
      // Keep seed data on error
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = (conv: Conversation) => {
    setSelectedConv(conv);
    setShowChat(true);
    setMessages(SEED_MESSAGES[conv.id] || [
      { id: "default", direction: "INBOUND", senderType: "CLIENT", content: conv.lastMessage, time: conv.time },
    ]);
  };

  // ─── Filtering ────────────────────────────────────────────────────────────

  const tagCounts = Object.fromEntries(
    (Object.keys(TAG_CONFIG) as CustomerTag[]).map((tag) => [
      tag,
      tag === "TOUTES" ? conversations.length : conversations.filter((c) => c.tag === tag).length,
    ])
  ) as Record<CustomerTag, number>;

  const filteredConversations = conversations.filter((c) => {
    const matchTag = activeTag === "TOUTES" || c.tag === activeTag;
    const matchSearch = !searchQuery.trim() ||
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTag && matchSearch;
  });

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;
    setIsSending(true);
    const msg: Message = {
      id: `m-${Date.now()}`,
      direction: "OUTBOUND",
      senderType: "HUMAN",
      content: newMessage.trim(),
      status: "DELIVERED",
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
    setIsSending(false);
    showToast("✓ Message envoyé");
  };

  // ─── Assistant ────────────────────────────────────────────────────────────

  const handleAssistantSend = (text?: string) => {
    const query = text || assistantQuery;
    if (!query.trim()) return;
    setAssistantMessages((prev) => [...prev, { role: "user", text: query }]);
    setAssistantQuery("");
    setAssistantHasSuggestion(false);
    // Simulated response
    setTimeout(() => {
      let response = "Je recherche dans vos conversations...";
      if (query.toLowerCase().includes("relancer")) {
        const toRelance = conversations.filter((c) => c.tag === "A_RELANCER");
        response = toRelance.length > 0
          ? `Vous avez ${toRelance.length} client(s) à relancer : ${toRelance.map((c) => c.customerName).join(", ")}.`
          : "Aucun client à relancer pour le moment. Excellent travail !";
      } else if (query.toLowerCase().includes("commander") || query.toLowerCase().includes("prêt")) {
        const ready = conversations.filter((c) => c.tag === "PRETS_A_COMMANDER");
        response = ready.length > 0
          ? `${ready.length} client(s) prêts à commander : ${ready.map((c) => c.customerName).join(", ")}. Finalisez ces commandes en priorité.`
          : "Aucun client marqué comme prêt à commander actuellement.";
      } else if (query.toLowerCase().includes("réponse") || query.toLowerCase().includes("répondu")) {
        const noReply = conversations.filter((c) => c.unreadCount > 0);
        response = noReply.length > 0
          ? `${noReply.length} conversation(s) sans réponse : ${noReply.map((c) => c.customerName).join(", ")}.`
          : "Toutes les conversations ont reçu une réponse. 👍";
      } else {
        response = `Sur ${conversations.length} conversations aujourd'hui : ${tagCounts.A_RELANCER} à relancer, ${tagCounts.TRES_INTERESSES} très intéressés, ${tagCounts.PRETS_A_COMMANDER} prêts à commander.`;
      }
      setAssistantMessages((prev) => [...prev, { role: "bot", text: response }]);
    }, 800);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#FAF8F5]">

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* ── MAIN CONTAINER ────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto flex flex-col h-screen">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-[#FAF8F5] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (showChat ? setShowChat(false) : window.history.back())}
              className="p-2 rounded-xl hover:bg-[#F0EAE0] transition-colors text-[#1F1917]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-black text-[#1F1917] tracking-tight">
              {showChat && selectedConv ? selectedConv.customerName : "Conversations"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!showChat && (
              <>
                {searchOpen ? (
                  <div className="flex items-center gap-2 bg-white border border-[#EBE5DA] rounded-xl px-3 py-1.5 shadow-sm animate-fade-in">
                    <Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-40 text-sm text-[#1F1917] outline-none bg-transparent placeholder:text-stone-400"
                    />
                    <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                      <X className="w-4 h-4 text-stone-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-xl hover:bg-[#F0EAE0] transition-colors text-[#1F1917]"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={loadConversations}
                  className="p-2 rounded-xl hover:bg-[#F0EAE0] transition-colors text-stone-400"
                  title="Rafraîchir"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
        {!showChat && (
          <>
            {/* TAG FILTERS */}
            <div
              ref={tagsRef}
              className="flex items-center gap-2 overflow-x-auto px-4 pb-3 hide-scrollbar"
              style={{ scrollbarWidth: "none" }}
            >
              {(Object.keys(TAG_CONFIG) as CustomerTag[]).map((tag) => {
                const cfg = TAG_CONFIG[tag];
                const isActive = activeTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                      isActive
                        ? `${cfg.bg} text-white border-transparent shadow-sm`
                        : `bg-white text-stone-600 border-[#EBE5DA] hover:border-[#800020]/30`
                    }`}
                  >
                    {tag !== "TOUTES" && (
                      <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white/60" : cfg.dot}`} />
                    )}
                    {cfg.label}
                    <span className={`ml-0.5 text-[11px] font-black ${isActive ? "text-white/80" : "text-stone-400"}`}>
                      {tagCounts[tag]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* PERIOD + HOUR SELECTORS */}
            <div className="flex items-center gap-2 px-4 pb-4">
              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowPeriodDropdown(!showPeriodDropdown); setShowHourDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#EBE5DA] rounded-xl text-xs font-semibold text-[#1F1917] hover:border-[#800020]/40 transition-colors shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {activePeriod}
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </button>
                {showPeriodDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 z-30 bg-white border border-[#EBE5DA] rounded-2xl shadow-xl py-1.5 w-44 animate-fade-in">
                    {(["Aujourd'hui", "Hier", "Cette semaine", "Ce mois", "Personnalisée"] as PeriodOption[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setActivePeriod(p); setShowPeriodDropdown(false); }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors ${
                          activePeriod === p
                            ? "text-[#800020] font-bold bg-[#800020]/5"
                            : "text-[#1F1917] hover:bg-[#F8F5EE]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hour Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowHourDropdown(!showHourDropdown); setShowPeriodDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#EBE5DA] rounded-xl text-xs font-semibold text-[#1F1917] hover:border-[#800020]/40 transition-colors shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  {activeHour}
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </button>
                {showHourDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 z-30 bg-white border border-[#EBE5DA] rounded-2xl shadow-xl py-1.5 w-52 animate-fade-in">
                    {(["Toutes les heures", "Matin (6h-12h)", "Après-midi (12h-18h)", "Soir (18h-23h)"] as HourOption[]).map((h) => (
                      <button
                        key={h}
                        onClick={() => { setActiveHour(h); setShowHourDropdown(false); }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors ${
                          activeHour === h
                            ? "text-[#800020] font-bold bg-[#800020]/5"
                            : "text-[#1F1917] hover:bg-[#F8F5EE]"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CONVERSATION LIST */}
            <div
              className="flex-1 overflow-y-auto px-4 pb-28 space-y-2"
              onClick={() => { setShowPeriodDropdown(false); setShowHourDropdown(false); }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#800020]" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-10 h-10 text-stone-300 mb-3" />
                  <p className="text-sm font-semibold text-stone-500">Aucune conversation trouvée</p>
                  <p className="text-xs text-stone-400 mt-1">Essayez un autre filtre ou période</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const tagCfg = TAG_CONFIG[conv.tag];
                  return (
                    <button
                      key={conv.id}
                      onClick={() => loadMessages(conv)}
                      className="w-full flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-[#EBE5DA]/80 shadow-sm hover:shadow-md hover:border-[#800020]/20 transition-all duration-200 text-left group"
                    >
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${conv.avatarColor}`}>
                        {conv.avatarInitials}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-sm text-[#1F1917] truncate">{conv.customerName}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="text-[11px] text-stone-400 font-medium">{conv.time}</span>
                            {conv.unreadCount > 0 && (
                              <span className="w-5 h-5 rounded-full bg-[#800020] text-white text-[10px] font-black flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-stone-500 truncate leading-relaxed">{conv.lastMessage}</p>

                        {/* Badges row */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            conv.tag === "A_RELANCER" ? "bg-[#800020]/8 text-[#800020] border-[#800020]/20" :
                            conv.tag === "TRES_INTERESSES" ? "bg-orange-50 text-orange-600 border-orange-200" :
                            conv.tag === "PRETS_A_COMMANDER" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            conv.tag === "EN_ATTENTE" ? "bg-amber-50 text-amber-600 border-amber-200" :
                            conv.tag === "SCEPTIQUES" ? "bg-stone-50 text-stone-500 border-stone-200" :
                            "bg-stone-50 text-stone-500 border-stone-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tagCfg.dot}`} />
                            {tagCfg.label}
                          </span>
                          {conv.fromWhatsApp && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <MessageSquare className="w-2.5 h-2.5" />
                              WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── CHAT VIEW ─────────────────────────────────────────────────────── */}
        {showChat && selectedConv && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Conversation header info */}
            <div className="px-4 pb-3 flex items-center gap-3 border-b border-[#EBE5DA] bg-[#FAF8F5]">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${selectedConv.avatarColor}`}>
                {selectedConv.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-500 truncate">{selectedConv.phoneNumber}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                selectedConv.tag === "A_RELANCER" ? "bg-[#800020]/8 text-[#800020] border-[#800020]/20" :
                selectedConv.tag === "TRES_INTERESSES" ? "bg-orange-50 text-orange-600 border-orange-200" :
                selectedConv.tag === "PRETS_A_COMMANDER" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                selectedConv.tag === "EN_ATTENTE" ? "bg-amber-50 text-amber-600 border-amber-200" :
                "bg-stone-50 text-stone-500 border-stone-200"
              }`}>
                {TAG_CONFIG[selectedConv.tag].label}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F1EA]/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.direction === "OUTBOUND"
                      ? msg.senderType === "AI"
                        ? "bg-[#800020] text-white rounded-br-none"
                        : "bg-[#1F1917] text-white rounded-br-none"
                      : "bg-white text-[#1F1917] rounded-bl-none border border-[#EBE5DA] shadow-sm"
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.direction === "OUTBOUND" ? "text-white/60 justify-end" : "text-stone-400"}`}>
                      <span>{msg.time}</span>
                      {msg.direction === "OUTBOUND" && (
                        <>
                          {msg.status === "READ" && <CheckCheck className="w-3 h-3 text-blue-300" />}
                          {msg.status === "DELIVERED" && <CheckCheck className="w-3 h-3 text-white/60" />}
                          {msg.status === "SENT" && <Check className="w-3 h-3 text-white/60" />}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-[#EBE5DA] bg-[#FAF8F5]">
              <input
                type="text"
                placeholder="Écrire un message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-white border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-sm text-[#1F1917] placeholder:text-stone-400 outline-none focus:border-[#800020]/50 transition-colors"
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                className="w-10 h-10 rounded-full bg-[#800020] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#590C1D] transition-colors shadow-sm"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── FLOATING ASSISTANT BUTTON ─────────────────────────────────────── */}
      <div className="fixed bottom-24 right-5 z-40">
        <button
          onClick={() => { setShowAssistant(true); setAssistantHasSuggestion(false); }}
          className="relative w-14 h-14 rounded-full bg-[#800020] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
        >
          <Bot className="w-6 h-6" />
          {assistantHasSuggestion && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
          )}
        </button>
      </div>

      {/* ── ASSISTANT OVERLAY ─────────────────────────────────────────────── */}
      {showAssistant && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-[#1F1917]/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
            style={{ maxHeight: "80vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBE5DA] bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#800020]/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#800020]" />
                </div>
                <div>
                  <p className="font-black text-sm text-[#1F1917]">Assistant WILLShop</p>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    En ligne
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssistant(false)}
                className="p-2 rounded-xl hover:bg-[#F0EAE0] text-stone-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {assistantMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#800020] text-white rounded-br-none"
                      : "bg-[#F8F5EE] text-[#1F1917] rounded-bl-none border border-[#EBE5DA]"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={assistantEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-5 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {ASSISTANT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleAssistantSend(s)}
                    className="px-2.5 py-1 bg-[#F8F5EE] border border-[#EBE5DA] rounded-full text-[11px] font-semibold text-stone-600 hover:border-[#800020]/30 hover:text-[#800020] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-5 py-3 border-t border-[#EBE5DA]">
              <input
                type="text"
                placeholder="Posez votre question..."
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAssistantSend()}
                className="flex-1 bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-4 py-2.5 text-sm text-[#1F1917] placeholder:text-stone-400 outline-none focus:border-[#800020]/50 transition-colors"
              />
              <button
                onClick={() => handleAssistantSend()}
                disabled={!assistantQuery.trim()}
                className="w-9 h-9 rounded-xl bg-[#800020] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#590C1D] transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLOSE DROPDOWNS OVERLAY ───────────────────────────────────────── */}
      {(showPeriodDropdown || showHourDropdown) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setShowPeriodDropdown(false); setShowHourDropdown(false); }}
        />
      )}
    </div>
  );
}
