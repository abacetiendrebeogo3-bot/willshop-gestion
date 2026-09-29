import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stbzctncpvgqdpybcrmg.supabase.co';
    const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabaseUrl = rawUrl.trim().replace(/^["']|["']$/g, '');
    const serviceKey = rawServiceKey.trim().replace(/^["']|["']$/g, '');

    if (!serviceKey) {
      console.error('[Org API Error] SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
      return NextResponse.json(
        {
          error:
            'Configuration serveur incomplète : SUPABASE_SERVICE_ROLE_KEY est manquante dans les variables d\'environnement Vercel (Project Settings > Environment Variables).',
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Authenticate user from Cookies or Authorization Bearer Header
    let user = null;

    // Method A: Check Cookie Auth
    try {
      const supabaseUserClient = await createServerSupabaseClient();
      const { data: cookieAuthData } = await supabaseUserClient.auth.getUser();
      if (cookieAuthData?.user) {
        user = cookieAuthData.user;
      }
    } catch {
      // Cookie check fallback
    }

    // Method B: Check Bearer Header if Cookie Auth returned null
    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const { data: tokenAuthData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
        if (tokenAuthData?.user) {
          user = tokenAuthData.user;
        } else if (tokenError) {
          console.error('[Org API Bearer Token Auth Error]', tokenError.message);
        }
      }
    }

    if (!user) {
      console.error('[Org API Auth Error] User not authenticated via Cookies or Bearer token');
      return NextResponse.json(
        { error: 'Session d\'authentification invalide ou expirée. Veuillez vous déconnecter et vous reconnecter.' },
        { status: 401 }
      );
    }

    // 2. Check if user already owns or belongs to an organization (Idempotency / Existing Org Handling)
    const { data: existingRoles } = await supabaseAdmin
      .from('user_organization_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order("created_at", { ascending: true });

    if (existingRoles && existingRoles.length > 0) {
      const existingOrgId = existingRoles[0].organization_id;
      const { data: existingOrg } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', existingOrgId)
        .single();

      if (existingOrg) {
        return NextResponse.json({
          success: true,
          existing: true,
          organization: existingOrg,
        });
      }
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête JSON invalide' }, { status: 400 });
    }

    const { name, sector, country, city, currency, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Le nom de l'entreprise est obligatoire." }, { status: 400 });
    }

    // Generate unique slug from company name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const slug = `${baseSlug || 'org'}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Insert Organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: name.trim(),
        slug,
        country: country || 'Burkina Faso',
        currency: currency || 'XOF',
        timezone: 'Africa/Ouagadougou',
        settings: {
          sector: sector || 'COMMERCE',
          city: city || 'Ouagadougou',
          company_phone: phone || '',
          onboarding_step: 'WHATSAPP',
          onboarding_completed: false,
        },
        created_by: user.id,
      })
      .select('*')
      .single();

    if (orgError || !org) {
      console.error('[Org Creation DB Error]', orgError);
      return NextResponse.json(
        { error: `Erreur base de données Supabase lors de la création d'entreprise: ${orgError?.message || 'Inconnue'}` },
        { status: 500 }
      );
    }

    // 4. Insert User Role as OWNER (with rollback cleanup if role assignment fails)
    const { error: roleError } = await supabaseAdmin
      .from('user_organization_roles')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'OWNER',
        permissions: ['*'],
        created_by: user.id,
      });

    if (roleError) {
      console.error('[Role Assignment Error - Rolling back Org]', roleError);
      // Clean up orphaned organization
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return NextResponse.json(
        { error: `Erreur d'assignation du rôle OWNER (${roleError.message}). Création annulée.` },
        { status: 500 }
      );
    }

    // 5. Create default financial account (Caisse Principale)
    const { error: finError } = await supabaseAdmin.from('financial_accounts').insert({
      organization_id: org.id,
      name: 'Caisse Principale',
      type: 'CASH_REGISTER',
      opening_balance: 0,
      current_balance: 0,
      currency: currency || 'XOF',
      status: 'ACTIVE',
    });

    if (finError) {
      console.warn('[Default Caisse Warning]', finError.message);
    }

    return NextResponse.json({
      success: true,
      existing: false,
      organization: org,
    });
  } catch (error: any) {
    console.error('[Organization API Exception]', error);
    return NextResponse.json({ error: error?.message || 'Erreur serveur imprévue' }, { status: 500 });
  }
}
