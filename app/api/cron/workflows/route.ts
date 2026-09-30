import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WorkflowSchedulerService } from '@/src/application/services/WorkflowSchedulerService';
import { getRequiredEnv } from '@/src/config/env';
import { requireRole } from '@/src/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCronExecution(request);
}

export async function POST(request: NextRequest) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[CRON SECURITY ALERT] CRON_SECRET is missing. Failing closed.');
      return NextResponse.json(
        { error: 'Configuration critique manquante: CRON_SECRET n\'est pas défini.' },
        { status: 500 }
      );
    }

    let targetOrgId: string | undefined = undefined;
    const authHeader = request.headers.get('authorization');
    const isCronAuthorized = authHeader === `Bearer ${cronSecret}`;

    if (isCronAuthorized) {
      // 1. Authorized by true CRON secret
      targetOrgId = request.nextUrl.searchParams.get('orgId') || undefined;
    } else {
      // 2. Fallback to manual execution by an OWNER
      const { organizationId, errorResponse } = await requireRole(request, ['OWNER']);
      if (errorResponse) return errorResponse;

      const requestedOrgId = request.nextUrl.searchParams.get('orgId');
      if (requestedOrgId && requestedOrgId !== organizationId) {
        return NextResponse.json(
          { error: 'Interdit : Vous ne pouvez déclencher le cron que pour votre propre organisation.' },
          { status: 403 }
        );
      }
      
      targetOrgId = organizationId;
    }

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

    // 3. Execute Workflow Engine Evaluation
    const schedulerService = new WorkflowSchedulerService(supabaseAdmin);
    const summary = await schedulerService.evaluateDueWorkflows(targetOrgId);

    return NextResponse.json({
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (err: any) {
    console.error('[Cron Workflows Route Error]', err);
    return NextResponse.json(
      { status: 'ERROR', error: err.message || 'Worker execution error' },
      { status: 500 }
    );
  }
}
