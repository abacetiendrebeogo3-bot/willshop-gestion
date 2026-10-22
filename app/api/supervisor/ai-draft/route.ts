import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

/**
 * POST { conversationId, alertType, reason }
 * Lit les 30 derniers messages de la conversation et demande à OpenAI :
 *  - un résumé en une phrase de la situation
 *  - LE message de relance à envoyer (court, naturel, style WhatsApp Burkina)
 * Appelé uniquement quand la commerciale clique sur « Rédiger avec l'IA » (maîtrise des coûts).
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY n'est pas configurée dans Vercel." }, { status: 400 });
    }
    const model = process.env.OPENAI_SUPERVISOR_MODEL || 'gpt-4o-mini';

    const admin = createClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );
    const userClient = await createServerSupabaseClient();
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: roles } = await admin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', auth.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1);
    const organizationId = roles?.[0]?.organization_id;
    if (!organizationId) return NextResponse.json({ error: 'Aucune organisation' }, { status: 403 });

    const { conversationId, alertType, reason } = await request.json();
    if (!conversationId) return NextResponse.json({ error: 'conversationId manquant' }, { status: 400 });

    const { data: msgs, error } = await admin
      .from('messages')
      .select('direction, content, created_at')
      .eq('organization_id', organizationId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    const transcript = (msgs || [])
      .reverse()
      .map((m: any) => {
        const who = m.direction === 'INBOUND' ? 'CLIENT' : 'COMMERCIALE';
        const at = new Date(m.created_at).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' });
        return `[${at}] ${who}: ${(m.content || '').slice(0, 400)}`;
      })
      .join('\n');

    const system = `Tu es le superviseur commercial de WillShop, boutique en ligne à Ouagadougou (Burkina Faso) qui vend des produits bien-être et cosmétiques (Kit Minceur, Kit Maca, etc.), paiement à la livraison, livraison 1 000 F partout à Ouaga.
Tu aides la commerciale à relancer ses prospects sur WhatsApp.
Réponds UNIQUEMENT en JSON : {"resume": "...", "message": "..."}
- "resume" : une phrase qui dit où en est le prospect et ce qui bloque.
- "message" : le message exact à envoyer au client. Court (2-3 phrases max), chaleureux, naturel, français simple de Ouaga, 1 emoji max, vouvoiement. Il doit pousser vers une action claire (commander, fixer une heure de livraison, répondre à une question). Ne jamais inventer de prix, de promo ou d'information absente de la conversation.`;

    const user = `Situation détectée : ${alertType || 'inconnue'} — ${reason || ''}

Conversation (heure de Ouagadougou) :
${transcript || '(aucun message)'}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[SUPERVISOR_AI] OpenAI error', res.status, txt);
      return NextResponse.json({ error: `OpenAI HTTP ${res.status}: ${txt.slice(0, 160)}` }, { status: 502 });
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed: { resume?: string; message?: string } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }

    return NextResponse.json({
      status: 'SUCCESS',
      summary: parsed.resume || '',
      message: parsed.message || '',
      usage: data?.usage || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur IA' }, { status: 500 });
  }
}
