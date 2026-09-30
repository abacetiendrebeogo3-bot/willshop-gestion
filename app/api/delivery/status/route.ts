import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/src/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER', 'COMMERCIAL', 'LIVREUR']);
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

    // 3. Ownership check for LIVREUR
    if (role === 'LIVREUR' || role === 'DRIVER') {
      const { data: driverInfo } = await supabaseAdmin
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .single();
      
      if (!driverInfo) {
        return NextResponse.json({ error: 'Profil livreur introuvable.' }, { status: 403 });
      }

      const { data: deliveryInfo } = await supabaseAdmin
        .from('deliveries')
        .select('driver_id')
        .eq('id', deliveryId)
        .single();
      
      if (deliveryInfo?.driver_id !== driverInfo.id) {
        return NextResponse.json({ error: 'Vous ne pouvez pas modifier une livraison qui ne vous est pas assignée.' }, { status: 403 });
      }
    }

    // 4. Prepare patch updates
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
