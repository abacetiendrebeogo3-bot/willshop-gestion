import { NextRequest, NextResponse } from "next/server";
import { requireRole } from '@/src/lib/auth/requireRole';
import { EvolutionWhatsAppAdapter } from "@/src/infrastructure/whatsapp/EvolutionWhatsAppAdapter";
import { MetaWhatsAppAdapter } from "@/src/infrastructure/whatsapp/MetaWhatsAppAdapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { user, organizationId, role, supabaseAdmin, errorResponse } = await requireRole(request, ['OWNER', 'MANAGER']);
    if (errorResponse) return errorResponse;

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

    // 5. Generate secure cryptographically strong invitation_token valid for 72 hours
    const crypto = require("crypto");
    const invitationToken = `inv_${crypto.randomBytes(16).toString("hex")}`;
    const invitationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    // Insert/Update team_employees with upsert & clear deleted_at
    const cleanDigits = phoneClean.replace(/[^\d]/g, "");
    const { data: existingEmp } = await supabaseAdmin
      .from("team_employees")
      .select("id")
      .or(`phone.eq.${phoneClean},phone.eq.+${cleanDigits}`)
      .limit(1)
      .maybeSingle();

    let empErr = null;
    if (existingEmp) {
      const { error: updErr } = await supabaseAdmin
        .from("team_employees")
        .update({
          organization_id: organizationId,
          first_name: fName,
          last_name: lName,
          email: email ? email.trim() : null,
          role: memberRole,
          responsibilities: jobTitle ? [jobTitle.trim()] : [],
          employment_status: "ACTIVE",
          activity_status: "ONLINE",
          invitation_token: invitationToken,
          invitation_expires_at: invitationExpiresAt,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingEmp.id);
      empErr = updErr;
    } else {
      const { error: insErr } = await supabaseAdmin
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
          invitation_token: invitationToken,
          invitation_expires_at: invitationExpiresAt,
          deleted_at: null,
        });
      empErr = insErr;
    }

    if (empErr) {
      console.warn("[Invite API] Upsert employee warning:", empErr.message);
    }

    // 6. Build Invitation Text & App Login Link with Token
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "https://willshop-gestion.vercel.app").replace(/\/+$/, '');
    const inviteUrl = `${appUrl}/login?phone=${encodeURIComponent(phoneClean)}&token=${invitationToken}`;

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
