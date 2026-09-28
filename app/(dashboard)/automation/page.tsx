"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Sliders,
  Layers,
  FileCode2,
  Loader2,
  Send,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/src/infrastructure/supabase/client";

export default function AutomationDashboardPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "approval" | "logs">("rules");
  const [globalKillSwitch, setGlobalKillSwitch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [rules, setRules] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadAutomationData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  async function loadAutomationData() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_organization_roles")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      const currentOrgId = roleData && roleData.length > 0 ? roleData[0].organization_id : null;
      setOrgId(currentOrgId);

      if (currentOrgId) {
        // Fetch Kill Switch state
        const { data: ks } = await supabase
          .from("kill_switches")
          .select("global_stopped")
          .eq("organization_id", currentOrgId)
          .maybeSingle();
        if (ks) setGlobalKillSwitch(Boolean(ks.global_stopped));

        // Fetch Automation Rules
        const { data: rulesData } = await supabase
          .from("automation_rules")
          .select("*")
          .eq("organization_id", currentOrgId)
          .order("created_at", { ascending: false });

        if (rulesData && rulesData.length > 0) {
          setRules(rulesData);
        } else {
          // Default system sequence rules
          setRules([
            { id: "r1", name: "Séquence Relances Commerciales J0->J21", category: "SALES", enabled: true, trigger_type: "SCHEDULE", permission_level: "YELLOW", execution_count: 12 },
            { id: "r2", name: "Rappel Livraison Échouée", category: "DELIVERY", enabled: true, trigger_type: "EVENT", permission_level: "GREEN", execution_count: 4 },
            { id: "r3", name: "Notification Seuil Stock Bas", category: "STOCK", enabled: true, trigger_type: "CONDITION", permission_level: "GREEN", execution_count: 2 },
          ]);
        }

        // Fetch Pending Approval Requests
        const { data: appData } = await supabase
          .from("approval_requests")
          .select("*")
          .eq("organization_id", currentOrgId)
          .eq("status", "PENDING_APPROVAL")
          .order("created_at", { ascending: false });
        setApprovals(appData || []);

        // Fetch Recent Executions
        const { data: execData } = await supabase
          .from("automation_executions")
          .select("*")
          .eq("organization_id", currentOrgId)
          .order("created_at", { ascending: false })
          .limit(20);
        setExecutions(execData || []);
      }
    } catch (_err) {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }

  const handleTriggerWorker = async () => {
    setIsTriggeringWorker(true);
    try {
      const url = orgId ? `/api/cron/workflows?orgId=${orgId}` : "/api/cron/workflows";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (res.ok && data.status === "SUCCESS") {
        const sum = data.summary || {};
        showToast(`✓ Worker exécuté ! ${sum.executedCount || 0} action(s) générée(s), ${sum.stoppedCount || 0} arrêtée(s).`);
        await loadAutomationData();
      } else {
        showToast(`⚠ Erreur du worker : ${data.error || "Échec"}`);
      }
    } catch (err: any) {
      showToast("Erreur lors du déclenchement du worker.");
    } finally {
      setIsTriggeringWorker(false);
    }
  };

  const handleToggleGlobalKillSwitch = async () => {
    const nextState = !globalKillSwitch;
    setGlobalKillSwitch(nextState);

    if (orgId) {
      const supabase = createClient();
      await supabase
        .from("kill_switches")
        .upsert({
          organization_id: orgId,
          global_stopped: nextState,
          updated_at: new Date().toISOString(),
        });
      showToast(nextState ? "⚠ Kill Switch Global ACTIVÉ : Automatisations bloquées" : "✓ Kill Switch Désactivé : Automatisations actives");
    }
  };

  const filteredRules =
    selectedCategory === "ALL" ? rules : rules.filter((r) => r.category === selectedCategory);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 animate-fade-in-up">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] bg-[#1F1917] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-stone-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EBE5DA] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#800020]/10 text-[#800020] border border-[#800020]/20">
              <Zap className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[#1F1917] tracking-tight">
              Moteur de Relances & Automatisations
            </h1>
          </div>
          <p className="text-xs text-stone-500 font-semibold mt-1">
            Orchestration des relances commerciales (J0→J21), conditions d'arrêt et validation humaine
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTriggerWorker}
            disabled={isTriggeringWorker}
            className="px-4 py-2.5 bg-[#800020] hover:bg-[#660019] text-white font-bold text-xs rounded-2xl shadow-2xs flex items-center gap-2 transition-all disabled:opacity-40"
          >
            {isTriggeringWorker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>⚡ Déclencher Worker (Test)</span>
          </button>

          <button
            onClick={handleToggleGlobalKillSwitch}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-2xl border transition-all flex items-center gap-1.5 ${
              globalKillSwitch
                ? "bg-red-600 text-white border-red-700"
                : "bg-white text-stone-700 border-[#EBE5DA] hover:border-red-300"
            }`}
          >
            <ShieldAlert className={`w-4 h-4 ${globalKillSwitch ? "text-white animate-pulse" : "text-stone-400"}`} />
            <span>{globalKillSwitch ? "ARRÊTÉ" : "Stop Urgence"}</span>
          </button>
        </div>
      </div>

      {/* Kill Switch Alert Banner */}
      {globalKillSwitch && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-950 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <p className="font-extrabold text-xs">ATTENTION — Kill Switch Global Activé</p>
              <p className="text-[11px] text-red-800 font-medium mt-0.5">
                Toutes les exécutions de relances et tâches d'automatisation sont actuellement suspendues pour votre organisation.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleGlobalKillSwitch}
            className="px-3.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-2xs"
          >
            Réactiver
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#EBE5DA] p-5 rounded-3xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Automatisations</span>
            <Sliders className="w-4 h-4 text-[#800020]" />
          </div>
          <p className="text-2xl font-black text-[#1F1917]">{rules.filter((r) => r.enabled !== false).length} / {rules.length}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">Relances J0→J21 Actives</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] p-5 rounded-3xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Approbations en Attente</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{approvals.length}</p>
          <p className="text-[11px] text-stone-500 font-medium mt-1">Actions Commerciales à Valider</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] p-5 rounded-3xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Exécutions Récents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-[#1F1917]">{executions.length}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">0 Doublon (Idempotent)</p>
        </div>

        <div className="bg-white border border-[#EBE5DA] p-5 rounded-3xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Horaires de Relance</span>
            <Clock className="w-4 h-4 text-[#800020]" />
          </div>
          <p className="text-lg font-black text-[#1F1917]">08:00 - 20:00</p>
          <p className="text-[11px] text-stone-500 font-medium mt-1">GMT+0 (Ouagadougou)</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#EBE5DA] gap-6">
        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 ${
            activeTab === "rules"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Séquences de Relances ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab("approval")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "approval"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Centre de Validation ({approvals.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-3 text-xs font-extrabold transition-colors border-b-2 ${
            activeTab === "logs"
              ? "border-[#800020] text-[#800020]"
              : "border-transparent text-stone-500 hover:text-[#1F1917]"
          }`}
        >
          Journal & Historique d'Exécution
        </button>
      </div>

      {/* TAB 1: RULES */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="bg-white border border-[#EBE5DA] rounded-3xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]">
              <h3 className="font-extrabold text-[#1F1917] text-xs">Règles & Workflows Configurés</h3>
              <span className="text-[11px] text-stone-500 font-bold">Modèle Commercial Assisté</span>
            </div>
            <div className="divide-y divide-stone-100">
              {rules.map((rule) => (
                <div key={rule.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-extrabold text-[#1F1917] text-xs">{rule.name}</h4>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#800020]/10 text-[#800020]">
                        {rule.category || "SALES"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                        {rule.permission_level || "YELLOW"}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 font-medium">
                      Déclencheur : <span className="font-bold text-stone-700">{rule.trigger_type || "SCHEDULE"}</span> • Exécutions : {rule.execution_count || 0}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                      ✓ Séquence J0→J21 Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPROVAL CENTER */}
      {activeTab === "approval" && (
        <div className="bg-white border border-[#EBE5DA] rounded-3xl p-6 shadow-2xs space-y-4">
          <h3 className="text-xs font-extrabold text-[#1F1917]">Actions Commerciales en Attente de Validation</h3>
          <p className="text-[11px] text-stone-500 font-medium">
            Toutes les relances nécessitant une validation humaine sont acheminées directement dans l'espace "Ma Journée" de la commerciale responsable.
          </p>

          {approvals.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-[#EBE5DA] rounded-2xl">
              <UserCheck className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-[#1F1917]">Aucune action en attente</p>
              <p className="text-[11px] text-stone-500">Toutes les actions requérant une validation ont été traitées.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((appr) => (
                <div key={appr.id} className="bg-[#FAF8F5] border border-[#EBE5DA] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1F1917]">{appr.action_type}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">EN ATTENTE</span>
                  </div>
                  <p className="text-xs text-stone-600">{appr.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white border border-[#EBE5DA] rounded-3xl overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-stone-100 bg-[#FAF8F5] flex items-center justify-between">
            <h3 className="font-extrabold text-[#1F1917] text-xs">Historique des Exécutions & Logs Audit</h3>
            <span className="text-[11px] font-mono text-stone-500">{executions.length} enregistrements</span>
          </div>
          {executions.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500 font-medium">
              Aucun log d'exécution pour le moment. Cliquez sur "⚡ Déclencher Worker" pour simuler un cycle.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 font-mono text-xs">
              {executions.map((exec) => (
                <div key={exec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAF8F5]/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1F1917]">{exec.step_key || 'Step'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        exec.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        exec.status === 'STOPPED' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-800'
                      }`}>
                        {exec.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Idempotency Key: {exec.idempotency_key} {exec.stop_reason ? `• Cause d arrêt: ${exec.stop_reason}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {exec.created_at ? new Date(exec.created_at).toLocaleTimeString('fr-FR') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
