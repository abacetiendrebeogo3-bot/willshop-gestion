import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { RoutineEngineService } from '@/src/application/services/RoutineEngineService';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // 1. Authenticate CEO User
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
        { error: 'Session non authentifiée.' },
        { status: 401 }
      );
    }

    // 2. Resolve organizationId
    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Aucune organisation associée.' },
        { status: 403 }
      );
    }

    // 3. Load CEO Metrics & Active Routine
    const routineService = new RoutineEngineService(supabaseAdmin);
    const metrics = await routineService.getCEODirectionMetrics(organizationId);
    const routine = await routineService.getOrCreateRoutine(user.id, organizationId, 'CEO_MY_DIRECTION');

    return NextResponse.json({
      status: 'SUCCESS',
      metrics,
      routine,
    });
  } catch (err: any) {
    console.error('[CEO Routine API Error]', err);
    return NextResponse.json(
      { error: err.message || 'Erreur lors du chargement de la routine CEO.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { routineId, currentStepKey, nextStepKey, isFinished } = body;

    let supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    let serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Update current step to COMPLETED
    if (currentStepKey) {
      await supabaseAdmin.from('routine_steps')
        .update({ status: 'COMPLETED' })
        .eq('routine_id', routineId)
        .eq('step_key', currentStepKey);
    }

    // Update next step to IN_PROGRESS
    if (nextStepKey && !isFinished) {
      await supabaseAdmin.from('routine_steps')
        .update({ status: 'IN_PROGRESS' })
        .eq('routine_id', routineId)
        .eq('step_key', nextStepKey);
    }

    // Update total_actions_completed
    const { data: steps } = await supabaseAdmin.from('routine_steps')
      .select('id')
      .eq('routine_id', routineId)
      .eq('status', 'COMPLETED');
    
    const completedCount = steps ? steps.length : 0;

    await supabaseAdmin.from('work_routines')
      .update({ 
        total_actions_completed: completedCount,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS' 
      })
      .eq('id', routineId);

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (err: any) {
    console.error('[Routine PATCH Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
