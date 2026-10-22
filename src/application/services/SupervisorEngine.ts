/**
 * WILLShop OS — Superviseur Commercial (moteur de règles, sans IA)
 * Application Layer — logique pure, testable, sans accès base de données.
 *
 * Lit les conversations WhatsApp synchronisées (Evolution API, numéro de la commerciale)
 * et produit une liste d'alertes priorisées : qui répondre, qui relancer, et avec quel message.
 * Le superviseur NE DÉCLENCHE AUCUN ENVOI : il propose, la commerciale envoie depuis son téléphone.
 */

export type SupervisorAlertType =
  | 'NON_REPONDU'          // le client a écrit, personne ne lui a répondu
  | 'JAMAIS_CONTACTE'      // nouveau prospect, aucun message envoyé
  | 'PROMESSE_ECHUE'       // le client a promis ("demain", "je vous reviens"…) et la date est passée
  | 'INTERESSE_SANS_COMMANDE' // a demandé prix/livraison, puis silence, pas de commande
  | 'SILENCE'              // on a écrit en dernier, le client ne répond plus
  | 'COMMANDE_BLOQUEE'     // commande confirmée mais pas livrée depuis longtemps / reportée / échouée
  | 'FIDELISATION';        // client livré il y a ~1 semaine, à recontacter

export type SupervisorPriority = 'URGENT' | 'HAUTE' | 'NORMALE';

export interface SupervisorMessage {
  direction: 'INBOUND' | 'OUTBOUND';
  content: string | null;
  createdAt: Date;
}

export interface SupervisorOrder {
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupervisorConversationInput {
  conversationId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  /** messages triés du plus ancien au plus récent */
  messages: SupervisorMessage[];
  orders: SupervisorOrder[];
  ignored?: boolean;
  snoozeUntil?: Date | null;
}

export interface SupervisorAlert {
  conversationId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  type: SupervisorAlertType;
  priority: SupervisorPriority;
  title: string;
  reason: string;
  lastClientMessage: string | null;
  sinceMinutes: number;
  suggestedMessage: string;
  whatsappLink: string;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const ACTIVE_ORDER_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
const DONE_ORDER_STATUSES = ['DELIVERED', 'COMPLETED'];
const PROBLEM_ORDER_STATUSES = ['RESCHEDULED', 'FAILED', 'RETURNED'];

const PROMISE_PATTERNS = [
  /\bdemain\b/i,
  /\bapr[eè]s[- ]demain\b/i,
  /plus tard/i,
  /je (vais|vai) (voir|r[ée]fl[ée]chir|vous (rappeler|[ée]crire|revenir))/i,
  /je (vous |te )?reviens/i,
  /je (vous |te )?rappelle/i,
  /fin du mois/i,
  /quand j'?aurai/i,
  /la semaine prochaine/i,
  /ce (soir|week[- ]?end)/i,
  /\blundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche\b/i,
];

const INTEREST_PATTERNS = [
  /\bprix\b/i,
  /combien/i,
  /[cç]a co[uû]te/i,
  /\btarif/i,
  /livraison/i,
  /disponible/i,
  /je (veux|voudrais|prends|commande)/i,
  /command/i,
  /comment (on|je) (fait|fais|utilise)/i,
  /\bint[ée]ress/i,
];

const ACK_PATTERNS = /^(ok+|okay|d'accord|dac+|merci( beaucoup)?|bien re[cç]u|👍|🙏|👌|ok merci|super|cool)[\s!.]*$/i;

function normalizePhoneDigits(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '');
}

export function buildWhatsAppLink(phone: string, text: string): string {
  const digits = normalizePhoneDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function firstName(name: string): string {
  const clean = (name || '').trim();
  if (!clean || clean.startsWith('+') || /^\d/.test(clean) || /^client/i.test(clean)) return '';
  return clean.split(/\s+/)[0];
}

function hello(name: string): string {
  const f = firstName(name);
  return f ? `Bonjour ${f}` : 'Bonjour';
}

function formatSince(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const h = minutes / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.round(h / 24);
  return `${d} jour${d > 1 ? 's' : ''}`;
}

/** Date à laquelle une promesse devient "échue". */
export function promiseDueDate(promiseText: string, promisedAt: Date): Date {
  const t = promiseText.toLowerCase();
  const base = new Date(promisedAt.getTime());
  if (/apr[eè]s[- ]demain/.test(t)) return new Date(base.getTime() + 2 * DAY);
  if (/\bdemain\b/.test(t)) return new Date(base.getTime() + DAY);
  if (/ce soir/.test(t)) return new Date(base.getTime() + 6 * HOUR);
  if (/semaine prochaine/.test(t)) return new Date(base.getTime() + 7 * DAY);
  if (/fin du mois/.test(t)) return new Date(base.getTime() + 5 * DAY);
  return new Date(base.getTime() + DAY);
}

const PRIORITY_RANK: Record<SupervisorPriority, number> = { URGENT: 0, HAUTE: 1, NORMALE: 2 };

/**
 * Évalue UNE conversation et renvoie l'alerte la plus importante, ou null.
 */
export function evaluateConversation(
  conv: SupervisorConversationInput,
  now: Date = new Date()
): SupervisorAlert | null {
  if (conv.ignored) return null;
  if (conv.snoozeUntil && conv.snoozeUntil.getTime() > now.getTime()) return null;

  const msgs = conv.messages.filter((m) => m && m.createdAt);
  const orders = conv.orders || [];
  const name = conv.customerName || conv.customerPhone;
  const make = (
    type: SupervisorAlertType,
    priority: SupervisorPriority,
    title: string,
    reason: string,
    sinceMs: number,
    suggestedMessage: string
  ): SupervisorAlert => ({
    conversationId: conv.conversationId,
    customerId: conv.customerId,
    customerName: name,
    customerPhone: conv.customerPhone,
    type,
    priority,
    title,
    reason,
    lastClientMessage: lastInbound?.content || null,
    sinceMinutes: Math.round(sinceMs / MIN),
    suggestedMessage,
    whatsappLink: buildWhatsAppLink(conv.customerPhone, suggestedMessage),
  });

  const lastMsg = msgs[msgs.length - 1];
  const lastInbound = [...msgs].reverse().find((m) => m.direction === 'INBOUND');
  const lastOutbound = [...msgs].reverse().find((m) => m.direction === 'OUTBOUND');
  const hasOutbound = Boolean(lastOutbound);

  const activeOrder = orders.find((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const problemOrder = orders.find((o) => PROBLEM_ORDER_STATUSES.includes(o.status));
  const lastDoneOrder = orders
    .filter((o) => DONE_ORDER_STATUSES.includes(o.status))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const hasAnyOrder = orders.some((o) => o.status !== 'CANCELLED' && o.status !== 'DRAFT');

  // 1. Le client attend une réponse
  if (lastMsg && lastMsg.direction === 'INBOUND') {
    const waited = now.getTime() - lastMsg.createdAt.getTime();
    const isAck = ACK_PATTERNS.test((lastMsg.content || '').trim());
    if (!isAck && waited >= 15 * MIN && waited <= 7 * DAY) {
      if (!hasOutbound) {
        return make(
          'JAMAIS_CONTACTE',
          'URGENT',
          `Nouveau prospect sans réponse`,
          `${name} a écrit il y a ${formatSince(waited / MIN)} et n'a jamais reçu de réponse.`,
          waited,
          `${hello(name)} 😊 merci pour votre message ! Je suis là pour vous aider. Qu'est-ce qui vous intéresse ?`
        );
      }
      return make(
        'NON_REPONDU',
        waited >= 2 * HOUR ? 'URGENT' : 'HAUTE',
        `Attend une réponse`,
        `${name} attend une réponse depuis ${formatSince(waited / MIN)}.`,
        waited,
        `${hello(name)}, désolée pour l'attente 🙏 Je reviens vers vous tout de suite.`
      );
    }
  }

  // 2. Commande bloquée / reportée / échouée
  if (problemOrder) {
    const since = now.getTime() - problemOrder.updatedAt.getTime();
    if (since >= 2 * HOUR) {
      return make(
        'COMMANDE_BLOQUEE',
        'HAUTE',
        `Commande ${problemOrder.status === 'RESCHEDULED' ? 'reportée' : 'non aboutie'}`,
        `La commande de ${name} est ${problemOrder.status === 'RESCHEDULED' ? 'reportée' : 'en échec'} depuis ${formatSince(since / MIN)}. Fixer une nouvelle date de livraison.`,
        since,
        `${hello(name)} 😊 je reviens vers vous pour votre commande. Quel moment vous arrange pour la livraison aujourd'hui ou demain ?`
      );
    }
  }
  if (activeOrder) {
    const since = now.getTime() - activeOrder.createdAt.getTime();
    if (since >= DAY) {
      return make(
        'COMMANDE_BLOQUEE',
        'HAUTE',
        `Commande pas encore livrée`,
        `${name} a une commande confirmée depuis ${formatSince(since / MIN)} sans livraison. Vérifier avec le livreur.`,
        since,
        `${hello(name)}, votre commande est bien notée ✅ Le livreur vous contacte très bientôt. Vous êtes disponible à quelle heure ?`
      );
    }
    return null; // commande en cours normale : rien à faire
  }

  // 3. Promesse échue
  const lastOrderTime = orders.length ? Math.max(...orders.map((o) => o.createdAt.getTime())) : 0;
  const promise = [...msgs]
    .reverse()
    .find((m) => m.direction === 'INBOUND' && PROMISE_PATTERNS.some((p) => p.test(m.content || '')));
  if (promise && promise.createdAt.getTime() > lastOrderTime) {
    const due = promiseDueDate(promise.content || '', promise.createdAt);
    const outboundAfterDue = msgs.some(
      (m) => m.direction === 'OUTBOUND' && m.createdAt.getTime() >= due.getTime()
    );
    const age = now.getTime() - promise.createdAt.getTime();
    if (now.getTime() >= due.getTime() && !outboundAfterDue && age <= 10 * DAY) {
      return make(
        'PROMESSE_ECHUE',
        'HAUTE',
        `Promesse d'achat à relancer`,
        `${name} avait dit : « ${(promise.content || '').slice(0, 80)} » il y a ${formatSince(age / MIN)}.`,
        age,
        `${hello(name)} 😊 comme convenu je reviens vers vous. On programme votre livraison pour aujourd'hui ?`
      );
    }
  }

  // 4. Intéressé sans commande, puis silence
  if (lastMsg && lastMsg.direction === 'OUTBOUND' && !hasAnyOrder) {
    const silence = now.getTime() - lastMsg.createdAt.getTime();
    const showedInterest = msgs.some(
      (m) => m.direction === 'INBOUND' && INTEREST_PATTERNS.some((p) => p.test(m.content || ''))
    );
    if (showedInterest && silence >= 6 * HOUR && silence <= 7 * DAY) {
      return make(
        'INTERESSE_SANS_COMMANDE',
        'HAUTE',
        `Intéressé, n'a pas commandé`,
        `${name} a demandé le prix / la livraison puis ne répond plus depuis ${formatSince(silence / MIN)}.`,
        silence,
        `${hello(name)} 😊 je reviens vers vous pour le produit. Il reste encore quelques pièces, je vous en réserve une ? La livraison est à 1 000 F partout à Ouaga.`
      );
    }
    if (silence >= DAY && silence <= 7 * DAY) {
      return make(
        'SILENCE',
        'NORMALE',
        `Ne répond plus`,
        `Dernier message envoyé à ${name} il y a ${formatSince(silence / MIN)}, sans réponse.`,
        silence,
        `${hello(name)}, j'espère que vous allez bien 😊 Avez-vous eu le temps de réfléchir ? Je reste disponible pour vos questions.`
      );
    }
  }

  // 5. Fidélisation : livré il y a 7 à 14 jours, aucun échange depuis
  if (lastDoneOrder) {
    const sinceDelivery = now.getTime() - lastDoneOrder.updatedAt.getTime();
    const talkedSince = msgs.some((m) => m.createdAt.getTime() > lastDoneOrder.updatedAt.getTime());
    if (sinceDelivery >= 7 * DAY && sinceDelivery <= 14 * DAY && !talkedSince) {
      return make(
        'FIDELISATION',
        'NORMALE',
        `Client à fidéliser`,
        `${name} a été livré il y a ${formatSince(sinceDelivery / MIN)}. Prendre des nouvelles et proposer un autre produit.`,
        sinceDelivery,
        `${hello(name)} 😊 c'est WillShop ! Comment se passe votre utilisation du produit ? Vous voyez déjà des résultats ?`
      );
    }
  }

  return null;
}

/**
 * Évalue toutes les conversations et renvoie les alertes triées : URGENT d'abord, puis la plus ancienne attente.
 */
export function buildSupervisorAlerts(
  conversations: SupervisorConversationInput[],
  now: Date = new Date()
): SupervisorAlert[] {
  return conversations
    .map((c) => evaluateConversation(c, now))
    .filter((a): a is SupervisorAlert => a !== null)
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return p !== 0 ? p : b.sinceMinutes - a.sinceMinutes;
    });
}

export function summarizeAlerts(alerts: SupervisorAlert[]) {
  return {
    total: alerts.length,
    urgent: alerts.filter((a) => a.priority === 'URGENT').length,
    haute: alerts.filter((a) => a.priority === 'HAUTE').length,
    normale: alerts.filter((a) => a.priority === 'NORMALE').length,
    byType: alerts.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {}),
  };
}
