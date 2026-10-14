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

// GET /api/customers/[id]/tags - List customer tags & org tags
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

    // Get customer tags
    const { data: custTags, error: ctErr } = await supabaseAdmin
      .from("customer_tags")
      .select("tag_id, tags (id, name, color, category)")
      .eq("customer_id", customerId);

    if (ctErr) {
      console.error("[Customer Tags GET Error]", ctErr);
      return NextResponse.json({ error: ctErr.message }, { status: 500 });
    }

    const assigned = (custTags || [])
      .map((ct: any) => ct.tags)
      .filter(Boolean);

    // Get all available tags in org
    const { data: allOrgTags } = await supabaseAdmin
      .from("tags")
      .select("id, name, color, category")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    return NextResponse.json({
      tags: assigned,
      availableTags: allOrgTags || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/customers/[id]/tags - Add tag to customer
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
    const { organizationId, supabaseAdmin } = authCtx as any;

    const body = await request.json();
    const tagName = (body.name || "").trim();
    const tagColor = body.color || "#800020";

    if (!tagName) {
      return NextResponse.json({ error: "Le nom du tag est obligatoire." }, { status: 400 });
    }

    // 1. Find or create tag
    let tagId = body.tagId;
    if (!tagId) {
      const { data: existingTag } = await supabaseAdmin
        .from("tags")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("name", tagName)
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: newTagErr } = await supabaseAdmin
          .from("tags")
          .insert({
            organization_id: organizationId,
            name: tagName,
            color: tagColor,
            category: "CLIENT",
          })
          .select("id")
          .single();

        if (newTagErr || !newTag) {
          return NextResponse.json({ error: newTagErr?.message || "Impossible de créer le tag." }, { status: 500 });
        }
        tagId = newTag.id;
      }
    }

    // 2. Link tag to customer
    const { error: linkErr } = await supabaseAdmin
      .from("customer_tags")
      .upsert({
        customer_id: customerId,
        tag_id: tagId,
      }, { onConflict: "customer_id,tag_id" });

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    // Return updated tag info
    const { data: tagDetails } = await supabaseAdmin
      .from("tags")
      .select("id, name, color, category")
      .eq("id", tagId)
      .single();

    return NextResponse.json({ status: "SUCCESS", tag: tagDetails });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/tags - Remove tag from customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const authCtx = await getAuthContext(request);
    if ("error" in authCtx && !authCtx.user) {
      return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    }
    const { supabaseAdmin } = authCtx as any;

    const { searchParams } = new URL(request.url);
    let tagId = searchParams.get("tagId");

    if (!tagId) {
      try {
        const body = await request.json();
        tagId = body.tagId;
      } catch {}
    }

    if (!tagId) {
      return NextResponse.json({ error: "tagId est requis" }, { status: 400 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("customer_tags")
      .delete()
      .eq("customer_id", customerId)
      .eq("tag_id", tagId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ status: "SUCCESS" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
