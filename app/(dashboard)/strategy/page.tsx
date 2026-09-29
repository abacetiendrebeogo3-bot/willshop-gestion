"use client";

import React, { useState, useEffect } from "react";
import { PageTransition } from "@/components/animations/PageTransition";
import { createClient } from "@/src/infrastructure/supabase/client";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import {
  Target,
  TrendingUp,
  ShieldAlert,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Briefcase,
  Layers,
  ArrowRight,
  Sparkles,
  Plus,
  Play,
  Zap,
  Check,
  X,
  Edit3,
  ListTodo,
  Loader2,
  Calendar,
  DollarSign,
  User,
  Activity,
  Award,
  AlertCircle,
} from "lucide-react";

export default function StrategyCockpitPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "goals" | "initiatives" | "recommendations" | "risks_decisions"
  >("overview");

  // Organization & User State
  const [organizationId, setOrganizationId] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("WILLShop OS");
  const [organizationVision, setOrganizationVision] = useState<string>("");
  const [strategyId, setStrategyId] = useState<string>("");
  const [teamEmployees, setTeamEmployees] = useState<any[]>([]);

  // Real Supabase Data Collections
  const [goals, setGoals] = useState<any[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals visibility state
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState<boolean>(false);
  const [showRiskModal, setShowRiskModal] = useState<boolean>(false);
  const [showDecisionModal, setShowDecisionModal] = useState<boolean>(false);
  const [showVisionModal, setShowVisionModal] = useState<boolean>(false);
  const [showWhatIfModal, setShowWhatIfModal] = useState<boolean>(false);
  const [showEngineModal, setShowEngineModal] = useState<boolean>(false);
  const [selectedInitiativeForTask, setSelectedInitiativeForTask] = useState<any>(null);

  // Form states
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    goalType: "FINANCIAL",
    strategicPriority: "HIGH",
    baselineValue: 0,
    targetValue: 100,
    currentValue: 0,
    unit: "XOF",
    kpiKey: "custom",
    ownerId: "",
    startDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0],
    status: "ON_TRACK",
  });

  const [initiativeForm, setInitiativeForm] = useState({
    title: "",
    description: "",
    goalId: "",
    ownerId: "",
    urgency: "HIGH",
    strategicImpact: "HIGH",
    effort: "MEDIUM",
    budget: 0,
    expectedRevenue: 0,
    startDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split("T")[0],
    status: "PLANNED",
  });

  const [riskForm, setRiskForm] = useState({
    title: "",
    description: "",
    probability: "MEDIUM",
    impact: "HIGH",
    ownerId: "",
    mitigationPlan: "",
    status: "IDENTIFIED",
  });

  const [decisionForm, setDecisionForm] = useState({
    action: "STOP",
    title: "",
    reason: "",
    expectedOutcome: "",
    ownerId: "",
    status: "APPROVED",
  });

  const [visionInput, setVisionInput] = useState<string>("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
    priority: "HIGH",
    dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split("T")[0],
  });

  const [savingState, setSavingState] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Real Data from Supabase
  const loadStrategyData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let targetOrgId = "";
      let targetOrgName = "WILLShop OS";

      if (user) {
        const { data: userRoles } = await supabase
          .from("user_organization_roles")
          .select("organization_id, role")
          .eq("user_id", user.id)
          .is("deleted_at", null)
      .order("created_at", { ascending: true });

        if (userRoles && userRoles.length > 0) {
          targetOrgId = userRoles[0].organization_id;
          const { data: org } = await supabase
            .from("organizations")
            .select("name, settings")
            .eq("id", targetOrgId)
            .single();
          if (org) {
            targetOrgName = org.name;
            if (org.settings && typeof org.settings === "object" && org.settings.vision) {
              setOrganizationVision(org.settings.vision);
            }
          }
        }
      }

      if (!targetOrgId) {
        const { data: fallbackOrgs } = await supabase
          .from("organizations")
          .select("id, name, settings")
          .limit(1);

        if (fallbackOrgs && fallbackOrgs.length > 0) {
          targetOrgId = fallbackOrgs[0].id;
          targetOrgName = fallbackOrgs[0].name;
          if (fallbackOrgs[0].settings?.vision) {
            setOrganizationVision(fallbackOrgs[0].settings.vision);
          }
        }
      }

      setOrganizationId(targetOrgId);
      setOrganizationName(targetOrgName);

      if (!targetOrgId) {
        setIsLoading(false);
        return;
      }

      // Fetch strategy row for vision fallback
      const { data: stratRows } = await supabase
        .from("strategies")
        .select("id, vision")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (stratRows && stratRows.length > 0) {
        setStrategyId(stratRows[0].id);
        if (stratRows[0].vision && !organizationVision) {
          setOrganizationVision(stratRows[0].vision);
        }
      }

      // Fetch team employees for owner selection
      const { data: empRows } = await supabase
        .from("team_employees")
        .select("id, full_name, role")
        .eq("organization_id", targetOrgId);

      setTeamEmployees(empRows || []);

      // Fetch Live BI metrics for automatic KPI calculation
      let liveRevenue = 0;
      let liveOrdersCount = 0;
      let liveDeliveryRate = 0;
      let liveProductsCount = 0;

      const { data: ordersData } = await supabase
        .from("orders")
        .select("total_amount, status")
        .eq("organization_id", targetOrgId);

      if (ordersData) {
        liveOrdersCount = ordersData.length;
        liveRevenue = ordersData
          .filter((o) => o.status !== "CANCELLED")
          .reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
      }

      const { data: deliveriesData } = await supabase
        .from("deliveries")
        .select("status")
        .eq("organization_id", targetOrgId);

      if (deliveriesData && deliveriesData.length > 0) {
        const delivered = deliveriesData.filter((d) => d.status === "DELIVERED").length;
        liveDeliveryRate = Math.round((delivered / deliveriesData.length) * 100);
      }

      const { data: productsData } = await supabase
        .from("products")
        .select("id")
        .eq("organization_id", targetOrgId);

      if (productsData) {
        liveProductsCount = productsData.length;
      }

      // Fetch Strategic Goals
      const { data: goalsRows } = await supabase
        .from("strategic_goals")
        .select("*")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false });

      const mappedGoals = (goalsRows || []).map((g) => {
        let current = Number(g.current_value || 0);
        // Automatically sync current_value if linked to live Supabase KPI
        if (g.kpi_key === "revenue") current = liveRevenue;
        else if (g.kpi_key === "orders_count") current = liveOrdersCount;
        else if (g.kpi_key === "delivery_success_rate") current = liveDeliveryRate;
        else if (g.kpi_key === "products_count") current = liveProductsCount;

        return {
          id: g.id,
          title: g.title,
          description: g.description,
          type: g.goal_type || "FINANCIAL",
          kpiKey: g.kpi_key || "custom",
          baseline: Number(g.baseline_value || 0),
          target: Number(g.target_value || 100),
          current,
          unit: g.unit || "XOF",
          startDate: g.start_date ? g.start_date.split("T")[0] : "",
          dueDate: g.due_date ? g.due_date.split("T")[0] : "",
          status: g.status || "ON_TRACK",
          ownerId: g.owner_id,
        };
      });
      setGoals(mappedGoals);

      // Fetch Initiatives
      const { data: initRows } = await supabase
        .from("initiatives")
        .select("*")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false });

      setInitiatives(
        (initRows || []).map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          goalId: i.goal_id,
          status: i.status || "PLANNED",
          impact: i.strategic_impact || "HIGH",
          urgency: i.urgency || "HIGH",
          effort: i.effort || "MEDIUM",
          budget: Number(i.budget || 0),
          expectedRevenue: Number(i.expected_revenue || 0),
          roi: Number(i.expected_roi || (i.budget > 0 ? Math.round(((i.expected_revenue - i.budget) / i.budget) * 100) : 0)),
          score: Number(i.prioritization_score || 8.5),
          startDate: i.start_date ? i.start_date.split("T")[0] : "",
          dueDate: i.due_date ? i.due_date.split("T")[0] : "",
          ownerId: i.owner_id,
        }))
      );

      // Fetch Strategy Risks
      const { data: riskRows } = await supabase
        .from("strategy_risks")
        .select("*")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false });

      setRisks(
        (riskRows || []).map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          probability: r.probability || "MEDIUM",
          impact: r.impact || "HIGH",
          score: Number(r.risk_score || 6),
          mitigation: r.mitigation_plan || "Surveillance active",
          status: r.status || "IDENTIFIED",
          ownerId: r.owner_id,
        }))
      );

      // Fetch Strategic Decisions (Stop/Start/Continue)
      const { data: decRows } = await supabase
        .from("strategic_decisions")
        .select("*")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false });

      setDecisions(
        (decRows || []).map((d) => ({
          id: d.id,
          title: d.title,
          action: d.chosen_option || "STOP",
          reason: d.reason || d.context || "",
          evidence: d.expected_outcome || "",
          confidence: "HIGH",
          status: d.status || "APPROVED",
          ownerId: d.owner_id,
        }))
      );
    } catch (err) {
      console.error("Error loading strategy data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStrategyData();
  }, []);

  // Calculation of real Health Score & Strategic Alignment
  const calculateProgress = (g: any) => {
    if (!g || g.target === g.baseline) return 0;
    const diff = g.target - g.baseline;
    const currentDiff = g.current - g.baseline;
    if (diff <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((currentDiff / diff) * 100)));
  };

  const strategicHealthScore =
    goals.length > 0
      ? Math.round(
          goals.reduce((acc, g) => acc + calculateProgress(g), 0) / goals.length
        )
      : null;

  const strategicAlignment =
    goals.length > 0
      ? goals.filter((g) => g.status === "ON_TRACK" || g.status === "COMPLETED").length /
        goals.length
      : null;

  // Handlers for creating new strategy elements
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const payload = {
        organization_id: organizationId,
        title: goalForm.title.trim(),
        description: goalForm.description.trim(),
        goal_type: goalForm.goalType,
        kpi_key: goalForm.kpiKey,
        baseline_value: Number(goalForm.baselineValue),
        target_value: Number(goalForm.targetValue),
        current_value: Number(goalForm.currentValue),
        unit: goalForm.unit,
        start_date: goalForm.startDate,
        due_date: goalForm.dueDate,
        status: goalForm.status,
        owner_id: goalForm.ownerId || null,
      };

      const { error } = await supabase.from("strategic_goals").insert(payload);
      if (error) throw error;

      showToast("🎯 Objectif stratégique créé avec succès !");
      setShowGoalModal(false);
      setGoalForm({
        title: "",
        description: "",
        goalType: "FINANCIAL",
        strategicPriority: "HIGH",
        baselineValue: 0,
        targetValue: 100,
        currentValue: 0,
        unit: "XOF",
        kpiKey: "custom",
        ownerId: "",
        startDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0],
        status: "ON_TRACK",
      });
      await loadStrategyData();
    } catch (err: any) {
      console.error("Error creating goal:", err);
      alert(`Erreur lors de la création de l'objectif: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleCreateInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initiativeForm.title.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const budget = Number(initiativeForm.budget || 0);
      const expectedRevenue = Number(initiativeForm.expectedRevenue || 0);
      const roi = budget > 0 ? Math.round(((expectedRevenue - budget) / budget) * 100) : 0;

      const payload = {
        organization_id: organizationId,
        goal_id: initiativeForm.goalId || null,
        title: initiativeForm.title.trim(),
        description: initiativeForm.description.trim(),
        owner_id: initiativeForm.ownerId || null,
        status: initiativeForm.status,
        strategic_impact: initiativeForm.strategicImpact,
        urgency: initiativeForm.urgency,
        effort: initiativeForm.effort,
        budget,
        expected_revenue: expectedRevenue,
        expected_roi: roi,
        prioritization_score: 8.5,
        start_date: initiativeForm.startDate,
        due_date: initiativeForm.dueDate,
      };

      const { error } = await supabase.from("initiatives").insert(payload);
      if (error) throw error;

      showToast("🚀 Initiative créée avec succès !");
      setShowInitiativeModal(false);
      setInitiativeForm({
        title: "",
        description: "",
        goalId: "",
        ownerId: "",
        urgency: "HIGH",
        strategicImpact: "HIGH",
        effort: "MEDIUM",
        budget: 0,
        expectedRevenue: 0,
        startDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split("T")[0],
        status: "PLANNED",
      });
      await loadStrategyData();
    } catch (err: any) {
      console.error("Error creating initiative:", err);
      alert(`Erreur lors de la création de l'initiative: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleCreateRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskForm.title.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const pVal = riskForm.probability === "HIGH" ? 3 : riskForm.probability === "MEDIUM" ? 2 : 1;
      const iVal = riskForm.impact === "HIGH" ? 3 : riskForm.impact === "MEDIUM" ? 2 : 1;

      const payload = {
        organization_id: organizationId,
        title: riskForm.title.trim(),
        description: riskForm.description.trim(),
        probability: riskForm.probability,
        impact: riskForm.impact,
        risk_score: pVal * iVal,
        mitigation_plan: riskForm.mitigationPlan.trim(),
        owner_id: riskForm.ownerId || null,
        status: riskForm.status,
      };

      const { error } = await supabase.from("strategy_risks").insert(payload);
      if (error) throw error;

      showToast("🛡️ Risque stratégique répertorié !");
      setShowRiskModal(false);
      setRiskForm({
        title: "",
        description: "",
        probability: "MEDIUM",
        impact: "HIGH",
        ownerId: "",
        mitigationPlan: "",
        status: "IDENTIFIED",
      });
      await loadStrategyData();
    } catch (err: any) {
      console.error("Error creating risk:", err);
      alert(`Erreur lors de la création du risque: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionForm.title.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const payload = {
        organization_id: organizationId,
        title: decisionForm.title.trim(),
        chosen_option: decisionForm.action,
        reason: decisionForm.reason.trim(),
        expected_outcome: decisionForm.expectedOutcome.trim(),
        owner_id: decisionForm.ownerId || null,
        status: decisionForm.status,
      };

      const { error } = await supabase.from("strategic_decisions").insert(payload);
      if (error) throw error;

      showToast("⚡ Décision stratégique enregistrée !");
      setShowDecisionModal(false);
      setDecisionForm({
        action: "STOP",
        title: "",
        reason: "",
        expectedOutcome: "",
        ownerId: "",
        status: "APPROVED",
      });
      await loadStrategyData();
    } catch (err: any) {
      console.error("Error creating decision:", err);
      alert(`Erreur lors de l'enregistrement de la décision: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleSaveVision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visionInput.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .single();

      const existingSettings = org?.settings && typeof org.settings === "object" ? org.settings : {};
      const updatedSettings = { ...existingSettings, vision: visionInput.trim() };

      const { error } = await supabase
        .from("organizations")
        .update({ settings: updatedSettings })
        .eq("id", organizationId);

      if (error) throw error;

      // Update strategy row if exists
      if (strategyId) {
        await supabase
          .from("strategies")
          .update({ vision: visionInput.trim() })
          .eq("id", strategyId);
      }

      setOrganizationVision(visionInput.trim());
      showToast("🟢 Vision stratégique mise à jour pour l'organisation !");
      setShowVisionModal(false);
    } catch (err: any) {
      console.error("Error saving vision:", err);
      alert(`Erreur lors de l'enregistrement de la vision: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  const handleCreateTaskFromInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInitiativeForTask || !taskForm.title.trim() || !organizationId) return;
    setSavingState(true);

    try {
      const supabase = createClient();
      const payload = {
        organization_id: organizationId,
        title: taskForm.title.trim(),
        description: `[Initiative: ${selectedInitiativeForTask.title}]\n${taskForm.description.trim()}`,
        assignee_id: taskForm.assigneeId || null,
        priority: taskForm.priority,
        status: "TODO",
        due_date: taskForm.dueDate,
      };

      const { error } = await supabase.from("team_tasks").insert(payload);
      if (error) throw error;

      showToast("👥 Tâche opérationnelle transférée à l'équipe !");
      setSelectedInitiativeForTask(null);
    } catch (err: any) {
      console.error("Error creating team task:", err);
      alert(`Erreur lors de la création de la tâche: ${err.message}`);
    } finally {
      setSavingState(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-12">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#7B61FF] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 animate-slide-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#181824] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#7B61FF]/10 rounded-2xl border border-[#7B61FF]/20 text-[#7B61FF]">
              <Target className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                Strategy & Goals Cockpit
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Le système stratégique de {organizationName} — Relie la vision à l&apos;exécution opérationnelle.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DataSourceBadge
            type={goals.length > 0 ? "DATABASE" : "EMPTY_STATE"}
            label="STRATEGY ENGINE"
          />
          <button
            onClick={() => setShowEngineModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#12121A] hover:bg-[#1A1A26] text-gray-300 font-medium rounded-xl border border-[#1E1E2C] transition-all text-sm"
          >
            <Sparkles className="w-4 h-4 text-[#7B61FF]" />
            Strategy Engine
          </button>
          <div className="relative group">
            <button
              onClick={() => setShowWhatIfModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#12121A] hover:bg-[#1A1A26] text-gray-300 font-medium rounded-xl border border-[#1E1E2C] transition-all text-sm opacity-90"
            >
              <Play className="w-4 h-4 text-amber-400" />
              Simuler Scénario What-If
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 font-mono rounded">
                Bientôt
              </span>
            </button>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#7B61FF]/20 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel Objectif
          </button>
        </div>
      </div>

      {/* STRATEGY HEALTH BANNER */}
      <div className="bg-gradient-to-r from-[#12121A] via-[#161624] to-[#12121A] border border-[#7B61FF]/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold rounded-full border border-emerald-500/20">
                🟢 VISION ACTIVE ({organizationName})
              </span>
              <span className="text-xs text-gray-400 font-mono">
                Alignement Stratégique:{" "}
                <strong className="text-white">
                  {strategicAlignment !== null
                    ? `${Math.round(strategicAlignment * 100)}%`
                    : "Données insuffisantes"}
                </strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Stratégie de Croissance — {organizationName}
              <button
                onClick={() => {
                  setVisionInput(organizationVision);
                  setShowVisionModal(true);
                }}
                className="p-1 hover:bg-[#181824] rounded text-gray-400 hover:text-[#7B61FF] transition-all"
                title="Modifier la vision"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </h2>
            <p className="text-sm text-gray-300 italic">
              {organizationVision
                ? `« ${organizationVision} »`
                : `« Aucune vision stratégique configurée pour ${organizationName}. Cliquez pour configurer votre vision. »`}
            </p>
          </div>

          <div className="flex items-center gap-6 bg-[#0A0A10]/80 p-4 rounded-xl border border-[#1E1E2C]">
            <div className="text-center">
              <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                Health Score
              </span>
              <div className="text-3xl font-extrabold text-[#7B61FF] mt-1">
                {strategicHealthScore !== null ? (
                  <>
                    {strategicHealthScore}
                    <span className="text-sm text-gray-400 font-normal">/100</span>
                  </>
                ) : (
                  <span className="text-base text-gray-400 font-normal">
                    Indisponible — données insuffisantes
                  </span>
                )}
              </div>
            </div>
            <div className="h-10 w-[1px] bg-[#181824]" />
            <div className="text-xs text-gray-300 space-y-1">
              <p>
                Objectifs: <span className="font-bold text-slate-300">{goals.length}</span>
              </p>
              <p>
                Initiatives: <span className="font-bold text-slate-300">{initiatives.length}</span>
              </p>
              <p>
                Risques: <span className="font-bold text-slate-300">{risks.length}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-[#181824] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30"
              : "text-gray-400 hover:text-white hover:bg-[#12121A]"
          }`}
        >
          <Compass className="w-4 h-4" />
          Vue Stratégique
        </button>

        <button
          onClick={() => setActiveTab("goals")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            activeTab === "goals"
              ? "bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30"
              : "text-gray-400 hover:text-white hover:bg-[#12121A]"
          }`}
        >
          <Target className="w-4 h-4" />
          Objectifs & Trajectoires ({goals.length})
        </button>

        <button
          onClick={() => setActiveTab("initiatives")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            activeTab === "initiatives"
              ? "bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30"
              : "text-gray-400 hover:text-white hover:bg-[#12121A]"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Initiatives & Plan 90 Jours ({initiatives.length})
        </button>

        <button
          onClick={() => setActiveTab("recommendations")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            activeTab === "recommendations"
              ? "bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30"
              : "text-gray-400 hover:text-white hover:bg-[#12121A]"
          }`}
        >
          <Zap className="w-4 h-4" />
          Stop / Start / Continue ({decisions.length})
        </button>

        <button
          onClick={() => setActiveTab("risks_decisions")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            activeTab === "risks_decisions"
              ? "bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30"
              : "text-gray-400 hover:text-white hover:bg-[#12121A]"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Risques & Dépendances ({risks.length})
        </button>
      </div>

      {/* TAB CONTENT: VUE STRATÉGIQUE (OVERVIEW) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#7B61FF]" />
                Arborescence Stratégique d&apos;Exécution
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Visualisation de la cascade vision → objectifs → initiatives → opérations.
              </p>
            </div>

            {/* CASCADE DIAGRAM */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              <div className="bg-[#0A0A10] border border-[#7B61FF]/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase bg-[#7B61FF]/20 text-[#7B61FF] px-2 py-0.5 rounded font-bold">
                  1. VISION
                </span>
                <p className="text-xs font-bold text-white line-clamp-3">
                  {organizationVision || "Définir la vision globale"}
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-blue-500/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">
                  2. OBJECTIFS ({goals.length})
                </span>
                <p className="text-xs font-bold text-white line-clamp-2">
                  {goals.length > 0 ? goals[0].title : "Aucun objectif stratégique"}
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-purple-500/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold">
                  3. INITIATIVES ({initiatives.length})
                </span>
                <p className="text-xs font-bold text-white line-clamp-2">
                  {initiatives.length > 0 ? initiatives[0].title : "Aucune initiative active"}
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                  4. DÉCISIONS ({decisions.length})
                </span>
                <p className="text-xs font-bold text-white line-clamp-2">
                  {decisions.length > 0 ? decisions[0].title : "Arbitrages Stop/Start"}
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-rose-500/30 rounded-xl p-4 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">
                  5. RISQUES ({risks.length})
                </span>
                <p className="text-xs font-bold text-white line-clamp-2">
                  {risks.length > 0 ? risks[0].title : "Aucun risque majeur"}
                </p>
              </div>
            </div>

            {/* STRATEGIC SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#181824]">
              <div className="bg-[#0A0A10] border border-[#1E1E2C] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">OBJECTIFS STRATÉGIQUES</span>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="text-xs text-[#7B61FF] font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="text-2xl font-bold text-white">{goals.length}</div>
                <p className="text-xs text-gray-400">
                  {goals.filter((g) => g.status === "ON_TRACK").length} en bonne voie,{" "}
                  {goals.filter((g) => g.status === "AT_RISK" || g.status === "BEHIND").length} en vigilance.
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-[#1E1E2C] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">PLAN 90 JOURS (INITIATIVES)</span>
                  <button
                    onClick={() => setShowInitiativeModal(true)}
                    className="text-xs text-[#7B61FF] font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="text-2xl font-bold text-white">{initiatives.length}</div>
                <p className="text-xs text-gray-400">
                  {initiatives.filter((i) => i.status === "IN_PROGRESS").length} en cours d&apos;exécution.
                </p>
              </div>

              <div className="bg-[#0A0A10] border border-[#1E1E2C] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400">MATRICE DES RISQUES</span>
                  <button
                    onClick={() => setShowRiskModal(true)}
                    className="text-xs text-[#7B61FF] font-medium hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Créer
                  </button>
                </div>
                <div className="text-2xl font-bold text-white">{risks.length}</div>
                <p className="text-xs text-gray-400">
                  {risks.filter((r) => r.impact === "HIGH").length} risques critiques surveillés.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: OBJECTIVES & GOALS */}
      {activeTab === "goals" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-[#7B61FF]" />
                Objectifs & Trajectoires Météo
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Progression calculée en temps réel d&apos;après le SSOT Supabase.
              </p>
            </div>

            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-medium rounded-xl transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              + Créer un objectif
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
              <span>Chargement des objectifs stratégiques...</span>
            </div>
          ) : goals.length === 0 ? (
            <div className="bg-[#12121A] border border-dashed border-[#1E1E2C] rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[#7B61FF]/10 text-[#7B61FF] rounded-2xl flex items-center justify-center mx-auto border border-[#7B61FF]/20">
                <Target className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">🎯 Aucun objectif stratégique</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Commencez par définir votre premier objectif pour piloter la croissance de {organizationName}.
                </p>
              </div>
              <button
                onClick={() => setShowGoalModal(true)}
                className="px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl text-xs transition-all"
              >
                + Créer mon premier objectif
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {goals.map((g) => {
                const progress = calculateProgress(g);
                const ownerName =
                  teamEmployees.find((e) => e.id === g.ownerId)?.full_name || "Non assigné";

                return (
                  <div
                    key={g.id}
                    className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-6 hover:border-[#7B61FF]/40 transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-[#181824] text-xs font-mono text-gray-300 rounded uppercase">
                          {g.type}
                        </span>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full border font-mono ${
                            g.status === "ON_TRACK" || g.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : g.status === "AT_RISK"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-lg leading-snug">{g.title}</h3>
                      {g.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">{g.description}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Progression réelle</span>
                          <span className="font-mono text-white font-bold">{progress}%</span>
                        </div>
                        <div className="w-full bg-[#181824] h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              progress >= 70
                                ? "bg-emerald-500"
                                : progress >= 40
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-[#0A0A10] p-3 rounded-xl border border-[#181824]">
                        <div>
                          <span className="text-gray-400">Actuel:</span>
                          <p className="font-bold text-white font-mono">
                            {g.current.toLocaleString()} {g.unit}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">Cible:</span>
                          <p className="font-bold text-[#7B61FF] font-mono">
                            {g.target.toLocaleString()} {g.unit}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-[11px] text-gray-400 pt-2 border-t border-[#181824]">
                        <div className="flex justify-between">
                          <span>Responsable: <strong className="text-gray-200">{ownerName}</strong></span>
                          <span>Source KPI: <code className="text-[#7B61FF]">{g.kpiKey}</code></span>
                        </div>
                        {g.dueDate && (
                          <span className="font-mono text-gray-500 text-right">
                            Échéance: {g.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: INITIATIVES */}
      {activeTab === "initiatives" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#7B61FF]" />
                Initiatives Stratégiques (Plan 90 Jours)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Projets clés reliés aux objectifs opérationnels.
              </p>
            </div>

            <button
              onClick={() => setShowInitiativeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-medium rounded-xl transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              + Nouvelle Initiative
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
              <span>Chargement des initiatives...</span>
            </div>
          ) : initiatives.length === 0 ? (
            <div className="bg-[#12121A] border border-dashed border-[#1E1E2C] rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[#7B61FF]/10 text-[#7B61FF] rounded-2xl flex items-center justify-center mx-auto border border-[#7B61FF]/20">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">🚀 Aucune initiative stratégique</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Définissez les plans d&apos;action 90 jours pour atteindre vos objectifs.
                </p>
              </div>
              <button
                onClick={() => setShowInitiativeModal(true)}
                className="px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl text-xs transition-all"
              >
                + Créer ma première initiative
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {initiatives.map((init) => {
                const ownerName =
                  teamEmployees.find((e) => e.id === init.ownerId)?.full_name || "Non assigné";
                const goalTitle =
                  goals.find((g) => g.id === init.goalId)?.title || "Objectif général";

                return (
                  <div
                    key={init.id}
                    className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-5 hover:border-[#7B61FF]/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-0.5 bg-[#7B61FF]/20 text-[#7B61FF] text-xs font-mono font-bold rounded">
                          Score: {init.score}
                        </span>
                        <h4 className="font-bold text-white text-base">{init.title}</h4>
                      </div>
                      {init.description && (
                        <p className="text-xs text-gray-300">{init.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span>Objectif: <strong className="text-white">{goalTitle}</strong></span>
                        <span>•</span>
                        <span>Responsable: <strong className="text-gray-200">{ownerName}</strong></span>
                        <span>•</span>
                        <span>Statut: <strong className="text-[#7B61FF] font-mono">{init.status}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-4 bg-[#0A0A10] p-3 rounded-xl border border-[#181824] text-xs font-mono">
                        <div>
                          <span className="text-gray-400">Budget:</span>
                          <p className="font-bold text-white">{init.budget.toLocaleString()} F</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Revenue Attendu:</span>
                          <p className="font-bold text-emerald-400">
                            {init.expectedRevenue.toLocaleString()} F
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">ROI:</span>
                          <p className="font-bold text-[#7B61FF]">+{init.roi}%</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedInitiativeForTask(init);
                          setTaskForm({
                            title: init.title,
                            description: init.description || "",
                            assigneeId: init.ownerId || "",
                            priority: "HIGH",
                            dueDate: init.dueDate || new Date().toISOString().split("T")[0],
                          });
                        }}
                        className="p-3 bg-[#181824] hover:bg-[#7B61FF]/20 text-gray-300 hover:text-[#7B61FF] rounded-xl border border-[#242436] transition-all flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                        title="Créer une tâche pour l'équipe"
                      >
                        <ListTodo className="w-4 h-4" />
                        Tâche Équipe
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RECOMMENDATIONS (STOP/START/CONTINUE) */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Arbitrages Stratégiques (Stop / Start / Continue)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Décisions d&apos;orientation prises par la direction.
              </p>
            </div>

            <button
              onClick={() => setShowDecisionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-medium rounded-xl transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              + Nouvelle Décision
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
              <span>Chargement des décisions...</span>
            </div>
          ) : decisions.length === 0 ? (
            <div className="bg-[#12121A] border border-dashed border-[#1E1E2C] rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
                <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">⚡ Aucune décision Stop/Start/Continue</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Consignez ce qu&apos;il faut stopper, lancer ou poursuivre.
                </p>
              </div>
              <button
                onClick={() => setShowDecisionModal(true)}
                className="px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl text-xs transition-all"
              >
                + Enregistrer une décision
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {decisions.map((rec) => {
                const ownerName =
                  teamEmployees.find((e) => e.id === rec.ownerId)?.full_name || "Non assigné";

                return (
                  <div
                    key={rec.id}
                    className={`bg-[#12121A] border rounded-2xl p-5 space-y-3 flex flex-col justify-between ${
                      rec.action === "STOP"
                        ? "border-rose-500/30"
                        : rec.action === "START"
                        ? "border-amber-500/30"
                        : "border-emerald-500/30"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-3 py-1 text-xs font-mono font-bold rounded-full border ${
                            rec.action === "STOP"
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                              : rec.action === "START"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {rec.action}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          Statut: {rec.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base leading-snug">{rec.title}</h3>
                      {rec.reason && <p className="text-xs text-gray-300">{rec.reason}</p>}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#181824]">
                      {rec.evidence && (
                        <div className="p-3 bg-[#0A0A10] rounded-xl border border-[#181824] text-xs text-gray-400">
                          <strong>Impact / Résultat:</strong> {rec.evidence}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400">
                        Responsable: <strong className="text-gray-200">{ownerName}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: RISKS & DECISIONS */}
      {activeTab === "risks_decisions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Matrice des Risques & Dépendances Stratégiques
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Cartographie des facteurs de risque et plans d&apos;atténuation.
              </p>
            </div>

            <button
              onClick={() => setShowRiskModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-xs font-medium rounded-xl transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              + Signaler un risque
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#7B61FF]" />
              <span>Chargement de la matrice des risques...</span>
            </div>
          ) : risks.length === 0 ? (
            <div className="bg-[#12121A] border border-dashed border-[#1E1E2C] rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">🛡️ Aucun risque stratégique recensé</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Enregistrez les risques opérationnels et financiers pour sécuriser la croissance.
                </p>
              </div>
              <button
                onClick={() => setShowRiskModal(true)}
                className="px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl text-xs transition-all"
              >
                + Signaler un risque
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {risks.map((r) => {
                const ownerName =
                  teamEmployees.find((e) => e.id === r.ownerId)?.full_name || "Non assigné";

                return (
                  <div
                    key={r.id}
                    className="bg-[#12121A] border border-rose-500/20 rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-base">{r.title}</span>
                      <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-mono font-bold rounded-full border border-rose-500/30">
                        Score: {r.score}/9
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-gray-300">{r.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#0A0A10] p-3 rounded-xl border border-[#181824]">
                      <div>
                        <span className="text-gray-400">Probabilité:</span>
                        <p className="font-bold text-amber-400">{r.probability}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Impact:</span>
                        <p className="font-bold text-rose-400">{r.impact}</p>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 text-xs">
                      <span className="text-gray-400 font-medium">Plan d&apos;atténuation:</span>
                      <p className="text-gray-200 bg-[#0A0A10] p-2.5 rounded-lg border border-[#181824]">
                        {r.mitigation}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-[#181824]">
                      <span>Responsable: <strong className="text-white">{ownerName}</strong></span>
                      <span className="font-mono uppercase text-[#7B61FF]">{r.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: NOUVEL OBJECTIF */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#7B61FF]/30 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-[#7B61FF]" />
                Nouvel Objectif Stratégique
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Intitulé de l&apos;objectif *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Atteindre 10 000 000 XOF de CA mensuel"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Détails contextuels et vision de cet objectif..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Catégorie</label>
                  <select
                    value={goalForm.goalType}
                    onChange={(e) => setGoalForm({ ...goalForm, goalType: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="FINANCIAL">FINANCIER</option>
                    <option value="OPERATIONAL">OPÉRATIONNEL</option>
                    <option value="CUSTOMER">CLIENTS</option>
                    <option value="GROWTH">CROISSANCE</option>
                    <option value="TEAM">ÉQUIPE</option>
                    <option value="DELIVERY">LIVRAISON</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Lier à un KPI SSOT
                  </label>
                  <select
                    value={goalForm.kpiKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      let unit = goalForm.unit;
                      if (key === "revenue") unit = "XOF";
                      else if (key === "orders_count") unit = "commandes";
                      else if (key === "delivery_success_rate") unit = "%";
                      else if (key === "products_count") unit = "produits";
                      setGoalForm({ ...goalForm, kpiKey: key, unit });
                    }}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="custom">Aucun (Calcul manuel)</option>
                    <option value="revenue">Chiffre d&apos;Affaires (XOF)</option>
                    <option value="orders_count">Nombre de Commandes</option>
                    <option value="delivery_success_rate">Taux de Livraison (%)</option>
                    <option value="products_count">Nombre de Produits</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Valeur initiale
                  </label>
                  <input
                    type="number"
                    value={goalForm.baselineValue}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, baselineValue: Number(e.target.value) })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Valeur cible *
                  </label>
                  <input
                    type="number"
                    required
                    value={goalForm.targetValue}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, targetValue: Number(e.target.value) })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Unité</label>
                  <input
                    type="text"
                    required
                    placeholder="XOF, %, etc."
                    value={goalForm.unit}
                    onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Responsable
                  </label>
                  <select
                    value={goalForm.ownerId}
                    onChange={(e) => setGoalForm({ ...goalForm, ownerId: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="">Sélectionner un membre...</option>
                    {teamEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Échéance</label>
                  <input
                    type="date"
                    required
                    value={goalForm.dueDate}
                    onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 bg-[#181824] hover:bg-[#242436] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOUVELLE INITIATIVE */}
      {showInitiativeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#7B61FF]/30 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#7B61FF]" />
                Nouvelle Initiative (Plan 90 Jours)
              </h3>
              <button
                onClick={() => setShowInitiativeModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInitiative} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nom de l&apos;initiative *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Campagne TikTok Ads & Automatisation WhatsApp"
                  value={initiativeForm.title}
                  onChange={(e) => setInitiativeForm({ ...initiativeForm, title: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Objectif associé
                </label>
                <select
                  value={initiativeForm.goalId}
                  onChange={(e) => setInitiativeForm({ ...initiativeForm, goalId: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                >
                  <option value="">Sélectionner un objectif...</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Budget Prévu (XOF)
                  </label>
                  <input
                    type="number"
                    value={initiativeForm.budget}
                    onChange={(e) =>
                      setInitiativeForm({ ...initiativeForm, budget: Number(e.target.value) })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    CA Attendu (XOF)
                  </label>
                  <input
                    type="number"
                    value={initiativeForm.expectedRevenue}
                    onChange={(e) =>
                      setInitiativeForm({
                        ...initiativeForm,
                        expectedRevenue: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Responsable
                  </label>
                  <select
                    value={initiativeForm.ownerId}
                    onChange={(e) =>
                      setInitiativeForm({ ...initiativeForm, ownerId: e.target.value })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="">Sélectionner un responsable...</option>
                    {teamEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Échéance</label>
                  <input
                    type="date"
                    required
                    value={initiativeForm.dueDate}
                    onChange={(e) =>
                      setInitiativeForm({ ...initiativeForm, dueDate: e.target.value })
                    }
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowInitiativeModal(false)}
                  className="px-4 py-2 bg-[#181824] hover:bg-[#242436] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer l'initiative"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOUVEAU RISQUE */}
      {showRiskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-rose-500/30 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Signaler un Risque Stratégique
              </h3>
              <button
                onClick={() => setShowRiskModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRisk} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Intitulé du risque *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Rupture de stock fournisseur en haute saison"
                  value={riskForm.title}
                  onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Plan d&apos;atténuation *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Actions préventives prévues..."
                  value={riskForm.mitigationPlan}
                  onChange={(e) => setRiskForm({ ...riskForm, mitigationPlan: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Probabilité</label>
                  <select
                    value={riskForm.probability}
                    onChange={(e) => setRiskForm({ ...riskForm, probability: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option value="LOW">FAIBLE (1)</option>
                    <option value="MEDIUM">MOYENNE (2)</option>
                    <option value="HIGH">ÉLEVÉE (3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Impact</label>
                  <select
                    value={riskForm.impact}
                    onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })}
                    className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                  >
                    <option value="LOW">FAIBLE (1)</option>
                    <option value="MEDIUM">MOYEN (2)</option>
                    <option value="HIGH">CRITIQUE (3)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Responsable</label>
                <select
                  value={riskForm.ownerId}
                  onChange={(e) => setRiskForm({ ...riskForm, ownerId: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="">Sélectionner un membre...</option>
                  {teamEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowRiskModal(false)}
                  className="px-4 py-2 bg-[#181824] hover:bg-[#242436] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer le risque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOUVEAU STOP/START/CONTINUE */}
      {showDecisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-amber-500/30 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Décision Stratégique (Stop / Start / Continue)
              </h3>
              <button
                onClick={() => setShowDecisionModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Type d&apos;arbitrage *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {["STOP", "START", "CONTINUE"].map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setDecisionForm({ ...decisionForm, action: act })}
                      className={`py-2 text-xs font-bold font-mono rounded-xl border transition-all ${
                        decisionForm.action === act
                          ? act === "STOP"
                            ? "bg-rose-500/20 text-rose-400 border-rose-500"
                            : act === "START"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                          : "bg-[#0A0A10] text-gray-400 border-[#1E1E2C]"
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Intitulé de l&apos;action *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Stopper les campagnes SMS à faible conversion"
                  value={decisionForm.title}
                  onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Contexte & Rationale
                </label>
                <textarea
                  rows={2}
                  placeholder="Pourquoi cette décision est prise..."
                  value={decisionForm.reason}
                  onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Impact attendu
                </label>
                <input
                  type="text"
                  placeholder="ex: Économie de 300 000 XOF/mois sur le budget marketing"
                  value={decisionForm.expectedOutcome}
                  onChange={(e) => setDecisionForm({ ...decisionForm, expectedOutcome: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-4 py-2 bg-[#181824] hover:bg-[#242436] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer la décision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT VISION */}
      {showVisionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#7B61FF]/30 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#7B61FF]" />
                Vision Stratégique — {organizationName}
              </h3>
              <button
                onClick={() => setShowVisionModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Énoncé de la Vision Stratégique *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ex: Devenir le leader de la distribution dans notre région..."
                  value={visionInput}
                  onChange={(e) => setVisionInput(e.target.value)}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowVisionModal(false)}
                  className="px-4 py-2 bg-[#181824] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sauvegarder la Vision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFORM INITIATIVE TO TEAM TASK */}
      {selectedInitiativeForTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#7B61FF]/30 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-[#7B61FF]" />
                Créer une tâche pour l&apos;équipe
              </h3>
              <button
                onClick={() => setSelectedInitiativeForTask(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskFromInitiative} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Titre de la tâche
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Assigné à (Équipe)
                </label>
                <select
                  value={taskForm.assigneeId}
                  onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                  className="w-full bg-[#0A0A10] border border-[#1E1E2C] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B61FF]"
                >
                  <option value="">Sélectionner un membre de l&apos;équipe...</option>
                  {teamEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setSelectedInitiativeForTask(null)}
                  className="px-4 py-2 bg-[#181824] text-gray-300 text-sm rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingState}
                  className="px-5 py-2 bg-[#7B61FF] text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {savingState ? <Loader2 className="w-4 h-4 animate-spin" /> : "Transférer à l'équipe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WHAT-IF SCENARIO SIMULATION */}
      {showWhatIfModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 text-center shadow-2xl animate-scale-up">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
              <Play className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-500/20 text-amber-400 rounded">
                Bientôt disponible
              </span>
              <h3 className="text-lg font-bold text-white">Simulateur de Scénarios What-If</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Cette fonctionnalité calculera l&apos;impact prédictif de variations budgétaires et de conversions sur vos KPI réels.
                Elle sera active dès le cumul de 30 jours de données historiques d&apos;exploitation.
              </p>
            </div>
            <button
              onClick={() => setShowWhatIfModal(false)}
              className="w-full py-2.5 bg-[#181824] hover:bg-[#242436] text-white text-sm font-medium rounded-xl"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* MODAL: STRATEGY ENGINE INSIGHTS */}
      {showEngineModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#7B61FF]/30 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#7B61FF]" />
                Strategy Engine — Diagnostic SSOT
              </h3>
              <button
                onClick={() => setShowEngineModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="p-4 bg-[#0A0A10] rounded-xl border border-[#1E1E2C] space-y-2">
                <span className="font-bold text-white text-sm">📊 Analyse Météo Stratégique</span>
                <p>
                  • <strong>{goals.length}</strong> objectifs configurés dans Supabase DEV.
                </p>
                <p>
                  • <strong>{initiatives.length}</strong> initiatives stratégiques liées.
                </p>
                <p>
                  • <strong>{risks.length}</strong> facteurs de risques identifiés.
                </p>
              </div>

              <div className="p-4 bg-[#7B61FF]/10 border border-[#7B61FF]/30 rounded-xl space-y-2">
                <span className="font-bold text-[#7B61FF] text-sm">💡 Recommandation Exécutive</span>
                <p>
                  {goals.length === 0
                    ? "Aucun objectif n'est encore enregistré. Créez au moins un objectif lié au CA ou aux livraisons pour activer le suivi de performance."
                    : "Vos objectifs sont suivis en temps réel. Assurez-vous que chaque initiative est assignée à un membre de l'équipe pour garantir son exécution."}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowEngineModal(false)}
                className="px-5 py-2 bg-[#7B61FF] text-white text-xs font-medium rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
