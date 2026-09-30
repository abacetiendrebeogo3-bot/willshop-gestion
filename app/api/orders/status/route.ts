import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/src/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER', 'COMMERCIAL']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'orderId et status sont requis.' },
        { status: 400 }
      );
    }

    if (status === 'CONFIRMED' || status === 'ORDER_CONFIRMED') {
      // Get order items to reserve stock
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const { data: reserved, error: rpcError } = await supabaseAdmin.rpc('reserve_stock', {
            p_product_id: item.product_id,
            p_qty: item.quantity
          });

          if (rpcError || !reserved) {
            return NextResponse.json(
              { error: `Stock insuffisant pour le produit (ID: ${item.product_id}). Réservation échouée.` },
              { status: 400 }
            );
          }
        }
      }

      // Instead of confirm_order (which double reserves stock), we just update the status 
      // since we manually reserved stock with the new atomic function above.
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'CONFIRMED', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      
      return NextResponse.json({ success: true, order: data });

    } else if (status === 'CANCELLED') {
      // Cancel order using SQL function
      const { data, error } = await supabaseAdmin.rpc('cancel_order', {
        p_order_id: orderId,
        p_organization_id: organizationId
      });
      if (error) throw error;
      return NextResponse.json({ success: true, order: data });

    } else {
      // Other statuses
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, order: data });
    }

  } catch (error: any) {
    console.error('Order status update error:', error);
    return NextResponse.json(
      { error: `Erreur interne: ${error.message}` },
      { status: 500 }
    );
  }
}
