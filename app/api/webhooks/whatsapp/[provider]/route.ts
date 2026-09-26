import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppEventNormalizer } from '@/src/infrastructure/whatsapp/WhatsAppEventNormalizer';
import { EvolutionWhatsAppAdapter } from '@/src/infrastructure/whatsapp/EvolutionWhatsAppAdapter';
import { MetaWhatsAppAdapter } from '@/src/infrastructure/whatsapp/MetaWhatsAppAdapter';
import { WhatsAppApplicationService } from '@/src/application/services/WhatsAppApplicationService';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.warn('GET /api/webhooks/whatsapp: WHATSAPP_VERIFY_TOKEN environment variable is not configured');
    return NextResponse.json({ error: 'Webhook verify token unconfigured' }, { status: 500 });
  }

  if (mode === 'subscribe' && token === expectedToken) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const correlationId = request.headers.get('x-correlation-id') || `wh-${Date.now()}`;
  const provider = params.provider.toLowerCase();

  try {
    let supabaseUrl = '';
    let supabaseServiceRoleKey = '';
    try {
      supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    } catch (envErr) {
      console.error('[Config Error] Supabase credentials missing in webhook:', envErr);
      return NextResponse.json(
        { status: 'ERROR', message: 'Configuration serveur manquante (variables d\'environnement non définies).' },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || request.headers.get('apikey') || '';

    // Select appropriate provider adapter
    const adapter =
      provider === 'evolution'
        ? new EvolutionWhatsAppAdapter()
        : new MetaWhatsAppAdapter();

    // Verify signature for security
    const isValidSignature = adapter.verifyWebhookSignature(rawBody, signature, '');
    if (!isValidSignature) {
      console.warn(`[SECURITY] Invalid signature for provider '${provider}'`);
      return NextResponse.json({ error: 'Unauthorized: signature verification failed' }, { status: 401 });
    }

    const rawPayload = JSON.parse(rawBody || '{}');

    // 1. Normalize Event
    const normalizedEvent = WhatsAppEventNormalizer.normalize(provider, rawPayload);

    if (!normalizedEvent) {
      return NextResponse.json({
        status: 'SUCCESS',
        provider,
        correlationId,
        processedEvents: 0,
        message: 'Non-message payload or ignored event type',
      });
    }

    // 2. Delegate to Application Service
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const appService = new WhatsAppApplicationService(supabase, adapter);

    const result = await appService.processInboundEvent(normalizedEvent);

    if (result.status === 'ERROR') {
      console.warn(`[WEBHOOK_REJECTED] ${result.message}`);
      return NextResponse.json(
        { status: 'ERROR', message: result.message, correlationId },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'SUCCESS',
      provider,
      correlationId,
      processedEvents: 1,
      conversationId: result.conversationId,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error processing WhatsApp webhook:', error);
    return NextResponse.json(
      { status: 'ERROR', message: error.message, correlationId },
      { status: 500 }
    );
  }
}
