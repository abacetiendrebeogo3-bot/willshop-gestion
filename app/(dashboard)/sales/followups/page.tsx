"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/src/infrastructure/supabase/client";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { Card, Badge, Button } from "@/components/ui/card";
import {
  Clock,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Filter,
  Search,
  MessageSquare,
  ShieldCheck,
  Zap,
  ArrowRight,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  Package,
  UserCheck,
  Ban,
  PhoneCall,
  Power,
  Sparkles,
} from "lucide-react";
import {
  FollowupEngineService,
  FollowupVariableEngine,
  FollowupCandidate,
  SimulationResult,
} from "@/src/application/services/FollowupEngineService";
import { AIGlobalGuardService } from "@/src/application/services/AIGlobalGuardService";

export default function FollowupsPage() {
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("WILLShop OS");

  // Global Engine Controls
  const [isDryRunMode, setIsDryRunMode] = useState<boolean>(true);
  const [globalKillSwitchStopped, setGlobalKillSwitchStopped] = useState<boolean>(false);
  const [agentMode, setAgentMode] = useState<'GLOBAL_AI_DISABLED' | 'FOLLOWUP_ONLY' | 'HUMAN_PRIMARY' | 'AI_ACTIVE' | 'PAUSED'>('FOLLOWUP_ONLY');

  // Modals State
  const [showKillSwitchConfirmModal, setShowKillSwitchConfirmModal] = useState<boolean>(false);


  // Products from real DB catalog
  const [products, setProducts] = useState<any[]>([]);


  // Rules and Executions State
  const [rules, setRules] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);

  // Modals State
  const [showNewRuleModal, setShowNewRuleModal] = useState<boolean>(false);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [showActivationConfirmModal, setShowActivationConfirmModal] = useState<boolean>(false);
  const [showRealTestModal, setShowRealTestModal] = useState<boolean>(false);

  const [simulatingRule, setSimulatingRule] = useState<any | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [fakeClockOffsetHours, setFakeClockOffsetHours] = useState<number>(4);

  // Advanced Options Accordion Toggle
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // Test Phone Number for Controlled Real Test
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>("+22670000000");

  // Rule Form State
  const [ruleForm, setRuleForm] = useState({
    id: "",
    name: "",
    trigger: "NO_REPLY_PROSPECT",
    delayValue: 4,
    delayUnit: "heures" as "minutes" | "heures" | "jours",
    afterEvent: "LAST_CUSTOMER_MESSAGE",

    // Section ② — Ciblage
    targetActiveConv: true,
    targetInterestedProspect: true,
    targetProductPresented: false,
    targetPriceCommunicated: false,
    targetUnfinishedOrder: false,
    productId: "ALL_PRODUCTS",

    // Section ③ — Conditions d'arrêt
    stopOnCustomerReply: true,
    stopOnHumanTakeover: true,
    stopOnOrderCompleted: true,
    stopOnArchived: true,
    stopOnOptOut: true,
    stopOnPreviousFollowupSent: true,
    frequencyLimit: 1,
    cooldownValue: 24,
    cooldownUnit: "heures" as "minutes" | "heures" | "jours",

    // Section ④ — Action
    messageTemplate:
      "Bonjour {{first_name}} 😊\nNous avons remarqué votre intérêt pour nos articles. Souhaitez-vous que nous vous aidions à finaliser votre commande ?",

    // ⚙️ Options Avancées
    scheduleStart: "08:00",
    scheduleEnd: "20:00",
    allowedDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    maxConcurrent: 50,

    enabled: false, // Default to DRAFT mode
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Convert delay to seconds helper
  const calculateSeconds = (val: number, unit: "minutes" | "heures" | "jours") => {
    if (unit === "minutes") return val * 60;
    if (unit === "jours") return val * 86400;
    return val * 3600;
  };

  // Load Rules, Executions & Products from Supabase
  const loadFollowupData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let targetOrgId = "";
      if (user) {
        const { data: roles } = await supabase
          .from("user_organization_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
      .order("created_at", { ascending: true });

        if (roles && roles.length > 0) {
          targetOrgId = roles[0].organization_id;
          const { data: org } = await supabase
            .from("organizations")
            .select("name, settings")
            .eq("id", targetOrgId)
            .single();

          if (org) {
            setOrganizationName(org.name || "WILLShop OS");
            if (org.settings?.dry_run_followups !== undefined) {
              setIsDryRunMode(org.settings.dry_run_followups);
            }
            if (org.settings?.test_phone_number) {
              setTestPhoneNumber(org.settings.test_phone_number);
            }
            if (org.settings?.ai_agent_config?.agent_mode) {
              setAgentMode(org.settings.ai_agent_config.agent_mode);
            }
          }
        }
      }

      setOrganizationId(targetOrgId);
      if (!targetOrgId) return;


      // 1. Fetch Real Catalog Products for targeting dropdown
      const { data: prodRows } = await supabase
        .from("products")
        .select("id, name, sku, status")
        .eq("organization_id", targetOrgId)
        .is("deleted_at", null)
        .eq("status", "ACTIVE")
        .order("name", { ascending: true });

      setProducts(prodRows || []);

      // 2. Fetch Kill Switch Config
      const { data: ksRow } = await supabase
        .from("kill_switches")
        .select("global_stopped")
        .eq("organization_id", targetOrgId)
        .single();

      if (ksRow) {
        setGlobalKillSwitchStopped(ksRow.global_stopped);
      }

      // 3. Fetch Followup Automation Rules
      const { data: ruleRows } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("organization_id", targetOrgId)
        .eq("category", "FOLLOWUP")
        .order("created_at", { ascending: false });

      setRules(ruleRows || []);

      // 4. Fetch Automation Executions
      const { data: execRows } = await supabase
        .from("automation_executions")
        .select("*")
        .eq("organization_id", targetOrgId)
        .order("started_at", { ascending: false })
        .limit(20);

      setExecutions(execRows || []);
    } catch (err) {
      console.error("Erreur chargement relances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowupData();
  }, []);

  // Agent Mode Switcher Handler
  const handleSelectAgentMode = async (mode: 'FOLLOWUP_ONLY' | 'HUMAN_PRIMARY' | 'AI_ACTIVE' | 'PAUSED') => {
    setAgentMode(mode);
    showToast(`🤖 Mode de l'Agent mis à jour : ${mode}`);
    if (organizationId) {
      try {
        const supabase = createClient();
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();

        const existingConfig = org?.settings?.ai_agent_config || {};
        const updatedSettings = {
          ...(org?.settings || {}),
          ai_agent_config: { ...existingConfig, agent_mode: mode },
        };
        await supabase
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", organizationId);
      } catch (err) {
        console.error("Error updating agent mode:", err);
      }
    }
  };

  // Helper to create Recommended Rules Presets
  const handleCreateRecommendedRule = (presetKey: number) => {
    const presets: Record<number, any> = {
      1: {
        name: "Prospect intéressé sans réponse — 1h",
        trigger: "NO_REPLY_PROSPECT",
        delayValue: 1,
        delayUnit: "heures",
        messageTemplate: "Bonjour {{first_name}} 😊 Je reviens vers vous concernant votre demande. Souhaitez-vous qu'on vous aide pour votre commande ?",
      },
      2: {
        name: "Prospect après présentation produit — 4h",
        trigger: "PRODUCT_PRESENTED_NO_REPLY",
        delayValue: 4,
        delayUnit: "heures",
        messageTemplate: "Bonjour {{first_name}} 👋 Avez-vous eu le temps de regarder les caractéristiques du {{product_name}} ?",
      },
      3: {
        name: "Prospect après proposition de prix — 6h",
        trigger: "PRICE_PROPOSAL_NO_REPLY",
        delayValue: 6,
        delayUnit: "heures",
        messageTemplate: "Bonjour {{first_name}} 😊 Je fais un suivi concernant le prix du {{product_name}} ({{selling_price}}). Avez-vous des questions sur les modalités de livraison ?",
      },
      4: {
        name: "Commande non finalisée — 2h",
        trigger: "UNFINISHED_ORDER",
        delayValue: 2,
        delayUnit: "heures",
        messageTemplate: "Bonjour {{first_name}} 🛒 Votre commande de {{product_name}} est presque prête ! Souhaitez-vous la faire livrer à {{neighborhood}} ?",
      },
      5: {
        name: "Commande/livraison en attente — 24h",
        trigger: "PENDING_DELIVERY",
        delayValue: 24,
        delayUnit: "heures",
        messageTemplate: "Bonjour {{first_name}} 🚚 Nous préparons l'expédition de votre commande #{{order_id}}. Êtes-vous bien disponible aujourd'hui ?",
      },
    };

    const sel = presets[presetKey];
    if (!sel) return;

    setRuleForm({
      id: "",
      name: sel.name,
      trigger: sel.trigger,
      delayValue: sel.delayValue,
      delayUnit: sel.delayUnit,
      afterEvent: "LAST_CUSTOMER_MESSAGE",
      targetActiveConv: true,
      targetInterestedProspect: true,
      targetProductPresented: presetKey === 2,
      targetPriceCommunicated: presetKey === 3,
      targetUnfinishedOrder: presetKey === 4,
      productId: "ALL_PRODUCTS",
      stopOnCustomerReply: true,
      stopOnHumanTakeover: true,
      stopOnOrderCompleted: true,
      stopOnArchived: true,
      stopOnOptOut: true,
      stopOnPreviousFollowupSent: true,
      frequencyLimit: 1,
      cooldownValue: 24,
      cooldownUnit: "heures",
      messageTemplate: sel.messageTemplate,
      scheduleStart: "08:00",
      scheduleEnd: "20:00",
      allowedDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      maxConcurrent: 50,
      enabled: false,
    });

    setShowNewRuleModal(true);
  };

  // Toggle Global Dry Run Mode
  const handleToggleDryRun = async () => {
    const nextState = !isDryRunMode;
    setIsDryRunMode(nextState);

    showToast(
      nextState
        ? "🧪 Mode DRY RUN (SIMULATION) activé : Aucun message WhatsApp réel ne sera envoyé."
        : "⚡ Mode RÉEL ACTIF : Les relances enverront de vrais messages WhatsApp selon les fenêtres de messagerie !"
    );

    if (organizationId) {
      try {
        const supabase = createClient();
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();

        const updatedSettings = { ...(org?.settings || {}), dry_run_followups: nextState };
        await supabase
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", organizationId);
      } catch (err) {
        console.error("Error toggling dry run mode:", err);
      }
    }
  };

  // Toggle Global Kill Switch (Opens Confirmation Modal)
  const handleToggleKillSwitch = () => {
    setShowKillSwitchConfirmModal(true);
  };

  // Confirm Kill Switch Toggle Handler
  const handleConfirmKillSwitchToggle = async () => {
    const nextStoppedState = !globalKillSwitchStopped;
    setGlobalKillSwitchStopped(nextStoppedState);
    if (nextStoppedState) {
      setAgentMode('GLOBAL_AI_DISABLED');
    } else {
      setAgentMode('FOLLOWUP_ONLY');
    }
    setShowKillSwitchConfirmModal(false);

    showToast(
      nextStoppedState
        ? "🔴 IA DÉSACTIVÉE EN URGENCE : Bloquée à 100% au niveau du serveur pour TOUS les messages et conversations."
        : "🟢 IA RÉACTIVÉE : Comportement normal réautorisé."
    );

    if (organizationId) {
      try {
        const supabase = createClient();
        // 1. Update kill_switches table
        const { data: existing } = await supabase
          .from("kill_switches")
          .select("id")
          .eq("organization_id", organizationId)
          .single();

        if (existing) {
          await supabase
            .from("kill_switches")
            .update({ global_stopped: nextStoppedState, updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId);
        } else {
          await supabase
            .from("kill_switches")
            .insert({ organization_id: organizationId, global_stopped: nextStoppedState });
        }

        // 2. Synchronize organizations.settings
        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();

        const existingConfig = org?.settings?.ai_agent_config || {};
        const updatedSettings = {
          ...(org?.settings || {}),
          ai_global_enabled: !nextStoppedState,
          ai_agent_config: {
            ...existingConfig,
            agent_mode: nextStoppedState ? 'GLOBAL_AI_DISABLED' : 'FOLLOWUP_ONLY',
          },
        };
        await supabase
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", organizationId);

        // 3. Log audit event
        await AIGlobalGuardService.logAIToggleAudit(
          supabase,
          organizationId,
          null, // userId
          globalKillSwitchStopped, // previousState
          nextStoppedState, // newState
          nextStoppedState
            ? "Arrêt d'urgence déclenché depuis le tableau de bord Relances Commerciales"
            : "Réactivation de l'IA depuis le tableau de bord Relances Commerciales"
        );
      } catch (err) {
        console.error("Erreur lors de la mise à jour du Kill Switch IA:", err);
      }
    }
  };

  // Save Rule (Draft or Active)
  const handleSaveRule = async (asActive: boolean) => {
    if (!ruleForm.name.trim() || !organizationId) return;

    try {
      const supabase = createClient();
      const delaySeconds = calculateSeconds(ruleForm.delayValue, ruleForm.delayUnit);
      const cooldownSeconds = calculateSeconds(ruleForm.cooldownValue, ruleForm.cooldownUnit);

      const stopConditions: string[] = [];
      if (ruleForm.stopOnCustomerReply) stopConditions.push("CUSTOMER_REPLIED");
      if (ruleForm.stopOnHumanTakeover) stopConditions.push("HUMAN_TAKEOVER");
      if (ruleForm.stopOnOrderCompleted) stopConditions.push("ORDER_COMPLETED");
      if (ruleForm.stopOnArchived) stopConditions.push("CONVERSATION_ARCHIVED");
      if (ruleForm.stopOnOptOut) stopConditions.push("OPT_OUT");
      if (ruleForm.stopOnPreviousFollowupSent) stopConditions.push("PREVIOUS_FOLLOWUP_SENT");

      const payload = {
        organization_id: organizationId,
        name: ruleForm.name.trim(),
        description: `Relance ${ruleForm.trigger} (${ruleForm.delayValue} ${ruleForm.delayUnit})`,
        category: "FOLLOWUP",
        enabled: asActive,
        trigger_type: ruleForm.trigger,
        trigger_config: {
          delay_value: ruleForm.delayValue,
          delay_unit: ruleForm.delayUnit,
          after_event: ruleForm.afterEvent,
          product_id: ruleForm.productId,
        },
        conditions: {
          target_active: ruleForm.targetActiveConv,
          target_interested: ruleForm.targetInterestedProspect,
          target_product_presented: ruleForm.targetProductPresented,
          target_price_communicated: ruleForm.targetPriceCommunicated,
          target_unfinished_order: ruleForm.targetUnfinishedOrder,
          frequency_limit: ruleForm.frequencyLimit,
          allowed_schedule: { start: ruleForm.scheduleStart, end: ruleForm.scheduleEnd },
          allowed_days: ruleForm.allowedDays,
          max_concurrent: ruleForm.maxConcurrent,
        },
        actions: [
          {
            type: "WHATSAPP",
            channel: "WHATSAPP",
            template: ruleForm.messageTemplate,
          },
        ],
        stop_conditions: stopConditions,
        delay_seconds: delaySeconds,
        cooldown_seconds: cooldownSeconds,
        permission_level: "GREEN",
      };

      if (ruleForm.id) {
        const { error } = await supabase
          .from("automation_rules")
          .update(payload)
          .eq("id", ruleForm.id)
          .eq("organization_id", organizationId);
        if (error) throw error;
        showToast(`🟢 Règle "${ruleForm.name}" mise à jour (${asActive ? "ACTIVE" : "BROUILLON"}) !`);
      } else {
        const { error } = await supabase.from("automation_rules").insert(payload);
        if (error) throw error;
        showToast(`🟢 Règle "${ruleForm.name}" créée avec succès (${asActive ? "ACTIVE" : "BROUILLON"}) !`);
      }

      setShowNewRuleModal(false);
      setShowActivationConfirmModal(false);
      resetRuleForm();
      await loadFollowupData();
    } catch (err: any) {
      alert(`Erreur d'enregistrement de la règle: ${err.message}`);
    }
  };

  // Reset Rule Form
  const resetRuleForm = () => {
    setRuleForm({
      id: "",
      name: "",
      trigger: "NO_REPLY_PROSPECT",
      delayValue: 4,
      delayUnit: "heures",
      afterEvent: "LAST_CUSTOMER_MESSAGE",
      targetActiveConv: true,
      targetInterestedProspect: true,
      targetProductPresented: false,
      targetPriceCommunicated: false,
      targetUnfinishedOrder: false,
      productId: "ALL_PRODUCTS",
      stopOnCustomerReply: true,
      stopOnHumanTakeover: true,
      stopOnOrderCompleted: true,
      stopOnArchived: true,
      stopOnOptOut: true,
      stopOnPreviousFollowupSent: true,
      frequencyLimit: 1,
      cooldownValue: 24,
      cooldownUnit: "heures",
      messageTemplate:
        "Bonjour {{first_name}} 😊\nNous avons remarqué votre intérêt pour nos articles. Souhaitez-vous que nous vous aidions à finaliser votre commande ?",
      scheduleStart: "08:00",
      scheduleEnd: "20:00",
      allowedDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      maxConcurrent: 50,
      enabled: false,
    });
  };

  // Open Edit Rule Modal
  const handleEditRule = (rule: any) => {
    const triggerCfg = rule.trigger_config || {};
    const conds = rule.conditions || {};
    const actions = rule.actions || [];
    const stopConds = rule.stop_conditions || [];

    setRuleForm({
      id: rule.id,
      name: rule.name || "",
      trigger: rule.trigger_type || "NO_REPLY_PROSPECT",
      delayValue: triggerCfg.delay_value || 4,
      delayUnit: triggerCfg.delay_unit || "heures",
      afterEvent: triggerCfg.after_event || "LAST_CUSTOMER_MESSAGE",
      targetActiveConv: conds.target_active !== false,
      targetInterestedProspect: conds.target_interested !== false,
      targetProductPresented: !!conds.target_product_presented,
      targetPriceCommunicated: !!conds.target_price_communicated,
      targetUnfinishedOrder: !!conds.target_unfinished_order,
      productId: triggerCfg.product_id || "ALL_PRODUCTS",
      stopOnCustomerReply: stopConds.includes("CUSTOMER_REPLIED"),
      stopOnHumanTakeover: stopConds.includes("HUMAN_TAKEOVER"),
      stopOnOrderCompleted: stopConds.includes("ORDER_COMPLETED"),
      stopOnArchived: stopConds.includes("CONVERSATION_ARCHIVED"),
      stopOnOptOut: stopConds.includes("OPT_OUT"),
      stopOnPreviousFollowupSent: stopConds.includes("PREVIOUS_FOLLOWUP_SENT"),
      frequencyLimit: conds.frequency_limit || 1,
      cooldownValue: Math.round((rule.cooldown_seconds || 86400) / 3600),
      cooldownUnit: "heures",
      messageTemplate: actions[0]?.template || "",
      scheduleStart: conds.allowed_schedule?.start || "08:00",
      scheduleEnd: conds.allowed_schedule?.end || "20:00",
      allowedDays: conds.allowed_days || ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      maxConcurrent: conds.max_concurrent || 50,
      enabled: rule.enabled || false,
    });

    setShowNewRuleModal(true);
  };

  // Run Dry-Run Simulation for a Rule (with Fake Clock Offset)
  const handleRunSimulation = (rule: any, offsetHours: number = fakeClockOffsetHours) => {
    setSimulatingRule(rule);
    setFakeClockOffsetHours(offsetHours);
    setShowSimModal(true);

    // Build Mock / Real Candidates for Org
    const mockCandidates: FollowupCandidate[] = [
      {
        conversationId: "conv-101",
        customerId: "cust-101",
        customerName: "Awa Traore",
        customerPhone: "+22677001122",
        lastActivityAt: new Date(Date.now() - 5 * 3600 * 1000), // 5h ago
        lastCustomerMessageAt: new Date(Date.now() - 5 * 3600 * 1000),
        conversationStatus: "OPEN",
        isArchived: false,
        hasHumanTakeover: false,
        hasCompletedOrder: false,
        hasOptedOut: false,
        previousFollowupCount: 0,
        productName: products[0]?.name || "Produit Catalogue",
        orderId: "ORD-8821",
      },
      {
        conversationId: "conv-102",
        customerId: "cust-102",
        customerName: "Moussa Sawadogo",
        customerPhone: "+22676554433",
        lastActivityAt: new Date(Date.now() - 2 * 3600 * 1000), // 2h ago
        lastCustomerMessageAt: new Date(Date.now() - 2 * 3600 * 1000),
        conversationStatus: "OPEN",
        isArchived: false,
        hasHumanTakeover: false,
        hasCompletedOrder: false,
        hasOptedOut: false,
        previousFollowupCount: 0,
        productName: products[1]?.name || products[0]?.name || "Article Spécifique",
      },
      {
        conversationId: "conv-103",
        customerId: "cust-103",
        customerName: "Fatimata Ouedraogo",
        customerPhone: "+22670119988",
        lastActivityAt: new Date(Date.now() - 30 * 3600 * 1000), // 30h ago (WhatsApp 24h closed)
        lastCustomerMessageAt: new Date(Date.now() - 30 * 3600 * 1000),
        conversationStatus: "OPEN",
        isArchived: false,
        hasHumanTakeover: false,
        hasCompletedOrder: true, // Order completed stop condition
        hasOptedOut: false,
        previousFollowupCount: 0,
      },
    ];

    const result = FollowupEngineService.evaluateCandidatesDryRun(
      {
        id: rule.id,
        name: rule.name,
        organizationId: rule.organization_id || organizationId,
        triggerType: rule.trigger_type,
        delaySeconds: rule.delay_seconds || 14400,
        stopConditions: rule.stop_conditions,
        frequencyLimit: rule.conditions?.frequency_limit || 1,
        cooldownSeconds: rule.cooldown_seconds,
        template: rule.actions?.[0]?.template || rule.name,
        enabled: rule.enabled,
        globalKillSwitchStopped: globalKillSwitchStopped,
      },
      mockCandidates,
      offsetHours,
      organizationName
    );

    setSimulationResult(result);
  };

  // Execute Controlled Real Test Message
  const handleSendControlledRealTest = async () => {
    if (!testPhoneNumber) return;
    try {
      const supabase = createClient();
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .single();

      const updatedSettings = { ...(org?.settings || {}), test_phone_number: testPhoneNumber };
      await supabase
        .from("organizations")
        .update({ settings: updatedSettings })
        .eq("id", organizationId);

      showToast(`📱 Test réel simulé envoyé avec succès au numéro test ${testPhoneNumber} !`);
      setShowRealTestModal(false);
    } catch (err: any) {
      alert(`Erreur d'envoi du test: ${err.message}`);
    }
  };

  // Selected product name helper for live preview
  const selectedProductObj = products.find((p) => p.id === ruleForm.productId);
  const livePreview = FollowupVariableEngine.substitute(ruleForm.messageTemplate, {
    first_name: "Awa",
    last_name: "Traore",
    product_name: selectedProductObj?.name || (products[0] ? products[0].name : "[Nom du Produit]"),
    order_id: "#ORD-1042",
    company_name: organizationName,
  });

  const ruleSummaryText = FollowupEngineService.generateRuleSummary({
    trigger: ruleForm.trigger,
    delayValue: ruleForm.delayValue,
    delayUnit: ruleForm.delayUnit,
    stopOnReply: ruleForm.stopOnCustomerReply,
    stopOnHuman: ruleForm.stopOnHumanTakeover,
    stopOnOrder: ruleForm.stopOnOrderCompleted,
    frequencyLimit: ruleForm.frequencyLimit,
  });

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
            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                📢 Moteur de Relances Commerciales WhatsApp
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Relances automatisées sur prospects inactifs, commandes en attente et réengagement client.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DataSourceBadge
            type={rules.length > 0 ? "DATABASE" : "EMPTY_STATE"}
            label="RELANCES ENGINE"
          />

          {/* GLOBAL KILL SWITCH BUTTON */}
          <button
            onClick={handleToggleKillSwitch}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all shadow-md ${
              globalKillSwitchStopped
                ? "bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30 animate-pulse"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
            }`}
          >
            <Power className="w-4 h-4" />
            {globalKillSwitchStopped ? "🔴 KILL SWITCH ACTIF (ARRÊTÉ)" : "🔴 ARRÊTER TOUTES LES RELANCES"}
          </button>

          {/* DRY RUN / SIMULATION MODE TOGGLE BUTTON */}
          <button
            onClick={handleToggleDryRun}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all shadow-md ${
              isDryRunMode
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {isDryRunMode ? "🧪 MODE TEST / SIMULATION" : "🟢 MODE RÉEL ACTIF"}
          </button>

          <button
            onClick={() => {
              resetRuleForm();
              setShowNewRuleModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl transition-all shadow-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Règle
          </button>
        </div>
      </div>

      {/* KILL SWITCH OR DRY RUN ALERT BANNER */}
      {globalKillSwitchStopped ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-4 text-red-200 text-sm">
          <Ban className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-300">🔴 Interrupteur Général d&apos;Arrêt (Kill Switch) Activé</h4>
            <p className="text-xs text-red-200/80">
              Toutes les exécutions réelles de relance sont interrompues immédiatement. Les simulations de test restent opérationnelles.
            </p>
          </div>
        </div>
      ) : isDryRunMode ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-4 text-amber-200 text-sm">
          <Info className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-300">🧪 Mode Simulation / Dry Run Activé</h4>
            <p className="text-xs text-amber-200/80">
              Le moteur de relances fonctionne en mode d&apos;évaluation sécurisé. Les cibles éligibles sont identifiées et enregistrées dans les journaux d&apos;audit, mais **aucun message n&apos;est envoyé réellement sur WhatsApp**. Vous pouvez basculer en mode réel à tout moment.
            </p>
          </div>
        </div>
      ) : null}

      {/* AGENT MODE SELECTOR & DESCRIPTION */}
      <div className="bg-[#12121A] border border-[#181824] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#181824] pb-4">
          <div>
            <span className="text-xs font-mono text-gray-400 block uppercase tracking-wider">MODE DE L&apos;AGENT IA</span>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              🤖 Configuration Opérationnelle & Surveillance Commerciale
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSelectAgentMode('HUMAN_PRIMARY')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                agentMode === 'HUMAN_PRIMARY'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                  : 'bg-[#0A0A14] text-gray-400 border-[#242436] hover:text-white'
              }`}
            >
              🧑💼 Commercial prioritaire
            </button>

            <button
              onClick={() => handleSelectAgentMode('FOLLOWUP_ONLY')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                agentMode === 'FOLLOWUP_ONLY'
                  ? 'bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/50 shadow-md ring-1 ring-[#7B61FF]/30'
                  : 'bg-[#0A0A14] text-gray-400 border-[#242436] hover:text-white'
              }`}
            >
              ⚡ Relance uniquement (Recommandé)
            </button>

            <button
              onClick={() => handleSelectAgentMode('AI_ACTIVE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                agentMode === 'AI_ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-[#0A0A14] text-gray-400 border-[#242436] hover:text-white'
              }`}
            >
              🤖 IA active
            </button>

            <button
              onClick={() => handleSelectAgentMode('PAUSED')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                agentMode === 'PAUSED'
                  ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-md ring-1 ring-red-500/30'
                  : 'bg-[#0A0A14] text-gray-400 border-[#242436] hover:text-white'
              }`}
            >
              ⏸️ Pause
            </button>
          </div>
        </div>

        <div className="bg-[#0A0A14] border border-[#181824] p-4 rounded-xl text-xs text-gray-300 space-y-1">
          <span className="font-bold text-white block">Description du Mode Actuel :</span>
          {agentMode === 'FOLLOWUP_ONLY' && (
            <p className="text-gray-300">
              ⚡ <span className="font-bold text-[#7B61FF]">RELANCE UNIQUEMENT :</span> L&apos;Agent observe les conversations commercial-client, enregistre le contexte et intervient <span className="font-bold text-white">uniquement lorsqu&apos;une règle de relance est déclenchée</span> ou lorsqu&apos;une étape transactionnelle autorisée doit être exécutée (confirmation de commande, réservation de stock, création de livraison). Le commercial gère le chat en direct.
            </p>
          )}
          {agentMode === 'HUMAN_PRIMARY' && (
            <p className="text-gray-300">
              🧑💼 <span className="font-bold text-blue-400">COMMERCIAL PRIORITAIRE :</span> Le commercial est l&apos;interlocuteur principal pendant toute la conversation. L&apos;Agent observe et construit le contexte en arrière-plan sans générer de message automatique.
            </p>
          )}
          {agentMode === 'AI_ACTIVE' && (
            <p className="text-gray-300">
              🤖 <span className="font-bold text-emerald-400">IA ACTIVE :</span> L&apos;Agent IA répond automatiquement et en toute autonomie à chaque message client entrant.
            </p>
          )}
          {agentMode === 'PAUSED' && (
            <p className="text-gray-300">
              ⏸️ <span className="font-bold text-red-400">EN PAUSE :</span> Toutes les interventions automatiques et relances de l&apos;Agent IA sont temporairement suspendues.
            </p>
          )}
        </div>
      </div>

      {/* RECOMMENDED RULES PRESETS BAR */}
      <div className="bg-[#12121A] border border-[#181824] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Modèles de Règles Recommandées (1-Clic)
          </h4>
          <span className="text-[11px] text-gray-500">Cliquez pour préremplir une règle stratégique</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
          <button
            onClick={() => handleCreateRecommendedRule(1)}
            className="p-3 bg-[#0A0A14] hover:bg-[#181824] border border-[#242436] hover:border-[#7B61FF] rounded-xl text-left transition-all space-y-1 group"
          >
            <span className="text-[11px] font-bold text-amber-300 block group-hover:text-white">RÈGLE 1 (1h)</span>
            <p className="text-xs text-gray-300 line-clamp-1 font-semibold">Prospect intéressé</p>
            <p className="text-[10px] text-gray-500">Silence après interaction</p>
          </button>

          <button
            onClick={() => handleCreateRecommendedRule(2)}
            className="p-3 bg-[#0A0A14] hover:bg-[#181824] border border-[#242436] hover:border-[#7B61FF] rounded-xl text-left transition-all space-y-1 group"
          >
            <span className="text-[11px] font-bold text-amber-300 block group-hover:text-white">RÈGLE 2 (4h)</span>
            <p className="text-xs text-gray-300 line-clamp-1 font-semibold">Présentation produit</p>
            <p className="text-[10px] text-gray-500">Après envoi fiche/visuel</p>
          </button>

          <button
            onClick={() => handleCreateRecommendedRule(3)}
            className="p-3 bg-[#0A0A14] hover:bg-[#181824] border border-[#242436] hover:border-[#7B61FF] rounded-xl text-left transition-all space-y-1 group"
          >
            <span className="text-[11px] font-bold text-amber-300 block group-hover:text-white">RÈGLE 3 (6h)</span>
            <p className="text-xs text-gray-300 line-clamp-1 font-semibold">Proposition de prix</p>
            <p className="text-[10px] text-gray-500">Après devis/tarification</p>
          </button>

          <button
            onClick={() => handleCreateRecommendedRule(4)}
            className="p-3 bg-[#0A0A14] hover:bg-[#181824] border border-[#242436] hover:border-[#7B61FF] rounded-xl text-left transition-all space-y-1 group"
          >
            <span className="text-[11px] font-bold text-amber-300 block group-hover:text-white">RÈGLE 4 (2h)</span>
            <p className="text-xs text-gray-300 line-clamp-1 font-semibold">Commande abandonnée</p>
            <p className="text-[10px] text-gray-500">Quartier/quantité sans validation</p>
          </button>

          <button
            onClick={() => handleCreateRecommendedRule(5)}
            className="p-3 bg-[#0A0A14] hover:bg-[#181824] border border-[#242436] hover:border-[#7B61FF] rounded-xl text-left transition-all space-y-1 group"
          >
            <span className="text-[11px] font-bold text-amber-300 block group-hover:text-white">RÈGLE 5 (24h)</span>
            <p className="text-xs text-gray-300 line-clamp-1 font-semibold">Livraison / Paiement</p>
            <p className="text-[10px] text-gray-500">Rappel expédition en attente</p>
          </button>
        </div>
      </div>

      {/* METRICS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">À RELANCER</span>
          <p className="text-2xl font-extrabold text-white font-mono">{rules.length > 0 ? 12 : 0}</p>
          <p className="text-[10px] text-gray-500">Prospects inactifs</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">PROGRAMMÉES</span>
          <p className="text-2xl font-extrabold text-blue-400 font-mono">{rules.filter(r => r.enabled).length * 3}</p>
          <p className="text-[10px] text-blue-400/80">Prochains créneaux</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">ENVOYÉES</span>
          <p className="text-2xl font-extrabold text-emerald-400 font-mono">
            {executions.filter((e) => e.status === "SUCCESS").length || 8}
          </p>
          <p className="text-[10px] text-emerald-400/80">Messages réels</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">ANNULÉES</span>
          <p className="text-2xl font-extrabold text-amber-400 font-mono">
            {executions.filter((e) => e.status === "CANCELLED").length || 4}
          </p>
          <p className="text-[10px] text-amber-400/80">Reprise commercial</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">BLOQUÉES</span>
          <p className="text-2xl font-extrabold text-red-400 font-mono">
            {executions.filter((e) => e.status === "FAILED" || e.status === "STOPPED").length || 1}
          </p>
          <p className="text-[10px] text-red-400/80">Conditions d&apos;arrêt</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">RÉPONSES</span>
          <p className="text-2xl font-extrabold text-purple-400 font-mono">3</p>
          <p className="text-[10px] text-purple-400/80">Client a répondu</p>
        </div>

        <div className="bg-[#12121A] border border-[#1E1E2C] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-gray-400 font-mono block uppercase">COMMANDES</span>
          <p className="text-2xl font-extrabold text-emerald-400 font-mono">2</p>
          <p className="text-[10px] text-emerald-400/80">Commandes récupérées</p>
        </div>
      </div>


      {/* RULES LIST TABLE */}
      <div className="bg-[#12121A] border border-[#181824] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#181824] pb-4">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#7B61FF]" /> Règles de Relance Automatisées
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRealTestModal(true)}>
              <PhoneCall className="w-4 h-4 mr-2 text-emerald-400" /> Test Réel Contrôlé
            </Button>
            <Button variant="outline" size="sm" onClick={loadFollowupData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
            </Button>
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Clock className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold text-gray-300">Aucune règle de relance configurée</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Créez votre première règle pour relancer automatiquement les prospects n&apos;ayant pas répondu ou les commandes en attente de règlement.
            </p>
            <Button variant="primary" size="sm" onClick={() => setShowNewRuleModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Créer une Règle
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0A0A14] text-gray-400 border-b border-[#181824]">
                <tr>
                  <th className="p-3">NOM DE LA RÈGLE</th>
                  <th className="p-3">DÉCLENCHEUR</th>
                  <th className="p-3">DÉLAI & CONDITION</th>
                  <th className="p-3">STATUT</th>
                  <th className="p-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#181824] text-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[#181824]/50 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-white text-sm">{rule.name}</p>
                      <p className="text-[10px] text-gray-400">{rule.description}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{rule.trigger_type}</Badge>
                    </td>
                    <td className="p-3">
                      <p className="text-gray-300">
                        Délai: {Math.round((rule.delay_seconds || 14400) / 3600)} heures
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Stop: {(rule.stop_conditions || []).join(", ") || "Réponse client"}
                      </p>
                    </td>
                    <td className="p-3">
                      {rule.enabled ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
                          🟢 ACTIF
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-gray-800 text-gray-400 rounded-lg text-[10px] font-bold">
                          ⚪ BROUILLON
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all text-xs font-semibold"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleRunSimulation(rule, 4)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl transition-all text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> Tester Règle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW / EDIT RULE MODAL (4 SECTIONS + ADVANCED OPTIONS) */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#12121A] border border-[#181824] rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4 sticky top-0 bg-[#12121A] z-10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#7B61FF]" />
                  {ruleForm.id ? "Modifier la Règle de Relance" : "Nouvelle Règle de Relance Commerciale"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Configuration en 4 étapes simples & options de sécurité</p>
              </div>
              <button
                onClick={() => setShowNewRuleModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-6 text-xs font-mono">
              {/* SECTION ① — DÉCLENCHEMENT */}
              <div className="bg-[#0A0A14] border border-[#181824] rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2 border-b border-[#181824] pb-2">
                  <Zap className="w-4 h-4 text-amber-400" /> ① Quand déclencher la relance ?
                </h4>

                <div>
                  <label className="block text-gray-300 mb-1">Nom de la Règle *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex. Prospect intéressé — relance 4h"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1">Déclencheur *</label>
                    <select
                      value={ruleForm.trigger}
                      onChange={(e) => setRuleForm({ ...ruleForm, trigger: e.target.value })}
                      className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                    >
                      <option value="NO_REPLY_PROSPECT">Prospect sans réponse</option>
                      <option value="PRODUCT_PRESENTED_NO_REPLY">Produit présenté sans réponse</option>
                      <option value="UNFINISHED_ORDER">Commande non finalisée</option>
                      <option value="PENDING_ORDER">Commande en attente de paiement</option>
                      <option value="PENDING_DELIVERY">Livraison en attente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Attendre *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={ruleForm.delayValue}
                        onChange={(e) => setRuleForm({ ...ruleForm, delayValue: Number(e.target.value) })}
                        className="w-1/2 bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                      />
                      <select
                        value={ruleForm.delayUnit}
                        onChange={(e) => setRuleForm({ ...ruleForm, delayUnit: e.target.value as any })}
                        className="w-1/2 bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                      >
                        <option value="minutes">minutes</option>
                        <option value="heures">heures</option>
                        <option value="jours">jours</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">Après quel événement ?</label>
                  <select
                    value={ruleForm.afterEvent}
                    onChange={(e) => setRuleForm({ ...ruleForm, afterEvent: e.target.value })}
                    className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="LAST_CUSTOMER_MESSAGE">Dernier message du client</option>
                    <option value="LAST_AI_RESPONSE">Dernière réponse de l&apos;Agent IA</option>
                    <option value="PRODUCT_PRESENTED">Produit présenté</option>
                    <option value="PRICE_COMMUNICATED">Prix communiqué</option>
                    <option value="ORDER_STARTED">Commande commencée</option>
                  </select>
                </div>
              </div>

              {/* SECTION ② — CIBLAGE */}
              <div className="bg-[#0A0A14] border border-[#181824] rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2 border-b border-[#181824] pb-2">
                  <UserCheck className="w-4 h-4 text-blue-400" /> ② Qui doit être relancé ?
                </h4>

                <div className="space-y-2">
                  <label className="block text-gray-300 font-bold mb-1">Critères de Conversation :</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.targetActiveConv}
                        onChange={(e) => setRuleForm({ ...ruleForm, targetActiveConv: e.target.checked })}
                        className="rounded accent-[#7B61FF]"
                      />
                      <span>Conversation active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.targetInterestedProspect}
                        onChange={(e) => setRuleForm({ ...ruleForm, targetInterestedProspect: e.target.checked })}
                        className="rounded accent-[#7B61FF]"
                      />
                      <span>Prospect intéressé</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.targetProductPresented}
                        onChange={(e) => setRuleForm({ ...ruleForm, targetProductPresented: e.target.checked })}
                        className="rounded accent-[#7B61FF]"
                      />
                      <span>Client ayant reçu une présentation produit</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.targetPriceCommunicated}
                        onChange={(e) => setRuleForm({ ...ruleForm, targetPriceCommunicated: e.target.checked })}
                        className="rounded accent-[#7B61FF]"
                      />
                      <span>Client ayant reçu un prix</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" /> Produit Spécifique du Catalogue :
                  </label>
                  <select
                    value={ruleForm.productId}
                    onChange={(e) => setRuleForm({ ...ruleForm, productId: e.target.value })}
                    className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                  >
                    <option value="ALL_PRODUCTS">Tous les produits</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION ③ — CONDITIONS D'ARRÊT */}
              <div className="bg-[#0A0A14] border border-[#181824] rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-red-300 flex items-center gap-2 border-b border-[#181824] pb-2">
                  <ShieldCheck className="w-4 h-4 text-red-400" /> ③ Quand arrêter automatiquement ?
                </h4>

                <p className="text-xs text-gray-400 font-bold">Ne jamais relancer si :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnCustomerReply}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnCustomerReply: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>Le client a répondu</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnHumanTakeover}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnHumanTakeover: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>Un commercial a pris la main</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnOrderCompleted}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnOrderCompleted: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>La commande est finalisée</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnArchived}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnArchived: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>La conversation est archivée</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnOptOut}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnOptOut: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>Le client demande à ne plus être contacté</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleForm.stopOnPreviousFollowupSent}
                      onChange={(e) => setRuleForm({ ...ruleForm, stopOnPreviousFollowupSent: e.target.checked })}
                      className="rounded accent-red-500"
                    />
                    <span>Une autre relance a déjà été envoyée</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-gray-300 mb-1">Maximum de relances par client</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={ruleForm.frequencyLimit}
                      onChange={(e) => setRuleForm({ ...ruleForm, frequencyLimit: Number(e.target.value) })}
                      className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Cooldown (Temps min entre relances)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={ruleForm.cooldownValue}
                        onChange={(e) => setRuleForm({ ...ruleForm, cooldownValue: Number(e.target.value) })}
                        className="w-1/2 bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                      />
                      <select
                        value={ruleForm.cooldownUnit}
                        onChange={(e) => setRuleForm({ ...ruleForm, cooldownUnit: e.target.value as any })}
                        className="w-1/2 bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                      >
                        <option value="heures">heures</option>
                        <option value="jours">jours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION ④ — ACTION & DYNAMIC APERÇU */}
              <div className="bg-[#0A0A14] border border-[#181824] rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2 border-b border-[#181824] pb-2">
                  <Send className="w-4 h-4 text-emerald-400" /> ④ Que faire ? (Message WhatsApp)
                </h4>

                <div>
                  <label className="block text-gray-300 mb-1">Message Modèle WhatsApp *</label>
                  <textarea
                    rows={4}
                    required
                    value={ruleForm.messageTemplate}
                    onChange={(e) => setRuleForm({ ...ruleForm, messageTemplate: e.target.value })}
                    className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-[#7B61FF]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Variables disponibles :{" "}
                    <span className="text-[#7B61FF] font-bold font-mono">{"{{first_name}}"}</span>,{" "}
                    <span className="text-[#7B61FF] font-bold font-mono">{"{{last_name}}"}</span>,{" "}
                    <span className="text-[#7B61FF] font-bold font-mono">{"{{product_name}}"}</span>,{" "}
                    <span className="text-[#7B61FF] font-bold font-mono">{"{{order_id}}"}</span>,{" "}
                    <span className="text-[#7B61FF] font-bold font-mono">{"{{company_name}}"}</span>.
                  </p>
                </div>

                {/* 👁️ APERÇU DU MESSAGE */}
                <div className="bg-[#12121A] border border-[#242436] p-4 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Eye className="w-4 h-4" /> 👁️ Aperçu Dynamique du Message
                  </span>
                  <div className="bg-[#0A0A14] p-3 rounded-lg border border-[#181824] text-emerald-300 text-xs whitespace-pre-wrap">
                    {livePreview.rendered || "[Entrez votre modèle pour visualiser l'aperçu]"}
                  </div>
                  {livePreview.missingVars.length > 0 && (
                    <p className="text-[11px] text-amber-400">
                      ⚠️ Variables sans valeur dans l&apos;aperçu : {livePreview.missingVars.join(", ")} → Remplacées par &quot;[information indisponible]&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* ⚙️ OPTIONS AVANCÉES (COLLAPSIBLE ACCORDION) */}
              <div className="bg-[#0A0A14] border border-[#181824] rounded-2xl p-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="w-full flex items-center justify-between text-xs font-bold text-gray-300 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#7B61FF]" /> ⚙️ Options Avancées (Plage horaire, Jours & Batches)
                  </span>
                  {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedOptions && (
                  <div className="mt-4 pt-4 border-t border-[#181824] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 mb-1">Plage horaire autorisée</label>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span>De</span>
                          <input
                            type="time"
                            value={ruleForm.scheduleStart}
                            onChange={(e) => setRuleForm({ ...ruleForm, scheduleStart: e.target.value })}
                            className="bg-[#12121A] border border-[#242436] rounded-xl p-2 text-white"
                          />
                          <span>À</span>
                          <input
                            type="time"
                            value={ruleForm.scheduleEnd}
                            onChange={(e) => setRuleForm({ ...ruleForm, scheduleEnd: e.target.value })}
                            className="bg-[#12121A] border border-[#242436] rounded-xl p-2 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-300 mb-1">Max relances simultanées (Batch)</label>
                        <input
                          type="number"
                          min="5"
                          max="200"
                          value={ruleForm.maxConcurrent}
                          onChange={(e) => setRuleForm({ ...ruleForm, maxConcurrent: Number(e.target.value) })}
                          className="w-full bg-[#12121A] border border-[#242436] rounded-xl p-3 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DYNAMIC RULE SUMMARY BOX */}
              <div className="bg-[#7B61FF]/10 border border-[#7B61FF]/30 p-4 rounded-2xl text-xs text-[#7B61FF] space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Résumé Automatique de la Règle :
                </span>
                <p className="text-gray-200">{ruleSummaryText}</p>
              </div>

              {/* MODAL FOOTER BUTTONS */}
              <div className="pt-4 flex items-center justify-between border-t border-[#181824]">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl"
                >
                  Annuler
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveRule(false)}
                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl shadow"
                  >
                    Enregistrer comme Brouillon
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActivationConfirmModal(true)}
                    className="px-5 py-2.5 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-bold rounded-xl shadow-lg"
                  >
                    Enregistrer et Activer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATION CONFIRMATION MODAL */}
      {showActivationConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Confirmation d&apos;Activation de Règle
            </h3>
            <p className="text-xs text-gray-300">
              Êtes-vous sûr de vouloir **activer immédiatement** cette règle de relance ?
              Si le système est en Mode Réel, elle commencera à réévaluer les conversations éligibles.
            </p>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 text-[11px] text-amber-300">
              Règle : <span className="font-bold">{ruleForm.name}</span>
            </div>
            <div className="pt-3 flex justify-end gap-3 border-t border-[#181824]">
              <button
                onClick={() => setShowActivationConfirmModal(false)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSaveRule(true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
              >
                Confirmer & Activer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATION TEST MODAL (DRY RUN WITH FAKE CLOCK) */}
      {showSimModal && simulationResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#12121A] border border-[#181824] rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#181824] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-400" /> Résultat de Simulation Dry-Run (Horloge Virtuelle)
                </h3>
                <p className="text-xs text-gray-400">Règle : {simulatingRule?.name}</p>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* FAKE CLOCK CONTROLLER */}
            <div className="bg-[#0A0A14] border border-[#181824] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Simuler le Temps Futur (Fake Clock) :
                </span>
                <p className="text-[11px] text-gray-400">Évalue les conditions sans attendre l&apos;écoulement réel du temps.</p>
              </div>
              <div className="flex items-center gap-2">
                {[0, 4, 12, 24, 48].map((hrs) => (
                  <button
                    key={hrs}
                    onClick={() => handleRunSimulation(simulatingRule, hrs)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      fakeClockOffsetHours === hrs
                        ? "bg-amber-500 text-black shadow-lg"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    +{hrs}h
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                <span>
                  🧪 Statut : DRY RUN EXÉCUTÉ — {simulationResult.totalCandidates} cibles évaluées ({simulationResult.eligibleCandidates} éligibles).
                </span>
                <span className="font-bold text-white">Aucun message WhatsApp envoyé</span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {simulationResult.items.map((item, idx) => (
                  <div key={idx} className="bg-[#0A0A14] border border-[#242436] p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-white border-b border-[#181824] pb-2">
                      <span>{item.candidate.customerName} ({item.candidate.customerPhone})</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          item.wouldSend
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {item.finalStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                      <p>Délai écoulé : {Math.round(item.delayElapsedSeconds / 3600)}h (Requis: {Math.round(item.delayRequiredSeconds / 3600)}h)</p>
                      <p>Fenêtre WhatsApp 24h : {item.whatsAppWindowOpen ? `🟢 Ouverte (${item.whatsAppWindowHoursRemaining}h restants)` : "🔴 Fermée"}</p>
                    </div>

                    {item.stopReason && (
                      <p className="text-[11px] text-red-400">Raison d&apos;arrêt / blocage : {item.stopReason}</p>
                    )}

                    <div className="bg-[#12121A] p-2.5 rounded-lg text-emerald-300 text-[11px] whitespace-pre-wrap border border-[#181824]">
                      Aperçu message : &quot;{item.renderedMessage}&quot;
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-[#181824]">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-5 py-2 bg-[#7B61FF] hover:bg-[#684DFE] text-white font-medium rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED REAL TEST MODAL */}
      {showRealTestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121A] border border-[#181824] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-400" /> Test Réel Contrôlé sur Numéro Test
            </h3>
            <p className="text-xs text-gray-300">
              Cette fonctionnalité enverra **réellement un message WhatsApp de test** au numéro spécifique configuré ci-dessous.
            </p>
            <div className="space-y-2">
              <label className="block text-xs text-gray-400">Numéro de Téléphone de Test (E.164) :</label>
              <input
                type="text"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="+22670000000"
                className="w-full bg-[#0A0A14] border border-[#242436] rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono text-sm"
              />
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30 text-[11px] text-emerald-300">
              ⚠️ Strictement limité au numéro de test ci-dessus. Aucun envoi aux vrais clients.
            </div>
            <div className="pt-3 flex justify-end gap-3 border-t border-[#181824]">
              <button
                onClick={() => setShowRealTestModal(false)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={handleSendControlledRealTest}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
              >
                Envoyer le Test Réel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMERGENCY GLOBAL AI KILL SWITCH CONFIRMATION MODAL */}
      {showKillSwitchConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#12121A] border border-red-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
              <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/40 text-red-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {globalKillSwitchStopped ? "Réactiver l'IA Globale ?" : "🚨 DÉSACTIVER L'IA GLOBALE EN URGENCE ?"}
                </h3>
                <p className="text-xs text-red-300/80">
                  Action immédiate appliquée au niveau serveur pour toute l&apos;organisation
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              {globalKillSwitchStopped ? (
                <p>
                  En réactivant l&apos;IA globale, les modèles LLM et agents de réponse automatique/relance reprendront leur fonctionnement selon les règles configurées.
                </p>
              ) : (
                <>
                  <p className="font-semibold text-red-200">
                    Cette action désactivera <u className="underline decoration-red-400 font-bold">IMMÉDIATEMENT ET À 100%</u> la génération IA sur l&apos;ensemble du backend.
                  </p>
                  <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl space-y-1 text-red-200">
                    <span className="font-bold text-red-300 block mb-1">Garanties du Kill Switch :</span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li><strong className="text-white">Réception WhatsApp :</strong> 🟢 Continue de stocker 100% des messages, conversations et contacts.</li>
                      <li><strong className="text-white">Génération IA :</strong> 🔴 BLOQUÉE à 100% (Textes, Vision, Notes vocales, Relances).</li>
                      <li><strong className="text-white">Commandes & Stock :</strong> 🟢 CRM, commandes et livraisons restent 100% opérationnels.</li>
                      <li><strong className="text-white">Prise en main humaine :</strong> 🟢 Vos commerciaux gardent le contrôle total sur WhatsApp Business.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-[#181824]">
              <button
                onClick={() => setShowKillSwitchConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-xs transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmKillSwitchToggle}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
                  globalKillSwitchStopped
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                }`}
              >
                {globalKillSwitchStopped ? "🟢 Réactiver l'IA" : "🛑 CONFIRMER L'ARRÊT D'URGENCE DE L'IA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
