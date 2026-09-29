"use client";

import React, { useState, useMemo, useEffect } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Users, Search, Plus, Phone, MapPin, MessageSquare, ShoppingCart,
  Clock, Edit3, Trash2, CheckCircle2, X, ChevronRight, Filter,
  ExternalLink, TrendingUp, AlertCircle, Calendar, Star, FileText, ChevronDown, Download, Tag, Mail
} from "lucide-react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

interface CustomerRecord {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  city: string;
  status: string; // 'ACTIVE', 'PROSPECT', 'INTERESTED', 'HOT', 'TO_RELANCE'
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  lastActivity: string;
}

export default function CustomersCRMPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerConvId, setCustomerConvId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"INFO" | "HIST" | "CMD" | "LIV">("INFO");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
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
          name: c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.phone || "Client Inconnu",
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone || c.whatsapp_phone || "",
          city: c.city || c.address || "Non renseignée",
          status: c.status === "NEW" ? "PROSPECT" : c.status === "ACTIVE" ? "ACTIVE" : "TO_RELANCE",
          createdAt: c.created_at,
          ordersCount: 0,
          totalSpent: 0,
          lastActivity: c.updated_at || c.created_at,
        }));
        setCustomers(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerDetails = async (customerId: string) => {
    if (!orgId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", customerId)
        .eq("organization_id", orgId)
        .neq("status", "ARCHIVED")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.id) {
        setCustomerConvId(data.id);
      } else {
        setCustomerConvId(null);
      }
    } catch {
      setCustomerConvId(null);
    }
  };

  const openCustomerPanel = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setActiveTab("INFO");
    fetchCustomerDetails(cust.id);
  };

  const closePanel = () => {
    setSelectedCustomer(null);
    setCustomerConvId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE": return { label: "Client actif", style: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "TO_RELANCE": return { label: "À relancer", style: "bg-rose-100 text-rose-800 border-rose-200" };
      case "PROSPECT": return { label: "Prospect", style: "bg-blue-100 text-blue-800 border-blue-200" };
      case "INTERESTED": return { label: "Intéressé", style: "bg-amber-100 text-amber-800 border-amber-200" };
      case "HOT": return { label: "Très intéressé", style: "bg-purple-100 text-purple-800 border-purple-200" };
      default: return { label: "Client", style: "bg-stone-100 text-stone-800 border-stone-200" };
    }
  };

  // KPI Calculations
  const totalClients = customers.length;
  const activeClients = customers.filter(c => c.status === "ACTIVE").length;
  const withConvs = customers.length; // Approximate
  const toRelance = customers.filter(c => c.status === "TO_RELANCE").length;
  const hotClients = customers.filter(c => c.status === "HOT" || c.status === "PROSPECT").length;

  return (
    <div className="max-w-7xl mx-auto pb-24 animate-fade-in-up relative min-h-[90vh]">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-stone-800 animate-slide-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#1F1917]">Clients (CRM)</h1>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
              Base Clients
            </span>
          </div>
          <p className="text-stone-500 text-sm mt-1">
            Tous vos clients, prospects et conversations WhatsApp centralisés
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-[#EBE5DA] rounded-xl text-xs font-bold text-stone-700 hover:bg-[#F8F5EE] transition-all flex items-center gap-2 shadow-2xs">
            <Download className="w-4 h-4" />
            <span>Exporter</span>
          </button>
          <button className="px-4 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold hover:bg-[#660019] transition-all flex items-center gap-2 shadow-2xs">
            <Plus className="w-4 h-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total clients", val: totalClients, icon: Users, color: "text-blue-600", bg: "bg-blue-50", badge: "+12%" },
          { label: "Clients actifs", val: activeClients, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", badge: "+5%" },
          { label: "Avec conversations", val: withConvs, icon: MessageSquare, color: "text-stone-600", bg: "bg-stone-100", badge: "Stable" },
          { label: "À relancer", val: toRelance, icon: Clock, color: "text-rose-600", bg: "bg-rose-50", badge: "+2" },
          { label: "Très intéressés", val: hotClients, icon: Star, color: "text-purple-600", bg: "bg-purple-50", badge: "+8%" },
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
              <h3 className="text-xl font-black text-[#1F1917]">{kpi.val}</h3>
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
            placeholder="Rechercher nom, email ou téléphone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8F5EE] border border-transparent rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:bg-white focus:border-[#800020] outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          {["Tous les statuts", "Toutes les villes", "Tous les commerciaux", "Toutes les périodes"].map((f, i) => (
            <button key={i} className="px-3 py-2 bg-white border border-[#EBE5DA] rounded-xl text-[11px] font-bold text-stone-600 flex items-center gap-2 hover:bg-stone-50">
              {f} <ChevronDown className="w-3 h-3" />
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-[#EBE5DA] shadow-2xs overflow-hidden">
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
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBE5DA]">
              {customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((cust) => {
                const badge = getStatusBadge(cust.status);
                return (
                  <tr key={cust.id} onClick={() => openCustomerPanel(cust)} className="hover:bg-stone-50 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#800020]/10 text-[#800020] flex items-center justify-center font-black text-[10px]">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-[#1F1917]">{cust.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-stone-600">
                        {cust.phone} <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><MessageSquare className="w-2.5 h-2.5 text-white" /></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600 font-medium">{cust.city}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badge.style}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-stone-500 font-medium">
                      {new Date(cust.lastActivity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-[#1F1917]">{cust.ordersCount}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-[#800020]">{cust.totalSpent} F</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 bg-white border border-[#EBE5DA] rounded-lg text-stone-500 hover:text-[#800020] shadow-sm"><MessageSquare className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 bg-white border border-[#EBE5DA] rounded-lg text-stone-500 hover:text-emerald-600 shadow-sm"><ShoppingCart className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#EBE5DA] bg-[#F8F5EE] flex items-center justify-between text-[11px] font-bold text-stone-500">
          <span>Affichage de 1 à {customers.length} sur {customers.length}</span>
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-[#EBE5DA] bg-white rounded hover:bg-stone-50 text-stone-400">Préc</button>
            <button className="px-2 py-1 border border-[#EBE5DA] bg-white rounded hover:bg-stone-50 text-[#1F1917]">1</button>
            <button className="px-2 py-1 border border-[#EBE5DA] bg-white rounded hover:bg-stone-50 text-stone-400">Suiv</button>
          </div>
        </div>
      </div>

      {/* SLIDE-OVER CUSTOMER PANEL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="w-full absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={closePanel} />
          
          <div className="relative w-full max-w-md bg-[#F8F5EE] h-full shadow-2xl animate-slide-in-right flex flex-col border-l border-[#EBE5DA]">
            {/* Panel Header */}
            <div className="bg-white p-6 pb-0 border-b border-[#EBE5DA]">
              <button onClick={closePanel} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-[#1F1917] hover:bg-stone-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-3xl bg-[#800020]/10 text-[#800020] flex items-center justify-center font-black text-xl border border-[#800020]/20">
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#1F1917]">{selectedCustomer.name}</h2>
                  <div className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getStatusBadge(selectedCustomer.status).style}`}>
                      {getStatusBadge(selectedCustomer.status).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 text-xs font-bold border-b border-transparent">
                {[
                  { id: "INFO", label: "Informations" },
                  { id: "HIST", label: "Historique" },
                  { id: "CMD", label: "Commandes" },
                  { id: "LIV", label: "Livraisons" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`pb-3 px-1 border-b-2 transition-colors ${activeTab === t.id ? "border-[#800020] text-[#800020]" : "border-transparent text-stone-500 hover:text-[#1F1917]"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === "INFO" && (
                <>
                  {/* Coordonnées */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs space-y-4">
                    <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider mb-2">Coordonnées</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><Phone className="w-4 h-4 text-emerald-600" /></div>
                      <span className="font-mono font-bold text-stone-700">{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Mail className="w-4 h-4 text-blue-600" /></div>
                      <span className="font-medium text-stone-500 italic">Non renseigné</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center"><MapPin className="w-4 h-4 text-stone-600" /></div>
                      <span className="font-medium text-stone-700">{selectedCustomer.city}</span>
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 border border-[#EBE5DA] shadow-2xs text-center">
                      <ShoppingCart className="w-5 h-5 text-[#800020] mx-auto mb-2" />
                      <p className="text-[10px] text-stone-500 font-bold uppercase">Commandes</p>
                      <p className="text-lg font-black text-[#1F1917]">{selectedCustomer.ordersCount}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-[#EBE5DA] shadow-2xs text-center">
                      <TrendingUp className="w-5 h-5 text-[#800020] mx-auto mb-2" />
                      <p className="text-[10px] text-stone-500 font-bold uppercase">Total Dépensé</p>
                      <p className="text-lg font-black text-[#1F1917]">{selectedCustomer.totalSpent} F</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">Tags & Segments</h3>
                      <button className="text-[10px] font-bold text-[#800020] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Ajouter
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 text-[10px] font-bold flex items-center gap-1 border border-stone-200">
                        <Tag className="w-3 h-3" /> Nouveau
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-white rounded-2xl p-5 border border-[#EBE5DA] shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">Notes internes</h3>
                      <button className="text-stone-400 hover:text-[#800020]"><Edit3 className="w-4 h-4" /></button>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed italic">
                      Aucune note sur ce client pour le moment. Cliquez sur l'icône pour en ajouter.
                    </p>
                  </div>
                </>
              )}
              {activeTab !== "INFO" && (
                <div className="text-center py-10 text-stone-400 text-xs font-bold">
                  Contenu de l'onglet {activeTab} à venir.
                </div>
              )}
            </div>

            {/* Panel Actions (Fixed Bottom) */}
            <div className="bg-white p-5 border-t border-[#EBE5DA] space-y-3">
              <button
                onClick={() => {
                  if (customerConvId) {
                    router.push(`/whatsapp?conv=${customerConvId}`);
                  } else {
                    showToast("Aucune conversation trouvée pour ce client");
                  }
                }}
                className="w-full bg-[#800020] hover:bg-[#660019] text-white py-3.5 rounded-xl text-xs font-black shadow-lg shadow-[#800020]/20 flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Voir la conversation WhatsApp
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="w-full bg-white border border-[#EBE5DA] hover:bg-stone-50 text-[#1F1917] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  <ShoppingCart className="w-3.5 h-3.5 text-stone-500" />
                  Nouvelle commande
                </button>
                <button className="w-full bg-white border border-[#EBE5DA] hover:bg-stone-50 text-[#1F1917] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  Planifier relance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
