import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/src/lib/auth/requireRole';
import { RoutineEngineService } from '@/src/application/services/RoutineEngineService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER']);
    if (errorResponse) return errorResponse;

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
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { routineId, currentStepKey, nextStepKey, isFinished } = body;

    // Optional: could verify if routineId belongs to the current user
    // (In a real scenario, you'd want to check this)
    const { data: routine } = await supabaseAdmin.from('work_routines')
      .select('id, user_id')
      .eq('id', routineId)
      .single();

    if (!routine || routine.user_id !== user.id) {
      return NextResponse.json({ error: 'Routine non trouvée ou accès refusé' }, { status: 403 });
    }

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
