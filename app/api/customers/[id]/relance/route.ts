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

// GET /api/customers/[id]/relance - List engagements/relances for customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { organizationId, supabaseAdmin } = authCtx as any;

    const { data: engagements, error } = await supabaseAdmin
      .from("customer_engagements")
      .select("*")
      .eq("customer_id", customerId)
      .eq("organization_id", organizationId)
      .order("due_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ engagements: engagements || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/customers/[id]/relance - Schedule a follow-up/relance
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { user, organizationId, supabaseAdmin } = authCtx as any;

    const body = await request.json();
    const {
      title = "Relance client",
      description = "",
      dueAt,
      priority = "IMPORTANT", // 'URGENT' | 'IMPORTANT' | 'NORMAL'
    } = body;

    const targetDueDate = dueAt ? new Date(dueAt).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // 1. Create engagement in customer_engagements
    const { data: engagement, error: engErr } = await supabaseAdmin
      .from("customer_engagements")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        assigned_to: user.id,
        title: title.trim(),
        description: (description || "").trim() || null,
        due_at: targetDueDate,
        status: "PENDING",
        priority: ["URGENT", "IMPORTANT", "NORMAL"].includes(priority) ? priority : "IMPORTANT",
        source: "COMMERCIAL_MANUAL",
      })
      .select()
      .single();

    if (engErr || !engagement) {
      console.error("[Customer Relance API Error]", engErr);
      return NextResponse.json(
        { error: engErr?.message || "Impossible de planifier la relance." },
        { status: 500 }
      );
    }

    // 2. Update customer status to TO_RELANCE
    await supabaseAdmin
      .from("customers")
      .update({ status: "TO_RELANCE", updated_at: new Date().toISOString() })
      .eq("id", customerId);

    return NextResponse.json({
      status: "SUCCESS",
      engagement,
      message: "Relance planifiée avec succès.",
    });
  } catch (err: any) {
    console.error("[Relance Error]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
