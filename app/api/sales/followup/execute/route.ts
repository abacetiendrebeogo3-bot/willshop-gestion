import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { WorkflowSchedulerService } from '@/src/application/services/WorkflowSchedulerService';
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
      return NextResponse.json(
        { error: 'Configuration serveur Supabase manquante.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate Commercial User
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

    // 2. Resolve organizationId
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

    const body = await request.json();
    const { engagementId, messageText, recipientPhone } = body;

    if (!engagementId || !messageText || !recipientPhone) {
      return NextResponse.json(
        { error: 'Paramètres manquants (engagementId, messageText, recipientPhone).' },
        { status: 400 }
      );
    }

    // 3. Execute Commercial Follow-up
    const schedulerService = new WorkflowSchedulerService(supabaseAdmin);
    const result = await schedulerService.executeCommercialFollowup({
      engagementId,
      organizationId,
      messageText,
      recipientPhone,
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Échec d envoi de la relance.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'Relance commerciale envoyée avec succès via WhatsApp.',
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error('[Followup Execute API Error]', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors de l exécution de la relance.' },
      { status: 500 }
    );
  }
}
