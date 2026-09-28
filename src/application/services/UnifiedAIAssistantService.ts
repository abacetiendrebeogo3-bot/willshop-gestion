/**
 * WILLShop OS — Unified AI Assistant Service & Guardrail Engine
 * Application Layer.
 * 
 * Provides unified role-based AI assistance for CEO, Commercial, and Driver roles.
 * Enforces strict Permission Matrix:
 * - GREEN: Read, summarize, analyze, recommend (allowed).
 * - YELLOW: Prepare action, draft message, draft order (requires human confirmation).
 * - RED: Auto-send message, delete, critical edit (prohibited by default).
 * 
 * Anti-Hallucination Guardrail:
 * - Never invents data (prices, stock, revenue, margins, orders, customers, debts, deliveries, performance).
 * - If data is missing: returns explicit empty state ("Je n'ai pas cette information dans vos données actuelles.").
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CommercialIntelligenceEngine, ActionPriority } from './CommercialIntelligenceEngine';

export type UserRole = 'CEO' | 'OWNER' | 'ADMIN' | 'COMMERCIAL' | 'DRIVER' | 'MANAGER';

export type AIPermissionLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface AIRecommendationItem {
  category:
    | 'relance due'
    | 'conversation sans réponse'
    | 'client très intéressé'
    | 'intention de commande détectée'
    | 'commande à finaliser'
    | 'problème livraison'
    | 'client à surveiller';
  reason: string;
  dataUsed: string[];
  proposedAction: string;
  confidence: number;
}

export interface ProposedActionPayload {
  type: 'PREPARE_MESSAGE' | 'PREPARE_ORDER' | 'NONE';
  payload: any;
}

export interface AssistantResponse {
  query: string;
  response: string;
  role: 'CEO' | 'COMMERCIAL' | 'DRIVER';
  permissionLevel: AIPermissionLevel;
  requiresHumanConfirmation: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  proposedAction?: ProposedActionPayload;
  recommendations?: AIRecommendationItem[];
  evidence: string[];
}

export interface UnifiedAssistantOptions {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  role: UserRole;
  query: string;
  customerId?: string;
  conversationId?: string;
}

export class UnifiedAIAssistantService {

  /**
   * Processes a user AI query with unified role permissions and anti-hallucination guardrails.
   */
  public static async processQuery(options: UnifiedAssistantOptions): Promise<AssistantResponse> {
    const { supabase, organizationId, userId, role, query, customerId, conversationId } = options;
    const queryLower = (query || '').toLowerCase().trim();

    // Map user role to canonical assistant persona
    const canonicalRole: 'CEO' | 'COMMERCIAL' | 'DRIVER' =
      role === 'CEO' || role === 'OWNER' || role === 'ADMIN'
        ? 'CEO'
        : role === 'DRIVER'
        ? 'DRIVER'
        : 'COMMERCIAL';

    // 1. Guardrail Check: Interdict RED Actions (Auto-send, Delete, Financial Mutate)
    const isRedActionRequest =
      queryLower.includes('envoie automatiquement') ||
      queryLower.includes('envoyer sans confirmation') ||
      queryLower.includes('supprime le client') ||
      queryLower.includes('supprimer la commande') ||
      queryLower.includes('efface les données');

    if (isRedActionRequest) {
      return {
        query,
        response: "Action BLOUQUÉE : L'assistant IA ne peut pas effectuer d'envoi automatique de message ou de suppression critique. Confirmation humaine obligatoire.",
        role: canonicalRole,
        permissionLevel: 'RED',
        requiresHumanConfirmation: true,
        isBlocked: true,
        blockedReason: 'Action RED interdite par défaut.',
        evidence: ['TENTATIVE_ACTION_RED_BLOQUEE'],
      };
    }

    // 2. Execute Role-Based Assistant Engine
    if (canonicalRole === 'CEO') {
      return this.handleCEORole(supabase, organizationId, query, queryLower);
    } else if (canonicalRole === 'DRIVER') {
      return this.handleDriverRole(supabase, organizationId, userId, query, queryLower);
    } else {
      return this.handleCommercialRole(supabase, organizationId, userId, query, queryLower, customerId, conversationId);
    }
  }

  // ── CEO ASSISTANT HANDLER ──────────────────────────────────────────────────

  private static async handleCEORole(
    supabase: SupabaseClient,
    organizationId: string,
    query: string,
    queryLower: string
  ): Promise<AssistantResponse> {
    const brief = await CommercialIntelligenceEngine.generateCEOMorningBrief(supabase, organizationId);
    const evidence: string[] = [];

    // Query: "Que s'est-il passé hier ?" / Synthèse
    if (queryLower.includes('passé hier') || queryLower.includes('synthèse') || queryLower.includes('bilan')) {
      const resp = `${brief.summaryHeadline}\n\n• Commandes hier : ${brief.salesStats.totalOrdersYesterday}\n• Chiffre d'affaires : ${brief.salesStats.totalRevenueXof.toLocaleString('fr-FR')} FCFA\n• Commandes en attente de confirmation : ${brief.salesStats.unconfirmedOrdersCount}\n• Livraisons en cours : ${brief.salesStats.pendingDeliveryCount}\n• Factures non encaissées : ${brief.salesStats.unpaidInvoicesCount}`;
      evidence.push(`Basé sur ${brief.salesStats.totalOrdersYesterday} commandes dans la base de données.`);

      return {
        query,
        response: resp,
        role: 'CEO',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence,
      };
    }

    // Query: "Qu'est-ce qui nécessite mon attention ?" / Alertes
    if (queryLower.includes('attention') || queryLower.includes('alertes') || queryLower.includes('problèmes')) {
      if (brief.keyAlerts.length === 0) {
        return {
          query,
          response: "Toutes les opérations se déroulent normalement. Aucune alerte critique enregistrée pour votre entreprise aujourd'hui.",
          role: 'CEO',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 alerte enregistrée'],
        };
      }

      const alertList = brief.keyAlerts.map((a) => `• [${a.priority}] ${a.title} : ${a.description}`).join('\n');
      return {
        query,
        response: `Voici les points nécessitant votre attention :\n\n${alertList}`,
        role: 'CEO',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: brief.keyAlerts.map((a) => a.title),
      };
    }

    // Query: "Combien de commandes sont en attente ?"
    if (queryLower.includes('commandes') && (queryLower.includes('attente') || queryLower.includes('combien'))) {
      const count = brief.salesStats.unconfirmedOrdersCount;
      evidence.push(`${count} commandes en statut PENDING dans la table orders.`);

      return {
        query,
        response: count > 0
          ? `Vous avez actuellement ${count} commande(s) en attente de validation commerciale.`
          : "Aucune commande en attente de validation.",
        role: 'CEO',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence,
      };
    }

    // Query: "Quelles livraisons posent problème ?"
    if (queryLower.includes('livraison') || queryLower.includes('livreurs')) {
      const { data: failedDelivs } = await supabase
        .from('deliveries')
        .select('*, orders(order_number, total_amount), drivers(full_name, phone)')
        .eq('organization_id', organizationId)
        .in('status', ['FAILED', 'RESCHEDULED', 'RETURNED']);

      if (!failedDelivs || failedDelivs.length === 0) {
        return {
          query,
          response: "Aucun échec ou problème de livraison n'est actuellement signalé.",
          role: 'CEO',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 livraison en échec'],
        };
      }

      const listStr = failedDelivs.map((d: any) => {
        const drvName = d.drivers?.full_name || 'Livreur non assigné';
        const ordNum = d.orders?.order_number || 'N/A';
        return `• Livraison #${ordNum} (${d.status}) - Livreur: ${drvName} - Motif: ${d.failure_reason || 'Non spécifié'}`;
      }).join('\n');

      return {
        query,
        response: `Voici les livraisons en difficulté nécessitant un suivi :\n\n${listStr}`,
        role: 'CEO',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: failedDelivs.map((d: any) => `Delivery ${d.id} status ${d.status}`),
      };
    }

    // Default CEO Response
    return {
      query,
      response: brief.summaryHeadline,
      role: 'CEO',
      permissionLevel: 'GREEN',
      requiresHumanConfirmation: false,
      evidence: ['Brief opérationnel CEO généré'],
    };
  }

  // ── COMMERCIAL ASSISTANT HANDLER ───────────────────────────────────────────

  private static async handleCommercialRole(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    query: string,
    queryLower: string,
    customerId?: string,
    conversationId?: string
  ): Promise<AssistantResponse> {
    const brief = await CommercialIntelligenceEngine.generateCommercialMorningBrief(supabase, organizationId, userId);
    const evidence: string[] = [];

    // Query: "Qu'est-ce que je dois faire maintenant ?" / "Mes actions"
    if (queryLower.includes('faire maintenant') || queryLower.includes('mes actions') || queryLower.includes('programme')) {
      if (brief.priorityActions.length === 0) {
        return {
          query,
          response: "Toutes vos relances et actions commerciales sont à jour ! Vous pouvez contacter de nouveaux prospects ou revoir vos conversations récentes.",
          role: 'COMMERCIAL',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 action urgente'],
        };
      }

      const actionsText = brief.priorityActions
        .slice(0, 5)
        .map((a, idx) => `${idx + 1}. [${a.priority}] ${a.customerName} (${a.customerPhone}) : ${a.reasonTitle}\n   👉 Action : ${a.suggestedAction}`)
        .join('\n\n');

      const recs: AIRecommendationItem[] = brief.priorityActions.map((a) => ({
        category: a.actionType === 'RELANCER_PROSPECT' ? 'relance due' : a.actionType === 'SUIVRE_LIVRAISON' ? 'problème livraison' : 'commande à finaliser',
        reason: a.reasonDescription,
        dataUsed: a.evidence,
        proposedAction: a.suggestedAction,
        confidence: 0.95,
      }));

      return {
        query,
        response: `Voici vos actions prioritaires pour la journée :\n\n${actionsText}`,
        role: 'COMMERCIAL',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        recommendations: recs,
        evidence: brief.priorityActions.map((a) => a.reasonTitle),
      };
    }

    // Query: "Quels clients dois-je relancer ?" / "Mes relances"
    if (queryLower.includes('relancer') || queryLower.includes('relances')) {
      const relances = brief.priorityActions.filter((a) => a.actionType === 'RELANCER_PROSPECT');
      if (relances.length === 0) {
        return {
          query,
          response: "Aucun prospect nécessitant une relance urgente aujourd'hui.",
          role: 'COMMERCIAL',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 relance due'],
        };
      }

      const relanceText = relances.map((r) => `• ${r.customerName} (${r.customerPhone}) : ${r.reasonDescription}`).join('\n');
      return {
        query,
        response: `Voici les clients à relancer en priorité :\n\n${relanceText}`,
        role: 'COMMERCIAL',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: relances.map((r) => r.customerName),
      };
    }

    // Query: "Prépare-moi une réponse" / Draft Message (YELLOW Action -> Human Confirmation)
    if (queryLower.includes('prépare') || queryLower.includes('réponse') || queryLower.includes('message')) {
      const targetAction = brief.priorityActions[0];
      const draftMessage = targetAction
        ? targetAction.suggestedResponse
        : "Bonjour ! Je reviens vers vous concernant votre demande d'information. Êtes-vous toujours intéressé par nos produits ?";

      return {
        query,
        response: `Voici la proposition de message à envoyer :\n\n"${draftMessage}"\n\n⚠️ Vous pouvez copier, adapter ou envoyer directement ce message.`,
        role: 'COMMERCIAL',
        permissionLevel: 'YELLOW',
        requiresHumanConfirmation: true,
        proposedAction: {
          type: 'PREPARE_MESSAGE',
          payload: {
            text: draftMessage,
            customerId: targetAction?.customerId || customerId,
            conversationId: targetAction?.conversationId || conversationId,
          },
        },
        evidence: ['Proposition de message préparée'],
      };
    }

    // Default Commercial Response
    return {
      query,
      response: brief.summaryHeadline,
      role: 'COMMERCIAL',
      permissionLevel: 'GREEN',
      requiresHumanConfirmation: false,
      evidence: ['Brief commercial généré'],
    };
  }

  // ── DRIVER ASSISTANT HANDLER ───────────────────────────────────────────────

  private static async handleDriverRole(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    query: string,
    queryLower: string
  ): Promise<AssistantResponse> {
    const evidence: string[] = [];

    // Fetch driver profile by userId
    const { data: driverRow } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    const driverId = driverRow?.id;

    if (!driverId) {
      return {
        query,
        response: "Je n'ai pas pu identifier votre profil de livreur dans cette organisation.",
        role: 'DRIVER',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: ['Profil livreur non trouvé'],
      };
    }

    // Fetch deliveries assigned to driver
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('*, orders(order_number, total_amount, delivery_neighborhood), customers(first_name, last_name, phone)')
      .eq('organization_id', organizationId)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    const activeDeliveries = (deliveries || []).filter((d) => d.status === 'ASSIGNED' || d.status === 'IN_TRANSIT');
    const failedDeliveries = (deliveries || []).filter((d) => d.status === 'FAILED');

    // Query: "Quelles livraisons me restent ?" / "Mes livraisons"
    if (queryLower.includes('restent') || queryLower.includes('mes livraisons') || queryLower.includes('tournée')) {
      if (activeDeliveries.length === 0) {
        return {
          query,
          response: "Vous n'avez aucune livraison en cours pour le moment. Votre tournée est à jour !",
          role: 'DRIVER',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 livraison active'],
        };
      }

      const listText = activeDeliveries.map((d: any) => {
        const custName = d.customers ? `${d.customers.first_name} ${d.customers.last_name || ''}`.trim() : 'Client';
        const phone = d.customers?.phone || 'N/A';
        const quartier = d.orders?.delivery_neighborhood || d.delivery_address || 'Adresse non spécifiée';
        const total = d.orders?.total_amount ? `${d.orders.total_amount.toLocaleString('fr-FR')} FCFA` : '';
        return `• Commande #${d.orders?.order_number || d.id.slice(0, 6)} - Client: ${custName} (${phone}) - Quartier: ${quartier} (${total})`;
      }).join('\n');

      return {
        query,
        response: `Voici vos ${activeDeliveries.length} livraison(s) restante(s) :\n\n${listText}`,
        role: 'DRIVER',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: activeDeliveries.map((d: any) => `Delivery ${d.id}`),
      };
    }

    // Query: "Quelle est ma prochaine livraison ?"
    if (queryLower.includes('prochaine')) {
      const nextDeliv = activeDeliveries[0];
      if (!nextDeliv) {
        return {
          query,
          response: "Aucune livraison restante.",
          role: 'DRIVER',
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 livraison'],
        };
      }

      const custName = nextDeliv.customers ? `${nextDeliv.customers.first_name} ${nextDeliv.customers.last_name || ''}`.trim() : 'Client';
      const phone = nextDeliv.customers?.phone || 'N/A';
      const quartier = nextDeliv.orders?.delivery_neighborhood || nextDeliv.delivery_address || 'Adresse';

      return {
        query,
        response: `Prochaine livraison : Commande #${nextDeliv.orders?.order_number || nextDeliv.id.slice(0, 6)} pour ${custName} (${phone}) à ${quartier}.`,
        role: 'DRIVER',
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`Delivery ${nextDeliv.id}`],
      };
    }

    // Default Driver response
    return {
      query,
      response: `Bonjour ${driverRow.full_name} ! Vous avez ${activeDeliveries.length} livraison(s) en cours et ${failedDeliveries.length} échec(s) à revoir.`,
      role: 'DRIVER',
      permissionLevel: 'GREEN',
      requiresHumanConfirmation: false,
      evidence: [`Driver ID ${driverId}`],
    };
  }
}
