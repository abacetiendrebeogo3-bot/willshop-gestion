"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  ArrowLeft,
  ShoppingCart,
  Printer,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  MessageSquare,
  User,
  AlertTriangle,
  Send,
  ShieldCheck,
  X,
  ChevronDown,
} from "lucide-react";

interface OrderDetailData {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    city: string;
    address: string;
    channel: string;
  };
  items: Array<{
    id: string;
    name: string;
    sku: string;
    qty: number;
    unitPrice: number;
    subtotal: number;
  }>;
  financials: {
    subtotal: number;
    vat18: number;
    deliveryFee: number;
    totalTTC: number;
  };
  timeline: Array<{
    status: string;
    label: string;
    date: string;
    done: boolean;
  }>;
  delivery?: {
    driverName: string;
    driverPhone: string;
    zone: string;
    status: string;
    assignedAt: string;
  };
  whatsappThread?: Array<{
    sender: string;
    text: string;
    time: string;
  }>;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = (params?.id as string) || "";

  const [orderStatus, setOrderStatus] = useState<string>("ORDER_CONFIRMED");
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);

  const fetchOrderDetail = async () => {
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

      let query = supabase
        .from("orders")
        .select("*, customer:customers(*), items:order_items(*, product:products(*))")
        .eq("organization_id", orgId);

      // Match by ID or by order_number
      if (orderId.startsWith("CMD-") || orderId.startsWith("#CMD-")) {
        const cleanNo = orderId.startsWith("#") ? orderId : `#${orderId}`;
        query = query.or(`order_number.eq.${orderId},order_number.eq.${cleanNo}`);
      } else {
        query = query.eq("id", orderId);
      }

      const { data: orderData, error } = await query.maybeSingle();

      if (error || !orderData) {
        setOrderDetails(null);
        setIsLoading(false);
        return;
      }

      setOrderStatus(orderData.status || "ORDER_CONFIRMED");

      const cust = orderData.customer || {};
      const formattedItems = (orderData.items || []).map((i: any) => ({
        id: i.id,
        name: i.product?.name || "Produit sans nom",
        sku: i.product?.sku || "SKU-001",
        qty: i.quantity || 1,
        unitPrice: Number(i.unit_price) || 0,
        subtotal: Number(i.total_price) || (i.quantity * i.unit_price) || 0,
      }));

      const sub = Number(orderData.subtotal) || formattedItems.reduce((acc: number, item: any) => acc + item.subtotal, 0);
      const vat = Number(orderData.tax_amount) || Math.round(sub * 0.18);
      const fee = Number(orderData.delivery_fee) || 0;
      const total = Number(orderData.total_ttc) || (sub + vat + fee);

      const createdDateStr = orderData.created_at
        ? new Date(orderData.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "Inconnue";

      const currentSt = orderData.status || "ORDER_CONFIRMED";
      const isConfirmed = ["ORDER_CONFIRMED", "DELIVERY_CREATED", "IN_TRANSIT", "DELIVERED"].includes(currentSt);
      const isDelivCreated = ["DELIVERY_CREATED", "IN_TRANSIT", "DELIVERED"].includes(currentSt);
      const isInTransit = ["IN_TRANSIT", "DELIVERED"].includes(currentSt);
      const isDelivered = currentSt === "DELIVERED";

      const timeline = [
        { status: "ORDER_INTENT", label: "Intention WhatsApp / Saisie", date: createdDateStr, done: true },
        { status: "ORDER_CONFIRMED", label: "Commande confirmée par le commercial", date: isConfirmed ? "Validé" : "En attente", done: isConfirmed },
        { status: "DELIVERY_CREATED", label: "Livraison créée et attribuée", date: isDelivCreated ? "Validé" : "En attente", done: isDelivCreated },
        { status: "IN_TRANSIT", label: "Pris en charge par le livreur", date: isInTransit ? "En cours" : "En attente", done: isInTransit },
        { status: "DELIVERED", label: "Livraison effectuée & Paiement reçu", date: isDelivered ? "Livré" : "En attente", done: isDelivered },
      ];

      setOrderDetails({
        id: orderData.id,
        orderNumber: orderData.order_number || `#CMD-${orderData.id.substring(0, 6)}`,
        createdAt: createdDateStr,
        customer: {
          name: cust.full_name || `${cust.first_name || ""} ${cust.last_name || ""}`.trim() || cust.phone || "Client non spécifié",
          phone: cust.phone || cust.whatsapp_phone || "Non renseigné",
          city: cust.city || "Ouagadougou",
          address: orderData.delivery_address || cust.address || "Non renseignée",
          channel: cust.source || "Direct",
        },
        items: formattedItems,
        financials: {
          subtotal: sub,
          vat18: vat,
          deliveryFee: fee,
          totalTTC: total,
        },
        timeline,
      });
    } catch (err) {
      console.error("[Order Detail] Fetch error:", err);
      setOrderDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!orderDetails) return;
    try {
      const supabase = createClient();
            const res = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderDetails.id, status: newStatus }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour du statut');
      }

      setOrderStatus(newStatus);
      setShowStatusModal(false);
      showToast(`✓ Statut mis à jour: ${newStatus}`);
      fetchOrderDetail();
    } catch (err: any) {
      showToast(`Erreur: ${err?.message || "Impossible de changer le statut"}`);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!orderDetails) return;
    try {
      const supabase = createClient();
      await supabase
        .from("orders")
        .delete()
        .eq("id", orderDetails.id);

      setShowDeleteModal(false);
      showToast("🗑️ Commande supprimée avec succès.");
      setTimeout(() => {
        router.push("/orders");
      }, 1200);
    } catch (err: any) {
      showToast(`Erreur de suppression: ${err?.message || "Échec"}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-stone-500 font-bold text-xs space-y-2">
        <ShoppingCart className="w-8 h-8 text-[#800020] animate-bounce mx-auto" />
        <p>Chargement des détails de la commande...</p>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-[#EBE5DA] space-y-3 max-w-md mx-auto mt-8">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-black text-[#1F1917]">Commande non trouvée</h2>
        <p className="text-xs text-stone-500 font-medium">
          Cette commande n'existe pas ou a été supprimée de votre entreprise.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#800020] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la liste des commandes</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in-up">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl font-medium text-xs flex items-center gap-2 border border-gray-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Retour à la liste"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Commande {orderDetails.orderNumber}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
                {orderStatus}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Créée le {orderDetails.createdAt} • Client: {orderDetails.customer.name}
            </p>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <span>Changer statut</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <Link
            href="/orders/new"
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-gray-600" />
            <span>Modifier</span>
          </Link>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Supprimer</span>
          </button>
        </div>
      </div>

      {/* TIMELINE CYCLE DE VIE */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-extrabold text-gray-900">Cycle de Vie & Historique d'Événements</h2>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {orderDetails.timeline.map((t, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 text-xs transition-all ${
                t.done
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold">{t.status}</span>
                {t.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </div>
              <p className="font-semibold text-[11px] leading-snug">{t.label}</p>
              <span className="text-[10px] font-mono font-medium opacity-80">{t.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GRID: DETAILS, WHATSAPP & DELIVERY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (66%): Items & Customer Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-[#800020]" />
              <span>Informations Client & Adresse</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-medium block">Nom complet :</span>
                <span className="font-bold text-gray-900 text-sm">{orderDetails.customer.name}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Téléphone :</span>
                <span className="font-mono font-bold text-gray-900">{orderDetails.customer.phone}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Ville & Zone :</span>
                <span className="font-semibold text-gray-800">{orderDetails.customer.city}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Adresse de livraison :</span>
                <span className="font-semibold text-gray-800">{orderDetails.customer.address}</span>
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#800020]" />
              <span>Lignes de la commande ({orderDetails.items.length})</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 uppercase tracking-wider text-[10px]">
                    <th className="p-3">Produit</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3 text-center">Qté</th>
                    <th className="p-3 text-right">Prix Unitaire</th>
                    <th className="p-3 text-right">Sous-total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {orderDetails.items.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-bold text-gray-900">{item.name}</td>
                      <td className="p-3 font-mono text-gray-400">{item.sku}</td>
                      <td className="p-3 text-center font-bold">{item.qty}</td>
                      <td className="p-3 text-right font-mono">{item.unitPrice.toLocaleString("fr-FR")} FCFA</td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900">
                        {item.subtotal.toLocaleString("fr-FR")} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals */}
            <div className="pt-3 border-t border-gray-200 bg-gray-50/50 p-4 rounded-xl space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total produits :</span>
                <span>{orderDetails.financials.subtotal.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA (18%) :</span>
                <span>{orderDetails.financials.vat18.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Frais de livraison ({orderDetails.delivery?.zone || "Standard"}) :</span>
                <span>{orderDetails.financials.deliveryFee.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                <span>TOTAL NET TTC :</span>
                <span className="text-[#800020]">{orderDetails.financials.totalTTC.toLocaleString("fr-FR")} FCFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (34%): WhatsApp Thread & Delivery Driver Block */}
        <div className="space-y-6">
          {/* Delivery Driver Block */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-700" />
              <span>Livraison Associee</span>
            </h3>

            {orderDetails.delivery ? (
              <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{orderDetails.delivery.driverName}</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Livreur Assigné
                  </span>
                </div>
                <p className="text-gray-600 font-mono">{orderDetails.delivery.driverPhone}</p>
                <p className="text-gray-500 text-[11px]">Zone: {orderDetails.delivery.zone}</p>
                <p className="text-gray-500 text-[10px]">Assigné le: {orderDetails.delivery.assignedAt}</p>
              </div>
            ) : (
              <p className="text-xs text-stone-500 font-medium">Aucun livreur attribué pour l'instant.</p>
            )}
          </div>

          {/* Linked WhatsApp Conversation Thread (Read-only) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#800020]" />
              <span>Fil WhatsApp Lié (Lecture)</span>
            </h3>

            {orderDetails.whatsappThread && orderDetails.whatsappThread.length > 0 ? (
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-72 overflow-y-auto">
                {orderDetails.whatsappThread.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col text-xs max-w-[85%] ${
                      msg.sender === "client" ? "self-start bg-white border border-gray-200" : "self-end ml-auto bg-[#800020] text-white"
                    } p-2.5 rounded-xl shadow-2xs`}
                  >
                    <p className="leading-snug">{msg.text}</p>
                    <span className={`text-[9px] font-mono mt-1 ${msg.sender === "client" ? "text-gray-400" : "text-white/70"} text-right`}>
                      {msg.time}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 font-medium">Aucun fil WhatsApp directement lié à cette commande.</p>
            )}
          </div>
        </div>
      </div>

      {/* CHANGE STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-900 text-sm">Changer le statut de la commande</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { id: "ORDER_INTENT", label: "ORDER_INTENT — Intention détectée" },
                { id: "ORDER_CONFIRMED", label: "ORDER_CONFIRMED — Commande confirmée" },
                { id: "DELIVERY_CREATED", label: "DELIVERY_CREATED — Livraison créée" },
                { id: "IN_TRANSIT", label: "IN_TRANSIT — En cours de livraison" },
                { id: "DELIVERED", label: "DELIVERED — Livrée et clôturée" },
                { id: "FAILED", label: "FAILED — Échec de livraison" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleChangeStatus(st.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-bold border transition-colors ${
                    orderStatus === st.id
                      ? "bg-[#800020] text-white border-[#800020]"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-200 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-gray-900 text-base">Supprimer la commande ?</h3>
            <p className="text-xs text-gray-500">
              Êtes-vous sûr de vouloir supprimer la commande {orderDetails.orderNumber} ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-100 text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirmed}
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
