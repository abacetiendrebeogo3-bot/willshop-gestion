"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Users, Search, Plus, Phone, MapPin, MessageSquare, ShoppingCart,
  Clock, Edit3, Trash2, CheckCircle2, X, ChevronRight, Filter,
  ExternalLink, TrendingUp, AlertCircle, Calendar, Star, FileText, ChevronDown, Download, Tag, Mail,
  Loader2, Check, ArrowRight, RefreshCw, Send, AlertTriangle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { QuickOrderModal } from "@/components/sales/QuickOrderModal";

export const dynamic = "force-dynamic";

interface CustomerRecord {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  whatsapp_phone?: string;
  city: string;
  address?: string;
  status: string; // 'ACTIVE', 'PROSPECT', 'INTERESTED', 'HOT', 'TO_RELANCE'
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  lastActivity: string;
  notes?: string;
}

interface TagItem {
  id: string;
  name: string;
  color?: string;
  category?: string;
}

interface NoteItem {
  id: string;
  content: string;
  created_at: string;
  author_id?: string;
}

interface EngagementItem {
  id: string;
  title: string;
  description?: string;
  due_at: string;
  status: string;
  priority: string;
}

interface OrderSummary {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
}

export default function CustomersCRMPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerConvId, setCustomerConvId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"INFO" | "HIST" | "CMD" | "LIV">("INFO");

  // Modals state
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [isQuickOrderModalOpen, setIsQuickOrderModalOpen] = useState<boolean>(false);
  const [isRelanceModalOpen, setIsRelanceModalOpen] = useState<boolean>(false);
  const [isTagInputOpen, setIsTagInputOpen] = useState<boolean>(false);
  const [isOpeningWhatsApp, setIsOpeningWhatsApp] = useState<boolean>(false);

  // Customer sub-data for panel
  const [customerTags, setCustomerTags] = useState<TagItem[]>([]);
  const [customerNotes, setCustomerNotes] = useState<NoteItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<OrderSummary[]>([]);
  const [customerEngagements, setCustomerEngagements] = useState<EngagementItem[]>([]);
  const [isLoadingSubData, setIsLoadingSubData] = useState<boolean>(false);

  // New Note state
  const [newNoteContent, setNewNoteContent] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  // New Tag state
  const [newTagName, setNewTagName] = useState<string>("");
  const [isSubmittingTag, setIsSubmittingTag] = useState<boolean>(false);

  // Schedule Relance state
  const [relanceTitle, setRelanceTitle] = useState<string>("Relance commerciale");
  const [relanceDesc, setRelanceDesc] = useState<string>("");
  const [relanceDueAt, setRelanceDueAt] = useState<string>("");
  const [relancePriority, setRelancePriority] = useState<string>("IMPORTANT");
  const [isSubmittingRelance, setIsSubmittingRelance] = useState<boolean>(false);

  // New Customer Form state
  const [newCustForm, setNewCustForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    city: "Ouagadougou",
    address: "",
    status: "PROSPECT",
    note: "",
    tag: "",
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState<boolean>(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        if (data.customers) {
          setCustomers(data.customers);
        }
      } else {
        // Fallback to Supabase client direct fetch if API is warming up
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsLoading(false); return; }

        const { data: roleData } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(1);

        const activeOrgId = roleData?.[0]?.organization_id;
        setOrgId(activeOrgId);
        if (!activeOrgId) { setIsLoading(false); return; }

        const { data: custData } = await supabase
          .from("customers")
          .select("*")
          .eq("organization_id", activeOrgId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (custData) {
          const formatted = custData.map((c: any) => ({
            id: c.id,
            name: (c.full_name || `${c.first_name || ""} ${c.last_name || ""}`).trim() || c.phone || "Client sans nom",
            first_name: c.first_name || "",
            last_name: c.last_name || "",
            phone: c.phone || c.whatsapp_phone || "",
            whatsapp_phone: c.whatsapp_phone || c.phone || "",
            city: c.city || c.address || "Non renseignée",
            address: c.address || "",
            status: c.status || "PROSPECT",
            notes: c.notes || "",
            createdAt: c.created_at,
            ordersCount: 0,
            totalSpent: 0,
            lastActivity: c.updated_at || c.created_at,
          }));
          setCustomers(formatted);
        }
      }
    } catch (err) {
      console.error("[Customers CRM] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load customer sub-data (Tags, Notes, Orders, Relances)
  const loadCustomerDetails = async (cust: CustomerRecord) => {
    setIsLoadingSubData(true);
    try {
      // 1. Fetch Tags
      fetch(`/api/customers/${cust.id}/tags`)
        .then((r) => r.json())
        .then((data) => {
          if (data.tags) setCustomerTags(data.tags);
        })
        .catch(() => {});

      // 2. Fetch Notes
      fetch(`/api/customers/${cust.id}/notes`)
        .then((r) => r.json())
        .then((data) => {
          if (data.notes) setCustomerNotes(data.notes);
        })
        .catch(() => {});

      // 3. Fetch Relances / Engagements
      fetch(`/api/customers/${cust.id}/relance`)
        .then((r) => r.json())
        .then((data) => {
          if (data.engagements) setCustomerEngagements(data.engagements);
        })
        .catch(() => {});

      // 4. Fetch Orders
      const supabase = createClient();
      const { data: ords } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .eq("customer_id", cust.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (ords) {
        setCustomerOrders(ords);
      }

      // 5. Check if conversation exists
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", cust.id)
        .neq("status", "ARCHIVED")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCustomerConvId(conv?.id || null);
    } catch (e) {
      console.error("[Customer Details] Error:", e);
    } finally {
      setIsLoadingSubData(false);
    }
  };

  const openCustomerPanel = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setActiveTab("INFO");
    setIsTagInputOpen(false);
    setNewNoteContent("");
    setCustomerTags([]);
    setCustomerNotes([]);
    setCustomerOrders([]);
    setCustomerEngagements([]);
    loadCustomerDetails(cust);
  };

  const closePanel = () => {
    setSelectedCustomer(null);
    setCustomerConvId(null);
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { label: "Client actif", style: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "TO_RELANCE":
        return { label: "À relancer", style: "bg-rose-100 text-rose-800 border-rose-200" };
      case "PROSPECT":
        return { label: "Prospect", style: "bg-blue-100 text-blue-800 border-blue-200" };
      case "INTERESTED":
        return { label: "Intéressé", style: "bg-amber-100 text-amber-800 border-amber-200" };
      case "HOT":
        return { label: "Très intéressé", style: "bg-purple-100 text-purple-800 border-purple-200" };
      default:
        return { label: "Client", style: "bg-stone-100 text-stone-800 border-stone-200" };
    }
  };

  // 1. ADD NEW CUSTOMER
  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCustomerError(null);

    const phoneClean = newCustForm.phone.trim();
    if (!phoneClean) {
      setNewCustomerError("Le numéro de téléphone est obligatoire.");
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newCustForm.firstName,
          last_name: newCustForm.lastName,
          phone: phoneClean,
          city: newCustForm.city,
          address: newCustForm.address,
          status: newCustForm.status,
          note: newCustForm.note,
          tag: newCustForm.tag,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setNewCustomerError(data.error || "Impossible d'enregistrer le client.");
        return;
      }

      showToast(`✓ Client ${data.customer.name} ajouté avec succès !`);
      setIsNewCustomerModalOpen(false);
      setNewCustForm({
        firstName: "",
        lastName: "",
        phone: "",
        city: "Ouagadougou",
        address: "",
        status: "PROSPECT",
        note: "",
        tag: "",
      });

      // Refresh and select new customer
      await fetchCustomers();
      if (data.customer) {
        openCustomerPanel(data.customer);
      }
    } catch (err: any) {
      setNewCustomerError(err.message || "Erreur réseau.");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // 2. ADD / REMOVE TAGS
  const handleAddTag = async (tagName: string) => {
    if (!selectedCustomer || !tagName.trim()) return;
    setIsSubmittingTag(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.tag) {
        setCustomerTags((prev) => [...prev.filter((t) => t.id !== data.tag.id), data.tag]);
        setNewTagName("");
        setIsTagInputOpen(false);
        showToast("✓ Tag ajouté au client");
      } else {
        showToast(`Erreur : ${data.error || "Impossible d'ajouter le tag"}`);
      }
    } catch {
      showToast("Erreur réseau lors de l'ajout du tag");
    } finally {
      setIsSubmittingTag(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/tags?tagId=${tagId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCustomerTags((prev) => prev.filter((t) => t.id !== tagId));
        showToast("✓ Tag retiré");
      }
    } catch {
      showToast("Impossible de supprimer le tag");
    }
  };

  // 3. ADD NOTE
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !newNoteContent.trim()) return;

    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setCustomerNotes((prev) => [data.note, ...prev]);
        setNewNoteContent("");
        showToast("✓ Note interne enregistrée");
      } else {
        showToast(`Erreur : ${data.error || "Impossible d'enregistrer la note"}`);
      }
    } catch {
      showToast("Erreur réseau");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/notes?noteId=${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCustomerNotes((prev) => prev.filter((n) => n.id !== noteId));
        showToast("✓ Note supprimée");
      }
    } catch {
      showToast("Impossible de supprimer la note");
    }
  };

  // 4. OPEN WHATSAPP CONVERSATION (NEVER FAILS)
  const handleOpenConversation = async () => {
    if (!selectedCustomer) return;
    setIsOpeningWhatsApp(true);
    try {
      const res = await fetch("/api/whatsapp/conversation/get-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          phone: selectedCustomer.phone,
          name: selectedCustomer.name,
        }),
      });

      const data = await res.json();
      if (res.ok && data.conversationId) {
        router.push(`/whatsapp?conv=${data.conversationId}&customerId=${selectedCustomer.id}`);
      } else {
        // Fallback: direct WhatsApp URL if backend creation encounters issue
        const cleanDigits = selectedCustomer.phone.replace(/\D/g, "");
        if (cleanDigits) {
          window.open(`https://wa.me/${cleanDigits}`, "_blank");
        } else {
          showToast("Numéro de téléphone invalide pour WhatsApp");
        }
      }
    } catch (err: any) {
      console.error("[Open WhatsApp Error]", err);
      const cleanDigits = selectedCustomer.phone.replace(/\D/g, "");
      if (cleanDigits) {
        window.open(`https://wa.me/${cleanDigits}`, "_blank");
      }
    } finally {
      setIsOpeningWhatsApp(false);
    }
  };

  // 5. SCHEDULE RELANCE
  const handleScheduleRelanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    if (!relanceDueAt) {
      showToast("Veuillez sélectionner une date et heure.");
      return;
    }

    setIsSubmittingRelance(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/relance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: relanceTitle || "Relance client",
          description: relanceDesc,
          dueAt: relanceDueAt,
          priority: relancePriority,
        }),
      });

      const data = await res.json();
      if (res.ok && data.engagement) {
        showToast(`✓ Relance programmée pour le ${new Date(relanceDueAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} !`);
        setIsRelanceModalOpen(false);
        setRelanceDesc("");
        // Update local status
        setSelectedCustomer((prev) => prev ? { ...prev, status: "TO_RELANCE" } : null);
        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? { ...c, status: "TO_RELANCE" } : c))
        );
        // Refresh engagements
        loadCustomerDetails(selectedCustomer);
      } else {
        showToast(`Erreur : ${data.error || "Échec de planification"}`);
      }
    } catch {
      showToast("Erreur réseau");
    } finally {
      setIsSubmittingRelance(false);
    }
  };

  // Quick Relance preset helper
  const setQuickRelanceTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setRelanceDueAt(formatted);
  };

  // 6. EXPORT CSV
  const handleExportCSV = () => {
    if (customers.length === 0) {
      showToast("Aucun client à exporter.");
      return;
    }

    const filtered = filteredCustomers;
    const headers = [
      "ID",
      "Nom complet",
      "Prénom",
      "Nom",
      "Téléphone",
      "Ville",
      "Statut",
      "Commandes",
      "Total Dépensé (FCFA)",
      "Date d'inscription",
      "Dernière activité",
    ];

    const rows = filtered.map((c) => [
      `"${c.id}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.first_name || "").replace(/"/g, '""')}"`,
      `"${(c.last_name || "").replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.city.replace(/"/g, '""')}"`,
      `"${c.status}"`,
      c.ordersCount,
      c.totalSpent,
      `"${new Date(c.createdAt).toLocaleDateString("fr-FR")}"`,
      `"${new Date(c.lastActivity).toLocaleDateString("fr-FR")}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clients_willshop_os_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`✓ Export CSV réussi (${filtered.length} clients exportés) !`);
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchQuery =
        searchQuery === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchCity = cityFilter === "ALL" || c.city === cityFilter;

      return matchQuery && matchStatus && matchCity;
    });
  }, [customers, searchQuery, statusFilter, cityFilter]);

  // Unique cities list for filter
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city !== "Non renseignée") set.add(c.city);
    });
    return Array.from(set);
  }, [customers]);

  // KPI Calculations
  const totalClients = customers.length;
  const activeClients = customers.filter((c) => c.status === "ACTIVE").length;
  const toRelance = customers.filter((c) => c.status === "TO_RELANCE").length;
  const hotClients = customers.filter((c) => c.status === "HOT" || c.status === "INTERESTED").length;
  const totalRevenue = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);

  return (
    <div className="max-w-7xl mx-auto pb-24 animate-fade-in-up relative min-h-[90vh]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#1F1917]">Clients (CRM)</h1>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
              Base Clients ({totalClients})
            </span>
          </div>
          <p className="text-stone-500 text-sm mt-1">
            Gérez vos clients, segmentez vos tags, suivez les relances et passez commande en 1 clic
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCustomers}
            disabled={isLoading}
            className="p-2.5 bg-white border border-[#EBE5DA] rounded-xl text-stone-600 hover:bg-[#F8F5EE] transition-all shadow-2xs"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#800020]" : ""}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white border border-[#EBE5DA] rounded-xl text-xs font-bold text-stone-700 hover:bg-[#F8F5EE] hover:border-stone-400 transition-all flex items-center gap-2 shadow-2xs cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4 text-stone-500" />
            <span>Exporter ({filteredCustomers.length})</span>
          </button>
          <button
            onClick={() => {
              setNewCustomerError(null);
              setIsNewCustomerModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] transition-all flex items-center gap-2 shadow-md shadow-[#800020]/20 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total clients", val: totalClients, icon: Users, color: "text-blue-600", bg: "bg-blue-50", badge: "Base" },
          { label: "Clients actifs", val: activeClients, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", badge: "Actifs" },
          { label: "À relancer", val: toRelance, icon: Clock, color: "text-rose-600", bg: "bg-rose-50", badge: "Priorité" },
          { label: "Intéressés", val: hotClients, icon: Star, color: "text-purple-600", bg: "bg-purple-50", badge: "Chauds" },
          { label: "Total CA Réalisé", val: `${totalRevenue.toLocaleString()} F`, icon: TrendingUp, color: "text-[#800020]", bg: "bg-stone-100", badge: "XOF" },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-[#EBE5DA] shadow-2xs flex flex-col justify-between h-28">
            <div className="flex justify-between items-start">
              <div className={`w-8 h-8 rounded-full ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                {kpi.badge}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-black text-[#1F1917] truncate">{kpi.val}</h3>
              <p className="text-[10px] text-stone-500 font-bold uppercase">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-3 rounded-2xl border border-[#EBE5DA] shadow-2xs flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou ville..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8F5EE] border border-transparent rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:bg-white focus:border-[#800020] outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Statut Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#EBE5DA] rounded-xl text-[11px] font-bold text-stone-700 outline-none hover:bg-stone-50 cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Clients actifs</option>
            <option value="PROSPECT">Prospects</option>
            <option value="TO_RELANCE">À relancer</option>
            <option value="HOT">Très intéressés</option>
          </select>

          {/* Ville Selector */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#EBE5DA] rounded-xl text-[11px] font-bold text-stone-700 outline-none hover:bg-stone-50 cursor-pointer"
          >
            <option value="ALL">Toutes les villes</option>
            {uniqueCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-[#EBE5DA] shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#800020]" />
            <p className="text-xs font-bold text-stone-500">Chargement de votre base clients...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Users className="w-12 h-12 text-stone-300" />
            <h3 className="text-base font-bold text-stone-700">Aucun client trouvé</h3>
            <p className="text-xs text-stone-500 max-w-sm">
              {searchQuery || statusFilter !== "ALL"
                ? "Aucun résultat pour cette recherche ou ce filtre."
                : "Votre base client est actuellement vide. Ajoutez votre premier client dès maintenant !"}
            </p>
            <button
              onClick={() => setIsNewCustomerModalOpen(true)}
              className="mt-2 px-4 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un client</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F8F5EE] border-b border-[#EBE5DA] text-[10px] font-black text-stone-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Dernière activité</th>
                  <th className="px-4 py-3 text-center">Cmds</th>
                  <th className="px-4 py-3 text-right">Dépensé</th>
                  <th className="px-4 py-3 text-right">Actions rapides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBE5DA]">
                {filteredCustomers.map((cust) => {
                  const badge = getStatusBadge(cust.status);
                  return (
                    <tr
                      key={cust.id}
                      onClick={() => openCustomerPanel(cust)}
                      className="hover:bg-stone-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#800020]/10 text-[#800020] flex items-center justify-center font-black text-[10px] shrink-0">
                            {cust.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#1F1917] block">{cust.name}</span>
                            {cust.notes && (
                              <span className="text-[10px] text-stone-400 truncate max-w-[160px] block">
                                {cust.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-stone-600">
                          {cust.phone}
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600 font-medium">{cust.city}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badge.style}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-stone-500 font-medium">
                        {new Date(cust.lastActivity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-[#1F1917]">{cust.ordersCount}</td>
                      <td className="px-4 py-3 text-right text-xs font-black text-[#800020]">
                        {cust.totalSpent.toLocaleString()} F
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              handleOpenConversation();
                            }}
                            title="Ouvrir WhatsApp"
                            className="p-1.5 bg-white border border-[#EBE5DA] rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors shadow-2xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsQuickOrderModalOpen(true);
                            }}
                            title="Créer commande"
                            className="p-1.5 bg-white border border-[#EBE5DA] rounded-lg text-[#800020] hover:bg-[#800020]/10 transition-colors shadow-2xs"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setRelanceTitle(`Relance client — ${cust.name}`);
                              setQuickRelanceTime(24);
                              setIsRelanceModalOpen(true);
                            }}
                            title="Planifier relance"
                            className="p-1.5 bg-white border border-[#EBE5DA] rounded-lg text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#EBE5DA] bg-[#F8F5EE] flex items-center justify-between text-[11px] font-bold text-stone-500">
          <span>
            Affichage de 1 à {filteredCustomers.length} sur {customers.length} client(s)
          </span>
          <span className="text-[10px] text-stone-400">Cliquez sur un client pour afficher sa fiche complète</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER CUSTOMER PANEL */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="w-full absolute inset-0 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={closePanel} />

          <div className="relative w-full max-w-lg bg-[#F8F5EE] h-full shadow-2xl animate-slide-in-right flex flex-col border-l border-[#EBE5DA] z-10">
            {/* Panel Header */}
            <div className="bg-white p-6 pb-0 border-b border-[#EBE5DA]">
              <button
                onClick={closePanel}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-[#1F1917] hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-[#800020]/10 text-[#800020] flex items-center justify-center font-black text-xl border border-[#800020]/20 shrink-0">
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-[#1F1917] truncate">{selectedCustomer.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getStatusBadge(selectedCustomer.status).style}`}>
                      {getStatusBadge(selectedCustomer.status).label}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Inscrit le {new Date(selectedCustomer.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-5 text-xs font-bold">
                {[
                  { id: "INFO", label: "Informations" },
                  { id: "CMD", label: `Commandes (${customerOrders.length})` },
                  { id: "HIST", label: `Relances (${customerEngagements.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? "border-[#800020] text-[#800020]"
                        : "border-transparent text-stone-500 hover:text-[#1F1917]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: INFORMATIONS */}
              {activeTab === "INFO" && (
                <>
                  {/* Coordonnées */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs space-y-3.5">
                    <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">Coordonnées</h3>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="font-mono font-bold text-stone-700">{selectedCustomer.phone}</span>
                      </div>
                      <a
                        href={`tel:${selectedCustomer.phone}`}
                        className="text-[11px] font-bold text-[#800020] hover:underline"
                      >
                        Appeler
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-stone-600" />
                      </div>
                      <span className="font-medium text-stone-700">{selectedCustomer.city} {selectedCustomer.address ? `— ${selectedCustomer.address}` : ""}</span>
                    </div>
                  </div>

                  {/* Statistiques Rapides */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 border border-[#EBE5DA] shadow-2xs text-center">
                      <ShoppingCart className="w-5 h-5 text-[#800020] mx-auto mb-1.5" />
                      <p className="text-[10px] text-stone-500 font-bold uppercase">Commandes</p>
                      <p className="text-lg font-black text-[#1F1917]">{customerOrders.length || selectedCustomer.ordersCount}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-[#EBE5DA] shadow-2xs text-center">
                      <TrendingUp className="w-5 h-5 text-[#800020] mx-auto mb-1.5" />
                      <p className="text-[10px] text-stone-500 font-bold uppercase">Total Dépensé</p>
                      <p className="text-lg font-black text-[#1F1917]">
                        {selectedCustomer.totalSpent.toLocaleString()} F
                      </p>
                    </div>
                  </div>

                  {/* TAGS SECTION */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-stone-400" />
                        <span>Tags & Segments</span>
                      </h3>
                      <button
                        onClick={() => setIsTagInputOpen(!isTagInputOpen)}
                        className="text-[11px] font-bold text-[#800020] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter un tag</span>
                      </button>
                    </div>

                    {/* Tag input form */}
                    {isTagInputOpen && (
                      <div className="mb-3 p-3 bg-[#F8F5EE] rounded-xl border border-[#EBE5DA] animate-fade-in">
                        <p className="text-[10px] font-bold text-stone-500 mb-2">Choisir ou taper un tag :</p>
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {["VIP", "Grossiste", "Fidèle", "Prospect chaud", "Relance urgente", "Livraison express"].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleAddTag(preset)}
                              disabled={isSubmittingTag}
                              className="px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[10px] font-bold text-stone-700 hover:border-[#800020] hover:text-[#800020] transition-colors"
                            >
                              +{preset}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Tag personnalisé..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag(newTagName);
                              }
                            }}
                            className="flex-1 bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#800020]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTag(newTagName)}
                            disabled={isSubmittingTag || !newTagName.trim()}
                            className="px-3 py-1 bg-[#800020] text-white rounded-lg text-xs font-bold hover:bg-[#660019] disabled:opacity-50"
                          >
                            {isSubmittingTag ? "..." : "Valider"}
                          </button>
                        </div>
                      </div>
                    )}

                    {customerTags.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">Aucun tag pour le moment. Cliquez sur "Ajouter un tag".</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {customerTags.map((t) => (
                          <span
                            key={t.id}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-bold flex items-center gap-1.5 border border-stone-200 group"
                          >
                            <Tag className="w-3 h-3 text-[#800020]" />
                            <span>{t.name}</span>
                            <button
                              onClick={() => handleRemoveTag(t.id)}
                              className="text-stone-400 hover:text-rose-600 transition-colors ml-0.5"
                              title="Retirer le tag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NOTES SECTION */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-stone-400" />
                        <span>Notes Internes</span>
                      </h3>
                      <span className="text-[10px] text-stone-400">{customerNotes.length} note(s)</span>
                    </div>

                    {/* New Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Ajouter une note interne (ex: demande de remise, préférence horaire)..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl p-2.5 text-xs outline-none focus:bg-white focus:border-[#800020] transition-all resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingNote || !newNoteContent.trim()}
                          className="px-3 py-1.5 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] disabled:opacity-50 transition-all flex items-center gap-1.5"
                        >
                          {isSubmittingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit3 className="w-3 h-3" />}
                          <span>Enregistrer la note</span>
                        </button>
                      </div>
                    </form>

                    {/* Notes List */}
                    <div className="space-y-2 pt-2 border-t border-[#EBE5DA]/60">
                      {customerNotes.length === 0 && !selectedCustomer.notes ? (
                        <p className="text-xs text-stone-400 italic text-center py-2">
                          Aucune note sur ce client pour le moment.
                        </p>
                      ) : (
                        <>
                          {selectedCustomer.notes && customerNotes.length === 0 && (
                            <div className="p-3 bg-[#F8F5EE] rounded-xl border border-[#EBE5DA] text-xs text-stone-700">
                              <p className="font-medium">{selectedCustomer.notes}</p>
                              <span className="text-[10px] text-stone-400 mt-1 block">Note principale du client</span>
                            </div>
                          )}
                          {customerNotes.map((note) => (
                            <div
                              key={note.id}
                              className="p-3 bg-[#F8F5EE] rounded-xl border border-[#EBE5DA] text-xs text-stone-700 flex justify-between items-start gap-2 group"
                            >
                              <div className="flex-1">
                                <p className="font-medium whitespace-pre-wrap">{note.content}</p>
                                <span className="text-[10px] text-stone-400 mt-1 block">
                                  {new Date(note.created_at).toLocaleString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 p-1 transition-opacity"
                                title="Supprimer la note"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: COMMANDES */}
              {activeTab === "CMD" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">
                      Historique des commandes
                    </h3>
                    <button
                      onClick={() => setIsQuickOrderModalOpen(true)}
                      className="px-3 py-1.5 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nouvelle commande</span>
                    </button>
                  </div>

                  {customerOrders.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#EBE5DA] space-y-2">
                      <ShoppingCart className="w-8 h-8 text-stone-300 mx-auto" />
                      <p className="text-xs font-bold text-stone-600">Aucune commande pour ce client</p>
                      <p className="text-[11px] text-stone-400">
                        Passez une commande rapide pour ce client en 1 clic.
                      </p>
                      <button
                        onClick={() => setIsQuickOrderModalOpen(true)}
                        className="mt-2 px-4 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Créer une commande
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-4 bg-white rounded-2xl border border-[#EBE5DA] flex items-center justify-between"
                        >
                          <div>
                            <span className="text-xs font-bold text-[#1F1917] block">
                              Commande #{ord.order_number}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {new Date(ord.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-[#800020] block">
                              {Number(ord.total).toLocaleString()} F
                            </span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                              {ord.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 text-center">
                    <Link
                      href={`/orders/new?customerId=${selectedCustomer.id}&phone=${encodeURIComponent(selectedCustomer.phone)}&name=${encodeURIComponent(selectedCustomer.name)}`}
                      className="text-xs font-bold text-[#800020] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Ouvrir le formulaire de commande complet</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* TAB 3: RELANCES & ENGAGEMENTS */}
              {activeTab === "HIST" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">
                      Relances programmées & Suivi
                    </h3>
                    <button
                      onClick={() => {
                        setRelanceTitle(`Relance client — ${selectedCustomer.name}`);
                        setQuickRelanceTime(24);
                        setIsRelanceModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Planifier relance</span>
                    </button>
                  </div>

                  {customerEngagements.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#EBE5DA] space-y-2">
                      <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                      <p className="text-xs font-bold text-stone-600">Aucune relance programmée</p>
                      <p className="text-[11px] text-stone-400">
                        Planifiez une date pour relancer ce client et ne jamais perdre une vente.
                      </p>
                      <button
                        onClick={() => {
                          setRelanceTitle(`Relance client — ${selectedCustomer.name}`);
                          setQuickRelanceTime(24);
                          setIsRelanceModalOpen(true);
                        }}
                        className="mt-2 px-4 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] inline-flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Planifier maintenant
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerEngagements.map((eng) => (
                        <div
                          key={eng.id}
                          className="p-4 bg-white rounded-2xl border border-[#EBE5DA] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1F1917]">{eng.title}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              eng.priority === "URGENT"
                                ? "bg-rose-100 text-rose-800"
                                : eng.priority === "IMPORTANT"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-stone-700"
                            }`}>
                              {eng.priority}
                            </span>
                          </div>
                          {eng.description && (
                            <p className="text-xs text-stone-600">{eng.description}</p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Prévu pour le {new Date(eng.due_at).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="font-bold text-stone-600 uppercase">{eng.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel Actions (Fixed Bottom) */}
            <div className="bg-white p-5 border-t border-[#EBE5DA] space-y-3">
              <button
                onClick={handleOpenConversation}
                disabled={isOpeningWhatsApp}
                className="w-full bg-[#800020] hover:bg-[#660019] text-white py-3.5 rounded-xl text-xs font-black shadow-lg shadow-[#800020]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75"
              >
                {isOpeningWhatsApp ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                <span>Voir la conversation WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsQuickOrderModalOpen(true)}
                  className="w-full bg-white border border-[#EBE5DA] hover:bg-stone-50 text-[#1F1917] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-stone-500" />
                  <span>Nouvelle commande</span>
                </button>
                <button
                  onClick={() => {
                    setRelanceTitle(`Relance client — ${selectedCustomer.name}`);
                    setQuickRelanceTime(24);
                    setIsRelanceModalOpen(true);
                  }}
                  className="w-full bg-white border border-[#EBE5DA] hover:bg-stone-50 text-[#1F1917] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  <span>Planifier relance</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: NOUVEAU CLIENT */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fade-in"
            onClick={() => setIsNewCustomerModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#EBE5DA] overflow-hidden z-10 animate-scale-up">
            <div className="bg-[#800020] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-amber-200" />
                <h3 className="font-black text-sm">Ajouter un nouveau client</h3>
              </div>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4">
              {newCustomerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{newCustomerError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Prénom</label>
                  <input
                    type="text"
                    placeholder="ex: Yasmine"
                    value={newCustForm.firstName}
                    onChange={(e) => setNewCustForm({ ...newCustForm, firstName: e.target.value })}
                    className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Nom</label>
                  <input
                    type="text"
                    placeholder="ex: Sanou"
                    value={newCustForm.lastName}
                    onChange={(e) => setNewCustForm({ ...newCustForm, lastName: e.target.value })}
                    className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Téléphone WhatsApp <span className="text-[#800020]">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="tel"
                    required
                    placeholder="+226 70 00 00 00"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold outline-none focus:bg-white focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Ville</label>
                  <input
                    type="text"
                    placeholder="Ouagadougou"
                    value={newCustForm.city}
                    onChange={(e) => setNewCustForm({ ...newCustForm, city: e.target.value })}
                    className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Statut initial</label>
                  <select
                    value={newCustForm.status}
                    onChange={(e) => setNewCustForm({ ...newCustForm, status: e.target.value })}
                    className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-2.5 py-2 text-xs font-bold outline-none focus:bg-white focus:border-[#800020]"
                  >
                    <option value="PROSPECT">Prospect</option>
                    <option value="ACTIVE">Client actif</option>
                    <option value="TO_RELANCE">À relancer</option>
                    <option value="HOT">Très intéressé</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Adresse / Quartier</label>
                <input
                  type="text"
                  placeholder="ex: Ouaga 2000, près de la pharmacie"
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Tag initial (optionnel)</label>
                <input
                  type="text"
                  placeholder="ex: VIP, Grossiste, Facebook..."
                  value={newCustForm.tag}
                  onChange={(e) => setNewCustForm({ ...newCustForm, tag: e.target.value })}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Première note interne (optionnel)</label>
                <textarea
                  rows={2}
                  placeholder="Notes sur les besoins du client..."
                  value={newCustForm.note}
                  onChange={(e) => setNewCustForm({ ...newCustForm, note: e.target.value })}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl p-2.5 text-xs outline-none focus:bg-white focus:border-[#800020] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EBE5DA]">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 border border-[#EBE5DA] rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="px-5 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] flex items-center gap-2 shadow-md shadow-[#800020]/20 disabled:opacity-50"
                >
                  {isSubmittingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Créer le client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PLANIFIER UNE RELANCE */}
      {/* ========================================================================= */}
      {isRelanceModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fade-in"
            onClick={() => setIsRelanceModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#EBE5DA] overflow-hidden z-10 animate-scale-up">
            <div className="bg-[#800020] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-amber-200" />
                <h3 className="font-black text-sm">Planifier une relance</h3>
              </div>
              <button
                onClick={() => setIsRelanceModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleRelanceSubmit} className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold text-stone-400 block mb-0.5">Client ciblé</span>
                <p className="text-sm font-black text-[#1F1917]">
                  {selectedCustomer.name} ({selectedCustomer.phone})
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Motif de la relance</label>
                <input
                  type="text"
                  required
                  value={relanceTitle}
                  onChange={(e) => setRelanceTitle(e.target.value)}
                  placeholder="ex: Relance validation commande"
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-[#800020]"
                />
              </div>

              {/* Quick time buttons */}
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1.5">Raccourcis délai</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickRelanceTime(2)}
                    className="p-2 bg-[#F8F5EE] hover:bg-[#800020]/10 hover:text-[#800020] border border-[#EBE5DA] rounded-xl text-[10px] font-bold transition-colors"
                  >
                    Dans 2 heures
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRelanceTime(24)}
                    className="p-2 bg-[#F8F5EE] hover:bg-[#800020]/10 hover:text-[#800020] border border-[#EBE5DA] rounded-xl text-[10px] font-bold transition-colors"
                  >
                    Demain (24h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickRelanceTime(48)}
                    className="p-2 bg-[#F8F5EE] hover:bg-[#800020]/10 hover:text-[#800020] border border-[#EBE5DA] rounded-xl text-[10px] font-bold transition-colors"
                  >
                    Dans 2 jours
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Date et Heure précises <span className="text-[#800020]">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={relanceDueAt}
                  onChange={(e) => setRelanceDueAt(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs font-medium outline-none focus:bg-white focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Priorité</label>
                <select
                  value={relancePriority}
                  onChange={(e) => setRelancePriority(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-[#800020]"
                >
                  <option value="NORMAL">Normale</option>
                  <option value="IMPORTANT">Importante</option>
                  <option value="URGENT">Urgente (Aujourd'hui)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Message suggéré ou Note d'action (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="ex: Bonjour, je reviens vers vous concernant notre échange d'hier..."
                  value={relanceDesc}
                  onChange={(e) => setRelanceDesc(e.target.value)}
                  className="w-full bg-[#F8F5EE] border border-[#EBE5DA] rounded-xl p-2.5 text-xs outline-none focus:bg-white focus:border-[#800020] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EBE5DA]">
                <button
                  type="button"
                  onClick={() => setIsRelanceModalOpen(false)}
                  className="px-4 py-2 border border-[#EBE5DA] rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRelance || !relanceDueAt}
                  className="px-5 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] flex items-center gap-2 shadow-md shadow-[#800020]/20 disabled:opacity-50"
                >
                  {isSubmittingRelance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  <span>Enregistrer la relance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK ORDER MODAL */}
      {/* ========================================================================= */}
      {isQuickOrderModalOpen && selectedCustomer && (
        <QuickOrderModal
          isOpen={isQuickOrderModalOpen}
          onClose={() => setIsQuickOrderModalOpen(false)}
          initialCustomer={{
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            conversationId: customerConvId || undefined,
            neighborhood: selectedCustomer.city,
          }}
          onOrderCreated={(orderData) => {
            showToast("✓ Commande créée avec succès !");
            setIsQuickOrderModalOpen(false);
            // Refresh orders in drawer
            loadCustomerDetails(selectedCustomer);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}
