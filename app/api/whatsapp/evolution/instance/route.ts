import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { EvolutionWhatsAppAdapter } from '@/src/infrastructure/whatsapp/EvolutionWhatsAppAdapter';
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
      console.error('[Config Error] Configuration Supabase manquante dans /api/whatsapp/evolution/instance:', envErr);
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

    // 2. Resolve organization_id server-side via membership
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

    // 3. Initialize Evolution Adapter and check credentials
    const evolutionAdapter = new EvolutionWhatsAppAdapter();
    if (!evolutionAdapter.isConfigured()) {
      return NextResponse.json(
        { error: evolutionAdapter.getConfigError() },
        { status: 500 }
      );
    }

    // 4. Generate deterministic instance name per organization
    const instanceName = `ws_org_${organizationId.replace(/-/g, '').slice(0, 12)}`;

    // Determine Webhook URL for Evolution to post events back to WILLShop OS
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || 'https://willshop-gestion.vercel.app').replace(/\/+$/, '');
    const webhookUrl = `${appUrl}/api/webhooks/whatsapp/evolution`;

    // 5. Create or verify instance on Evolution
    const createResult = await evolutionAdapter.createInstance(instanceName, webhookUrl);
    if (!createResult.success) {
      return NextResponse.json(
        { error: `Échec création instance Evolution: ${createResult.error || 'Erreur inconnue'}` },
        { status: 502 }
      );
    }

    // Ensure Webhook is configured
    const webhookRes = await evolutionAdapter.setWebhook(instanceName, webhookUrl);
    if (!webhookRes.success) {
      console.error(`[Evolution Instance Route] Webhook configuration failed for ${instanceName}: ${webhookRes.error}`);
      return NextResponse.json(
        { error: `Instance connectée mais configuration du webhook échouée : ${webhookRes.error || 'Erreur inconnue'}` },
        { status: 502 }
      );
    }

    // 6. Check current connection state
    const connState = await evolutionAdapter.getConnectionState(instanceName);

    // Pre-register or update whatsapp_numbers row so org is mapped immediately
    const ownerInfo = await evolutionAdapter.getInstanceOwnerInfo(instanceName);
    const realPhone = ownerInfo.phoneNumber || connState.phoneNumber || instanceName;

    await supabaseAdmin.from('whatsapp_numbers').upsert(
      {
        organization_id: organizationId,
        phone_number: realPhone,
        display_name: ownerInfo.displayName || 'WILLShop Evolution',
        provider: 'EVOLUTION',
        provider_identity: instanceName,
        provider_phone_number_id: instanceName,
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_phone_number_id' }
    );

    if (connState.state === 'CONNECTED') {
      return NextResponse.json({
        success: true,
        instanceName,
        state: 'CONNECTED',
        phoneNumber: realPhone,
      });
    }

    // 7. Instance is not yet connected — fetch QR Code
    const qrResult = await evolutionAdapter.getQrCode(instanceName);

    return NextResponse.json({
      success: true,
      instanceName,
      state: 'WAITING_QR',
      qrCode: {
        base64: qrResult.base64 || createResult.qrcode?.base64,
        code: qrResult.code || createResult.qrcode?.code,
        pairingCode: qrResult.pairingCode || createResult.qrcode?.pairingCode,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/whatsapp/evolution/instance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
