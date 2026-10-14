import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/src/infrastructure/supabase/server";
import { getRequiredEnv } from "@/src/config/env";

export const dynamic = "force-dynamic";

async function getAuthContext(request: NextRequest) {
  let supabaseUrl = "";
  let serviceKey = "";
  try {
    supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    serviceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch {
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let user = null;
  try {
    const supabaseUser = await createServerSupabaseClient();
    const { data } = await supabaseUser.auth.getUser();
    if (data?.user) user = data.user;
  } catch {}

  if (!user) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data?.user) user = data.user;
    }
  }

  if (!user) {
    return { error: "Non authentifié", status: 401 };
  }

  const { data: userRoles } = await supabaseAdmin
    .from("user_organization_roles")
    .select("organization_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  const organizationId = userRoles?.[0]?.organization_id;
  if (!organizationId) {
    return { error: "Organisation introuvable", status: 403 };
  }

  return { user, organizationId, supabaseAdmin };
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { user, organizationId, supabaseAdmin } = authCtx as any;

    const body = await request.json();
    const { customerId, phone, name } = body;

    if (!customerId) {
      return NextResponse.json({ error: "customerId requis" }, { status: 400 });
    }

    // 1. Look for existing conversation
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .neq("status", "ARCHIVED")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConv?.id) {
      return NextResponse.json({
        status: "FOUND",
        conversationId: existingConv.id,
      });
    }

    // 2. Fetch default WhatsApp number if available
    const { data: waNumber } = await supabaseAdmin
      .from("whatsapp_numbers")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    // 3. Create new conversation
    const { data: newConv, error: createErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        whatsapp_number_id: waNumber?.id || null,
        status: "OPEN",
        channel: "WHATSAPP",
        assigned_user_id: user.id,
        assigned_agent: "HUMAN",
        conversation_mode: "HUMAN_ACTIVE",
        unread_count: 0,
        metadata: {
          customer_name: name || "Client",
          customer_phone: phone || "",
          source: "CRM_CUSTOMER_PAGE",
        },
      })
      .select("id")
      .single();

    if (createErr || !newConv) {
      console.error("[Get-or-Create Conversation Error]", createErr);
      return NextResponse.json(
        { error: createErr?.message || "Impossible d'initialiser la conversation." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "CREATED",
      conversationId: newConv.id,
    });
  } catch (err: any) {
    console.error("[Get-or-Create Conversation Catch Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
