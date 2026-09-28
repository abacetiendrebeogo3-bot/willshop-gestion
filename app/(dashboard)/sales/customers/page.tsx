"use client";

export const dynamic = "force-dynamic";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  MessageSquare,
  ShoppingCart,
  Clock,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle,
  ChevronRight,
  Filter,
  ExternalLink,
} from "lucide-react";

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address: string;
  channel: string;
  createdAt: string;
  pastOrdersCount: number;
  totalSpent: number;
  activeEngagementsCount: number;
  lastConversationTime: string;
}

export default function CustomersCRMPage() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customerConvId, setCustomerConvId] = useState<string | null>(null);
  const [isLoadingConv, setIsLoadingConv] = useState<boolean>(false);
  // show ghost customers (auto-created from WhatsApp with no real name)
  const [showGhosts, setShowGhosts] = useState<boolean>(false);

  // Form states for adding customer
  const [formName, setFormName] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formChannel, setFormChannel] = useState<string>("WhatsApp Direct");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      const activeOrgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
      setOrgId(activeOrgId);

      if (!activeOrgId) {
        setIsLoading(false);
        return;
      }

      const { data: custData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error || !custData) {
        setCustomers([]);
        setIsLoading(false);
        return;
      }

      const formatted: CustomerRecord[] = custData.map((c: any) => {
        const fullName = c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone || "Client Sans Nom";
        const createdDateStr = c.created_at
          ? new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
          : "Récemment";

        return {
          id: c.id,
          name: fullName,
          phone: c.phone || c.whatsapp_phone || "Non renseigné",
          address: c.address || c.city || "Non renseigné",
          channel: c.source || "WhatsApp Direct",
          createdAt: createdDateStr,
          pastOrdersCount: c.past_orders_count || 0,
          totalSpent: Number(c.total_spent) || 0,
          activeEngagementsCount: 0,
          lastConversationTime: createdDateStr,
        };
      });

      setCustomers(formatted);
      if (formatted.length > 0) {
        if (!selectedCustomer || !formatted.find((c) => c.id === selectedCustomer.id)) {
          setSelectedCustomer(formatted[0]);
        }
      } else {
        setSelectedCustomer(null);
      }
    } catch (err) {
      console.error("[Customers CRM] Error fetching customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // A customer is considered a "ghost" if their name is purely derived from the phone number
  // (auto-created by WhatsApp webhook with no human name provided)
  const isGhostCustomer = (c: CustomerRecord) => {
    const name = c.name.trim();
    // Ghost patterns: just a number, "Client XXXX", or "WhatsApp" appended variations
    if (/^\+?\d[\d\s\-]+$/.test(name)) return true;
    if (/^Client\s+\d+$/i.test(name)) return true;
    if (/^Client\s+WhatsApp$/i.test(name)) return true;
    if (name === "Client WhatsApp" || name === "Client Sans Nom") return true;
    if (name.toLowerCase().endsWith(" whatsapp") && name.split(" ").length <= 2) return true;
    return false;
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Filter out ghost customers unless explicitly shown
      if (!showGhosts && isGhostCustomer(c)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery, showGhosts]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    try {
      const supabase = createClient();
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_organization_roles")
            .select("organization_id")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .limit(1);
          if (roleData && roleData.length > 0) targetOrgId = roleData[0].organization_id;
        }
      }

      if (!targetOrgId) {
        showToast("Erreur: Organisation introuvable.");
        return;
      }

      const nameParts = formName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      const { data: inserted, error } = await supabase
        .from("customers")
        .insert({
          organization_id: targetOrgId,
          first_name: firstName,
          last_name: lastName,
          full_name: formName.trim(),
          phone: formPhone.trim(),
          whatsapp_phone: formPhone.trim(),
          address: formAddress.trim() || "Ouagadougou",
          source: formChannel,
          status: "ACTIVE",
        })
        .select("*")
        .single();

      if (error) {
        showToast(`Erreur d'ajout: ${error.message}`);
        return;
      }

      showToast(`✓ Client ${formName.trim()} ajouté au CRM !`);
      setShowAddModal(false);
      setFormName("");
      setFormPhone("");
      setFormAddress("");
      fetchCustomers();
    } catch (err: any) {
      showToast(`Erreur: ${err?.message || "Impossible d'ajouter le client."}`);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      const supabase = createClient();
      await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", selectedCustomer.id);

      setSelectedCustomer(null);
      setShowDeleteModal(false);
      showToast("🗑️ Client supprimé du CRM.");
      fetchCustomers();
    } catch (err: any) {
      showToast(`Erreur: ${err?.message || "Impossible de supprimer."}`);
    }
  };

  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);

  const loadCustomerConversation = async (customerId: string) => {
    if (!customerId) return;
    setIsLoadingConv(true);
    setCustomerConvId(null);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", customerId)
        .neq("status", "ARCHIVED")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCustomerConvId(data?.id || null);
    } catch {
      setCustomerConvId(null);
    } finally {
      setIsLoadingConv(false);
    }
  };

  const ghostCount = useMemo(
    () => customers.filter((c) => isGhostCustomer(c)).length,
    [customers]
  );

  const handlePurgeAllCustomers = async () => {
    try {
      const supabase = createClient();
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_organization_roles")
            .select("organization_id")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .limit(1);
          if (roleData && roleData.length > 0) targetOrgId = roleData[0].organization_id;
        }
      }

      if (!targetOrgId) {
        showToast("Erreur: Organisation introuvable.");
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("organization_id", targetOrgId);

      if (error) {
        showToast(`Erreur de nettoyage: ${error.message}`);
        return;
      }

      setCustomers([]);
      setSelectedCustomer(null);
      setShowPurgeModal(false);
      showToast("🧹 Tous les clients fictifs ont été supprimés avec succès !");
    } catch (err: any) {
      showToast(`Erreur: ${err?.message || "Impossible de vider la base."}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in-up">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl font-medium text-xs flex items-center gap-2 border border-gray-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion des Clients (CRM)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
              Base Clients
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Centralisation des contacts, historiques de commandes et engagements clients
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ghostCount > 0 && (
            <button
              onClick={() => setShowGhosts(!showGhosts)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                showGhosts
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showGhosts ? `Masquer les ${ghostCount} non identifiés` : `Afficher ${ghostCount} non identifiés`}</span>
            </button>
          )}
          {customers.length > 0 && (
            <button
              onClick={() => setShowPurgeModal(true)}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Vider tous les clients</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#800020] hover:bg-[#660019] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un client par nom, téléphone, adresse..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
          />
        </div>
      </div>

      {/* MAIN GRID: CUSTOMER LIST & DETAIL FICHE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Cards List (Left 66%) */}
        <div className="lg:col-span-2 space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 space-y-3 shadow-2xs">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto border border-gray-100 text-gray-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">Aucun client enregistré</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Votre base CRM ne contient encore aucun client. Ajoutez votre premier client pour commencer à suivre ses commandes et échanges.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#660019] transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau client</span>
              </button>
            </div>
          ) : (
            filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                onClick={() => { setSelectedCustomer(cust); loadCustomerConversation(cust.id); }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white flex items-center justify-between gap-4 shadow-2xs hover:shadow-xs ${
                  selectedCustomer?.id === cust.id
                    ? "border-[#800020] ring-2 ring-[#800020]/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#800020] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    {cust.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{cust.name}</h3>
                      <span className="text-gray-400 font-mono text-[11px]">{cust.phone}</span>
                    </div>

                    <p className="text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span>{cust.address}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-[10px] font-mono text-gray-400">{cust.channel}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right shrink-0">
                  <div className="hidden sm:block text-xs font-mono">
                    <span className="text-gray-400 block text-[10px]">Commandes</span>
                    <span className="font-bold text-gray-900">{cust.pastOrdersCount} cmd ({cust.totalSpent.toLocaleString("fr-FR")} FCFA)</span>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer Detail Fiche (Right 34%) */}
        <div className="space-y-4">
          {selectedCustomer ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#800020] text-[#D4A843] flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedCustomer.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-gray-900 text-base">{selectedCustomer.name}</h2>
                    <p className="text-xs text-gray-500 font-mono">{selectedCustomer.phone}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Supprimer le client"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                  <span className="text-[10px] text-gray-400 block font-sans">Commandes passées</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedCustomer.pastOrdersCount}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                  <span className="text-[10px] text-gray-400 block font-sans">Total dépensé</span>
                  <span className="font-bold text-[#800020] text-xs">
                    {selectedCustomer.totalSpent.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              </div>

              {/* Details Info */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Adresse :</span>
                  <span className="font-semibold text-gray-900">{selectedCustomer.address}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Canal WhatsApp :</span>
                  <span className="font-semibold text-gray-900">{selectedCustomer.channel}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Dernière conversation :</span>
                  <span className="font-semibold text-gray-900">{selectedCustomer.lastConversationTime}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                {isLoadingConv ? (
                  <div className="w-full py-2.5 text-xs text-center text-stone-400 font-bold">Chargement conversation...</div>
                ) : customerConvId ? (
                  <Link
                    href={`/whatsapp?conv=${customerConvId}`}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Voir la conversation WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </Link>
                ) : (
                  <div className="w-full py-2 text-[11px] text-center text-stone-400 bg-stone-50 rounded-xl border border-stone-100">
                    Aucune conversation WhatsApp trouvée
                  </div>
                )}

                <Link
                  href="/orders/new"
                  className="w-full bg-[#800020] hover:bg-[#660019] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer une commande pour ce client</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-2xs text-center text-gray-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-gray-300" />
              <p className="text-xs font-bold text-gray-600">Sélectionnez un client dans la liste</p>
              <p className="text-[11px] text-gray-400">Pour voir sa fiche détaillée et son historique.</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-900 text-sm">Nouveau Client CRM</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 font-bold mb-1">Nom complet :</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Amadou Fall"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Téléphone WhatsApp :</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+226 70 00 00 00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Adresse / Zone :</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ouagadougou, Secteur..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-semibold text-gray-900 focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Canal d'acquisition :</label>
                <select
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:border-[#800020]"
                >
                  <option value="WhatsApp Direct">WhatsApp Direct</option>
                  <option value="Facebook Ads">Facebook Ads</option>
                  <option value="Recommandation">Recommandation</option>
                  <option value="Boutique">Boutique physique</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-100 text-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#800020] hover:bg-[#660019] text-white shadow-xs"
                >
                  Enregistrer client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-gray-900 text-base">Supprimer le client ?</h3>
            <p className="text-xs text-gray-500">
              Voulez-vous vraiment supprimer {selectedCustomer.name} du CRM ? Ses commandes resteront archivées.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-100 text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PURGE ALL CUSTOMERS MODAL */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-gray-900 text-base">Vider tous les clients fictifs ?</h3>
            <p className="text-xs text-gray-500">
              Voulez-vous vraiment supprimer l'intégralité des clients de la liste ? Vous pourrez ensuite repartir d'une base 100% propre avec de vrais clients.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-100 text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handlePurgeAllCustomers}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Tout vider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
