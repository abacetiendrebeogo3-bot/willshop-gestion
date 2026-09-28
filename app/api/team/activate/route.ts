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

    // 1. Search for invited employee in team_employees
    let employee = null;

    // Search by exact phone, digits, or email
    const { data: empData, error: empErr } = await supabaseAdmin
      .from("team_employees")
      .select("*, organizations(name)")
      .or(`phone.eq.${inputTrim},phone.eq.+${cleanDigits},phone.eq.${cleanDigits},email.eq.${inputTrim}`)
      .limit(1)
      .maybeSingle();

    if (empData) {
      employee = empData;
    } else if (cleanDigits.length >= 6) {
      // Fuzzy search on last 8 digits of phone
      const lastDigits = cleanDigits.slice(-8);
      const { data: fuzzyEmp } = await supabaseAdmin
        .from("team_employees")
        .select("*, organizations(name)")
        .ilike("phone", `%${lastDigits}%`)
        .limit(1)
        .maybeSingle();

      if (fuzzyEmp) {
        employee = fuzzyEmp;
      }
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Aucune invitation trouvée pour ce numéro de téléphone. Veuillez contacter l'administrateur." },
        { status: 404 }
      );
    }

    // 2. Security Check (Fix P1): Verify invitation_token if present on employee record
    if (employee.invitation_token) {
      if (!token || token.trim() !== employee.invitation_token) {
        return NextResponse.json(
          { error: "Jeton d'invitation manquant ou invalide. Veuillez utiliser le lien d'invitation reçu sur WhatsApp." },
          { status: 403 }
        );
      }

      if (employee.invitation_expires_at && new Date(employee.invitation_expires_at) < new Date()) {
        return NextResponse.json(
          { error: "L'invitation a expiré (validité 72h). Veuillez demander une nouvelle invitation au gérant." },
          { status: 403 }
        );
      }
    }

    // 2. Construct canonical email for Supabase Auth
    const authEmail = employee.email && employee.email.includes("@")
      ? employee.email.trim().toLowerCase()
      : `${cleanDigits || "user" + Date.now()}@willshop.bf`;

    // 3. Check if Supabase Auth user exists
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === authEmail.toLowerCase() || u.phone === employee.phone
    );

    let authUserId = "";

    if (!existingUser) {
      // Create user via Admin API (skips email confirmation!)
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
          { error: `Échec d'activation du compte: ${createErr?.message || "Erreur serveur"}` },
          { status: 500 }
        );
      }

      authUserId = newAuthUser.user.id;
    } else {
      authUserId = existingUser.id;
      // Update password and confirm user account
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
      });
    }

    // 4. Ensure user_organization_roles record exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_organization_roles")
      .select("*")
      .eq("user_id", authUserId)
      .eq("organization_id", employee.organization_id)
      .is("deleted_at", null)
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
