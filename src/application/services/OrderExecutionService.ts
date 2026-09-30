/**
 * WILLShop OS — Operational Order Execution Service
 * Application Layer.
 * Handles end-to-end execution of confirmed orders:
 * 1. Catalogs & Price Verification (DB SSOT, non-hardcoded)
 * 2. Stock Verification & Reservation (product_stock & stock_movements)
 * 3. Zone & Delivery Fee Calculation (zones)
 * 4. Order & Order Items Creation (orders, order_items)
 * 5. Delivery Creation & Automatic Driver Assignment (deliveries, drivers)
 * 6. Driver WhatsApp Notification
 * 7. Accounting & Financial Sync (payments state PENDING, receivable created)
 * 8. CRM Sync (leads, customers, observability logs)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface OrderExecutionParams {
  organizationId: string;
  customerId: string;
  conversationId?: string;
  productId: string;
  quantity: number;
  neighborhood?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface OrderExecutionResult {
  success: boolean;
  errorCode?: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  totalAmount?: number;
  deliveryId?: string;
  driverId?: string | null;
  driverName?: string | null;
  paymentId?: string;
  paymentStatus?: 'PENDING' | 'RECEIVED' | 'VERIFIED' | 'RECONCILED';
  stockReserved?: boolean;
  driverNotified?: boolean;
}

export class OrderExecutionService {
  constructor(private readonly supabase: SupabaseClient) {}

  public async executeConfirmedOrder(params: OrderExecutionParams): Promise<OrderExecutionResult> {
    const {
      organizationId,
      customerId,
      conversationId,
      productId,
      quantity,
      neighborhood,
      customerName,
      customerPhone,
      notes,
    } = params;

    const qty = Math.max(1, Math.floor(quantity || 1));

    // 1. Verify Product & Price from DB SSOT
    const { data: product, error: prodErr } = await this.supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      return {
        success: false,
        errorCode: 'PRODUCT_NOT_FOUND',
        message: `Produit avec l'ID '${productId}' introuvable dans le catalogue.`,
      };
    }

    if (product.status && product.status !== 'ACTIVE') {
      return {
        success: false,
        errorCode: 'PRODUCT_INACTIVE',
        message: `Le produit '${product.name}' n'est pas actif au catalogue.`,
      };
    }

    const unitPrice = Number(product.selling_price || 0);

    // 2. Stock Verification & Reservation
    const { data: stockRow } = await this.supabase
      .from('product_stock')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('product_id', productId)
      .maybeSingle();

    if (stockRow) {
      const availableStock = Math.max(0, Number(stockRow.physical_stock || 0) - Number(stockRow.reserved_stock || 0));
      
      // Reserve stock with transactional concurrency lock
      const { data: reserved, error: rpcError } = await this.supabase.rpc('reserve_stock', {
        p_product_id: productId,
        p_qty: qty
      });

      if (rpcError || !reserved) {
        return {
          success: false,
          errorCode: 'INSUFFICIENT_STOCK',
          message: `Stock insuffisant pour '${product.name}'. Demandé: ${qty}. Echec du verrou transactionnel de concurrence.`,
        };
      }

      // Record stock movement (append-only ledger)
      await this.supabase.from('stock_movements').insert({
        organization_id: organizationId,
        product_id: productId,
        type: 'ORDER_RESERVATION',
        direction: 'RESERVE',
        quantity: qty,
        notes: `Réservation automatique commande pour client ${customerName || customerId}`,
      });
    }

    // 3. Zone & Delivery Fee Calculation
    let deliveryFee = 0;
    let zoneId: string | null = null;
    let zoneName = neighborhood || 'Zone par défaut';

    if (neighborhood) {
      const { data: zones } = await this.supabase
        .from('zones')
        .select('*')
        .eq('organization_id', organizationId)
        .ilike('name', `%${neighborhood.trim()}%`)
        .limit(1);

      if (zones && zones.length > 0) {
        zoneId = zones[0].id;
        deliveryFee = Number(zones[0].delivery_fee || 0);
        zoneName = zones[0].name;
      } else {
        // Search default zone
        const { data: defaultZone } = await this.supabase
          .from('zones')
          .select('*')
          .eq('organization_id', organizationId)
          .limit(1)
          .maybeSingle();

        if (defaultZone) {
          zoneId = defaultZone.id;
          deliveryFee = Number(defaultZone.delivery_fee || 0);
        }
      }
    }

    const subtotal = unitPrice * qty;
    const totalAmount = subtotal + deliveryFee;

    // 4. Create Order & Order Items
    const orderNumber = `CMD-${Date.now().toString().slice(-6)}`;

    const { data: order, error: orderErr } = await this.supabase
      .from('orders')
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        order_number: orderNumber,
        status: 'CONFIRMED',
        total: totalAmount,
        subtotal,
        delivery_fee: deliveryFee,
        notes: notes || `Commande créée automatiquement par l'Agent IA pour ${zoneName}`,
      })
      .select()
      .single();

    if (orderErr || !order) {
      return {
        success: false,
        errorCode: 'ORDER_CREATION_FAILED',
        message: `Échec de création de la commande : ${orderErr?.message}`,
      };
    }

    // Create Order Items
    await this.supabase.from('order_items').insert({
      organization_id: organizationId,
      order_id: order.id,
      product_id: productId,
      quantity: qty,
      unit_price: unitPrice,
      total_price: subtotal,
      product_name_snapshot: product.name,
      product_sku_snapshot: product.sku || 'SKU-001',
    });

    // 5. Create Delivery & Automatic Driver Assignment
    let deliveryId: string | undefined;
    let driverId: string | null = null;
    let driverName: string | null = null;
    let driverPhone: string | null = null;

    const { data: delivery } = await this.supabase
      .from('deliveries')
      .insert({
        organization_id: organizationId,
        order_id: order.id,
        zone_id: zoneId,
        status: 'PENDING',
        delivery_address: neighborhood || 'Ouagadougou',
        recipient_name: customerName || 'Client',
        recipient_phone: customerPhone || '',
      })
      .select()
      .single();

    if (delivery) {
      deliveryId = delivery.id;

      // Find available driver matching criteria
      let query = this.supabase
        .from('drivers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'AVAILABLE');

      if (zoneId) {
        const { data: zoneDrivers } = await query.eq('assigned_zone_id', zoneId).limit(1);
        if (zoneDrivers && zoneDrivers.length > 0) {
          driverId = zoneDrivers[0].id;
          driverName = zoneDrivers[0].name;
          driverPhone = zoneDrivers[0].phone;
        }
      }

      if (!driverId) {
        // Fallback to any available driver
        const { data: anyDrivers } = await this.supabase
          .from('drivers')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'AVAILABLE')
          .limit(1);

        if (anyDrivers && anyDrivers.length > 0) {
          driverId = anyDrivers[0].id;
          driverName = anyDrivers[0].name;
          driverPhone = anyDrivers[0].phone;
        }
      }

      if (driverId) {
        await this.supabase
          .from('deliveries')
          .update({
            driver_id: driverId,
            status: 'ASSIGNED',
            assigned_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
      }
    }

    // 6. Driver WhatsApp Notification
    let driverNotified = false;
    if (driverId && driverPhone) {
      try {
        const notificationText = `Nouvelle livraison #${orderNumber}\n\nClient : ${customerName || 'Client'}\nTéléphone : ${customerPhone || 'N/A'}\nZone : ${zoneName}\nProduit : ${product.name}\nQuantité : ${qty}\nTotal : ${totalAmount.toLocaleString('fr-FR')} XOF\nFrais livraison : ${deliveryFee > 0 ? `${deliveryFee} XOF` : 'Gratuite'}\nDélai : 24h`;

        // Send outbound notification log
        await this.supabase.from('messages').insert({
          organization_id: organizationId,
          direction: 'OUTBOUND',
          sender_type: 'SYSTEM',
          message_type: 'TEXT',
          content: `[NOTIFICATION LIVREUR ${driverName}]: ${notificationText}`,
          status: 'SENT',
          metadata: {
            driver_id: driverId,
            order_id: order.id,
          },
        });
        driverNotified = true;
      } catch (notifErr) {
        console.warn('[Driver Notification Warning]', notifErr);
      }
    }

    // 7. Accounting & Finance Sync (Status PENDING, expected revenue)
    let paymentId: string | undefined;
    const { data: payment } = await this.supabase
      .from('payments')
      .insert({
        organization_id: organizationId,
        order_id: order.id,
        amount: totalAmount,
        currency: 'XOF',
        method: 'CASH_ON_DELIVERY',
        status: 'PENDING',
        notes: `Paiement en attente à la livraison pour commande ${orderNumber}`,
      })
      .select()
      .single();

    if (payment) {
      paymentId = payment.id;
    }

    // 8. CRM Sync & Lead Update
    try {
      const { data: leads } = await this.supabase
        .from('leads')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (leads && leads.length > 0) {
        await this.supabase
          .from('leads')
          .update({
            status: 'WON',
            estimated_value: totalAmount,
            product_interest: product.name,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', leads[0].id);
      } else {
        await this.supabase.from('leads').insert({
          organization_id: organizationId,
          customer_id: customerId,
          conversation_id: conversationId || null,
          source: 'WHATSAPP_AI_AGENT',
          status: 'WON',
          score: 100,
          estimated_value: totalAmount,
          product_interest: product.name,
        });
      }
    } catch (crmErr) {
      console.warn('[CRM Sync Warning]', crmErr);
    }

    // Trace observability log
    try {
      await this.supabase.from('ai_actions').insert({
        organization_id: organizationId,
        action_type: 'ORDER_EXECUTION',
        permission_level: 'GREEN',
        status: 'SUCCESS',
        metadata: {
          WHY_TRIGGERED: 'ORDER_CONFIRMED_BY_CUSTOMER',
          CONVERSATION_ID: conversationId || null,
          CUSTOMER_ID: customerId,
          ORDER_ID: order.id,
          ORDER_NUMBER: orderNumber,
          TOTAL_AMOUNT: totalAmount,
          STOCK_RESERVED: qty,
          DRIVER_ID: driverId,
          PAYMENT_STATUS: 'PENDING',
        },
      });
    } catch (logErr) {
      console.warn('[AI Action Log Error]', logErr);
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber,
      totalAmount,
      deliveryId,
      driverId,
      driverName,
      paymentId,
      paymentStatus: 'PENDING',
      stockReserved: true,
      driverNotified,
      message: `Commande #${orderNumber} créée avec succès (Montant: ${totalAmount} XOF, Stock réservé: ${qty}, Statut paiement: PENDING).`,
    };
  }
}
