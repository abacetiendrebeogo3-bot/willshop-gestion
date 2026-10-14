/**
 * WILLShop OS — Unified AI Assistant Service & Guardrail Engine
 * Application Layer.
 * 
 * Provides unified role-based AI assistance for CEO/Owner, Commercial, and Driver roles.
 * Connected to live database entities: Customers, Orders, Engagements (Relances), Deliveries, Products.
 * 
 * Anti-Hallucination Guardrail:
 * - Queries real PostgreSQL/Supabase database tables.
 * - Always provides verifiable live figures and facts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CommercialIntelligenceEngine } from './CommercialIntelligenceEngine';

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

  public static async processQuery(options: UnifiedAssistantOptions): Promise<AssistantResponse> {
    const { supabase, organizationId, userId, role, query, customerId, conversationId } = options;
    const queryLower = (query || '').toLowerCase().trim();

    const canonicalRole: 'CEO' | 'COMMERCIAL' | 'DRIVER' =
      role === 'CEO' || role === 'OWNER' || role === 'ADMIN'
        ? 'CEO'
        : role === 'DRIVER'
        ? 'DRIVER'
        : 'COMMERCIAL';

    // 1. Guardrail Check: Interdict destructive or automated mutative actions
    const isRedActionRequest =
      queryLower.includes('envoie automatiquement') ||
      queryLower.includes('envoyer sans confirmation') ||
      queryLower.includes('supprime le client') ||
      queryLower.includes('supprimer la commande') ||
      queryLower.includes('efface les données');

    if (isRedActionRequest) {
      return {
        query,
        response: "Action BLOQUÉE : L'assistant IA ne peut pas effectuer d'envoi automatique de message ou de suppression critique sans confirmation humaine préalable.",
        role: canonicalRole,
        permissionLevel: 'RED',
        requiresHumanConfirmation: true,
        isBlocked: true,
        blockedReason: 'Action RED interdite par défaut.',
        evidence: ['TENTATIVE_ACTION_RED_BLOQUEE'],
      };
    }

    // 2. Fetch User Name for Personalization
    let userName = 'Responsable';
    try {
      const { data: userRow } = await supabase.auth.admin.getUserById(userId);
      const meta = userRow?.user?.user_metadata;
      if (meta?.first_name) {
        userName = meta.first_name;
      } else if (meta?.full_name) {
        userName = meta.full_name.split(' ')[0];
      } else {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .maybeSingle();
        if (org?.name) {
          userName = org.name.split(' ')[0];
        }
      }
    } catch {
      userName = 'Responsable';
    }

    // 3. Driver specific workflow
    if (canonicalRole === 'DRIVER') {
      return this.handleDriverRole(supabase, organizationId, userId, query, queryLower);
    }

    // 4. Comprehensive Business Intelligence Router (Accessible to CEO, Owner, Commercial)
    return this.handleGeneralBusinessQuery(
      supabase,
      organizationId,
      userId,
      userName,
      canonicalRole,
      query,
      queryLower,
      customerId,
      conversationId
    );
  }

  /**
   * Unified Handler that inspects live CRM, Orders, Engagements, and Products
   */
  private static async handleGeneralBusinessQuery(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    userName: string,
    role: 'CEO' | 'COMMERCIAL',
    query: string,
    queryLower: string,
    customerId?: string,
    conversationId?: string
  ): Promise<AssistantResponse> {

    // ── INTENT A: SPECIFIC CUSTOMER SEARCH (Name or Phone number) ────────────
    const isSpecificCustomerSearch =
      queryLower.includes('client ') ||
      queryLower.includes('prospect ') ||
      queryLower.includes('qui est ') ||
      queryLower.includes('trouve ') ||
      queryLower.includes('recherche ') ||
      queryLower.startsWith('fiche ') ||
      /\d{6,}/.test(queryLower);

    if (isSpecificCustomerSearch) {
      const searchTerms = query
        .replace(/client|prospect|qui est|trouve|recherche|fiche|infos|sur|le|\?|!/gi, '')
        .trim();

      if (searchTerms.length >= 2) {
        const { data: matchedCustomers } = await supabase
          .from('customers')
          .select('id, first_name, last_name, full_name, phone, city, address, status, notes, created_at')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .or(`phone.ilike.%${searchTerms}%,first_name.ilike.%${searchTerms}%,last_name.ilike.%${searchTerms}%,full_name.ilike.%${searchTerms}%`)
          .limit(3);

        if (matchedCustomers && matchedCustomers.length > 0) {
          const cust = matchedCustomers[0];
          const name = cust.full_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.phone;

          // Fetch orders for this customer
          const { data: custOrders } = await supabase
            .from('orders')
            .select('id, order_number, total, status')
            .eq('customer_id', cust.id)
            .is('deleted_at', null);

          const orderCount = custOrders?.length || 0;
          const totalSpent = (custOrders || []).reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);

          return {
            query,
            response: `👤 Fiche Client : ${name}\n\n• Téléphone WhatsApp : ${cust.phone}\n• Ville / Quartier : ${cust.city || 'Non renseignée'} ${cust.address ? `(${cust.address})` : ''}\n• Statut : ${cust.status}\n• Commandes passées : ${orderCount} (${totalSpent.toLocaleString('fr-FR')} FCFA dépensés)\n• Notes internes : ${cust.notes || 'Aucune note'}\n\n💡 Vous pouvez ouvrir sa fiche dans la section Clients pour lui envoyer un message ou planifier une relance.`,
            role,
            permissionLevel: 'GREEN',
            requiresHumanConfirmation: false,
            evidence: [`Client ID ${cust.id} (${cust.phone})`],
          };
        }
      }
    }

    // ── INTENT B: ALL CLIENTS / CRM OVERVIEW ─────────────────────────────────
    if (
      queryLower.includes('client') ||
      queryLower.includes('prospect') ||
      queryLower.includes('crm') ||
      queryLower.includes('base')
    ) {
      const { data: allCusts, error: custErr } = await supabase
        .from('customers')
        .select('id, first_name, last_name, full_name, phone, city, status, created_at')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const custs = allCusts || [];
      const total = custs.length;
      const actifs = custs.filter((c) => c.status === 'ACTIVE').length;
      const prospects = custs.filter((c) => c.status === 'PROSPECT').length;
      const toRelance = custs.filter((c) => c.status === 'TO_RELANCE').length;
      const chauds = custs.filter((c) => c.status === 'HOT' || c.status === 'INTERESTED').length;

      const recentFive = custs.slice(0, 5).map((c) => {
        const name = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone;
        return `• ${name} (${c.phone}) — ${c.city || 'Burkina Faso'} [${c.status}]`;
      }).join('\n');

      let advice = '';
      if (toRelance > 0) {
        advice = `\n\n⚠️ Action recommandée : Vous avez ${toRelance} client(s) marqué(s) « À relancer ». Tapez « Mes relances » pour voir la liste prioritaire.`;
      } else {
        advice = `\n\n✅ Tous vos contacts sont suivis. Vous pouvez contacter les ${prospects} prospects récents pour leur présenter vos nouveautés.`;
      }

      return {
        query,
        response: `📊 Synthèse de votre Base Clients (${total} contacts enregistrés) :\n\n• Clients actifs : ${actifs}\n• Prospects à convertir : ${prospects}\n• À relancer : ${toRelance}\n• Très intéressés (Chauds) : ${chauds}\n\nDerniers clients enregistrés :\n${recentFive || 'Aucun client récent'}${advice}`,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`${total} clients dans la base Supabase`],
      };
    }

    // ── INTENT C: RELANCES & ENGAGEMENTS ─────────────────────────────────────
    if (
      queryLower.includes('relance') ||
      queryLower.includes('relances') ||
      queryLower.includes('relancer') ||
      queryLower.includes('rappel') ||
      queryLower.includes('engagements')
    ) {
      // 1. Fetch pending customer_engagements
      const { data: engagements } = await supabase
        .from('customer_engagements')
        .select('id, title, description, due_at, priority, customers(id, first_name, last_name, full_name, phone)')
        .eq('organization_id', organizationId)
        .eq('status', 'PENDING')
        .order('due_at', { ascending: true })
        .limit(10);

      // 2. Fetch customers flagged as TO_RELANCE
      const { data: toRelanceCustomers } = await supabase
        .from('customers')
        .select('id, first_name, last_name, full_name, phone, updated_at')
        .eq('organization_id', organizationId)
        .eq('status', 'TO_RELANCE')
        .is('deleted_at', null)
        .limit(5);

      const engList = engagements || [];
      const custRelanceList = toRelanceCustomers || [];

      if (engList.length === 0 && custRelanceList.length === 0) {
        return {
          query,
          response: "Toutes vos relances sont à jour ! 🎉 Aucun rappel ni prospect en attente urgente de relance pour le moment.",
          role,
          permissionLevel: 'GREEN',
          requiresHumanConfirmation: false,
          evidence: ['0 relance en attente'],
        };
      }

      let resp = '🎯 Vos Relances Clients Prioritaires :\n\n';

      if (engList.length > 0) {
        resp += '📅 Relances planifiées :\n';
        resp += engList.map((e: any) => {
          const cust = e.customers;
          const custName = cust ? (cust.full_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.phone) : 'Client';
          const phone = cust?.phone || '';
          const due = new Date(e.due_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `• [${e.priority}] ${e.title} — ${custName} (${phone}) pour le ${due}${e.description ? `\n   Note : "${e.description}"` : ''}`;
        }).join('\n\n');
      }

      if (custRelanceList.length > 0) {
        resp += '\n\n⚠️ Contacts au statut « À relancer » :\n';
        resp += custRelanceList.map((c: any) => {
          const name = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone;
          return `• ${name} (${c.phone})`;
        }).join('\n');
      }

      resp += '\n\n💡 Pour relancer un client, cliquez sur sa fiche dans « Clients » puis sur « Voir la conversation WhatsApp ».';

      return {
        query,
        response: resp,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`${engList.length} engagements planifiés`, `${custRelanceList.length} clients statut TO_RELANCE`],
      };
    }

    // ── INTENT D: COMMANDES / VENTES / CHIFFRE D'AFFAIRES ────────────────────
    if (
      queryLower.includes('commande') ||
      queryLower.includes('commandes') ||
      queryLower.includes('vente') ||
      queryLower.includes('ventes') ||
      queryLower.includes('chiffre') ||
      queryLower.includes('affaire') ||
      queryLower.includes('revenu') ||
      queryLower.includes('panier') ||
      queryLower.includes(' ca ') ||
      queryLower.endsWith(' ca') ||
      queryLower === 'ca'
    ) {
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, customer_id, customers(first_name, last_name, full_name, phone)')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const orders = allOrders || [];
      const totalOrders = orders.length;

      const nonCancelled = orders.filter((o) => o.status !== 'CANCELLED');
      const totalRevenue = nonCancelled.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

      const pendingCount = orders.filter((o) => o.status === 'DRAFT' || o.status === 'PENDING').length;
      const confirmedCount = orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PROCESSING').length;
      const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;

      const recentOrdersList = orders.slice(0, 5).map((o: any) => {
        const cust = o.customers;
        const custName = cust ? (cust.full_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.phone) : 'Client';
        const dateStr = new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        return `• Commande #${o.order_number} : ${Number(o.total).toLocaleString('fr-FR')} FCFA (${custName}) — Statut: ${o.status} [${dateStr}]`;
      }).join('\n');

      return {
        query,
        response: `💰 Synthèse des Ventes & Commandes :\n\n• Chiffre d'affaires cumulé : ${totalRevenue.toLocaleString('fr-FR')} FCFA\n• Total des commandes : ${totalOrders}\n• En attente de confirmation : ${pendingCount}\n• Confirmées / En préparation : ${confirmedCount}\n• Livrées avec succès : ${deliveredCount}\n\nDernières commandes enregistrées :\n${recentOrdersList || 'Aucune commande enregistrée pour le moment.'}\n\n💡 Pour enregistrer une nouvelle vente, cliquez sur « Nouvelle commande » dans le menu Commandes ou directement sur la fiche d'un client.`,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`${totalOrders} commandes dans la table orders (${totalRevenue} FCFA)`],
      };
    }

    // ── INTENT E: PRODUITS / STOCK / CATALOGUE ──────────────────────────────
    if (
      queryLower.includes('produit') ||
      queryLower.includes('produits') ||
      queryLower.includes('stock') ||
      queryLower.includes('catalogue') ||
      queryLower.includes('prix')
    ) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, selling_price, minimum_stock, status')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      const prods = products || [];
      const activeProds = prods.filter((p) => p.status === 'ACTIVE');

      const prodList = activeProds.slice(0, 6).map((p) => {
        return `• ${p.name} : ${Number(p.selling_price || 0).toLocaleString('fr-FR')} FCFA (Réf: ${p.sku || 'N/A'})`;
      }).join('\n');

      return {
        query,
        response: `📦 Catalogue Produits & Stock :\n\n• Total références : ${prods.length} produit(s)\n• Produits actifs en vente : ${activeProds.length}\n\nAperçu des produits disponibles :\n${prodList || 'Aucun produit actif'}\n\n💡 Pour ajouter ou réapprovisionner un article, rendez-vous dans la section Produits & Stock.`,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`${prods.length} produits enregistrés`],
      };
    }

    // ── INTENT F: LIVRAISONS & LIVREURS ──────────────────────────────────────
    if (
      queryLower.includes('livraison') ||
      queryLower.includes('livraisons') ||
      queryLower.includes('livreur') ||
      queryLower.includes('livreurs')
    ) {
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('id, status, orders(order_number, total), drivers(name, phone)')
        .eq('organization_id', organizationId);

      const delivs = deliveries || [];
      const inTransit = delivs.filter((d) => d.status === 'IN_TRANSIT' || d.status === 'ASSIGNED').length;
      const failed = delivs.filter((d) => d.status === 'FAILED' || d.status === 'RESCHEDULED').length;
      const completed = delivs.filter((d) => d.status === 'DELIVERED').length;

      return {
        query,
        response: `🚚 État des Livraisons :\n\n• Livraisons en cours de tournée : ${inTransit}\n• Livraisons réussies : ${completed}\n• Échecs ou reports nécessitant arbitrage : ${failed}\n\n${failed > 0 ? '⚠️ Des livraisons ont rencontré un problème. Consultez l\'onglet Livraisons pour réassigner un livreur.' : '✅ Toutes les livraisons se déroulent sans incident signalé.'}`,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: [`${delivs.length} livraisons trouvées`],
      };
    }

    // ── INTENT G: ACTIONS PRIORITAIRES / QUE FAIRE AUJOURD'HUI ──────────────
    if (
      queryLower.includes('action') ||
      queryLower.includes('actions') ||
      queryLower.includes('que faire') ||
      queryLower.includes('priorit') ||
      queryLower.includes('programme')
    ) {
      const brief = await CommercialIntelligenceEngine.generateCommercialMorningBrief(supabase, organizationId, userId);

      const actionsText = brief.priorityActions && brief.priorityActions.length > 0
        ? brief.priorityActions.slice(0, 4).map((a, idx) => `${idx + 1}. [${a.priority}] ${a.customerName} (${a.customerPhone}) : ${a.reasonTitle}\n   👉 ${a.suggestedAction}`).join('\n\n')
        : '• Toutes vos relances sont effectuées.\n• Vous pouvez prospecter de nouveaux contacts WhatsApp ou vérifier les livraisons en cours.';

      return {
        query,
        response: `📋 Votre Programme d'Actions Commerciales :\n\n${actionsText}`,
        role,
        permissionLevel: 'GREEN',
        requiresHumanConfirmation: false,
        evidence: ['Actions prioritaires calculées sur la base live'],
      };
    }

    // ── INTENT H: PRÉPARER UN MESSAGE WHATSAPP ──────────────────────────────
    if (
      queryLower.includes('prépare') ||
      queryLower.includes('réponse') ||
      queryLower.includes('message') ||
      queryLower.includes('whatsapp')
    ) {
      const draftMessage = "Bonjour ! J'espère que vous allez bien. Je me permets de revenir vers vous concernant votre échange avec WILLShop. Êtes-vous toujours intéressé par nos produits ? Nous pouvons organiser votre livraison dès aujourd'hui.";

      return {
        query,
        response: `💬 Proposition de message WhatsApp prête à l'envoi :\n\n"${draftMessage}"\n\n📋 Vous pouvez copier ce texte et l'envoyer directement au client depuis la conversation WhatsApp.`,
        role,
        permissionLevel: 'YELLOW',
        requiresHumanConfirmation: true,
        proposedAction: {
          type: 'PREPARE_MESSAGE',
          payload: { text: draftMessage, customerId, conversationId },
        },
        evidence: ['Template de réponse commerciale préparé'],
      };
    }

    // ── INTENT I: SYNTHÈSE GLOBALE / BONJOUR / DÉFAUT ENRICHI ────────────────
    // When the user asks anything else or general greeting, return full live metrics with real name
    const [cCount, oData, pCount, eCount] = await Promise.all([
      supabase.from('customers').select('count', { count: 'exact' }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('orders').select('total, status').eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('products').select('count', { count: 'exact' }).eq('organization_id', organizationId).is('deleted_at', null),
      supabase.from('customer_engagements').select('count', { count: 'exact' }).eq('organization_id', organizationId).eq('status', 'PENDING'),
    ]);

    const totalCust = cCount.count || 0;
    const ordersList = oData.data || [];
    const totalRev = ordersList.filter((o) => o.status !== 'CANCELLED').reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const totalOrders = ordersList.length;
    const totalProd = pCount.count || 0;
    const pendingRel = eCount.count || 0;

    return {
      query,
      response: `Bonjour ${userName} 👋 Voici la vue opérationnelle en direct de WILLShop :\n\n👥 Base Clients : ${totalCust} clients enregistrés\n🛒 Commandes : ${totalOrders} commande(s) (${totalRev.toLocaleString('fr-FR')} FCFA de CA)\n📦 Produits : ${totalProd} référence(s) au catalogue\n⏰ Relances : ${pendingRel} relance(s) programmée(s)\n\nComment puis-je vous aider ? Vous pouvez me demander par exemple :\n• « Mes clients » pour analyser votre base\n• « Mes commandes » pour les détails des ventes\n• « Mes relances » pour les rappels urgents\n• Ou le nom d'un client précis (ex: « Client Yasmine »).`,
      role,
      permissionLevel: 'GREEN',
      requiresHumanConfirmation: false,
      evidence: [`${totalCust} clients`, `${totalOrders} commandes (${totalRev} FCFA)`, `${totalProd} produits`],
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
      .select('id, full_name, name')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    const driverId = driverRow?.id;
    const driverName = driverRow?.full_name || driverRow?.name || 'Livreur';

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
      .select('*, orders(order_number, total, delivery_neighborhood), customers(first_name, last_name, phone)')
      .eq('organization_id', organizationId)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    const activeDeliveries = (deliveries || []).filter((d) => d.status === 'ASSIGNED' || d.status === 'IN_TRANSIT');
    const failedDeliveries = (deliveries || []).filter((d) => d.status === 'FAILED');

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
        const custName = d.customers ? `${d.customers.first_name || ''} ${d.customers.last_name || ''}`.trim() : 'Client';
        const phone = d.customers?.phone || 'N/A';
        const quartier = d.orders?.delivery_neighborhood || d.delivery_address || 'Adresse';
        const total = d.orders?.total ? `${Number(d.orders.total).toLocaleString('fr-FR')} FCFA` : '';
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

    return {
      query,
      response: `Bonjour ${driverName} ! Vous avez ${activeDeliveries.length} livraison(s) en cours et ${failedDeliveries.length} échec(s) à revoir.`,
      role: 'DRIVER',
      permissionLevel: 'GREEN',
      requiresHumanConfirmation: false,
      evidence: [`Driver ID ${driverId}`],
    };
  }
}
