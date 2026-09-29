import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { UnifiedAIAssistantService, UserRole } from '@/src/application/services/UnifiedAIAssistantService';
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
      console.error('[Config Error] Supabase credentials missing in /api/ai/assistant:', envErr);
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

    // 2. Resolve organization_id and user role
    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    let organizationId = userRoles?.[0]?.organization_id;
    let role: UserRole = (userRoles?.[0]?.role as UserRole) || 'COMMERCIAL';

    if (!organizationId) {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (member) {
        organizationId = member.organization_id;
        role = (member.role as UserRole) || 'COMMERCIAL';
      }
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Aucune organisation valide associée à cet utilisateur.' },
        { status: 403 }
      );
    }

    // 3. Parse Body
    const body = await request.json();
    const { query, customerId, conversationId } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'La question (query) est obligatoire.' },
        { status: 400 }
      );
    }

    // 4. Delegate to Unified AI Assistant Service
    const assistantResult = await UnifiedAIAssistantService.processQuery({
      supabase: supabaseAdmin,
      organizationId,
      userId: user.id,
      role,
      query: query.trim(),
      customerId,
      conversationId,
    });

    return NextResponse.json({
      status: 'SUCCESS',
      ...assistantResult,
    });
  } catch (err: any) {
    console.error('Error in POST /api/ai/assistant:', err);
    return NextResponse.json(
      { error: err.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
