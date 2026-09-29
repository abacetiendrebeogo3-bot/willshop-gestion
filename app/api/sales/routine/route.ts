import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { RoutineEngineService } from '@/src/application/services/RoutineEngineService';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    let supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    let serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const supabaseUserClient = await createServerSupabaseClient();
    const { data: cookieAuthData } = await supabaseUserClient.auth.getUser();
    const user = cookieAuthData?.user;

    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order("created_at", { ascending: true })
      .limit(1);

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) return NextResponse.json({ error: 'No org' }, { status: 403 });

    const routineService = new RoutineEngineService(supabaseAdmin);
    const routine = await routineService.getOrCreateRoutine(user.id, organizationId, 'COMMERCIAL_MY_DAY');

    return NextResponse.json({ status: 'SUCCESS', routine });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { routineId, currentStepKey, nextStepKey, isFinished } = body;

    let supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    let serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (currentStepKey) {
      await supabaseAdmin.from('routine_steps')
        .update({ status: 'COMPLETED' })
        .eq('routine_id', routineId)
        .eq('step_key', currentStepKey);
    }
    if (nextStepKey && !isFinished) {
      await supabaseAdmin.from('routine_steps')
        .update({ status: 'IN_PROGRESS' })
        .eq('routine_id', routineId)
        .eq('step_key', nextStepKey);
    }

    const { data: steps } = await supabaseAdmin.from('routine_steps')
      .select('id')
      .eq('routine_id', routineId)
      .eq('status', 'COMPLETED');
    
    await supabaseAdmin.from('work_routines')
      .update({ 
        total_actions_completed: steps ? steps.length : 0,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS' 
      })
      .eq('id', routineId);

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
