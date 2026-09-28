"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/src/infrastructure/supabase/client";
import {
  Zap,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShoppingBag,
  TrendingUp,
  Calendar,
  RefreshCw,
  Award,
  Users,
} from "lucide-react";

export default function MyActivityPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [commercialName, setCommercialName] = useState<string>("Commercial");
  const [stats, setStats] = useState({
    actionsToday: 0,
    conversationsHandled: 0,
    followupsSent: 0,
    ordersCompleted: 0,
    revenueGenerated: 0,
    customersTotal: 0,
  });

  const loadActivityData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, first_name")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCommercialName(profile.first_name || profile.full_name || "Commercial");
        }

        const { data: roles } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .is("deleted_at", null);

        if (roles && roles.length > 0) {
          const orgId = roles[0].organization_id;

          // Fetch orders
          const { data: orders } = await supabase
            .from("orders")
            .select("total_amount")
            .eq("organization_id", orgId)
            .is("deleted_at", null);

          // Fetch conversations
          const { count: convCount } = await supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId);

          // Fetch customers
          const { count: custCount } = await supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .is("deleted_at", null);

          const totalRev = (orders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
          
          setStats({
            actionsToday: (orders?.length || 0) + (convCount || 0),
            conversationsHandled: convCount || 0,
            followupsSent: 0,
            ordersCompleted: orders?.length || 0,
            revenueGenerated: totalRev || 0,
            customersTotal: custCount || 0,
          });
        }
      }
    } catch (err) {
      console.error("Erreur chargement activité:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivityData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#800020]/10 rounded-2xl border border-[#800020]/20 text-[#800020]">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
              Mon Activité Commerciale
            </h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Synthèse en temps réel de vos accomplissements et performances opérationnelles.
            </p>
          </div>
        </div>

        <button
          onClick={loadActivityData}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#800020]" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* TODAY ACCOMPLISHMENTS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-2 shadow-2xs">
          <span className="text-[10px] font-mono text-gray-400 block uppercase font-bold">Actions Réalisées</span>
          <span className="text-3xl font-extrabold text-gray-900">{stats.actionsToday}</span>
          <p className="text-[11px] text-gray-500">Activités enregistrées</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-2 shadow-2xs">
          <span className="text-[10px] font-mono text-gray-400 block uppercase font-bold">Conversations Traitées</span>
          <span className="text-3xl font-extrabold text-gray-900">{stats.conversationsHandled}</span>
          <p className="text-[11px] text-gray-500">Interactions WhatsApp</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-2 shadow-2xs">
          <span className="text-[10px] font-mono text-gray-400 block uppercase font-bold">Commandes Conclues</span>
          <span className="text-3xl font-extrabold text-[#800020]">{stats.ordersCompleted}</span>
          <p className="text-[11px] text-gray-500">Ventes enregistrées</p>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-2 shadow-2xs">
          <span className="text-[10px] font-mono text-gray-400 block uppercase font-bold">Chiffre d'Affaires</span>
          <span className="text-2xl font-extrabold text-gray-900">{stats.revenueGenerated.toLocaleString("fr-FR")} FCFA</span>
          <p className="text-[11px] text-gray-500">Valeur totale conclue</p>
        </div>
      </div>

      {/* SUMMARY CARD */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#800020]" />
          Vue d'ensemble de l'activité
        </h3>

        {stats.actionsToday === 0 && stats.ordersCompleted === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50 space-y-2">
            <Award className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-700">Aucune activité enregistrée aujourd'hui</p>
            <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
              Les actions, conversations et commandes traitées s'afficheront ici au fur et à mesure.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-gray-500 font-bold block">Clients Actifs</span>
              <span className="text-xl font-bold text-gray-900">{stats.customersTotal} clients</span>
              <span className="text-[10px] text-gray-400 block">Base CRM</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-gray-500 font-bold block">Conversations</span>
              <span className="text-xl font-bold text-gray-900">{stats.conversationsHandled}</span>
              <span className="text-[10px] text-gray-400 block">WhatsApp Sync</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-gray-500 font-bold block">Commandes Totales</span>
              <span className="text-xl font-bold text-[#800020]">{stats.ordersCompleted}</span>
              <span className="text-[10px] text-gray-400 block">Chiffre d'Affaires : {stats.revenueGenerated.toLocaleString("fr-FR")} FCFA</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
