"use client";

import React, { useState, useMemo } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
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

import { useEffect } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";

export const dynamic = "force-dynamic";

export default function OrdersListPage() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
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
      .order("created_at", { ascending: true }).limit(1);

      const orgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
      if (!orgId) {
        setIsLoading(false);
        return;
      }

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*, customer:customers(*)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error || !ordersData || ordersData.length === 0) {
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const formatted: OrderRow[] = ordersData.map((o: any) => {
        const custName = o.customer?.full_name || `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim() || o.customer?.phone || "Client non spécifié";
        const custPhone = o.customer?.phone || o.customer?.whatsapp_phone || "Non renseigné";
        const createdDateStr = o.created_at
          ? new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "Récemment";

        return {
          id: o.id,
          orderNumber: o.order_number || `#CMD-${o.id.substring(0, 6)}`,
          customerName: custName,
          phone: custPhone,
          totalTTC: Number(o.total_ttc) || 0,
          status: o.status || "ORDER_CONFIRMED",
          itemsCount: 1,
          createdAt: createdDateStr,
          deliveryAddress: o.delivery_address || o.customer?.address || undefined,
        };
      });

      setOrders(formatted);
    } catch (err) {
      console.error("[Orders List] Fetch error:", err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
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
  }, [orders, selectedStatus, searchQuery]);

  const getStatusBadge = (status: OrderLifecycleStatus | string) => {
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
      default:
        return { label: status || "En attente", style: "bg-gray-100 text-gray-800 border-gray-200" };
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
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
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
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge?.style || "bg-gray-100 text-gray-800 border-gray-200"}`}>
                          {badge?.label || ord.status || "En attente"}
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
