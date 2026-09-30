import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
      console.error("[Config Error] Supabase config missing in /api/team/activate:", envErr);
      return NextResponse.json(
        { error: "Configuration serveur manquante." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = await request.json();
    const { phoneOrEmail, password, token } = body;

    if (!phoneOrEmail || !phoneOrEmail.trim() || !password) {
      return NextResponse.json(
        { error: "Veuillez fournir votre numéro de téléphone/email et votre mot de passe." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères." },
        { status: 400 }
      );
    }

    const inputTrim = phoneOrEmail.trim();
    const cleanDigits = inputTrim.replace(/[^\d]/g, "");

    if (!token || token.trim() === '') {
      return NextResponse.json(
        { error: "Jeton d'invitation manquant. Veuillez utiliser le lien fourni." },
        { status: 403 }
      );
    }
    const cleanToken = token.trim();

    // 1. Search for invited employee strictly by token
    const { data: employee, error: empErr } = await supabaseAdmin
      .from("team_employees")
      .select("*, organizations(name)")
      .eq("invitation_token", cleanToken)
      .limit(1)
      .maybeSingle();

    if (!employee) {
      return NextResponse.json(
        { error: "Aucune invitation valide trouvée avec ce jeton. Veuillez contacter l'administrateur." },
        { status: 404 }
      );
    }

    if (employee.user_id) {
       return NextResponse.json(
         { error: "Ce compte est déjà activé. Veuillez vous connecter." },
         { status: 403 }
       );
    }

    if (!employee.invitation_expires_at || new Date(employee.invitation_expires_at) < new Date()) {
       return NextResponse.json(
         { error: "L'invitation a expiré (validité 72h). Veuillez demander une nouvelle invitation au gérant." },
         { status: 403 }
       );
    }

    // 2. Construct canonical email for Supabase Auth
    const authEmail = employee.email && employee.email.includes("@")
      ? employee.email.trim().toLowerCase()
      : `${cleanDigits || "user" + Date.now()}@willshop.bf`;

    let authUserId = "";

    // 3. Create user via Admin API (skips email confirmation!)
    // We strictly create. If user exists, we fail, preventing silent password resets of existing accounts.
    const { data: newAuthUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: employee.first_name,
        last_name: employee.last_name,
        phone: employee.phone,
      },
    });

    if (createErr || !newAuthUser.user) {
      console.error("[Activate API] Admin createUser error:", createErr);
      return NextResponse.json(
        { error: `Échec d'activation du compte: L'identifiant est peut-être déjà utilisé (${createErr?.message || "Erreur serveur"}).` },
        { status: 400 }
      );
    }

    authUserId = newAuthUser.user.id;

    // 4. Ensure user_organization_roles record exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_organization_roles")
      .select("*")
      .eq("user_id", authUserId)
      .eq("organization_id", employee.organization_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("user_organization_roles").insert({
        organization_id: employee.organization_id,
        user_id: authUserId,
        role: employee.role || "COMMERCIAL",
      });
    }

    // 5. Update team_employees user_id link and consume invitation token
    await supabaseAdmin
      .from("team_employees")
      .update({
        user_id: authUserId,
        employment_status: "ACTIVE",
        activity_status: "ONLINE",
        invitation_token: null,
        invitation_expires_at: null,
      })
      .eq("id", employee.id);

    return NextResponse.json({
      success: true,
      email: authEmail,
      role: employee.role || "COMMERCIAL",
      organizationName: employee.organizations?.name || "WILLShop OS",
      message: `Compte activé avec succès pour ${employee.first_name} ${employee.last_name} !`,
    });
  } catch (err: any) {
    console.error("[Activate API Exception]", err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors de l'activation du compte." },
      { status: 500 }
    );
  }
}
