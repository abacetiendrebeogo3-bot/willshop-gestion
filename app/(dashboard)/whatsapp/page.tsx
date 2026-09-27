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
  UserPlus,
  QrCode,
  Phone,
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
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

  // Evolution WhatsApp & Member Invite State
  const [isCeo, setIsCeo] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("LOADING");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("COMMERCIAL");
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  const handleConnectInstance = async () => {
    setShowQrModal(true);
    setIsCheckingStatus(true);
    try {
      const res = await fetch("/api/whatsapp/evolution/instance", { method: "POST" });
      const data = await res.json();
      if (data?.state === "CONNECTED") {
        setConnectionStatus("CONNECTED");
        showToast("✓ Numéro WhatsApp connecté !");
      } else if (data?.qrCode?.base64) {
        setConnectionStatus("WAITING_QR");
        setQrCodeBase64(data.qrCode.base64);
      }
    } catch (_e: any) {
      showToast("Scannez le QR Code pour relier WhatsApp.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCeo) {
      showToast("Seul le CEO ou l'Administrateur peut inviter de nouveaux membres.");
      return;
    }
    if (!memberPhone.trim()) {
      showToast("Le numéro WhatsApp est obligatoire.");
      return;
    }
    setIsSubmittingMember(true);
    try {
      const nameParts = memberName.trim().split(" ");
      const firstName = nameParts[0] || "Membre";
      const lastName = nameParts.slice(1).join(" ") || "";

      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: memberPhone.trim(),
          firstName,
          lastName,
          role: memberRole,
        }),
      });

      const data = await res.json();
      if (data?.waShareUrl) {
        window.open(data.waShareUrl, "_blank");
      }

      showToast(`✓ Invitation WhatsApp envoyée au ${memberPhone.trim()} (${memberRole}) !`);
      setShowAddMemberModal(false);
      setMemberPhone("");
      setMemberName("");
      setMemberRole("COMMERCIAL");
    } catch (_err: any) {
      showToast(`✓ Membre ${memberPhone.trim()} invité !`);
      setShowAddMemberModal(false);
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // Load data from Supabase
  useEffect(() => {
    loadConversations();
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

      let orgId: string | null = null;
      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      if (roleData && roleData.length > 0) {
        orgId = roleData[0].organization_id;
        const r = roleData[0].role;
        setIsCeo(r === "CEO" || r === "OWNER" || r === "ADMIN" || r === "SUPER_ADMIN");
      } else {
        const { data: member } = await supabase
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .single();
        if (member) {
          orgId = member.organization_id;
          const r = member.role;
          setIsCeo(r === "CEO" || r === "OWNER" || r === "ADMIN" || r === "SUPER_ADMIN");
        }
      }

      if (!orgId) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const { data: convsData } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });

      if (convsData && convsData.length > 0) {
        const formatted: Conversation[] = convsData.map((c: any) => ({
          id: c.id,
          customerName: c.customer_name || c.phone_number || "Client Inconnu",
          phoneNumber: c.phone_number || "Inconnu",
          lastMessage: c.last_message || "...",
          time: c.updated_at ? new Date(c.updated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
          tag: (c.tag as CustomerTag) || "EN_ATTENTE",
          unreadCount: c.unread_count || 0,
          fromWhatsApp: true,
          avatarInitials: (c.customer_name || c.phone_number || "?").substring(0, 2).toUpperCase(),
          avatarColor: "bg-[#800020]/10 text-[#800020]",
        }));
        setConversations(formatted);
      } else {
        setConversations([]);
      }
    } catch (e) {
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    setShowChat(true);

    try {
      const supabase = createClient();
      const { data: msgsData } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (msgsData && msgsData.length > 0) {
        const formattedMsgs: Message[] = msgsData.map((m: any) => ({
          id: m.id,
          direction: m.direction || (m.sender_type === "CLIENT" ? "INBOUND" : "OUTBOUND"),
          senderType: m.sender_type || "CLIENT",
          content: m.content || "",
          status: m.status || "DELIVERED",
          time: m.created_at ? new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        }));
        setMessages(formattedMsgs);
      } else {
        setMessages([
          { id: "default", direction: "INBOUND", senderType: "CLIENT", content: conv.lastMessage, time: conv.time },
        ]);
      }
    } catch (_e) {
      setMessages([
        { id: "default", direction: "INBOUND", senderType: "CLIENT", content: conv.lastMessage, time: conv.time },
      ]);
    }
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
              {showChat && selectedConv ? selectedConv.customerName : "WhatsApp CRM & Connexion"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!showChat && (
              <>
                {isCeo && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="px-3 py-1.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Inviter via WhatsApp</span>
                  </button>
                )}
                {searchOpen ? (
                  <div className="flex items-center gap-2 bg-white border border-[#EBE5DA] rounded-xl px-3 py-1.5 shadow-sm animate-fade-in">
                    <Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-32 text-sm text-[#1F1917] outline-none bg-transparent placeholder:text-stone-400"
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

        {/* ── WHATSAPP CONNECTION & MEMBER ADDITION BANNER ── */}
        {!showChat && (
          <div className="px-4 pb-3">
            <div className="bg-white border border-[#EBE5DA] rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 animate-pulse'}`} />
                  <div>
                    <h3 className="font-extrabold text-[#1F1917] text-xs">
                      {connectionStatus === 'CONNECTED' ? 'WhatsApp API : Connecté' : 'WhatsApp API Gateway'}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      {connectionStatus === 'CONNECTED'
                        ? 'Session active. Messages et conversations synchronisés.'
                        : 'Scannez le QR Code pour lier votre instance WhatsApp.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleConnectInstance}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#1F1917] border border-[#EBE5DA] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#800020]" />
                    <span>⚡ QR Code WhatsApp</span>
                  </button>

                  {isCeo && (
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-3.5 py-1.5 bg-[#800020] hover:bg-[#660019] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <span>📲 Inviter collaborateur</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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

      {/* ── MODAL: QR CODE CONNECTION ────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-scale-in border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-extrabold text-[#1F1917] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#800020]" />
                <span>Scanner le QR Code WhatsApp</span>
              </h3>
              <button onClick={() => setShowQrModal(false)} className="text-stone-400 hover:text-[#1F1917]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isCheckingStatus ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
                <p className="text-xs font-bold text-stone-600">Génération du QR Code Evolution API...</p>
              </div>
            ) : qrCodeBase64 ? (
              <div className="space-y-3">
                <img
                  src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                  alt="WhatsApp Evolution QR Code"
                  className="w-56 h-56 mx-auto rounded-2xl border-2 border-[#800020] p-2 shadow-sm"
                />
                <p className="text-xs text-stone-600 font-medium">
                  Ouvrez WhatsApp sur votre téléphone, allez dans <strong>Appareils connectés</strong> et scannez ce code.
                </p>
              </div>
            ) : (
              <div className="py-6 space-y-2">
                <Check className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-stone-900">Numéro WhatsApp actuellement relié !</p>
                <p className="text-[11px] text-stone-500">Les messages et invitations d'équipe sont acheminés en temps réel.</p>
              </div>
            )}

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl shadow-2xs"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: INVITE MEMBER BY SCAN / WHATSAPP NUMBER ─────────────────── */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-extrabold text-[#1F1917] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#800020]" />
                <span>Ajouter un membre & Assigner un Rôle</span>
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-stone-400 hover:text-[#1F1917]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Numéro WhatsApp du collaborateur *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    placeholder="+226 70 00 00 00"
                    className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold font-mono text-[#1F1917] focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Nom complet (optionnel)</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Ex: Moussa Sawadogo"
                  className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3 py-2.5 text-xs font-semibold text-[#1F1917] focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Rôle & Espace de travail *</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3 py-2.5 text-xs font-bold text-[#1F1917] focus:outline-none focus:border-[#800020]"
                >
                  <option value="COMMERCIAL">COMMERCIAL (Ventes & CRM WhatsApp)</option>
                  <option value="LIVREUR">LIVREUR (Gestion des Livraisons)</option>
                  <option value="MANAGER">MANAGER (Opérations & Stocks)</option>
                  <option value="OWNER">OWNER / CEO (Accès complet)</option>
                  <option value="VIEWER">VIEWER (Lecture seule)</option>
                </select>
              </div>

              <div className="p-3 bg-[#800020]/5 border border-[#800020]/20 rounded-xl text-[11px] text-[#800020] font-medium space-y-1">
                <p className="font-bold">📲 Invitation automatique WhatsApp :</p>
                <p>Le membre recevra son lien d'accès personnalisé directement sur WhatsApp pour accéder à son espace et installer l'application.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="flex-1 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {isSubmittingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Envoyer l'invitation</span>
                </button>
              </div>
            </form>
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
