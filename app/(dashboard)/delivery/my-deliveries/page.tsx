"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import {
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Navigation,
  Calendar,
  AlertTriangle,
  X,
  User,
  ChevronRight,
  Check,
} from "lucide-react";

interface DeliveryItem {
  id: string;
  itemNumber: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  zone: string;
  amount: string;
  timeSlot: string;
  status: "ASSIGNED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "RESCHEDULED";
  failureReason?: string;
}

import { useEffect } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";

interface DeliveryItem {
  id: string;
  itemNumber: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  zone: string;
  amount: string;
  timeSlot: string;
  status: "ASSIGNED" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "RESCHEDULED";
  failureReason?: string;
}

export default function MyDeliveriesPage() {
  const [activeTab, setActiveTab] = useState<"TODAY" | "HISTORY">("TODAY");
  const [driverName, setDriverName] = useState<string>("Livreur");
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const cleanPhone = user.user_metadata?.phone || user.phone || "";
      const cleanDigits = (cleanPhone || user.email?.split("@")[0] || "").replace(/[^\d]/g, "");

      const { data: emp } = await supabase
        .from("team_employees")
        .select("first_name, last_name")
        .or(`user_id.eq.${user.id},phone.eq.${cleanPhone},phone.eq.+${cleanDigits}`)
        .limit(1)
        .maybeSingle();

      if (emp && emp.first_name) {
        setDriverName(`${emp.first_name} ${emp.last_name || ""}`.trim());
      } else if (user.user_metadata?.first_name) {
        setDriverName(`${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim());
      } else if (user.user_metadata?.full_name) {
        setDriverName(user.user_metadata.full_name);
      } else if (user.email && !user.email.endsWith("@willshop.bf")) {
        const prefix = user.email.split("@")[0];
        setDriverName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      const orgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
      if (!orgId) {
        setIsLoading(false);
        return;
      }

      const { data: delData, error } = await supabase
        .from("deliveries")
        .select("*, order:orders(*, customer:customers(*))")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error || !delData || delData.length === 0) {
        setDeliveries([]);
        setIsLoading(false);
        return;
      }

      const formatted: DeliveryItem[] = delData.map((d: any, idx: number) => {
        const custName = d.order?.customer?.full_name || d.recipient_name || "Client";
        const custPhone = d.order?.customer?.phone || d.recipient_phone || "Non renseigné";
        const address = d.delivery_address || d.order?.customer?.address || "Ouagadougou";
        const amt = d.order?.total_ttc ? `${Number(d.order.total_ttc).toLocaleString("fr-FR")} FCFA` : "0 FCFA";
        const orderNo = d.order?.order_number || `#CMD-${d.id.substring(0, 6)}`;

        return {
          id: d.id,
          itemNumber: idx + 1,
          orderNumber: orderNo,
          customerName: custName,
          phone: custPhone,
          address,
          zone: d.zone_name || "Zone Centrale",
          amount: amt,
          timeSlot: d.created_at ? new Date(d.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Aujourd'hui",
          status: d.status || "ASSIGNED",
          failureReason: d.failure_reason,
        };
      });

      setDeliveries(formatted);
    } catch (err) {
      console.error("[My Deliveries] Fetch error:", err);
      setDeliveries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryItem | null>(null);
  const [showFailModal, setShowFailModal] = useState<boolean>(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [failReason, setFailReason] = useState<string>("Client absent");
  const [rescheduleDate, setRescheduleDate] = useState<string>("Demain 10:00");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const todayDeliveries = deliveries.filter(
    (d) => d.status === "ASSIGNED" || d.status === "IN_TRANSIT"
  );
  const historyDeliveries = deliveries.filter(
    (d) => d.status === "DELIVERED" || d.status === "FAILED" || d.status === "RESCHEDULED"
  );

  const handleMarkDelivered = (id: string) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "DELIVERED" } : d))
    );
    showToast("🎉 Livraison confirmée comme LIVRÉE & Payée !");
  };

  const handleConfirmFail = () => {
    if (!selectedDelivery) return;
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === selectedDelivery.id
          ? { ...d, status: "FAILED", failureReason: failReason }
          : d
      )
    );
    setShowFailModal(false);
    setSelectedDelivery(null);
    showToast("⚠️ Échec de livraison enregistré.");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in-up">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1917] text-white px-4 py-3 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 border border-stone-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION matching Screen 5 in input_file_0.png */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EBE5DA]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1F1917] tracking-tight">Mes Livraisons</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
              Livreur
            </span>
          </div>
          <p className="text-xs text-stone-500 font-semibold mt-0.5">
            Aujourd'hui • {driverName}
          </p>
        </div>

        {/* Tabs matching Screen 5 */}
        <div className="flex items-center gap-1.5 bg-[#F2ECE1] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("TODAY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "TODAY"
                ? "bg-[#800020] text-white shadow-2xs"
                : "text-stone-700 hover:text-[#1F1917]"
            }`}
          >
            Aujourd'hui ({todayDeliveries.length})
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "HISTORY"
                ? "bg-[#800020] text-white shadow-2xs"
                : "text-stone-700 hover:text-[#1F1917]"
            }`}
          >
            Historique ({historyDeliveries.length})
          </button>
        </div>
      </div>

      {/* TODAY DELIVERIES LIST matching Screen 5 in input_file_0.png */}
      {activeTab === "TODAY" && (
        <div className="space-y-3">
          {todayDeliveries.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#EBE5DA] shadow-xs space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-black text-[#1F1917]">Aucune livraison en attente pour le moment.</h2>
            </div>
          ) : (
            todayDeliveries.map((del) => (
              <div
                key={del.id}
                className="bg-white p-4 rounded-2xl border border-[#EBE5DA] shadow-xs hover:border-[#800020]/30 transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Numbered Circle Badge (Green e.g. Screen 5) */}
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                      {del.itemNumber}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-stone-400 font-bold">{del.timeSlot}</span>
                        <span className="text-stone-300">•</span>
                        <h3 className="font-extrabold text-[#1F1917] text-sm">{del.customerName}</h3>
                      </div>
                      <p className="text-xs text-stone-500 font-semibold">{del.address}</p>
                    </div>
                  </div>

                  {/* Actions Button */}
                  <button
                    onClick={() => setSelectedDelivery(del)}
                    className="bg-[#800020] hover:bg-[#590C1D] text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-2xs transition-all shrink-0"
                  >
                    Détails
                  </button>
                </div>

                {/* Expanded Action Panel matching Screen 13 in input_file_0.png */}
                {selectedDelivery?.id === del.id && (
                  <div className="pt-3 border-t border-[#EBE5DA] space-y-3 animate-fade-in bg-[#F8F5EE]/60 p-3 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-stone-500">Téléphone: {del.phone}</span>
                      <span className="font-black text-[#1F1917]">{del.amount}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleMarkDelivered(del.id)}
                        className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Livré</span>
                      </button>

                      <button
                        onClick={() => setShowFailModal(true)}
                        className="flex-1 bg-rose-700 hover:bg-rose-800 text-white py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>Échec</span>
                      </button>

                      <button
                        onClick={() => setShowRescheduleModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-extrabold transition-all"
                      >
                        Reprogrammer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: HISTORIQUE */}
      {activeTab === "HISTORY" && (
        <div className="bg-white p-5 rounded-2xl border border-[#EBE5DA] shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-[#1F1917]">Historique des Livraisons</h2>
          <div className="space-y-2 text-xs">
            {historyDeliveries.map((del) => (
              <div key={del.id} className="p-3 bg-[#F8F5EE] rounded-xl border border-[#EBE5DA] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#1F1917]">{del.customerName}</span>
                  <span className="text-stone-500 block text-[11px]">{del.address}</span>
                </div>
                <span className="font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Livré & Payé ({del.amount})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAIL REASON MODAL */}
      {showFailModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-[#EBE5DA] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EBE5DA] pb-3">
              <h3 className="font-extrabold text-[#1F1917] text-sm">Déclarer un Échec de livraison</h3>
              <button onClick={() => setShowFailModal(false)} className="text-stone-400 hover:text-[#1F1917]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-stone-600 font-bold mb-1">Raison :</label>
              {["Client absent / Injoignable", "Adresse introuvable", "Refus du client"].map((r, i) => (
                <button
                  key={i}
                  onClick={() => setFailReason(r)}
                  className={`w-full text-left p-2.5 rounded-xl border font-bold transition-colors ${
                    failReason === r ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-stone-50 text-stone-700 border-stone-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFailModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-stone-300 text-stone-700"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmFail}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-xs"
              >
                Confirmer l'échec
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
