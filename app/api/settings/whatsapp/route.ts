import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    let supabaseUrl = '';
    let serviceKey = '';
    try {
      supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    } catch {
      return NextResponse.json(
        { error: 'Configuration serveur Supabase manquante.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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
      return NextResponse.json({ error: 'Session non authentifiée.' }, { status: 401 });
    }

    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Aucune organisation trouvée.' }, { status: 403 });
    }

    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    const orgSettings = orgData?.settings || {};
    const evoUrl = process.env.EVOLUTION_API_URL || process.env.NEXT_PUBLIC_EVOLUTION_API_URL || orgSettings.evolution_api_url || '';
    const evoKey = process.env.EVOLUTION_API_KEY || orgSettings.evolution_api_key || '';

    const isConfigured = Boolean(evoUrl && evoKey);
    const maskedKey = evoKey ? `${evoKey.slice(0, 4)}...${evoKey.slice(-4)}` : '';

    return NextResponse.json({
      configured: isConfigured,
      evolution_api_url: evoUrl,
      hasKey: Boolean(evoKey),
      maskedKey,
      source: process.env.EVOLUTION_API_KEY ? 'ENV_VARIABLE' : orgSettings.evolution_api_key ? 'DB_SETTINGS' : 'NONE',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let supabaseUrl = '';
    let serviceKey = '';
    try {
      supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
      serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    } catch {
      return NextResponse.json(
        { error: 'Configuration serveur Supabase manquante.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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
      return NextResponse.json({ error: 'Session non authentifiée.' }, { status: 401 });
    }

    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Aucune organisation trouvée.' }, { status: 403 });
    }

    const body = await request.json();
    const { evolution_api_url, evolution_api_key } = body || {};

    if (!evolution_api_url || !evolution_api_key) {
      return NextResponse.json(
        { error: 'L\'URL du serveur Evolution API et la clé API sont requises.' },
        { status: 400 }
      );
    }

    const cleanUrl = evolution_api_url.trim().replace(/\/+$/, '');
    const cleanKey = evolution_api_key.trim().replace(/^["']|["']$/g, '');

    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    const existingSettings = orgData?.settings || {};
    const updatedSettings = {
      ...existingSettings,
      evolution_api_url: cleanUrl,
      evolution_api_key: cleanKey,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('organizations')
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq('id', organizationId);

    if (updateErr) {
      console.error('Error updating organization settings:', updateErr);
      return NextResponse.json({ error: 'Échec de sauvegarde des paramètres.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration Evolution API enregistrée avec succès.',
      evolution_api_url: cleanUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
