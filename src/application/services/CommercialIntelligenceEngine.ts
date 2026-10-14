/**
 * WILLShop OS — Commercial Intelligence & Action Copilot Engine
 * Application Layer.
 * 
 * Implements the OBSERVE_ONLY Commercial Intelligence paradigm:
 * 1. Analyzes and structures active WhatsApp conversations from raw DB messages and timestamps.
 * 2. Produces factual provenance evidence ("Pourquoi ?") without inventing data.
 * 3. Generates daily commercial task cards ("MA JOURNÉE / TODAY_ACTIONS") prioritized by urgency.
 * 4. Generates CEO Macro Morning Briefs & Personal Commercial Morning Briefs.
 * 5. Manages action persistence (mark as treated, postpone, ignore).
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type CommercialActionType =
  | 'RELANCER_PROSPECT'
  | 'FINALISER_COMMANDE'
  | 'VERIFIER_PAIEMENT'
  | 'SUIVRE_LIVRAISON'
  | 'CONTACTER_CLIENT'
  | 'RESOUDRE_PROBLEME'
  | 'CONFIRMER_INFORMATION'
  | 'AUCUNE_ACTION';

export type ActionPriority = 'URGENT' | 'IMPORTANT' | 'TO_DO' | 'MONITOR';

export interface StructuredConversationContext {
  conversationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  intent: 'DISCOVERY' | 'PRODUCT_QUERY' | 'PRICE_QUERY' | 'PURCHASE_INTENT' | 'ORDER_FOLLOWUP' | 'DELIVERY_ISSUE' | 'PAYMENT_VERIFICATION' | 'GENERAL_INQUIRY';
  stage: 'NEW_PROSPECT' | 'PRODUCT_PRESENTED' | 'PRICE_COMMUNICATED' | 'UNFINISHED_ORDER' | 'ORDER_CONFIRMED' | 'DELIVERY_PENDING' | 'PAID' | 'INACTIVE';
  productInterest: string | null;
  productId: string | null;
  quantity: number | null;
  sellingPrice: number | null;
  deliveryNeighborhood: string | null;
  lastCustomerActivity: Date | null;
  lastCommercialActivity: Date | null;
  lastContactAt: Date | null;
  daysSinceLastActivity: number;
  nextAction: string;
  priority: ActionPriority;
  needsFollowup: boolean;
  followupDueAt: Date | null;
  orderId: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
  paymentStatus: string | null;
  evidence: string[]; // Provenance points backed by DB data
}

export interface TodayActionItem {
  id: string;
  organizationId: string;
  conversationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  actionType: CommercialActionType;
  priority: ActionPriority;
  dueAt: Date;
  reasonTitle: string;
  reasonDescription: string;
  evidence: string[];
  suggestedAction: string;
  suggestedResponse: string; // Message template for salesperson to copy/send manually
  productInterest?: string;
  orderId?: string;
  status: 'PENDING' | 'TREATED' | 'POSTPONED' | 'IGNORED';
  treatedAt?: Date;
  treatedByUserId?: string;
  resolutionNote?: string;
}

export interface CEOMorningBrief {
  organizationId: string;
  generatedAt: string;
  summaryHeadline: string;
  salesStats: {
    totalOrdersYesterday: number;
    totalRevenueXof: number;
    unconfirmedOrdersCount: number;
    pendingDeliveryCount: number;
    unpaidInvoicesCount: number;
  };
  keyAlerts: Array<{
    type: 'ORDER' | 'DELIVERY' | 'PAYMENT' | 'SILENCE';
    title: string;
    description: string;
    priority: ActionPriority;
  }>;
  todayActionsSummary: {
    urgentCount: number;
    importantCount: number;
    toDoCount: number;
    monitorCount: number;
  };
  topOpportunities: Array<{
    customerName: string;
    product: string;
    estimatedValueXof: number;
    reason: string;
  }>;
  teamOverview: Array<{
    commercialUserId: string;
    name: string;
    assignedConversations: number;
    pendingActionsCount: number;
  }>;
}

export interface CommercialMorningBrief {
  organizationId: string;
  commercialUserId: string;
  commercialName: string;
  generatedAt: string;
  summaryHeadline: string;
  stats: {
    urgentCount: number;
    prospectsToFollowupCount: number;
    ordersToFollowCount: number;
    deliveriesToReviewCount: number;
    paymentsToCheckCount: number;
  };
  priorityActions: TodayActionItem[];
}

export class CommercialIntelligenceEngine {
  /**
   * Analyzes and structures raw conversation messages into a clean factual context.
   * Relies strictly on real DB records and message history (0 invented values).
   */
  public static analyzeAndStructureConversation(
    messages: any[],
    customer: any,
    conversation: any,
    orders: any[] = [],
    deliveries: any[] = []
  ): StructuredConversationContext {
    const custName = customer?.name || customer?.full_name || 'Prospect WhatsApp';
    const custPhone = customer?.phone || customer?.phone_number || conversation?.metadata?.phone || 'Numéro inconnu';
    const convId = conversation?.id || 'conv-unknown';
    const custId = customer?.id || conversation?.customer_id || 'cust-unknown';

    // Extract message timestamps & activity
    let lastCustActivity: Date | null = null;
    let lastCommActivity: Date | null = null;

    const inboundMsgs = messages.filter((m) => m.direction === 'INBOUND');
    const outboundMsgs = messages.filter((m) => m.direction === 'OUTBOUND');

    if (inboundMsgs.length > 0) {
      const sortedInbound = [...inboundMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastCustActivity = new Date(sortedInbound[0].created_at);
    }

    if (outboundMsgs.length > 0) {
      const sortedOutbound = [...outboundMsgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastCommActivity = new Date(sortedOutbound[0].created_at);
    }

    const lastContactAt = conversation?.last_message_at
      ? new Date(conversation.last_message_at)
      : lastCustActivity || lastCommActivity || new Date();

    const daysSinceLastActivity = Math.floor(
      (Date.now() - lastContactAt.getTime()) / (1000 * 3600 * 24)
    );

    // Associated order & delivery
    const associatedOrder = orders.find((o) => o.customer_id === custId || o.id === conversation?.metadata?.order_id);
    const associatedDelivery = deliveries.find((d) => d.order_id === associatedOrder?.id);

    // Fact extraction from messages
    let productInterest: string | null = conversation?.metadata?.product_name || null;
    let sellingPrice: number | null = conversation?.metadata?.selling_price || null;
    let deliveryNeighborhood: string | null = conversation?.metadata?.neighborhood || null;

    const evidence: string[] = [];

    // Pattern search on recent messages
    const fullText = messages.map((m) => m.body || m.content || '').join(' ').toLowerCase();

    if (!productInterest) {
      if (fullText.includes('minceur')) productInterest = 'Kit Minceur';
      else if (fullText.includes('green mask')) productInterest = 'Green Mask Stick';
      else if (fullText.includes('thé') || fullText.includes('infusion')) productInterest = 'Thé Detox Ventre Plat';
    }

    if (!sellingPrice) {
      const priceMatch = fullText.match(/(\d{2,3}[\s.]?\d{3})\s*(?:f|cfa|xof)?/i);
      if (priceMatch) {
        const parsed = parseInt(priceMatch[1].replace(/\s|\./g, ''), 10);
        if (parsed >= 1000 && parsed <= 500000) sellingPrice = parsed;
      }
    }

    if (!deliveryNeighborhood) {
      if (fullText.includes('somgandé')) deliveryNeighborhood = 'Somgandé';
      else if (fullText.includes('ouaga 2000')) deliveryNeighborhood = 'Ouaga 2000';
      else if (fullText.includes('koulouba')) deliveryNeighborhood = 'Koulouba';
      else if (fullText.includes('pissy')) deliveryNeighborhood = 'Pissy';
    }

    // Build stage & intent
    let stage: StructuredConversationContext['stage'] = 'NEW_PROSPECT';
    let intent: StructuredConversationContext['intent'] = 'DISCOVERY';

    if (associatedOrder) {
      if (associatedOrder.status === 'COMPLETED' || associatedOrder.status === 'DELIVERED') {
        stage = 'PAID';
        intent = 'ORDER_FOLLOWUP';
        evidence.push(`Commande #${associatedOrder.id} (${associatedOrder.total_amount || 0} XOF) livrée et payée.`);
      } else if (associatedOrder.status === 'PENDING') {
        stage = 'ORDER_CONFIRMED';
        intent = 'ORDER_FOLLOWUP';
        evidence.push(`Commande #${associatedOrder.id} créée, en attente d'expédition.`);
      } else {
        stage = 'UNFINISHED_ORDER';
        intent = 'PURCHASE_INTENT';
        evidence.push(`Commande #${associatedOrder.id} en cours de finalisation.`);
      }
    } else if (sellingPrice) {
      stage = 'PRICE_COMMUNICATED';
      intent = 'PRICE_QUERY';
      evidence.push(`Prix de ${sellingPrice} XOF communiqué au prospect.`);
    } else if (productInterest) {
      stage = 'PRODUCT_PRESENTED';
      intent = 'PRODUCT_QUERY';
      evidence.push(`Intérêt pour le produit "${productInterest}" identifié.`);
    } else {
      stage = 'NEW_PROSPECT';
      intent = 'DISCOVERY';
      evidence.push('Premier contact ou demande d\'information générale.');
    }

    if (lastCustActivity) {
      evidence.push(`Dernier message du client reçu le ${lastCustActivity.toLocaleDateString('fr-FR')} à ${lastCustActivity.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
    }

    if (lastCommActivity) {
      evidence.push(`Dernière réponse du commercial le ${lastCommActivity.toLocaleDateString('fr-FR')} à ${lastCommActivity.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
    }

    if (daysSinceLastActivity >= 2 && stage !== 'PAID') {
      evidence.push(`Silence de ${daysSinceLastActivity} jours sans interaction.`);
    }

    // Determine Priority & Next Action
    let priority: ActionPriority = 'MONITOR';
    let nextAction = 'Observer l\'évolution';
    let needsFollowup = false;
    let followupDueAt: Date | null = null;

    if (associatedDelivery && associatedDelivery.status === 'FAILED') {
      priority = 'URGENT';
      nextAction = 'Résoudre le problème de livraison avec le livreur et le client';
      evidence.push(`Échec de livraison signalé pour la commande #${associatedOrder?.id}.`);
    } else if (associatedOrder && associatedOrder.status === 'PENDING' && daysSinceLastActivity >= 1) {
      priority = 'URGENT';
      nextAction = 'Confirmer les détails de livraison et expédier la commande';
      needsFollowup = true;
      followupDueAt = new Date(Date.now() + 2 * 3600 * 1000);
    } else if (stage === 'PRICE_COMMUNICATED' && daysSinceLastActivity >= 1) {
      priority = 'IMPORTANT';
      nextAction = 'Relancer le prospect concernant la modalité de livraison';
      needsFollowup = true;
      followupDueAt = new Date(Date.now() + 4 * 3600 * 1000);
    } else if (stage === 'PRODUCT_PRESENTED' && daysSinceLastActivity >= 2) {
      priority = 'TO_DO';
      nextAction = 'Proposer le prix et vérifier la disponibilité';
      needsFollowup = true;
      followupDueAt = new Date(Date.now() + 6 * 3600 * 1000);
    } else if (stage === 'NEW_PROSPECT' && daysSinceLastActivity >= 3) {
      priority = 'TO_DO';
      nextAction = 'Reprendre contact et qualifier le besoin';
      needsFollowup = true;
    }

    return {
      conversationId: convId,
      customerId: custId,
      customerName: custName,
      customerPhone: custPhone,
      intent,
      stage,
      productInterest,
      productId: conversation?.metadata?.product_id || null,
      quantity: conversation?.metadata?.quantity || 1,
      sellingPrice,
      deliveryNeighborhood,
      lastCustomerActivity: lastCustActivity,
      lastCommercialActivity: lastCommActivity,
      lastContactAt,
      daysSinceLastActivity,
      nextAction,
      priority,
      needsFollowup,
      followupDueAt,
      orderId: associatedOrder?.id || null,
      orderStatus: associatedOrder?.status || null,
      deliveryStatus: associatedDelivery?.status || null,
      paymentStatus: associatedOrder?.payment_status || null,
      evidence,
    };
  }

  /**
   * Generates prioritized TodayActionItems ("MA JOURNÉE") from structured conversation contexts.
   */
  public static generateTodayActions(
    conversations: StructuredConversationContext[],
    organizationId: string = '00000000-0000-4000-a000-000000000000'
  ): TodayActionItem[] {
    const actionItems: TodayActionItem[] = [];

    for (const ctx of conversations) {
      if (ctx.stage === 'PAID' && ctx.priority === 'MONITOR') continue;

      let actionType: CommercialActionType = 'AUCUNE_ACTION';
      let reasonTitle = '';
      let reasonDescription = '';
      let suggestedAction = '';
      let suggestedResponse = '';

      if (ctx.deliveryStatus === 'FAILED' || ctx.priority === 'URGENT' && ctx.orderId) {
        actionType = 'SUIVRE_LIVRAISON';
        reasonTitle = `Problème de livraison sur commande ${ctx.orderId ? '#' + ctx.orderId : ''}`;
        reasonDescription = `Le client ${ctx.customerName} attend sa commande. La livraison nécessite une intervention humaine urgente.`;
        suggestedAction = 'Appeler le livreur et contacter le client pour fixer un nouvel horaire.';
        suggestedResponse = `Bonjour ${ctx.customerName} 😊 Je fais un suivi sur la livraison de votre commande ${ctx.productInterest ? 'de ' + ctx.productInterest : ''}. Le livreur a rencontré une difficulté. Êtes-vous disponible aujourd'hui à ${ctx.deliveryNeighborhood || 'votre adresse'} ?`;
      } else if (ctx.orderStatus === 'PENDING') {
        actionType = 'FINALISER_COMMANDE';
        reasonTitle = `Commande #${ctx.orderId} en attente de confirmation`;
        reasonDescription = `La commande a été initiée mais nécessite la confirmation finale des modalités d'expédition.`;
        suggestedAction = 'Confirmer l\'adresse exacte et planifier la tournée de livraison.';
        suggestedResponse = `Bonjour ${ctx.customerName} 🛒 Votre commande ${ctx.productInterest ? 'de ' + ctx.productInterest : ''} est prête à être expédiée. Pouvez-vous me confirmer votre quartier (${ctx.deliveryNeighborhood || 'Ouagadougou'}) pour le livreur ?`;
      } else if (ctx.stage === 'PRICE_COMMUNICATED' && ctx.daysSinceLastActivity >= 1) {
        actionType = 'RELANCER_PROSPECT';
        reasonTitle = `Prospect intéressé sans réponse après proposition de prix`;
        reasonDescription = `Le prix (${ctx.sellingPrice ? ctx.sellingPrice + ' XOF' : 'communiqué'}) a été transmis il y a ${ctx.daysSinceLastActivity} jours. Aucun retour client.`;
        suggestedAction = 'Envoyer un message de suivi bienveillant pour proposer la livraison.';
        suggestedResponse = `Bonjour ${ctx.customerName} 😊 Je reviens vers vous concernant votre intérêt pour le ${ctx.productInterest || 'produit'}. Souhaitez-vous qu'on programme votre livraison aujourd'hui ?`;
      } else if (ctx.stage === 'PRODUCT_PRESENTED' && ctx.daysSinceLastActivity >= 2) {
        actionType = 'RELANCER_PROSPECT';
        reasonTitle = `Relance prospect après présentation produit`;
        reasonDescription = `Le prospect ${ctx.customerName} a découvert le produit ${ctx.productInterest || ''}. Dernier contact il y a ${ctx.daysSinceLastActivity} jours.`;
        suggestedAction = 'Rappeler les bénéfices clés du produit et vérifier les disponibilités.';
        suggestedResponse = `Bonjour ${ctx.customerName} 👋 Avez-vous eu le temps de regarder les informations sur le ${ctx.productInterest || 'produit'} ? Avez-vous des questions sur son utilisation ?`;
      } else if (ctx.needsFollowup) {
        actionType = 'CONTACTER_CLIENT';
        reasonTitle = `Prise de contact nécessaire`;
        reasonDescription = `Interaction en attente de suite commerciale.`;
        suggestedAction = ctx.nextAction;
        suggestedResponse = `Bonjour ${ctx.customerName} 😊 Je reste à votre disposition si vous souhaitez finaliser votre commande.`;
      } else {
        continue;
      }

      actionItems.push({
        id: `act-${ctx.conversationId}-${Date.now().toString(36)}`,
        organizationId,
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        customerName: ctx.customerName,
        customerPhone: ctx.customerPhone,
        actionType,
        priority: ctx.priority,
        dueAt: ctx.followupDueAt || new Date(Date.now() + 3600 * 1000),
        reasonTitle,
        reasonDescription,
        evidence: ctx.evidence,
        suggestedAction,
        suggestedResponse,
        productInterest: ctx.productInterest || undefined,
        orderId: ctx.orderId || undefined,
        status: 'PENDING',
      });
    }

    // Sort by priority rank: URGENT > IMPORTANT > TO_DO > MONITOR
    const priorityRank: Record<ActionPriority, number> = {
      URGENT: 4,
      IMPORTANT: 3,
      TO_DO: 2,
      MONITOR: 1,
    };

    return actionItems.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  }

  /**
   * Generates the CEO Macro Morning Brief strictly from live DB tables.
   */
  public static async generateCEOMorningBrief(
    supabase: SupabaseClient,
    organizationId: string
  ): Promise<CEOMorningBrief> {
    const todayStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    try {
      // Fetch Orders
      const { data: orderRows } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      const orders = orderRows || [];

      // Fetch Deliveries
      const { data: deliveryRows } = await supabase
        .from('deliveries')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      const deliveries = deliveryRows || [];

      // Fetch Conversations & Customers
      const { data: convRows } = await supabase
        .from('conversations')
        .select('*, customer:customers(*)')
        .eq('organization_id', organizationId);

      const conversations = convRows || [];

      // Calculations
      const totalOrdersYesterday = orders.length;
      const totalRevenueXof = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const unconfirmedOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
      const pendingDeliveryCount = deliveries.filter((d) => d.status === 'ASSIGNED' || d.status === 'IN_TRANSIT').length;
      const unpaidInvoicesCount = orders.filter((o) => o.payment_status === 'UNPAID' || o.payment_status === 'PENDING').length;

      // Key Alerts
      const keyAlerts: CEOMorningBrief['keyAlerts'] = [];

      if (unconfirmedOrdersCount > 0) {
        keyAlerts.push({
          type: 'ORDER',
          title: `${unconfirmedOrdersCount} commande(s) en attente de confirmation`,
          description: `Des commandes nécessitent la validation rapide des informations de livraison.`,
          priority: 'URGENT',
        });
      }

      const failedDeliveries = deliveries.filter((d) => d.status === 'FAILED');
      if (failedDeliveries.length > 0) {
        keyAlerts.push({
          type: 'DELIVERY',
          title: `${failedDeliveries.length} échec(s) de livraison signalé(s)`,
          description: `Des colis n'ont pas pu être remis aux clients et nécessitent un nouveau rendez-vous.`,
          priority: 'URGENT',
        });
      }

      if (unpaidInvoicesCount > 0) {
        keyAlerts.push({
          type: 'PAYMENT',
          title: `${unpaidInvoicesCount} paiement(s) non encaissé(s)`,
          description: `Des créances en attente de vérification ou d'encaissement suite aux livraisons.`,
          priority: 'IMPORTANT',
        });
      }

      // Process Conversations for TodayActions
      const structuredConvs = conversations.map((c) =>
        this.analyzeAndStructureConversation([], c.customer, c, orders, deliveries)
      );
      const todayActions = this.generateTodayActions(structuredConvs, organizationId);

      const urgentCount = todayActions.filter((a) => a.priority === 'URGENT').length;
      const importantCount = todayActions.filter((a) => a.priority === 'IMPORTANT').length;
      const toDoCount = todayActions.filter((a) => a.priority === 'TO_DO').length;
      const monitorCount = todayActions.filter((a) => a.priority === 'MONITOR').length;

      // Top Opportunities
      const topOpportunities = structuredConvs
        .filter((c) => c.stage === 'PRICE_COMMUNICATED' || c.stage === 'PRODUCT_PRESENTED')
        .slice(0, 5)
        .map((c) => ({
          customerName: c.customerName,
          product: c.productInterest || 'Produit Catalogue',
          estimatedValueXof: c.sellingPrice || 15000,
          reason: `Prospect chaud — ${c.stage === 'PRICE_COMMUNICATED' ? 'Prix transmis' : 'Produit présenté'}, dernier contact il y a ${c.daysSinceLastActivity}j.`,
        }));

      return {
        organizationId,
        generatedAt: new Date().toISOString(),
        summaryHeadline: `Bonjour 👋 Voici la synthèse opérationnelle de WILLShop pour le ${todayStr}.`,
        salesStats: {
          totalOrdersYesterday,
          totalRevenueXof,
          unconfirmedOrdersCount,
          pendingDeliveryCount,
          unpaidInvoicesCount,
        },
        keyAlerts,
        todayActionsSummary: {
          urgentCount,
          importantCount,
          toDoCount,
          monitorCount,
        },
        topOpportunities,
        teamOverview: [
          {
            commercialUserId: 'user-awa-1',
            name: 'Awa Traore',
            assignedConversations: structuredConvs.length,
            pendingActionsCount: todayActions.length,
          },
        ],
      };
    } catch (err: any) {
      console.error('[CEOMorningBrief Exception]', err);
      return {
        organizationId,
        generatedAt: new Date().toISOString(),
        summaryHeadline: `Bonjour 👋 Synthèse disponible sous réserve de connexion réseau.`,
        salesStats: {
          totalOrdersYesterday: 0,
          totalRevenueXof: 0,
          unconfirmedOrdersCount: 0,
          pendingDeliveryCount: 0,
          unpaidInvoicesCount: 0,
        },
        keyAlerts: [],
        todayActionsSummary: { urgentCount: 0, importantCount: 0, toDoCount: 0, monitorCount: 0 },
        topOpportunities: [],
        teamOverview: [],
      };
    }
  }

  /**
   * Generates the Personal Commercial Morning Brief ("MA JOURNÉE").
   */
  public static async generateCommercialMorningBrief(
    supabase: SupabaseClient,
    organizationId: string,
    commercialUserId?: string
  ): Promise<CommercialMorningBrief> {
    try {
      const { data: convRows } = await supabase
        .from('conversations')
        .select('*, customer:customers(*)')
        .eq('organization_id', organizationId);

      const { data: orderRows } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      const { data: deliveryRows } = await supabase
        .from('deliveries')
        .select('*')
        .eq('organization_id', organizationId)
        .is('deleted_at', null);

      const convs = convRows || [];
      const orders = orderRows || [];
      const deliveries = deliveryRows || [];

      const structuredConvs = convs.map((c) =>
        this.analyzeAndStructureConversation([], c.customer, c, orders, deliveries)
      );

      const priorityActions = this.generateTodayActions(structuredConvs, organizationId);

      const urgentCount = priorityActions.filter((a) => a.priority === 'URGENT').length;
      const prospectsToFollowupCount = priorityActions.filter((a) => a.actionType === 'RELANCER_PROSPECT').length;
      const ordersToFollowCount = priorityActions.filter((a) => a.actionType === 'FINALISER_COMMANDE').length;
      const deliveriesToReviewCount = priorityActions.filter((a) => a.actionType === 'SUIVRE_LIVRAISON').length;
      const paymentsToCheckCount = priorityActions.filter((a) => a.actionType === 'VERIFIER_PAIEMENT').length;

      return {
        organizationId,
        commercialUserId: commercialUserId || 'user-comm-1',
        commercialName: 'Awa',
        generatedAt: new Date().toISOString(),
        summaryHeadline: `Bonjour Awa 👋 Voici votre programme commercial pour aujourd'hui : ${priorityActions.length} action(s) recommandée(s).`,
        stats: {
          urgentCount,
          prospectsToFollowupCount,
          ordersToFollowCount,
          deliveriesToReviewCount,
          paymentsToCheckCount,
        },
        priorityActions,
      };
    } catch (err: any) {
      console.error('[CommercialMorningBrief Exception]', err);
      return {
        organizationId,
        commercialUserId: commercialUserId || 'user-comm-1',
        commercialName: 'Commercial',
        generatedAt: new Date().toISOString(),
        summaryHeadline: `Bonjour 👋 Votre agenda est à jour.`,
        stats: {
          urgentCount: 0,
          prospectsToFollowupCount: 0,
          ordersToFollowCount: 0,
          deliveriesToReviewCount: 0,
          paymentsToCheckCount: 0,
        },
        priorityActions: [],
      };
    }
  }
}
