import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
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
      console.error('[Config Error] Configuration Supabase manquante dans /api/delivery/status:', envErr);
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

    // 2. Resolve organization_id server-side
    const { data: userRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id, role')
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
    const { deliveryId, status, failureReason, notes, recipientName, rescheduledDate } = body;

    if (!deliveryId || !status) {
      return NextResponse.json(
        { error: 'deliveryId et status sont requis.' },
        { status: 400 }
      );
    }

    if (status === 'FAILED' && (!failureReason || !failureReason.trim())) {
      return NextResponse.json(
        { error: 'Le motif d\'échec est obligatoire pour déclarer un échec de livraison.' },
        { status: 400 }
      );
    }

    // 3. Prepare patch updates
    const nowIso = new Date().toISOString();
    const patch: any = {
      status,
      updated_at: nowIso,
    };

    if (notes) {
      patch.notes = notes;
    }

    if (status === 'IN_TRANSIT') {
      patch.picked_up_at = nowIso;
    } else if (status === 'DELIVERED') {
      patch.delivered_at = nowIso;
      if (recipientName) patch.recipient_name = recipientName;
    } else if (status === 'FAILED') {
      patch.failed_at = nowIso;
      patch.failure_reason = failureReason;
    } else if (status === 'RESCHEDULED') {
      patch.rescheduled_at = nowIso;
      if (rescheduledDate) patch.scheduled_date = rescheduledDate;
    }

    // Update delivery record in DB
    const { data: updatedDelivery, error: updateErr } = await supabaseAdmin
      .from('deliveries')
      .update(patch)
      .eq('id', deliveryId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating delivery status:', updateErr);
      return NextResponse.json(
        { error: `Échec de mise à jour de la livraison : ${updateErr.message}` },
        { status: 500 }
      );
    }

    // Audit action log
    try {
      await supabaseAdmin.from('ai_actions').insert({
        organization_id: organizationId,
        action_type: `DELIVERY_${status}`,
        title: `Mise à jour livraison: ${status}`,
        details: {
          deliveryId,
          status,
          failureReason,
          notes,
          rescheduledDate,
          actorId: user.id,
        },
        status: 'EXECUTED',
        created_at: nowIso,
      });
    } catch (_auditErr) {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      delivery: updatedDelivery,
    });
  } catch (error: any) {
    console.error('Error in POST /api/delivery/status:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur lors de la mise à jour de la livraison' },
      { status: 500 }
    );
  }
}
