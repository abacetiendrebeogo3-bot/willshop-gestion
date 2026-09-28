import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { WorkflowSchedulerService } from '@/src/application/services/WorkflowSchedulerService';
import { getRequiredEnv } from '@/src/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCronExecution(request);
}

export async function POST(request: NextRequest) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: NextRequest) {
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

    // 1. Authenticate Vercel Cron or User Session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'willshop_cron_secret';
    let isAuthorized = false;

    if (authHeader && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else if (request.nextUrl.searchParams.get('secret') === cronSecret) {
      isAuthorized = true;
    } else {
      // Check if logged-in user session (CEO / Manager triggering worker from UI)
      try {
        const supabaseUserClient = await createServerSupabaseClient();
        const { data: authData } = await supabaseUserClient.auth.getUser();
        if (authData?.user) {
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Accès non autorisé au worker de workflow.' },
        { status: 401 }
      );
    }

    // 2. Optional target organizationId filter
    const targetOrgId = request.nextUrl.searchParams.get('orgId') || undefined;

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
