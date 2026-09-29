"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  Sparkles,
  Play,
  Pause,
  Eye,
  MousePointer,
  MessageSquare,
  PackageCheck,
  ShoppingBag,
  CheckCircle2,
  Inbox,
  AlertTriangle,
  Loader2,
  Link2Off,
  Database
} from "lucide-react";

import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { createClient } from "@/src/infrastructure/supabase/client";

export default function MarketingCockpitPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "creatives" | "funnel" | "budget">("campaigns");

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Marketing Campaigns SSOT Data from Supabase
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Creatives SSOT Data from Supabase
  const [creatives, setCreatives] = useState<any[]>([]);

  // Real Database Metrics for Conversion Funnel
  const [funnelData, setFunnelData] = useState<{
    impressions: number | null;
    clicks: number | null;
    conversations: number | null;
    leads: number;
    orders: number;
    deliveredOrders: number;
    leadToOrderRate: number | null;
    orderToDeliveryRate: number | null;
    diagnosis: string;
  }>({
    impressions: null,
    clicks: null,
    conversations: null,
    leads: 0,
    orders: 0,
    deliveredOrders: 0,
    leadToOrderRate: null,
    orderToDeliveryRate: null,
    diagnosis: "Chargement des métriques réelles depuis Supabase...",
  });

  useEffect(() => {
    loadMarketingData();
  }, []);

  async function loadMarketingData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: roles } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
      .order("created_at", { ascending: true });

      if (!roles || roles.length === 0) return;
      const currentOrgId = roles[0].organization_id;
      setOrgId(currentOrgId);

      // 1. Fetch Real Orders count & delivered orders from `orders`
      const { data: realOrders } = await supabase
        .from("orders")
        .select("id, status, total")
        .eq("organization_id", currentOrgId);

      const ordersCount = realOrders?.length || 0;

      // 2. Fetch Real Deliveries from `deliveries`
      const { data: realDeliveries } = await supabase
        .from("deliveries")
        .select("id, status")
        .eq("organization_id", currentOrgId);

      const deliveredCount = realDeliveries?.filter((d) => d.status === "DELIVERED").length || 0;

      // 3. Fetch Real Customers / Leads from `customers`
      const { data: realCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", currentOrgId);

      const leadsCount = realCustomers?.length || 0;

      // 4. Fetch Real Marketing Campaigns from `marketing_campaigns` if table exists
      const { data: realCampaigns } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("organization_id", currentOrgId);

      if (realCampaigns && realCampaigns.length > 0) {
        setCampaigns(realCampaigns);
      } else {
        setCampaigns([]);
      }

      // Compute Real Dynamic Rates
      const leadToOrder = leadsCount > 0 && ordersCount > 0 ? Math.round((ordersCount / leadsCount) * 100) : null;
      const orderToDelivery = ordersCount > 0 && deliveredCount > 0 ? Math.round((deliveredCount / ordersCount) * 100) : null;

      let diagnosis = "Aucune donnée marketing disponible. Connectez une source publicitaire et enregistrez vos premières campagnes.";

      if (ordersCount > 0 || leadsCount > 0) {
        diagnosis = `Données réelles Supabase : ${leadsCount} lead(s), ${ordersCount} commande(s), ${deliveredCount} livraison(s) effectuée(s). Connectez Meta Ads pour mesurer les impressions et clics publicitaires en amont.`;
      }

      setFunnelData({
        impressions: null, // Meta Ads not connected
        clicks: null,
        conversations: null,
        leads: leadsCount,
        orders: ordersCount,
        deliveredOrders: deliveredCount,
        leadToOrderRate: leadToOrder,
        orderToDeliveryRate: orderToDelivery,
        diagnosis,
      });
    } catch (err) {
      console.error("[Marketing Load Error]", err);
      setFunnelData((prev) => ({
        ...prev,
        diagnosis: "Erreur lors du chargement des données marketing.",
      }));
    } finally {
      setLoading(false);
    }
  }

  const handleToggleCampaign = (id: string) => {
    setCampaigns(
      campaigns.map((c) =>
        c.id === id ? { ...c, status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE" } : c
      )
    );
  };

  const totalSpend = campaigns.reduce((acc, c) => acc + (c.total_spend || c.totalSpend || 0), 0);
  const totalRevenue = campaigns.reduce((acc, c) => acc + (c.attributed_revenue || c.attributedRevenue || 0), 0);
  const totalProfit = campaigns.reduce((acc, c) => acc + (c.contribution_profit || c.contributionProfit || 0), 0);
  const overallRoas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
  const overallRoi = totalSpend > 0 ? Math.round((totalProfit / totalSpend) * 100) / 100 : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Megaphone className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Marketing Intelligence & Cockpit Publicitaire
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Attribution réelle Supabase, rentabilité (ROAS vs ROI) et diagnostic du tunnel sans données fictives
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <DataSourceBadge type="DATABASE" label="Supabase SSOT" />
          <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 font-semibold flex items-center gap-1.5">
            <Link2Off className="w-3.5 h-3.5 text-amber-400" /> Meta Ads : Non connecté
          </span>
        </div>
      </div>

      {/* Metric Cards: Revenue, Spend, Profit, ROAS, ROI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">CA Attribué Pub</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {totalRevenue > 0 ? `${totalRevenue.toLocaleString()} XOF` : "0 XOF"}
          </p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Campagnes actives : {campaigns.length}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Dépenses Publicitaires</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">
            {totalSpend > 0 ? `${totalSpend.toLocaleString()} XOF` : "0 XOF"}
          </p>
          <p className="text-[11px] text-blue-400 font-mono mt-1">ROAS Global : {overallRoas > 0 ? `${overallRoas}x` : "—"}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Contribution Profit Réel</span>
            <PieChart className="w-4 h-4 text-purple-400" />
          </div>
          <p className={`text-2xl font-bold ${totalProfit > 0 ? "text-emerald-400" : "text-slate-300"}`}>
            {totalProfit !== 0 ? `${totalProfit.toLocaleString()} XOF` : "0 XOF"}
          </p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Déduit COGS + Pub + Livraison</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">ROI Marketing Réel</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{overallRoi > 0 ? `${overallRoi}x` : "—"}</p>
          <p className="text-[11px] text-emerald-400 font-mono mt-1">Bénéfice net / Dépense pub</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "campaigns"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Campagnes ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("creatives")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "creatives"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Creative Intelligence ({creatives.length})
        </button>
        <button
          onClick={() => setActiveTab("funnel")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "funnel"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Diagnostic Tunnel de Vente
        </button>
      </div>

      {/* TAB 1: CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Inbox className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Aucune campagne publicitaire enregistrée</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Connectez vos comptes Meta Ads ou créez votre première campagne marketing pour mesurer votre ROAS et votre ROI réel.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {campaigns.map((camp) => (
                <div key={camp.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-100 text-sm">{camp.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                        {camp.platform || "META_ADS"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          camp.status === "ACTIVE"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                      <span>Budget: {Number(camp.budget || 0).toLocaleString()} XOF</span>
                      <span>Dépensé: <strong className="text-slate-200">{Number(camp.total_spend || 0).toLocaleString()} XOF</strong></span>
                      <span>CA: <strong className="text-emerald-400">{Number(camp.attributed_revenue || 0).toLocaleString()} XOF</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleCampaign(camp.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                        camp.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {camp.status === "ACTIVE" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      {camp.status === "ACTIVE" ? "ACTIVE" : "PAUSÉE"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATIVE INTELLIGENCE */}
      {activeTab === "creatives" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          {creatives.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Sparkles className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Pas encore de visuels publicitaires analysés</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                L'intelligence créative analysera vos vidéos et images Meta Ads dès que des données de diffusion réelles seront synchronisées.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {creatives.map((crea) => (
                <div key={crea.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">{crea.type}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        crea.statusTag === "WINNER"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : crea.statusTag === "WATCH"
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : "bg-red-950 text-red-400 border border-red-800"
                      }`}
                    >
                      {crea.statusTag}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm">{crea.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FUNNEL DIAGNOSTICS */}
      {activeTab === "funnel" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-100">Tunnel de Conversion Marketing → Ventes</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Métriques mesurées à partir des données réelles Supabase (Orders, Deliveries, Customers)
              </p>
            </div>
            <DataSourceBadge type="DATABASE" label="Données Réelles" />
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Chargement du tunnel de conversion...
            </div>
          ) : (
            <>
              {/* Visual Funnel Steps */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center font-mono">
                {/* Step 1: Impressions */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <Eye className="w-4 h-4 text-blue-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">Impressions</p>
                  <p className="font-bold text-slate-400 text-sm">
                    {funnelData.impressions !== null ? funnelData.impressions.toLocaleString() : "—"}
                  </p>
                  <p className="text-[9px] text-amber-400/80">Meta Ads Non connecté</p>
                </div>

                {/* Step 2: Clics */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <MousePointer className="w-4 h-4 text-purple-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">Clics</p>
                  <p className="font-bold text-slate-400 text-sm">
                    {funnelData.clicks !== null ? funnelData.clicks.toLocaleString() : "—"}
                  </p>
                  <p className="text-[9px] text-amber-400/80">Meta Ads Non connecté</p>
                </div>

                {/* Step 3: Conversations */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <MessageSquare className="w-4 h-4 text-emerald-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">Conversations</p>
                  <p className="font-bold text-slate-400 text-sm">
                    {funnelData.conversations !== null ? funnelData.conversations.toLocaleString() : "—"}
                  </p>
                  <p className="text-[9px] text-slate-500">WhatsApp CRM</p>
                </div>

                {/* Step 4: Leads */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <ShoppingBag className="w-4 h-4 text-amber-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">Leads (CRM)</p>
                  <p className="font-bold text-slate-200 text-sm">
                    {funnelData.leads > 0 ? funnelData.leads : "—"}
                  </p>
                  <p className="text-[9px] text-emerald-400">Supabase Customers</p>
                </div>

                {/* Step 5: Commandes */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <PackageCheck className="w-4 h-4 text-blue-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">
                    Commandes {funnelData.leadToOrderRate !== null ? `(${funnelData.leadToOrderRate}%)` : "(—)"}
                  </p>
                  <p className="font-bold text-slate-200 text-sm">
                    {funnelData.orders > 0 ? funnelData.orders : "—"}
                  </p>
                  <p className="text-[9px] text-emerald-400">Supabase Orders</p>
                </div>

                {/* Step 6: Livrés / Payés */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                  <p className="text-[10px] text-slate-500 uppercase">
                    Livrés/Payés {funnelData.orderToDeliveryRate !== null ? `(${funnelData.orderToDeliveryRate}%)` : "(—)"}
                  </p>
                  <p className="font-bold text-emerald-400 text-sm">
                    {funnelData.deliveredOrders > 0 ? funnelData.deliveredOrders : "—"}
                  </p>
                  <p className="text-[9px] text-emerald-400">Supabase Delivery</p>
                </div>
              </div>

              {/* Diagnostic Box */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Diagnostic IA du Tunnel (Données Réelles)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {funnelData.diagnosis}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
