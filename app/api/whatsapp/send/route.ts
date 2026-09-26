import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { EvolutionWhatsAppAdapter } from '@/src/infrastructure/whatsapp/EvolutionWhatsAppAdapter';
import { MetaWhatsAppAdapter } from '@/src/infrastructure/whatsapp/MetaWhatsAppAdapter';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let supabaseUrl = '';
    let serviceKey = '';
    try {
      supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    } catch (envErr) {
      console.error('[Config Error] Configuration Supabase manquante dans /api/whatsapp/send:', envErr);
      return NextResponse.json(
        { error: 'Configuration serveur manquante (variables d\'environnement non définies).' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate user
    let user = null;
    try {
      const supabaseUserClient = await createServerSupabaseClient();
      const { data: cookieAuthData } = await supabaseUserClient.auth.getUser();
      if (cookieAuthData?.user) {
        user = cookieAuthData.user;
      }
    } catch {}

    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const { data: tokenAuthData } = await supabaseAdmin.auth.getUser(token);
        if (tokenAuthData?.user) {
          user = tokenAuthData.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous reconnecter.' },
        { status: 401 }
      );
    }

    // 2. Resolve organization_id server-side
    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Aucune organisation valide associée à cet utilisateur.' },
        { status: 403 }
      );
    }

    // 3. Parse request payload
    const body = await request.json();
    const { conversationId, text } = body;

    if (!conversationId || !text || !text.trim()) {
      return NextResponse.json(
        { error: 'Paramètres manquants (conversationId, text)' },
        { status: 400 }
      );
    }

    // 4. Fetch conversation & customer details
    const { data: conversation, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('*, customers(id, phone, first_name, last_name)')
      .eq('id', conversationId)
      .eq('organization_id', organizationId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable ou non autorisée' },
        { status: 404 }
      );
    }

    const recipientPhone = conversation.customers?.phone;
    if (!recipientPhone) {
      return NextResponse.json(
        { error: 'Numéro de téléphone destinataire introuvable pour cette conversation' },
        { status: 400 }
      );
    }

    // 5. Fetch registered active WhatsApp line for organization
    const { data: whatsappNum, error: numErr } = await supabaseAdmin
      .from('whatsapp_numbers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (numErr || !whatsappNum) {
      return NextResponse.json(
        { error: 'Aucun numéro WhatsApp actif trouvé pour cette organisation. Veuillez connecter un numéro dans l onglet WhatsApp.' },
        { status: 400 }
      );
    }

    const provider = (whatsappNum.provider || 'EVOLUTION').toUpperCase();
    const providerIdentity = whatsappNum.provider_identity || whatsappNum.provider_phone_number_id || `ws_org_${organizationId.replace(/-/g, '').slice(0, 12)}`;

    // 6. Instantiate adapter & send message via WhatsApp gateway
    const adapter = provider === 'EVOLUTION'
      ? new EvolutionWhatsAppAdapter()
      : new MetaWhatsAppAdapter();

    const sendResult = await adapter.sendTextMessage(providerIdentity, {
      toPhoneNumber: recipientPhone,
      messageText: text.trim(),
    });

    if (sendResult.status === 'FAILED') {
      console.error(`[OUTBOUND_WHATSAPP_FAILED] Evolution API returned error:`, sendResult.errorCode);
      return NextResponse.json(
        {
          error: `Échec d envoi WhatsApp réel via Evolution API : ${sendResult.errorCode || 'Erreur passerelle'}`,
        },
        { status: 502 }
      );
    }

    // 7. Message was successfully delivered to Evolution API — Persist in Supabase
    const { data: insertedMsg, error: msgInsertErr } = await supabaseAdmin
      .from('messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        customer_id: conversation.customer_id,
        direction: 'OUTBOUND',
        sender_type: 'HUMAN',
        sender_id: user.id,
        message_type: 'TEXT',
        content: text.trim(),
        external_message_id: sendResult.externalMessageId,
        status: 'SENT',
      })
      .select()
      .single();

    if (msgInsertErr) {
      console.error('Error inserting outbound message record:', msgInsertErr);
    }

    // 8. Update conversation status to HUMAN_ACTIVE and last_message_at
    await supabaseAdmin
      .from('conversations')
      .update({
        conversation_mode: 'HUMAN_ACTIVE',
        assigned_agent: 'HUMAN',
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return NextResponse.json({
      success: true,
      externalMessageId: sendResult.externalMessageId,
      message: insertedMsg || { content: text.trim(), status: 'SENT' },
    });
  } catch (error: any) {
    console.error('Error in POST /api/whatsapp/send:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur lors de l envoi' },
      { status: 500 }
    );
  }
}
