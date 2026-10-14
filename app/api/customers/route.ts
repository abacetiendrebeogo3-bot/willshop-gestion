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

  if (!supabaseUrl || !serviceKey) {
    return { error: "Configuration serveur Supabase manquante", status: 500 };
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
    return { error: "Session non authentifiée. Veuillez vous connecter.", status: 401 };
  }

  const { data: userRoles } = await supabaseAdmin
    .from("user_organization_roles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  const organizationId = userRoles?.[0]?.organization_id;
  if (!organizationId) {
    return { error: "Aucune organisation associée à cet utilisateur.", status: 403 };
  }

  return { user, organizationId, supabaseAdmin };
}

// GET /api/customers - List all customers with orders and aggregates
export async function GET(request: NextRequest) {
  try {
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { organizationId, supabaseAdmin } = authCtx as any;

    // 1. Fetch customers
    const { data: customers, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (custErr) {
      console.error("[Customers API] Fetch error:", custErr);
      return NextResponse.json({ error: custErr.message }, { status: 500 });
    }

    // 2. Fetch orders aggregates
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, total, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    const ordersMap = new Map<string, { count: number; totalSpent: number }>();
    if (orders) {
      for (const ord of orders) {
        if (!ord.customer_id) continue;
        const cur = ordersMap.get(ord.customer_id) || { count: 0, totalSpent: 0 };
        cur.count += 1;
        if (ord.status !== "CANCELLED") {
          cur.totalSpent += Number(ord.total) || 0;
        }
        ordersMap.set(ord.customer_id, cur);
      }
    }

    // 3. Format response
    const formatted = (customers || []).map((c: any) => {
      const ordStats = ordersMap.get(c.id) || { count: 0, totalSpent: 0 };
      const fullName = (c.full_name || `${c.first_name || ""} ${c.last_name || ""}`).trim();
      return {
        id: c.id,
        name: fullName || c.phone || "Client sans nom",
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        phone: c.phone || c.whatsapp_phone || "",
        whatsapp_phone: c.whatsapp_phone || c.phone || "",
        city: c.city || c.address || "Non renseignée",
        address: c.address || "",
        status: c.status || "PROSPECT",
        notes: c.notes || "",
        createdAt: c.created_at,
        ordersCount: ordStats.count,
        totalSpent: Math.round(ordStats.totalSpent),
        lastActivity: c.updated_at || c.created_at,
      };
    });

    return NextResponse.json({ customers: formatted });
  } catch (err: any) {
    console.error("[Customers API Error]", err);
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { user, organizationId, supabaseAdmin } = authCtx as any;

    const body = await request.json();
    const {
      first_name = "",
      last_name = "",
      phone,
      city = "",
      address = "",
      status = "PROSPECT",
      note = "",
      tag = "",
    } = body;

    const cleanPhone = (phone || "").trim().replace(/\s+/g, "");
    if (!cleanPhone) {
      return NextResponse.json(
        { error: "Le numéro de téléphone est obligatoire." },
        { status: 400 }
      );
    }

    // Check for existing customer with same phone in this organization
    const { data: existingCust } = await supabaseAdmin
      .from("customers")
      .select("id, phone, first_name, last_name")
      .eq("organization_id", organizationId)
      .eq("phone", cleanPhone)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCust) {
      return NextResponse.json(
        {
          error: `Un client existe déjà avec ce numéro (${cleanPhone}) : ${existingCust.first_name || ""} ${existingCust.last_name || ""}`.trim(),
          existingCustomer: existingCust,
        },
        { status: 409 }
      );
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`.trim();

    // 1. Insert customer
    const { data: newCust, error: insertErr } = await supabaseAdmin
      .from("customers")
      .insert({
        organization_id: organizationId,
        first_name: first_name.trim() || null,
        last_name: last_name.trim() || null,
        full_name: fullName || null,
        phone: cleanPhone,
        whatsapp_phone: cleanPhone,
        city: city.trim() || null,
        address: address.trim() || null,
        status: status || "PROSPECT",
        notes: note.trim() || null,
        source: "MANUAL",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr || !newCust) {
      console.error("[Customers API] Insert customer error:", insertErr);
      return NextResponse.json(
        { error: insertErr?.message || "Erreur lors de la création du client." },
        { status: 500 }
      );
    }

    // 2. Insert initial internal note if provided
    if (note.trim()) {
      await supabaseAdmin.from("customer_notes").insert({
        organization_id: organizationId,
        customer_id: newCust.id,
        author_id: user.id,
        content: note.trim(),
      });
    }

    // 3. Attach tag if provided
    if (tag.trim()) {
      let tagId: string | null = null;
      const { data: existingTag } = await supabaseAdmin
        .from("tags")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("name", tag.trim())
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: createdTag } = await supabaseAdmin
          .from("tags")
          .insert({
            organization_id: organizationId,
            name: tag.trim(),
            color: "#800020",
            category: "CLIENT",
          })
          .select("id")
          .single();
        if (createdTag) tagId = createdTag.id;
      }

      if (tagId) {
        await supabaseAdmin.from("customer_tags").insert({
          customer_id: newCust.id,
          tag_id: tagId,
        });
      }
    }

    // 4. Ensure conversation record exists for immediate WhatsApp access
    try {
      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_id", newCust.id)
        .maybeSingle();

      if (!existingConv) {
        await supabaseAdmin.from("conversations").insert({
          organization_id: organizationId,
          customer_id: newCust.id,
          status: "OPEN",
          channel: "WHATSAPP",
          conversation_mode: "HUMAN_ACTIVE",
          assigned_agent: "HUMAN",
          unread_count: 0,
          metadata: {
            customer_name: fullName || cleanPhone,
            customer_phone: cleanPhone,
          },
        });
      }
    } catch (convErr) {
      console.warn("[Customers API] Auto conv creation notice:", convErr);
    }

    return NextResponse.json({
      status: "SUCCESS",
      customer: {
        id: newCust.id,
        name: fullName || cleanPhone,
        first_name: newCust.first_name || "",
        last_name: newCust.last_name || "",
        phone: newCust.phone,
        city: newCust.city || "Non renseignée",
        status: newCust.status,
        createdAt: newCust.created_at,
        ordersCount: 0,
        totalSpent: 0,
        lastActivity: newCust.created_at,
      },
    });
  } catch (err: any) {
    console.error("[Customers API POST Error]", err);
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}
