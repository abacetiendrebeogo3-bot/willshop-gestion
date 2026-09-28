import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/src/infrastructure/supabase/server";
import { OrderExecutionService } from "@/src/application/services/OrderExecutionService";
import { EvolutionWhatsAppAdapter } from "@/src/infrastructure/whatsapp/EvolutionWhatsAppAdapter";
import { MetaWhatsAppAdapter } from "@/src/infrastructure/whatsapp/MetaWhatsAppAdapter";
import { getRequiredEnv } from "@/src/config/env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let supabaseUrl = "";
    let serviceKey = "";
    try {
      supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
      serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    } catch (envErr) {
      console.error("[Config Error] Supabase credentials missing in /api/orders/quick-create:", envErr);
      return NextResponse.json(
        { error: "Configuration serveur manquante." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate User Session
    let user = null;
    try {
      const supabaseUserClient = await createServerSupabaseClient();
      const { data: authData } = await supabaseUserClient.auth.getUser();
      if (authData?.user) {
        user = authData.user;
      }
    } catch {}

    if (!user) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const { data: tokenData } = await supabaseAdmin.auth.getUser(token);
        if (tokenData?.user) {
          user = tokenData.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Session non authentifiée." },
        { status: 401 }
      );
    }

    // 2. Resolve organization_id
    const { data: userRoles } = await supabaseAdmin
      .from("user_organization_roles")
      .select("organization_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const organizationId = userRoles?.[0]?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Aucune organisation associée." },
        { status: 403 }
      );
    }

    // 3. Parse Body
    const body = await request.json();
    const { customerId, conversationId, productId, quantity, neighborhood, notes, customerName, customerPhone } = body;

    if (!customerId || !productId) {
      return NextResponse.json(
        { error: "Le client et le produit sont obligatoires pour créer une commande." },
        { status: 400 }
      );
    }

    // 4. Execute Confirmed Order via OrderExecutionService
    const executionService = new OrderExecutionService(supabaseAdmin);
    const result = await executionService.executeConfirmedOrder({
      organizationId,
      customerId,
      conversationId,
      productId,
      quantity: quantity || 1,
      neighborhood,
      customerName,
      customerPhone,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Échec de la création de la commande." },
        { status: 400 }
      );
    }

    // 5. Complete any pending customer_engagements for this customer
    await supabaseAdmin
      .from("customer_engagements")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("status", "PENDING");

    // 6. Update order_intent_status on conversation if conversationId is provided
    if (conversationId) {
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
          order_intent_status: "ORDER_CREATED",
          last_engagement_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    // 7. Send Order Confirmation WhatsApp Message to Customer if phone is available
    if (customerPhone) {
      try {
        const { data: whatsappNum } = await supabaseAdmin
          .from("whatsapp_numbers")
          .select("*")
          .eq("organization_id", organizationId)
          .limit(1)
          .maybeSingle();

        const providerAdapter = whatsappNum?.provider === "meta"
          ? new MetaWhatsAppAdapter()
          : new EvolutionWhatsAppAdapter();

        const confirmationText = `Bonjour ${customerName || 'Client'} ! Votre commande ${result.orderNumber || ''} de ${result.totalAmount?.toLocaleString('fr-FR') || ''} FCFA a bien été enregistrée. Elle est en cours de préparation pour livraison à ${neighborhood || 'votre adresse'}. Merci de votre confiance !`;

        const instanceOrNumberId = whatsappNum?.phone_number_id || whatsappNum?.instance_name || "ws_default";
        await providerAdapter.sendTextMessage(instanceOrNumberId, {
          toPhoneNumber: customerPhone,
          messageText: confirmationText,
        });

        // Record confirmation message in messages table
        if (conversationId) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: conversationId,
            organization_id: organizationId,
            direction: "OUTBOUND",
            sender_type: "HUMAN",
            content: confirmationText,
            status: "SENT",
            created_at: new Date().toISOString(),
          });
        }
      } catch (waErr) {
        console.warn("[QuickOrder] Notification WhatsApp not sent (non-critical):", waErr);
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      deliveryId: result.deliveryId,
      driverId: result.driverId,
      message: `Commande ${result.orderNumber} créée avec succès et livraison programmée.`,
    });
  } catch (err: any) {
    console.error("[QuickOrder Route Error]", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la création rapide de la commande." },
      { status: 500 }
    );
  }
}
