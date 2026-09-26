"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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

  // Form states for adding customer
  const [formName, setFormName] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formChannel, setFormChannel] = useState<string>("WhatsApp Direct");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Mock initial list of customers
  const [customers, setCustomers] = useState<CustomerRecord[]>([
    {
      id: "c1",
      name: "Awa Koné",
      phone: "+226 70 12 34 56",
      address: "Ouagadougou, Secteur 15",
      channel: "WhatsApp Direct",
      createdAt: "12 sept. 2024",
      pastOrdersCount: 5,
      totalSpent: 125000,
      activeEngagementsCount: 1,
      lastConversationTime: "Aujourd'hui 10:24",
    },
    {
      id: "c2",
      name: "Moussa Traoré",
      phone: "+226 71 23 45 67",
      address: "Ouagadougou, Zone 1",
      channel: "WhatsApp Direct",
      createdAt: "04 oct. 2024",
      pastOrdersCount: 3,
      totalSpent: 85000,
      activeEngagementsCount: 1,
      lastConversationTime: "Hier 14:15",
    },
    {
      id: "c3",
      name: "Fatou Diarra",
      phone: "+226 76 34 56 78",
      address: "Ouaga 2000",
      channel: "Facebook Ads",
      createdAt: "18 nov. 2024",
      pastOrdersCount: 2,
      totalSpent: 42000,
      activeEngagementsCount: 0,
      lastConversationTime: "24 sept. 2026",
    },
    {
      id: "c4",
      name: "Ibrahim Sanogo",
      phone: "+226 72 45 67 89",
      address: "Pissy",
      channel: "Recommandation",
      createdAt: "02 janv. 2025",
      pastOrdersCount: 4,
      totalSpent: 96000,
      activeEngagementsCount: 0,
      lastConversationTime: "23 sept. 2026",
    },
  ]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    const newCust: CustomerRecord = {
      id: `c-${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      address: formAddress.trim() || "Ouagadougou",
      channel: formChannel,
      createdAt: "À l'instant",
      pastOrdersCount: 0,
      totalSpent: 0,
      activeEngagementsCount: 0,
      lastConversationTime: "À l'instant",
    };

    setCustomers((prev) => [newCust, ...prev]);
    setShowAddModal(false);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    showToast(`✓ Client ${newCust.name} ajouté au CRM !`);
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    setCustomers((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
    setSelectedCustomer(null);
    setShowDeleteModal(false);
    showToast("🗑️ Client supprimé du CRM.");
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

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#800020] hover:bg-[#660019] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau client</span>
        </button>
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
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 space-y-2">
              <Users className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-xs font-bold text-gray-700">Aucun client trouvé.</p>
            </div>
          ) : (
            filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomer(cust)}
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
    </div>
  );
}
