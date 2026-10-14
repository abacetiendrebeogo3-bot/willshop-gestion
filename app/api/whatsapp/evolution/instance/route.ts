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
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Aucune organisation valide associée à cet utilisateur.' },
        { status: 403 }
      );
    }

    // 3. Fetch org settings to see if dynamic credentials exist
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    const orgSettings = orgData?.settings || {};

    // Check if client explicitly requests demo mode via body or query param
    let body: any = {};
    try {
      const rawText = await request.text();
      if (rawText) body = JSON.parse(rawText);
    } catch {}

    const queryMode = request.nextUrl.searchParams.get('mode');
    const isDemoRequested = body?.mode === 'demo' || queryMode === 'demo';

    let evoUrl = orgSettings.evolution_api_url || process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || '';
    let evoKey = orgSettings.evolution_api_key || process.env.EVOLUTION_API_KEY || '';

    if (isDemoRequested) {
      evoUrl = 'DEMO';
      evoKey = 'demo-key';
      const updatedSettings = {
        ...orgSettings,
        evolution_api_url: 'DEMO',
        evolution_api_key: 'demo-key',
      };
      await supabaseAdmin
        .from('organizations')
        .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
        .eq('id', organizationId);
    }

    const evolutionAdapter = new EvolutionWhatsAppAdapter(evoUrl, evoKey);
    if (!evolutionAdapter.isConfigured()) {
      return NextResponse.json(
        {
          error: evolutionAdapter.getConfigError(),
          missingConfig: true,
          configuredUrl: evoUrl || '',
        },
        { status: 400 }
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
        {
          error: createResult.error || 'Erreur inconnue lors de la connexion Evolution',
          isNetworkError: true,
          configuredUrl: evoUrl,
        },
        { status: 502 }
      );
    }

    // Ensure Webhook is configured (skipped if demo)
    if (!evolutionAdapter.isDemo()) {
      const webhookRes = await evolutionAdapter.setWebhook(instanceName, webhookUrl);
      if (!webhookRes.success) {
        console.error(`[Evolution Instance Route] Webhook configuration failed for ${instanceName}: ${webhookRes.error}`);
      }
    }

    // 6. Check current connection state
    const connState = await evolutionAdapter.getConnectionState(instanceName);

    // Pre-register or update whatsapp_numbers row so org is mapped immediately
    const ownerInfo = await evolutionAdapter.getInstanceOwnerInfo(instanceName);
    const realPhone = ownerInfo.phoneNumber || connState.phoneNumber || '+22655002796';

    const { data: existingNum } = await supabaseAdmin
      .from('whatsapp_numbers')
      .select('id')
      .eq('organization_id', organizationId)
      .or(`provider_identity.eq.${instanceName},provider_phone_number_id.eq.${instanceName}`)
      .maybeSingle();

    if (existingNum?.id) {
      await supabaseAdmin
        .from('whatsapp_numbers')
        .update({
          phone_number: realPhone,
          display_name: ownerInfo.displayName || (evolutionAdapter.isDemo() ? 'WILLShop Démo (+226 55 00 27 96)' : 'WILLShop Evolution'),
          status: 'ACTIVE',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingNum.id);
    } else {
      await supabaseAdmin.from('whatsapp_numbers').insert({
        organization_id: organizationId,
        phone_number: realPhone,
        display_name: ownerInfo.displayName || (evolutionAdapter.isDemo() ? 'WILLShop Démo (+226 55 00 27 96)' : 'WILLShop Evolution'),
        provider: 'EVOLUTION',
        provider_identity: instanceName,
        provider_phone_number_id: instanceName,
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      });
    }

    // 7. Always fetch QR Code so the client can display the QR code in the modal
    let qrResult: any = { base64: null, code: null, pairingCode: null };
    try {
      qrResult = await evolutionAdapter.getQrCode(instanceName);
    } catch (e) {
      console.warn('[Evolution Instance Route] getQrCode warning:', e);
    }

    const qrBase64 = qrResult?.base64 || createResult.qrcode?.base64 || (evolutionAdapter.isDemo() ? evolutionAdapter.getDemoQrSvg() : null);

    return NextResponse.json({
      success: true,
      instanceName,
      state: connState.state,
      phoneNumber: realPhone,
      isDemo: evolutionAdapter.isDemo(),
      qrCode: {
        base64: qrBase64,
        code: qrResult?.code || createResult.qrcode?.code || `DEMO-${instanceName}`,
        pairingCode: qrResult?.pairingCode || createResult.qrcode?.pairingCode || 'WILL-1234',
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
