import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/src/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // COMMERCIAL is NOT allowed to update deliveries
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER', 'LIVREUR', 'DRIVER']);
    if (errorResponse) return errorResponse;

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

    // 1. Fetch current delivery state
    const { data: currentDelivery } = await supabaseAdmin
      .from('deliveries')
      .select('status, driver_id')
      .eq('id', deliveryId)
      .eq('organization_id', organizationId)
      .single();

    if (!currentDelivery) {
      return NextResponse.json({ error: 'Livraison introuvable.' }, { status: 404 });
    }

    // 2. Ownership check (Sauf OWNER ou MANAGER)
    if (role !== 'OWNER' && role !== 'MANAGER') {
      const { data: driverInfo } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .single();
      
      if (!driverInfo) {
        return NextResponse.json({ error: 'Profil livreur introuvable.' }, { status: 403 });
      }
      
      if (currentDelivery.driver_id !== driverInfo.id) {
        return NextResponse.json({ error: 'Vous ne pouvez pas modifier une livraison qui ne vous est pas assignée.' }, { status: 403 });
      }
    }

    // 3. State Transition Validation
    const allowedTransitions: Record<string, string[]> = {
      'PENDING_ASSIGNMENT': ['ASSIGNED', 'CANCELLED'],
      'ASSIGNED': ['PICKED_UP', 'CANCELLED', 'IN_TRANSIT'], // Allowing IN_TRANSIT directly just in case UI skips PICKED_UP
      'PICKED_UP': ['IN_TRANSIT', 'CANCELLED'],
      'IN_TRANSIT': ['DELIVERED', 'FAILED', 'RESCHEDULED', 'RETURNED'],
      'FAILED': ['RESCHEDULED', 'RETURNED', 'CANCELLED'],
      'RESCHEDULED': ['ASSIGNED', 'PICKED_UP', 'CANCELLED', 'IN_TRANSIT'],
      'DELIVERED': [],
      'RETURNED': [],
      'CANCELLED': []
    };

    const currentStatus = currentDelivery.status || 'PENDING_ASSIGNMENT';
    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Transition non autorisée: Impossible de passer de ${currentStatus} à ${status}.` },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let updatedDelivery = null;
    let updateErr = null;

    if (status === 'IN_TRANSIT') {
      const { data, error } = await supabaseAdmin.rpc('start_transit_delivery', {
        p_delivery_id: deliveryId,
        p_org_id: organizationId
      });
      updatedDelivery = data;
      updateErr = error;
    } else if (status === 'DELIVERED') {
      const { data, error } = await supabaseAdmin.rpc('deliver_delivery', {
        p_delivery_id: deliveryId,
        p_org_id: organizationId
      });
      updatedDelivery = data;
      updateErr = error;
    } else if (status === 'FAILED') {
      const { data, error } = await supabaseAdmin.rpc('fail_delivery', {
        p_delivery_id: deliveryId,
        p_org_id: organizationId,
        p_reason: failureReason
      });
      updatedDelivery = data;
      updateErr = error;
    } else if (status === 'RESCHEDULED') {
      const { data, error } = await supabaseAdmin.rpc('reschedule_delivery', {
        p_delivery_id: deliveryId,
        p_org_id: organizationId,
        p_new_date: rescheduledDate
      });
      updatedDelivery = data;
      updateErr = error;
    } else {
      // Fallback manual update for other statuses
      const patch: any = { status, updated_at: nowIso };
      if (notes) patch.notes = notes;
      if (status === 'ASSIGNED') {
          // If moving to ASSIGNED manually (e.g. from RESCHEDULED), ensure it can happen
          // Note: assign_delivery rpc also exists
      }
      
      const { data, error } = await supabaseAdmin
        .from('deliveries')
        .update(patch)
        .eq('id', deliveryId)
        .eq('organization_id', organizationId)
        .select()
        .single();
      
      updatedDelivery = data;
      updateErr = error;
    }

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
