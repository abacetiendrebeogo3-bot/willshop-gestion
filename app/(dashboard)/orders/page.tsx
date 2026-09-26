"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  RotateCcw,
  FileText,
  Calendar,
} from "lucide-react";

export type OrderLifecycleStatus =
  | "ORDER_INTENT"
  | "ORDER_CONFIRMED"
  | "DELIVERY_CREATED"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "RESCHEDULED";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  totalTTC: number;
  status: OrderLifecycleStatus;
  itemsCount: number;
  createdAt: string;
  deliveryDriver?: string;
  deliveryAddress?: string;
}

export default function OrdersListPage() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Mock list of orders representing the complete lifecycle
  const ordersList: OrderRow[] = [
    {
      id: "ord-2026-001",
      orderNumber: "#CMD-2026-0014",
      customerName: "Awa Koné",
      phone: "+226 70 12 34 56",
      totalTTC: 25000,
      status: "ORDER_CONFIRMED",
      itemsCount: 2,
      createdAt: "24 sept. 2026 à 14:32",
      deliveryDriver: "Issa Nikiema",
      deliveryAddress: "Ouagadougou Centre",
    },
    {
      id: "ord-2026-002",
      orderNumber: "#CMD-2026-0015",
      customerName: "Moussa Traoré",
      phone: "+226 71 23 45 67",
      totalTTC: 45000,
      status: "ORDER_INTENT",
      itemsCount: 1,
      createdAt: "26 sept. 2026 à 10:15",
    },
    {
      id: "ord-2026-003",
      orderNumber: "#CMD-2026-0016",
      customerName: "Fatou Diarra",
      phone: "+226 76 34 56 78",
      totalTTC: 18500,
      status: "IN_TRANSIT",
      itemsCount: 3,
      createdAt: "25 sept. 2026 à 16:40",
      deliveryDriver: "Issa Nikiema",
      deliveryAddress: "Ouaga 2000 Zone B",
    },
    {
      id: "ord-2026-004",
      orderNumber: "#CMD-2026-0017",
      customerName: "Ibrahim Sanogo",
      phone: "+226 72 45 67 89",
      totalTTC: 36000,
      status: "DELIVERED",
      itemsCount: 2,
      createdAt: "23 sept. 2026 à 09:20",
      deliveryDriver: "Oumar Zango",
      deliveryAddress: "Pissy Secteur 15",
    },
    {
      id: "ord-2026-005",
      orderNumber: "#CMD-2026-0018",
      customerName: "Kassoum Sawadogo",
      phone: "+226 78 67 89 01",
      totalTTC: 28000,
      status: "FAILED",
      itemsCount: 1,
      createdAt: "22 sept. 2026 à 11:05",
      deliveryDriver: "Issa Nikiema",
      deliveryAddress: "Karpala Zone C",
    },
    {
      id: "ord-2026-006",
      orderNumber: "#CMD-2026-0019",
      customerName: "Salif Ouédraogo",
      phone: "+226 73 78 90 12",
      totalTTC: 52000,
      status: "DELIVERY_CREATED",
      itemsCount: 4,
      createdAt: "26 sept. 2026 à 08:30",
    },
  ];

  const filteredOrders = useMemo(() => {
    return ordersList.filter((o) => {
      if (selectedStatus !== "ALL" && o.status !== selectedStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = o.customerName.toLowerCase().includes(q);
        const matchNumber = o.orderNumber.toLowerCase().includes(q);
        const matchPhone = o.phone.toLowerCase().includes(q);
        if (!matchName && !matchNumber && !matchPhone) return false;
      }
      return true;
    });
  }, [selectedStatus, searchQuery]);

  const getStatusBadge = (status: OrderLifecycleStatus) => {
    switch (status) {
      case "ORDER_INTENT":
        return { label: "Intention (Brouillon)", style: "bg-amber-50 text-amber-800 border-amber-200" };
      case "ORDER_CONFIRMED":
        return { label: "Confirmée", style: "bg-[#800020]/10 text-[#800020] border-[#800020]/20" };
      case "DELIVERY_CREATED":
        return { label: "Livraison créée", style: "bg-blue-50 text-blue-800 border-blue-200" };
      case "ASSIGNED":
        return { label: "Livreur assigné", style: "bg-indigo-50 text-indigo-800 border-indigo-200" };
      case "IN_TRANSIT":
        return { label: "En cours de livraison", style: "bg-purple-50 text-purple-800 border-purple-200" };
      case "DELIVERED":
        return { label: "Livrée & Payée", style: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "FAILED":
        return { label: "Échec livraison", style: "bg-rose-50 text-rose-800 border-rose-200" };
      case "RESCHEDULED":
        return { label: "Reprogrammée", style: "bg-orange-50 text-orange-800 border-orange-200" };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Liste des Commandes</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
              Ventes & Pipeline
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Suivi du cycle de vie complet des commandes WILLShop OS
          </p>
        </div>

        <Link
          href="/orders/new"
          className="bg-[#800020] hover:bg-[#660019] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle commande</span>
        </Link>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de client, téléphone, #CMD..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#800020]"
          />
        </div>

        {/* Lifecycle Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Statut :</span>
          {[
            { id: "ALL", label: "Toutes" },
            { id: "ORDER_INTENT", label: "Intentions (Intents)" },
            { id: "ORDER_CONFIRMED", label: "Confirmées" },
            { id: "DELIVERY_CREATED", label: "Livraisons créées" },
            { id: "IN_TRANSIT", label: "En transit" },
            { id: "DELIVERED", label: "Livrées" },
            { id: "FAILED", label: "Échecs" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedStatus === st.id
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-gray-100/80 text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-200 uppercase tracking-wider text-[10px]">
                <th className="p-4">N° Commande</th>
                <th className="p-4">Client</th>
                <th className="p-4">Statut Cycle de Vie</th>
                <th className="p-4 text-right">Montant TTC</th>
                <th className="p-4">Date de Création</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                    Aucune commande ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const badge = getStatusBadge(ord.status);

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => router.push(`/orders/${ord.id}`)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="p-4 font-mono font-bold text-gray-900 flex items-center gap-2">
                        <span>{ord.orderNumber}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{ord.customerName}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{ord.phone}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.style}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-extrabold text-gray-900">
                        {ord.totalTTC.toLocaleString("fr-FR")} FCFA
                      </td>
                      <td className="p-4 text-gray-500 text-[11px] font-medium">{ord.createdAt}</td>
                      <td className="p-4 text-center">
                        <Link
                          href={`/orders/${ord.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#800020] hover:underline"
                        >
                          <span>Voir détail</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
