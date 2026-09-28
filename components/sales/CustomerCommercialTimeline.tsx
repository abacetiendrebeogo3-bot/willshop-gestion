"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  MessageSquare,
  ShoppingCart,
  Truck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

interface CustomerCommercialTimelineProps {
  customerId: string;
  conversationId?: string;
}

export function CustomerCommercialTimeline({
  customerId,
  conversationId,
}: CustomerCommercialTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (customerId) {
      loadTimelineEvents();
    }
  }, [customerId, conversationId]);

  async function loadTimelineEvents() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const combinedEvents: any[] = [];

      // 1. Fetch Customer Engagements / Relances
      const { data: engData } = await supabase
        .from("customer_engagements")
        .select("id, title, status, due_at, created_at, source")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      (engData || []).forEach((e) => {
        combinedEvents.push({
          id: `eng-${e.id}`,
          type: "RELANCE",
          title: e.title || "Relance programmée",
          status: e.status,
          date: e.due_at || e.created_at,
          icon: Clock,
          color: e.status === "COMPLETED" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-amber-600 bg-amber-50 border-amber-200",
        });
      });

      // 2. Fetch Orders
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, order_number, total_ttc, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      (orderData || []).forEach((o) => {
        combinedEvents.push({
          id: `ord-${o.id}`,
          type: "COMMANDE",
          title: `Commande ${o.order_number || ''} — ${Number(o.total_ttc || 0).toLocaleString('fr-FR')} FCFA`,
          status: o.status,
          date: o.created_at,
          icon: ShoppingCart,
          color: "text-[#800020] bg-rose-50 border-rose-200",
        });
      });

      // 3. Fetch Deliveries
      const { data: delivData } = await supabase
        .from("deliveries")
        .select("id, status, neighborhood, created_at, updated_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      (delivData || []).forEach((d) => {
        combinedEvents.push({
          id: `del-${d.id}`,
          type: "LIVRAISON",
          title: `Livraison (${d.neighborhood || 'Quartier'}) — ${d.status}`,
          status: d.status,
          date: d.updated_at || d.created_at,
          icon: Truck,
          color: d.status === "DELIVERED" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-blue-700 bg-blue-50 border-blue-200",
        });
      });

      // Sort chronological descending
      combinedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(combinedEvents);
    } catch (err) {
      console.error("[CustomerTimeline] Error loading events:", err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-xs text-stone-500 font-bold">
        <Loader2 className="w-4 h-4 animate-spin text-[#800020]" />
        <span>Chargement de l'historique commercial...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-4 bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl text-center text-xs text-stone-500 font-medium">
        Aucun événement commercial enregistré pour ce client.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-black text-[#1F1917] uppercase tracking-wider">
        Historique Commercial & Livraisons
      </h4>
      <div className="relative border-l-2 border-[#EBE5DA] ml-3 pl-4 space-y-4">
        {events.map((ev) => {
          const IconComp = ev.icon;
          const dateStr = new Date(ev.date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div key={ev.id} className="relative flex items-start justify-between gap-3 text-xs">
              <span className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border border-white flex items-center justify-center ${ev.color}`}>
                <IconComp className="w-2.5 h-2.5" />
              </span>

              <div>
                <span className="font-bold text-[#1F1917]">{ev.title}</span>
                <p className="text-[11px] text-stone-500 font-mono mt-0.5">{dateStr}</p>
              </div>

              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-stone-100 text-stone-700 border border-stone-200 uppercase">
                {ev.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
