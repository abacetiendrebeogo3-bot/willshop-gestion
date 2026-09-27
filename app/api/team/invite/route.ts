import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/src/infrastructure/supabase/server";
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
      console.error("[Config Error] Supabase config missing in /api/team/invite:", envErr);
      return NextResponse.json(
        { error: "Configuration serveur manquante." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate user session
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
        { error: "Session non authentifiée. Veuillez vous reconnecter." },
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
        { error: "Aucune organisation valide associée." },
        { status: 403 }
      );
    }

    // 3. Parse payload
    const body = await request.json();
    const { phone, firstName, lastName, email, role, jobTitle } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Le numéro de téléphone est obligatoire pour inviter un membre." },
        { status: 400 }
      );
    }

    const phoneClean = phone.trim();
    const fName = (firstName || "Membre").trim();
    const lName = (lastName || "").trim();
    const memberRole = (role || "COMMERCIAL").trim();

    // 4. Fetch Organization Name
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    const orgName = org?.name || "WILLShop OS";

    // 5. Insert/Update team_employees
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("team_employees")
      .insert({
        organization_id: organizationId,
        phone: phoneClean,
        first_name: fName,
        last_name: lName,
        email: email ? email.trim() : null,
        role: memberRole,
        responsibilities: jobTitle ? [jobTitle.trim()] : [],
        employment_status: "ACTIVE",
        activity_status: "ONLINE",
      })
      .select()
      .single();

    if (empErr) {
      console.warn("[Invite API] Insert employee warning:", empErr.message);
    }

    // 6. Build Invitation Text & App Login Link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://willshop-gestion.vercel.app";
    const inviteUrl = `${appUrl}/login?phone=${encodeURIComponent(phoneClean)}`;

    const inviteText = `📲 *Invitation WILLShop OS*

Bonjour ${fName} ${lName} ! 🚀

Vous avez été invité(e) à rejoindre l'espace de travail de *${orgName}* avec le rôle *${memberRole}*.

📍 *Lien direct vers votre espace commercial :*
👉 ${inviteUrl}

📱 *Comment installer l'application sur votre téléphone :*
1. Cliquez sur le lien ci-dessus.
2. Dans le menu de votre navigateur (Chrome ou Safari), sélectionnez *"Ajouter à l'écran d'accueil"* (Installer l'application PWA).

Bienvenue dans l'équipe !`;

    let whatsappSent = false;
    let whatsappError = null;

    // 7. Dispatch via WhatsApp API if an active line is connected
    try {
      const { data: whatsappNum } = await supabaseAdmin
        .from("whatsapp_numbers")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "ACTIVE")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (whatsappNum) {
        const provider = (whatsappNum.provider || "EVOLUTION").toUpperCase();
        const providerIdentity =
          whatsappNum.provider_identity ||
          whatsappNum.provider_phone_number_id ||
          `ws_org_${organizationId.replace(/-/g, "").slice(0, 12)}`;

        const adapter =
          provider === "EVOLUTION"
            ? new EvolutionWhatsAppAdapter()
            : new MetaWhatsAppAdapter();

        const sendRes = await adapter.sendTextMessage(providerIdentity, {
          toPhoneNumber: phoneClean,
          messageText: inviteText,
        });

        if (sendRes.status === "SENT") {
          whatsappSent = true;
        } else {
          whatsappError = sendRes.errorCode;
        }
      }
    } catch (waErr: any) {
      console.error("[Invite API] WhatsApp dispatch error:", waErr);
      whatsappError = waErr?.message;
    }

    // 8. Return response with direct WhatsApp share link as fallback
    const encodedWaText = encodeURIComponent(inviteText);
    const waShareUrl = `https://wa.me/${phoneClean.replace(/[^\d]/g, "")}?text=${encodedWaText}`;

    return NextResponse.json({
      success: true,
      message: `Invitation préparée pour ${phoneClean}`,
      phone: phoneClean,
      inviteUrl,
      waShareUrl,
      whatsappSent,
      whatsappError,
      inviteText,
    });
  } catch (err: any) {
    console.error("[Invite API Error]", err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors de l'envoi de l'invitation." },
      { status: 500 }
    );
  }
}
