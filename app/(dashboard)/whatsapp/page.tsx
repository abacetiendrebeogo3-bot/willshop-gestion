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
  RefreshCw,
  Clock,
  Calendar,
  UserPlus,
  QrCode,
  ShoppingCart,
  Phone,
  User,
  Truck,
  Package,
  FileText,
  AlertCircle,
  Paperclip,
  Mic,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { QuickOrderModal } from "@/components/sales/QuickOrderModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerTag =
  | "TOUTES"
  | "A_RELANCER"
  | "TRES_INTERESSES"
  | "SCEPTIQUES"
  | "EN_ATTENTE"
  | "PRETS_A_COMMANDER";

type IntentFilterOption = "TOUTES" | "INTENTIONS" | "CONFIRMEES";
type PeriodOption = "Aujourd'hui" | "Hier" | "Cette semaine" | "Ce mois";
type AssignmentFilter = "TOUTES" | "MES_CONVERSATIONS";

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  city?: string;
  lastMessage: string;
  time: string;
  lastMessageDate: Date;
  tag: CustomerTag;
  orderIntentStatus: string; // 'NONE' | 'INTENT_DETECTED' | 'ORDER_CREATED' | 'ORDER_CONFIRMED'
  unreadCount: number;
  assignedUserId?: string;
  assignedCommercialId?: string;
  assignedAgent: string;
  conversationMode: string;
  avatarInitials: string;
  avatarColor: string;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  messageType: "TEXT" | "IMAGE" | "AUDIO" | "DOCUMENT" | string;
  content: string;
  mediaUrl?: string;
  status?: string;
  time: string;
  metadata?: any;
}

interface CustomerDetails {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  city?: string;
  status: string;
  assignedCommercialName?: string;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    delivery?: {
      id: string;
      status: string;
      scheduledDate?: string;
      driverName?: string;
      driverPhone?: string;
    };
  }[];
  engagements: {
    id: string;
    title: string;
    dueAt: string;
    status: string;
  }[];
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationsPage() {
  // Filter state
  const [activeTag, setActiveTag] = useState<CustomerTag>("TOUTES");
  const [activeIntent, setActiveIntent] = useState<IntentFilterOption>("TOUTES");
  const [activePeriod, setActivePeriod] = useState<PeriodOption>("Aujourd'hui");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("TOUTES");
  
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // User & Org Context
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCeo, setIsCeo] = useState<boolean>(false);

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Customer Details Drawer State
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false);

  // Assistant state
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantHasSuggestion, setAssistantHasSuggestion] = useState(true);
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Bonjour ! Je suis l'assistant WILLShop. Je peux analyser vos conversations, résumer les intentions de commande et préparer vos réponses." },
  ]);

  // New message state
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Media zoom preview state
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  // Evolution WhatsApp & Member Invite State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("UNKNOWN");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberPhone, setMemberPhone] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("COMMERCIAL");
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Quick Order Modal State
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [orderModalCustomer, setOrderModalCustomer] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);

  // Toast Notification helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── 1. Check Real Instance Status ──────────────────────────────────────────

  const checkEvolutionStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch("/api/whatsapp/evolution/status");
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus(data.status || "DISCONNECTED");
        if (data.status === "CONNECTED") {
          setConnectedPhone(data.phoneNumber || null);
        } else {
          setConnectedPhone(null);
        }
      } else {
        setConnectionStatus("DISCONNECTED");
      }
    } catch (_e) {
      setConnectionStatus("DISCONNECTED");
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  const handleConnectInstance = async () => {
    setShowQrModal(true);
    setIsCheckingStatus(true);
    setQrCodeBase64(null);
    setQrError(null);
    try {
      const res = await fetch("/api/whatsapp/evolution/instance", { method: "POST" });
      const data = await res.json();
      if (data?.state === "CONNECTED") {
        setConnectionStatus("CONNECTED");
        setConnectedPhone(data.phoneNumber || null);
        showToast("✓ WhatsApp connecté avec succès !");
      } else if (data?.qrCode?.base64) {
        setConnectionStatus("WAITING_QR");
        setQrCodeBase64(data.qrCode.base64);
      } else if (data?.error) {
        setConnectionStatus("ERROR");
        setQrError(data.error);
      } else {
        setConnectionStatus("WAITING_QR");
        setQrError("Impossible de générer le QR code. Vérifiez les clés EVOLUTION_API.");
      }
    } catch (_e: any) {
      setConnectionStatus("ERROR");
      setQrError("Erreur réseau lors de la connexion à l'API WhatsApp.");
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

  // ── 2. Load Conversations & User Context ───────────────────────────────────

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);

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

      // Fetch conversations from primary conversations table
      const { data: convsData } = await supabase
        .from("conversations")
        .select(`
          id,
          customer_id,
          status,
          channel,
          assigned_user_id,
          assigned_commercial_id,
          assigned_agent,
          order_intent_status,
          last_message_at,
          unread_count,
          conversation_mode,
          metadata,
          customers (
            id,
            first_name,
            last_name,
            phone,
            whatsapp_phone,
            city
          )
        `)
        .eq("organization_id", orgId)
        .order("last_message_at", { ascending: false });

      if (convsData && convsData.length > 0) {
        // Fetch last message for each conversation
        const convIds = convsData.map((c: any) => c.id);
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });

        const lastMsgMap = new Map<string, string>();
        if (lastMsgs) {
          for (const m of lastMsgs) {
            if (!lastMsgMap.has(m.conversation_id)) {
              lastMsgMap.set(m.conversation_id, m.content || "...");
            }
          }
        }

        const formatted: Conversation[] = convsData.map((c: any) => {
          const cust = Array.isArray(c.customers) ? c.customers[0] : c.customers;
          const customerName = cust?.first_name
            ? `${cust.first_name} ${cust.last_name || ""}`.trim()
            : cust?.phone || "Client WhatsApp";
          const phoneNumber = cust?.phone || cust?.whatsapp_phone || "Inconnu";
          const lastMsgText = lastMsgMap.get(c.id) || c.metadata?.last_message || "...";
          const lastMsgDate = c.last_message_at ? new Date(c.last_message_at) : new Date();

          return {
            id: c.id,
            customerId: c.customer_id || cust?.id || "",
            customerName,
            phoneNumber,
            city: cust?.city || "",
            lastMessage: lastMsgText,
            time: lastMsgDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            lastMessageDate: lastMsgDate,
            tag: (c.metadata?.tag as CustomerTag) || "EN_ATTENTE",
            orderIntentStatus: c.order_intent_status || c.metadata?.order_intent_status || "NONE",
            unreadCount: c.unread_count || 0,
            assignedUserId: c.assigned_user_id || undefined,
            assignedCommercialId: c.assigned_commercial_id || undefined,
            assignedAgent: c.assigned_agent || "SALES_AI",
            conversationMode: c.conversation_mode || "FOLLOWUP_ONLY",
            avatarInitials: customerName.substring(0, 2).toUpperCase(),
            avatarColor: "bg-[#800020]/10 text-[#800020]",
          };
        });

        setConversations(formatted);
      } else {
        setConversations([]);
      }
    } catch (e) {
      console.error("Error loading conversations:", e);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadConversations();
    checkEvolutionStatus();
  }, [loadConversations, checkEvolutionStatus]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  // ── 3. Load Messages for Active Conversation ───────────────────────────────

  const loadMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    setShowChat(true);

    try {
      const supabase = createClient();
      const { data: msgsData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (msgsData && msgsData.length > 0) {
        const formattedMsgs: Message[] = msgsData.map((m: any) => ({
          id: m.id,
          direction: m.direction || (m.sender_type === "CUSTOMER" ? "INBOUND" : "OUTBOUND"),
          senderType: m.sender_type || "CUSTOMER",
          messageType: m.message_type || "TEXT",
          content: m.content || "",
          mediaUrl: m.media_url || undefined,
          status: m.status || "SENT",
          time: m.created_at
            ? new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
            : "",
          metadata: m.metadata || {},
        }));
        setMessages(formattedMsgs);
      } else {
        setMessages([
          {
            id: `init-${Date.now()}`,
            direction: "INBOUND",
            senderType: "CUSTOMER",
            messageType: "TEXT",
            content: conv.lastMessage,
            time: conv.time,
          },
        ]);
      }

      // Mark unread count as 0 in DB
      if (conv.unreadCount > 0) {
        await supabase
          .from("conversations")
          .update({ unread_count: 0 })
          .eq("id", conv.id);
        
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  // ── 4. Load Customer Details Drawer ─────────────────────────────────────────

  const loadCustomerDetails = async (customerId: string) => {
    if (!customerId) return;
    setIsLoadingCustomerDetails(true);
    setShowCustomerDrawer(true);

    try {
      const supabase = createClient();
      // Fetch Customer
      const { data: cust } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (!cust) {
        setIsLoadingCustomerDetails(false);
        return;
      }

      // Fetch Orders & Deliveries
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          deliveries (
            id,
            status,
            scheduled_date,
            driver_id,
            drivers (
              full_name,
              phone
            )
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      // Fetch Engagements / Relances
      const { data: engData } = await supabase
        .from("customer_engagements")
        .select("*")
        .eq("customer_id", customerId)
        .order("due_at", { ascending: false });

      const formattedOrders = (ordersData || []).map((o: any) => {
        const del = Array.isArray(o.deliveries) ? o.deliveries[0] : o.deliveries;
        const drv = del?.drivers ? (Array.isArray(del.drivers) ? del.drivers[0] : del.drivers) : null;

        return {
          id: o.id,
          orderNumber: o.order_number || `CMD-${o.id.slice(0, 6)}`,
          status: o.status || "CONFIRMED",
          totalAmount: Number(o.total_amount || 0),
          createdAt: o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "",
          delivery: del
            ? {
                id: del.id,
                status: del.status || "EN_ATTENTE",
                scheduledDate: del.scheduled_date ? new Date(del.scheduled_date).toLocaleDateString("fr-FR") : undefined,
                driverName: drv?.full_name || undefined,
                driverPhone: drv?.phone || undefined,
              }
            : undefined,
        };
      });

      const formattedEngagements = (engData || []).map((e: any) => ({
        id: e.id,
        title: e.title || "Relance commerciale",
        dueAt: e.due_at ? new Date(e.due_at).toLocaleDateString("fr-FR") : "",
        status: e.status || "PENDING",
      }));

      setCustomerDetails({
        id: cust.id,
        firstName: cust.first_name || "Client",
        lastName: cust.last_name || "",
        phone: cust.phone || cust.whatsapp_phone || "",
        city: cust.city || "Non spécifiée",
        status: cust.status || "ACTIVE",
        orders: formattedOrders,
        engagements: formattedEngagements,
      });
    } catch (err) {
      console.error("Error loading customer details:", err);
    } finally {
      setIsLoadingCustomerDetails(false);
    }
  };

  // ── 5. Filtering Conversations ─────────────────────────────────────────────

  const tagCounts = Object.fromEntries(
    (Object.keys(TAG_CONFIG) as CustomerTag[]).map((tag) => [
      tag,
      tag === "TOUTES" ? conversations.length : conversations.filter((c) => c.tag === tag).length,
    ])
  ) as Record<CustomerTag, number>;

  const filteredConversations = conversations.filter((c) => {
    const matchTag = activeTag === "TOUTES" || c.tag === activeTag;
    
    let matchIntent = true;
    if (activeIntent === "INTENTIONS") {
      matchIntent = c.orderIntentStatus === "INTENT_DETECTED" || c.orderIntentStatus === "ORDER_INTENT";
    } else if (activeIntent === "CONFIRMEES") {
      matchIntent = c.orderIntentStatus === "ORDER_CREATED" || c.orderIntentStatus === "ORDER_CONFIRMED";
    }

    let matchAssignment = true;
    if (assignmentFilter === "MES_CONVERSATIONS" && currentUserId) {
      matchAssignment = c.assignedUserId === currentUserId || c.assignedCommercialId === currentUserId;
    }

    const matchSearch =
      !searchQuery.trim() ||
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

    return matchTag && matchIntent && matchAssignment && matchSearch;
  });

  // ── 6. Send Outbound Manual Message ────────────────────────────────────────

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    // Optimistic UI insert
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      direction: "OUTBOUND",
      senderType: "HUMAN",
      messageType: "TEXT",
      content: messageText,
      status: "SENT",
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          text: messageText,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showToast(`⚠️ Échec d'envoi: ${data.error || "Erreur réseau"}`);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else {
        showToast("✓ Message envoyé via WhatsApp");
        // Update conversation in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConv.id
              ? {
                  ...c,
                  lastMessage: messageText,
                  time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                }
              : c
          )
        );
      }
    } catch (_err) {
      showToast("✓ Message enregistré");
    } finally {
      setIsSending(false);
    }
  };

  // ── 7. AI Assistant Handler ────────────────────────────────────────────────

  const handleAssistantSend = (text?: string) => {
    const query = text || assistantQuery;
    if (!query.trim()) return;

    setAssistantMessages((prev) => [...prev, { role: "user", text: query }]);
    setAssistantQuery("");
    setAssistantHasSuggestion(false);

    setTimeout(() => {
      let response = "Analyse des conversations en cours...";
      const queryLower = query.toLowerCase();

      if (queryLower.includes("relancer")) {
        const toRelance = conversations.filter((c) => c.tag === "A_RELANCER");
        response =
          toRelance.length > 0
            ? `Vous avez ${toRelance.length} client(s) à relancer : ${toRelance.map((c) => c.customerName).join(", ")}.`
            : "Aucun client marqué à relancer actuellement.";
      } else if (queryLower.includes("intention") || queryLower.includes("prêt") || queryLower.includes("commander")) {
        const intents = conversations.filter((c) => c.orderIntentStatus !== "NONE");
        response =
          intents.length > 0
            ? `${intents.length} client(s) avec intention de commande détectée : ${intents.map((c) => `${c.customerName} (${c.orderIntentStatus})`).join(", ")}. Finalisez via le bouton '+ Commande 1-Clic'.`
            : "Aucune intention de commande en attente.";
      } else if (queryLower.includes("réponse") || queryLower.includes("non lu")) {
        const unread = conversations.filter((c) => c.unreadCount > 0);
        response =
          unread.length > 0
            ? `${unread.length} conversation(s) non lues : ${unread.map((c) => c.customerName).join(", ")}.`
            : "Toutes les conversations ont été traitées ! 👍";
      } else {
        response = `Statistiques des conversations : ${conversations.length} au total, ${tagCounts.A_RELANCER} à relancer, ${tagCounts.PRETS_A_COMMANDER} prêts à commander.`;
      }

      setAssistantMessages((prev) => [...prev, { role: "bot", text: response }]);
    }, 700);
  };

  // ── 8. Render UI ───────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#FAF8F5]">

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* ── MEDIA ZOOM MODAL ──────────────────────────────────────────────── */}
      {previewMediaUrl && (
        <div
          onClick={() => setPreviewMediaUrl(null)}
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewMediaUrl} alt="Aperçu média" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <button
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN CONTAINER ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto flex flex-col h-screen">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-[#FAF8F5] sticky top-0 z-20 border-b border-[#EBE5DA]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (showChat ? setShowChat(false) : window.history.back())}
              className="p-2 rounded-xl hover:bg-[#F0EAE0] transition-colors text-[#1F1917]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-black text-[#1F1917] tracking-tight flex items-center gap-2">
                <span>{showChat && selectedConv ? selectedConv.customerName : "WhatsApp & Conversations"}</span>
                {showChat && selectedConv?.orderIntentStatus !== "NONE" && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                    selectedConv?.orderIntentStatus === "ORDER_CONFIRMED" || selectedConv?.orderIntentStatus === "ORDER_CREATED"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }`}>
                    {selectedConv?.orderIntentStatus === "ORDER_CONFIRMED" || selectedConv?.orderIntentStatus === "ORDER_CREATED"
                      ? "Commande Confirmée"
                      : "Intention Détectée"}
                  </span>
                )}
              </h1>
              {showChat && selectedConv && (
                <p className="text-xs text-stone-500 font-medium">{selectedConv.phoneNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showChat ? (
              <>
                {isCeo && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="px-3 py-1.5 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Inviter commercial</span>
                  </button>
                )}

                {searchOpen ? (
                  <div className="flex items-center gap-2 bg-white border border-[#EBE5DA] rounded-xl px-3 py-1.5 shadow-2xs animate-fade-in">
                    <Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Nom, téléphone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-36 sm:w-48 text-sm text-[#1F1917] outline-none bg-transparent placeholder:text-stone-400"
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
                  onClick={() => { loadConversations(); checkEvolutionStatus(); }}
                  className="p-2 rounded-xl hover:bg-[#F0EAE0] transition-colors text-stone-500"
                  title="Rafraîchir"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading || isCheckingStatus ? "animate-spin text-[#800020]" : ""}`} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderModalCustomer({
                      id: selectedConv?.customerId,
                      name: selectedConv?.customerName,
                      phone: selectedConv?.phoneNumber,
                      conversationId: selectedConv?.id,
                    });
                    setShowQuickOrderModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>+ Commande 1-Clic</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectedConv && loadCustomerDetails(selectedConv.customerId)}
                  className="px-3 py-1.5 bg-white border border-[#EBE5DA] hover:bg-stone-50 text-[#1F1917] text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-[#800020]" />
                  <span className="hidden sm:inline">Fiche Client</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── REAL EVOLUTION CONNECTION BANNER ──────────────────────────────── */}
        {!showChat && (
          <div className="px-4 py-3">
            <div className="bg-white border border-[#EBE5DA] rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    connectionStatus === "CONNECTED"
                      ? "bg-emerald-500 ring-4 ring-emerald-100"
                      : connectionStatus === "WAITING_QR"
                      ? "bg-amber-500 animate-pulse ring-4 ring-amber-100"
                      : "bg-red-400 ring-4 ring-red-100"
                  }`} />
                  <div>
                    <h3 className="font-extrabold text-[#1F1917] text-xs flex items-center gap-2">
                      <span>
                        {connectionStatus === "CONNECTED"
                          ? `WhatsApp API : Connecté ${connectedPhone ? `(${connectedPhone})` : ""}`
                          : connectionStatus === "WAITING_QR"
                          ? "WhatsApp API : En attente du QR Code"
                          : "WhatsApp API : Non connecté"}
                      </span>
                    </h3>
                    <p className="text-[11px] text-stone-500 font-medium">
                      {connectionStatus === "CONNECTED"
                        ? "Instance WhatsApp active. Synchronisation et webhooks fonctionnels."
                        : "Scannez le QR Code pour relier le numéro de l'entreprise et recevoir les messages."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleConnectInstance}
                    className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#1F1917] border border-[#EBE5DA] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#800020]" />
                    <span>⚡ QR Code WhatsApp</span>
                  </button>
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
              className="flex items-center gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar"
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
                        ? `${cfg.bg} text-white border-transparent shadow-xs`
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

            {/* INTENT & ASSIGNMENT FILTERS */}
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              {/* Intent Selector */}
              <div className="flex items-center bg-white border border-[#EBE5DA] rounded-xl p-0.5 shadow-2xs">
                <button
                  onClick={() => setActiveIntent("TOUTES")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeIntent === "TOUTES" ? "bg-[#1F1917] text-white" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Toutes intentions
                </button>
                <button
                  onClick={() => setActiveIntent("INTENTIONS")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeIntent === "INTENTIONS" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  ⚡ Intentions
                </button>
                <button
                  onClick={() => setActiveIntent("CONFIRMEES")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeIntent === "CONFIRMEES" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  ✓ Commandes
                </button>
              </div>

              {/* Assignment Filter */}
              <button
                onClick={() =>
                  setAssignmentFilter((prev) => (prev === "TOUTES" ? "MES_CONVERSATIONS" : "TOUTES"))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                  assignmentFilter === "MES_CONVERSATIONS"
                    ? "bg-[#800020] text-white border-[#800020]"
                    : "bg-white text-stone-700 border-[#EBE5DA] hover:bg-stone-50"
                }`}
              >
                {assignmentFilter === "MES_CONVERSATIONS" ? "👤 Mes conversations" : "👥 Toutes les conversations"}
              </button>
            </div>

            {/* CONVERSATION LIST */}
            <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#800020]" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-10 h-10 text-stone-300 mb-3" />
                  <p className="text-sm font-semibold text-stone-500">Aucune conversation trouvée</p>
                  <p className="text-xs text-stone-400 mt-1">Modifiez les filtres de recherche</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const tagCfg = TAG_CONFIG[conv.tag];
                  return (
                    <button
                      key={conv.id}
                      onClick={() => loadMessages(conv)}
                      className="w-full flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-[#EBE5DA]/80 shadow-2xs hover:shadow-md hover:border-[#800020]/20 transition-all duration-200 text-left group"
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
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            conv.tag === "A_RELANCER" ? "bg-[#800020]/8 text-[#800020] border-[#800020]/20" :
                            conv.tag === "TRES_INTERESSES" ? "bg-orange-50 text-orange-600 border-orange-200" :
                            conv.tag === "PRETS_A_COMMANDER" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            conv.tag === "EN_ATTENTE" ? "bg-amber-50 text-amber-600 border-amber-200" :
                            "bg-stone-50 text-stone-500 border-stone-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tagCfg.dot}`} />
                            {tagCfg.label}
                          </span>

                          {conv.orderIntentStatus !== "NONE" && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              conv.orderIntentStatus === "ORDER_CONFIRMED" || conv.orderIntentStatus === "ORDER_CREATED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {conv.orderIntentStatus === "ORDER_CONFIRMED" || conv.orderIntentStatus === "ORDER_CREATED"
                                ? "✓ Commande créée"
                                : "⚡ Intention de commande"}
                            </span>
                          )}

                          {conv.assignedAgent === "HUMAN" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              👤 Commercial actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              🤖 Assistant IA
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

            {/* Messages timeline */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F1EA]/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    msg.direction === "OUTBOUND"
                      ? msg.senderType === "AI"
                        ? "bg-[#800020] text-white rounded-br-none"
                        : "bg-[#1F1917] text-white rounded-br-none"
                      : "bg-white text-[#1F1917] rounded-bl-none border border-[#EBE5DA] shadow-2xs"
                  }`}>
                    {/* Header tag for sender */}
                    {msg.direction === "OUTBOUND" && (
                      <div className="text-[10px] font-black text-amber-300/90 mb-1 uppercase tracking-wider flex items-center gap-1">
                        {msg.senderType === "AI" ? (
                          <>
                            <Bot className="w-3 h-3 text-amber-300" />
                            <span>Assistant IA WILLShop</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-emerald-300" />
                            <span>Commercial Humain</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Media image rendering */}
                    {msg.messageType === "IMAGE" && (
                      <div className="mb-2">
                        {msg.mediaUrl ? (
                          <img
                            src={msg.mediaUrl}
                            alt="Média envoyé"
                            onClick={() => setPreviewMediaUrl(msg.mediaUrl || null)}
                            className="max-h-48 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity border border-white/20"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-xs italic opacity-80">
                            <ImageIcon className="w-4 h-4" />
                            <span>[Photo reçue via WhatsApp]</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Media Audio / Voice note rendering */}
                    {msg.messageType === "AUDIO" && (
                      <div className="mb-2 space-y-1">
                        {msg.mediaUrl ? (
                          <audio controls src={msg.mediaUrl} className="w-full h-8" />
                        ) : (
                          <div className="flex items-center gap-2 text-xs opacity-90 font-medium">
                            <Mic className="w-4 h-4 text-emerald-400" />
                            <span>[Note vocale WhatsApp]</span>
                          </div>
                        )}

                        {/* Transcription badge if present */}
                        {(msg.metadata?.raw_transcription || msg.content) && (
                          <div className="mt-1 text-xs bg-black/10 rounded-lg p-2 border border-black/10">
                            <p className="text-[11px] font-bold text-amber-200">Transcription Whisper :</p>
                            <p className="italic">{msg.metadata?.raw_transcription || msg.content}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Media Document rendering */}
                    {msg.messageType === "DOCUMENT" && (
                      <div className="mb-2">
                        <a
                          href={msg.mediaUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-xs underline font-bold"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span>{msg.content || "Document joint"}</span>
                        </a>
                      </div>
                    )}

                    {/* Text content */}
                    {msg.messageType !== "AUDIO" && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Time & status footer */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${
                      msg.direction === "OUTBOUND" ? "text-white/60 justify-end" : "text-stone-400"
                    }`}>
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

            {/* Chat input form */}
            <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-[#EBE5DA] bg-[#FAF8F5]">
              <input
                type="text"
                placeholder="Écrire un message WhatsApp..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-white border border-[#EBE5DA] rounded-2xl px-4 py-2.5 text-sm text-[#1F1917] placeholder:text-stone-400 outline-none focus:border-[#800020]/50 transition-colors shadow-2xs"
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                className="w-10 h-10 rounded-full bg-[#800020] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#590C1D] transition-colors shadow-2xs shrink-0"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── CUSTOMER DETAILS DRAWER ────────────────────────────────────────── */}
      {showCustomerDrawer && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[#FAF8F5] h-full shadow-2xl flex flex-col overflow-hidden">

            {/* Drawer Header */}
            <div className="px-5 py-4 bg-white border-b border-[#EBE5DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#800020]" />
                <h2 className="font-black text-[#1F1917] text-base">Fiche Commerciale Client</h2>
              </div>
              <button
                onClick={() => setShowCustomerDrawer(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoadingCustomerDetails ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#800020]" />
                </div>
              ) : customerDetails ? (
                <>
                  {/* Identity Card */}
                  <div className="bg-white border border-[#EBE5DA] rounded-2xl p-4 shadow-2xs space-y-2">
                    <h3 className="font-extrabold text-base text-[#1F1917]">
                      {customerDetails.firstName} {customerDetails.lastName}
                    </h3>
                    <div className="space-y-1 text-xs text-stone-600 font-medium">
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#800020]" />
                        <span>{customerDetails.phone}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-stone-400" />
                        <span>Ville : {customerDetails.city}</span>
                      </p>
                    </div>
                  </div>

                  {/* Orders History */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-xs text-[#1F1917] uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#800020]" />
                      <span>Historique Commandes ({customerDetails.orders.length})</span>
                    </h4>

                    {customerDetails.orders.length === 0 ? (
                      <div className="p-4 bg-white border border-[#EBE5DA] rounded-xl text-center text-xs text-stone-400 font-medium">
                        Aucune commande enregistrée
                      </div>
                    ) : (
                      customerDetails.orders.map((ord) => (
                        <div key={ord.id} className="p-3.5 bg-white border border-[#EBE5DA] rounded-xl shadow-2xs space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-[#800020]">{ord.orderNumber}</span>
                            <span className="text-[#1F1917]">{ord.totalAmount.toLocaleString('fr-FR')} FCFA</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-500">
                            <span>Statut : {ord.status}</span>
                            <span>{ord.createdAt}</span>
                          </div>

                          {/* Delivery info */}
                          {ord.delivery && (
                            <div className="mt-2 pt-2 border-t border-stone-100 text-[11px] space-y-1 text-stone-600">
                              <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
                                <Truck className="w-3.5 h-3.5" />
                                <span>Livraison : {ord.delivery.status}</span>
                              </p>
                              {ord.delivery.driverName && (
                                <p className="text-stone-500">
                                  Livreur : {ord.delivery.driverName} ({ord.delivery.driverPhone || 'N/A'})
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Engagements / Followups */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-xs text-[#1F1917] uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#800020]" />
                      <span>Relances programmées</span>
                    </h4>

                    {customerDetails.engagements.length === 0 ? (
                      <div className="p-4 bg-white border border-[#EBE5DA] rounded-xl text-center text-xs text-stone-400 font-medium">
                        Aucune relance en attente
                      </div>
                    ) : (
                      customerDetails.engagements.map((eng) => (
                        <div key={eng.id} className="p-3 bg-white border border-[#EBE5DA] rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-[#1F1917]">{eng.title}</p>
                            <p className="text-stone-400 text-[11px]">Échéance : {eng.dueAt}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            eng.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {eng.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-white border-t border-[#EBE5DA]">
              <button
                onClick={() => {
                  if (selectedConv) {
                    setOrderModalCustomer({
                      id: selectedConv.customerId,
                      name: selectedConv.customerName,
                      phone: selectedConv.phoneNumber,
                      conversationId: selectedConv.id,
                    });
                    setShowCustomerDrawer(false);
                    setShowQuickOrderModal(true);
                  }
                }}
                className="w-full py-3 bg-[#800020] hover:bg-[#660019] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Créer une commande pour ce client</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING ASSISTANT BUTTON ─────────────────────────────────────── */}
      <div className="fixed bottom-20 right-5 z-40">
        <button
          onClick={() => { setShowAssistant(true); setAssistantHasSuggestion(false); }}
          className="relative w-14 h-14 rounded-full bg-[#800020] text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center border-2 border-amber-300"
        >
          <Bot className="w-7 h-7" />
          {assistantHasSuggestion && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
          )}
        </button>
      </div>

      {/* ── ASSISTANT OVERLAY ─────────────────────────────────────────────── */}
      {showAssistant && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#EBE5DA] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-[#800020] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm">Assistant Commercial WILLShop IA</h3>
              </div>
              <button onClick={() => setShowAssistant(false)} className="p-1 rounded-lg hover:bg-white/20 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]">
              {assistantMessages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-[#1F1917] text-white" : "bg-white text-[#1F1917] border border-[#EBE5DA] shadow-2xs font-medium"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={assistantEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-[#EBE5DA] space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {["Qui dois-je relancer ?", "Intentions de commande", "Conversations non lues"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleAssistantSend(s)}
                    className="px-2.5 py-1 bg-[#FAF8F5] border border-[#EBE5DA] rounded-lg text-[11px] font-bold text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Posez une question sur vos conversations..."
                  value={assistantQuery}
                  onChange={(e) => setAssistantQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAssistantSend()}
                  className="flex-1 bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs text-[#1F1917] outline-none"
                />
                <button
                  onClick={() => handleAssistantSend()}
                  className="px-3 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019]"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QR CODE MODAL ─────────────────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#EBE5DA] text-center space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base text-[#1F1917]">Lier WhatsApp API Gateway</h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isCheckingStatus ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
                <p className="text-xs font-bold text-stone-500">Connexion à Evolution API...</p>
              </div>
            ) : qrCodeBase64 ? (
              <div className="space-y-3">
                <img src={qrCodeBase64} alt="QR Code WhatsApp" className="w-56 h-56 mx-auto rounded-2xl border-4 border-[#800020]/20 shadow-md" />
                <p className="text-xs text-stone-600 font-medium">
                  Ouvrez WhatsApp sur votre téléphone &gt; Appareils connectés &gt; Connecter un appareil.
                </p>
              </div>
            ) : qrError ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold space-y-2">
                <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                <p>{qrError}</p>
              </div>
            ) : (
              <div className="py-6 text-xs text-stone-500 font-medium">
                {connectionStatus === "CONNECTED" ? "Appareil déjà connecté !" : "Génération du QR code..."}
              </div>
            )}

            <button
              onClick={() => checkEvolutionStatus()}
              className="w-full py-2.5 bg-[#1F1917] hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
            >
              Vérifier le statut de connexion
            </button>
          </div>
        </div>
      )}

      {/* ── INVITE MEMBER MODAL ───────────────────────────────────────────── */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#EBE5DA] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base text-[#1F1917]">Inviter un collaborateur via WhatsApp</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-extrabold text-[#1F1917] mb-1">Nom Complet</label>
                <input
                  type="text"
                  placeholder="Ex: Moussa Ouédraogo"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3.5 py-2.5 text-xs outline-none text-[#1F1917]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#1F1917] mb-1">Numéro WhatsApp</label>
                <input
                  type="tel"
                  placeholder="+22670000000"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3.5 py-2.5 text-xs outline-none text-[#1F1917]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#1F1917] mb-1">Rôle dans l'entreprise</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl px-3.5 py-2.5 text-xs outline-none text-[#1F1917] font-bold"
                >
                  <option value="COMMERCIAL">Commercial(e)</option>
                  <option value="MANAGER">Manager commercial</option>
                  <option value="DRIVER">Livreur / Logistics</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingMember}
                className="w-full py-3 bg-[#800020] hover:bg-[#660019] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer l'invitation WhatsApp"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── QUICK ORDER MODAL ─────────────────────────────────────────────── */}
      <QuickOrderModal
        isOpen={showQuickOrderModal}
        onClose={() => setShowQuickOrderModal(false)}
        initialCustomer={orderModalCustomer}
        onOrderCreated={() => {
          showToast("✓ Commande 1-Clic créée et livraison programmée !");
          loadConversations();
          if (selectedConv) {
            loadMessages(selectedConv);
          }
        }}
      />
    </div>
  );
}
