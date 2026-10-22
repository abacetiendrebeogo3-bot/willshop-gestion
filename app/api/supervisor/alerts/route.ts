import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { getRequiredEnv } from '@/src/config/env';
import {
  buildSupervisorAlerts,
  summarizeAlerts,
  SupervisorConversationInput,
} from '@/src/application/services/SupervisorEngine';

export const dynamic = 'force-dynamic';

const LOOKBACK_DAYS = 15;

async function resolveContext(): Promise<
  { admin: SupabaseClient; organizationId: string } | { error: NextResponse }
> {
  const admin = createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
  const userClient = await createServerSupabaseClient();
  const { data } = await userClient.auth.getUser();
  const user = data?.user;
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };

  const { data: roles } = await admin
    .from('user_organization_roles')
    .select('organization_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const organizationId = roles?.[0]?.organization_id;
  if (!organizationId) return { error: NextResponse.json({ error: 'Aucune organisation' }, { status: 403 }) };
  return { admin, organizationId };
}

/**
 * GET — calcule les alertes du superviseur en direct (aucun envoi WhatsApp).
 */
export async function GET(_request: NextRequest) {
  try {
    const ctx = await resolveContext();
    if ('error' in ctx) return ctx.error;
    const { admin, organizationId } = ctx;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();

    const { data: convs, error: convErr } = await admin
      .from('conversations')
      .select('id, customer_id, metadata, last_message_at, customers(first_name, last_name, phone, whatsapp_phone)')
      .eq('organization_id', organizationId)
      .gte('last_message_at', since)
      .order('last_message_at', { ascending: false })
      .limit(300);
    if (convErr) throw convErr;

    const conversations = convs || [];
    const convIds = conversations.map((c: any) => c.id);
    const customerIds = conversations.map((c: any) => c.customer_id).filter(Boolean);

    const messagesByConv = new Map<string, any[]>();
    // Lecture par paquets pour rester sous les limites PostgREST
    for (let i = 0; i < convIds.length; i += 100) {
      const chunk = convIds.slice(i, i + 100);
      const { data: msgs, error: msgErr } = await admin
        .from('messages')
        .select('conversation_id, direction, content, created_at')
        .eq('organization_id', organizationId)
        .in('conversation_id', chunk)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(10000);
      if (msgErr) throw msgErr;
      for (const m of msgs || []) {
        const list = messagesByConv.get(m.conversation_id) || [];
        list.push(m);
        messagesByConv.set(m.conversation_id, list);
      }
    }

    const ordersByCustomer = new Map<string, any[]>();
    for (let i = 0; i < customerIds.length; i += 100) {
      const chunk = customerIds.slice(i, i + 100);
      const { data: orders } = await admin
        .from('orders')
        .select('customer_id, status, created_at, updated_at')
        .eq('organization_id', organizationId)
        .in('customer_id', chunk)
        .is('deleted_at', null);
      for (const o of orders || []) {
        const list = ordersByCustomer.get(o.customer_id) || [];
        list.push(o);
        ordersByCustomer.set(o.customer_id, list);
      }
    }

    const inputs: SupervisorConversationInput[] = conversations.map((c: any) => {
      const cust = Array.isArray(c.customers) ? c.customers[0] : c.customers;
      const name = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.replace(/\bWhatsApp\b/g, '').trim() : '';
      const phone = cust?.whatsapp_phone || cust?.phone || '';
      const sup = c.metadata?.supervisor || {};
      return {
        conversationId: c.id,
        customerId: c.customer_id,
        customerName: name || phone,
        customerPhone: phone,
        ignored: sup.ignored === true,
        snoozeUntil: sup.snooze_until ? new Date(sup.snooze_until) : null,
        messages: (messagesByConv.get(c.id) || []).map((m) => ({
          direction: m.direction,
          content: m.content,
          createdAt: new Date(m.created_at),
        })),
        orders: (ordersByCustomer.get(c.customer_id) || []).map((o) => ({
          status: o.status,
          createdAt: new Date(o.created_at),
          updatedAt: new Date(o.updated_at),
        })),
      };
    });

    const alerts = buildSupervisorAlerts(inputs.filter((i) => i.customerPhone));
    return NextResponse.json({
      status: 'SUCCESS',
      generatedAt: new Date().toISOString(),
      conversationsAnalyzed: inputs.length,
      summary: summarizeAlerts(alerts),
      alerts,
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (err: any) {
    console.error('[SUPERVISOR] GET error', err);
    return NextResponse.json({ error: err.message || 'Erreur superviseur' }, { status: 500 });
  }
}

/**
 * POST — actions de la commerciale sur une alerte :
 *  - "done"   : relance faite, on masque 24h (le message envoyé depuis le téléphone arrivera via le webhook)
 *  - "snooze" : plus tard (hours, défaut 3h)
 *  - "ignore" : contact perso / pas un prospect, ne plus jamais alerter
 *  - "unignore"
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext();
    if ('error' in ctx) return ctx.error;
    const { admin, organizationId } = ctx;

    const body = await request.json();
    const { conversationId, action, hours } = body || {};
    if (!conversationId || !['done', 'snooze', 'ignore', 'unignore'].includes(action)) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    const { data: conv, error } = await admin
      .from('conversations')
      .select('id, metadata')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!conv) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });

    const metadata = conv.metadata || {};
    const sup = { ...(metadata.supervisor || {}) };
    const now = Date.now();
    if (action === 'done') sup.snooze_until = new Date(now + 24 * 3600 * 1000).toISOString();
    if (action === 'snooze') sup.snooze_until = new Date(now + (Number(hours) || 3) * 3600 * 1000).toISOString();
    if (action === 'ignore') sup.ignored = true;
    if (action === 'unignore') { sup.ignored = false; sup.snooze_until = null; }
    sup.last_action = action;
    sup.last_action_at = new Date(now).toISOString();

    const { error: upErr } = await admin
      .from('conversations')
      .update({ metadata: { ...metadata, supervisor: sup } })
      .eq('id', conversationId)
      .eq('organization_id', organizationId);
    if (upErr) throw upErr;

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur' }, { status: 500 });
  }
}
