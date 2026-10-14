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

// GET /api/customers/[id]/notes
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

    const { data: notes, error: notesErr } = await supabaseAdmin
      .from("customer_notes")
      .select("*")
      .eq("customer_id", customerId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (notesErr) {
      return NextResponse.json({ error: notesErr.message }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/customers/[id]/notes
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
    const content = (body.content || "").trim();

    if (!content) {
      return NextResponse.json({ error: "Le contenu de la note ne peut pas être vide." }, { status: 400 });
    }

    const { data: newNote, error: insertErr } = await supabaseAdmin
      .from("customer_notes")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        author_id: user.id,
        content,
      })
      .select()
      .single();

    if (insertErr || !newNote) {
      return NextResponse.json({ error: insertErr?.message || "Impossible d'ajouter la note." }, { status: 500 });
    }

    // Also update customers.notes with latest note content
    await supabaseAdmin
      .from("customers")
      .update({ notes: content, updated_at: new Date().toISOString() })
      .eq("id", customerId);

    return NextResponse.json({ status: "SUCCESS", note: newNote });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/notes
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
    let noteId = searchParams.get("noteId");
    if (!noteId) {
      try {
        const body = await request.json();
        noteId = body.noteId;
      } catch {}
    }

    if (!noteId) {
      return NextResponse.json({ error: "noteId est requis" }, { status: 400 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("customer_notes")
      .delete()
      .eq("id", noteId)
      .eq("customer_id", customerId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ status: "SUCCESS" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
