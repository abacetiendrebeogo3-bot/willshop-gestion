import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/infrastructure/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ user: any; organizationId: string; role: string; errorResponse?: NextResponse; supabaseAdmin: any }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      user: null,
      organizationId: '',
      role: '',
      supabaseAdmin: null,
      errorResponse: NextResponse.json(
        { error: 'Configuration serveur manquante (variables d\'environnement non définies).' },
        { status: 500 }
      ),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let user = null;
  try {
    const supabaseUserClient = await createServerSupabaseClient();
    const { data: cookieAuthData } = await supabaseUserClient.auth.getUser();
    if (cookieAuthData?.user) {
      user = cookieAuthData.user;
    }
  } catch {}

  if (!user) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const { data: tokenAuthData } = await supabaseAdmin.auth.getUser(token);
      if (tokenAuthData?.user) {
        user = tokenAuthData.user;
      }
    }
  }

  if (!user) {
    return {
      user: null,
      organizationId: '',
      role: '',
      supabaseAdmin,
      errorResponse: NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous reconnecter.' },
        { status: 401 }
      ),
    };
  }

  const { data: userRoles } = await supabaseAdmin
    .from('user_organization_roles')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const roleRecord = userRoles?.[0];
  if (!roleRecord) {
    return {
      user,
      organizationId: '',
      role: '',
      supabaseAdmin,
      errorResponse: NextResponse.json(
        { error: 'Aucune organisation valide associée à cet utilisateur.' },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(roleRecord.role)) {
    return {
      user,
      organizationId: roleRecord.organization_id,
      role: roleRecord.role,
      supabaseAdmin,
      errorResponse: NextResponse.json(
        { error: `Accès refusé. Votre rôle (${roleRecord.role}) ne permet pas cette action.` },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    organizationId: roleRecord.organization_id,
    role: roleRecord.role,
    supabaseAdmin,
  };
}
