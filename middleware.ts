import { NextResponse, type NextRequest } from 'next/server';

/**
 * WILLShop OS — Edge Middleware Router & RBAC Protection
 * Zero external package imports to avoid ES module load errors.
 */

function getSupabaseSession(request: NextRequest): { userId: string } | null {
  const allCookies = request.cookies.getAll();
  let authCookieValue = '';

  const authCookie = allCookies.find(
    (c) => c.name.includes('-auth-token') && !c.name.includes('-auth-token.')
  );

  if (authCookie) {
    authCookieValue = authCookie.value;
  } else {
    const chunks = allCookies
      .filter((c) => c.name.includes('-auth-token.'))
      .sort((a, b) => {
        const idxA = parseInt(a.name.split('.').pop() || '0', 10);
        const idxB = parseInt(b.name.split('.').pop() || '0', 10);
        return idxA - idxB;
      });
    if (chunks.length > 0) {
      authCookieValue = chunks.map((c) => c.value).join('');
    }
  }

  if (!authCookieValue) return null;

  try {
    let parsed: any;
    if (authCookieValue.startsWith('{') || authCookieValue.startsWith('[')) {
      parsed = JSON.parse(authCookieValue);
    } else if (authCookieValue.startsWith('base64-')) {
      const decodedStr = Buffer.from(authCookieValue.substring(7), 'base64').toString('utf8');
      parsed = JSON.parse(decodedStr);
    }

    const token = parsed?.access_token || (Array.isArray(parsed) ? parsed[0] : null);
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    if (payload.sub) {
      return { userId: payload.sub };
    }
  } catch (_e) {
    // Ignore invalid cookie format
  }

  return null;
}

async function getUserRole(userId: string, request: NextRequest): Promise<string> {
  const cachedRole = request.cookies.get('willshop_role')?.value;
  if (cachedRole && ['OWNER', 'CEO', 'MANAGER', 'COMMERCIAL', 'SALES', 'LIVREUR', 'DRIVER'].includes(cachedRole)) {
    return cachedRole;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stbzctncpvgqdpybcrmg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceKey) return 'OWNER';

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/user_organization_roles?select=role&user_id=eq.${userId}&deleted_at=is.null`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].role || 'OWNER';
      }
    }
  } catch (e) {
    console.error('[Middleware Role Fetch Error]', e);
  }

  return 'OWNER';
}

function getHomePathForRole(role: string): string {
  if (role === 'COMMERCIAL' || role === 'SALES') {
    return '/sales/my-day';
  }
  if (role === 'LIVREUR' || role === 'DRIVER') {
    return '/delivery/my-deliveries';
  }
  return '/ceo';
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Public / Static assets pass-through
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/favicon') ||
      pathname === '/offline' ||
      /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|json|woff|woff2)$/i.test(pathname)
    ) {
      return NextResponse.next();
    }

    const session = getSupabaseSession(request);
    const isAuthRoute = pathname === '/login' || pathname === '/signup';

    // 1. Unauthenticated users trying to access protected routes
    if (!session) {
      if (!isAuthRoute) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // 2. Authenticated user
    const role = await getUserRole(session.userId, request);
    const homePath = getHomePathForRole(role);

    // If visiting auth routes while logged in -> redirect to role home
    if (isAuthRoute) {
      const response = NextResponse.redirect(new URL(homePath, request.url));
      response.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
      return response;
    }

    // Root path -> redirect to role home
    if (pathname === '/') {
      const response = NextResponse.redirect(new URL(homePath, request.url));
      response.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
      return response;
    }

    // 3. RBAC Route Guards for Commercial and Livreur roles
    if (role === 'COMMERCIAL' || role === 'SALES') {
      const isForbidden =
        pathname.startsWith('/ceo') ||
        pathname.startsWith('/finance') ||
        pathname.startsWith('/bi') ||
        pathname.startsWith('/team') ||
        pathname.startsWith('/settings');

      if (isForbidden) {
        console.warn(`[RBAC BLOCK] Commercial user attempted to access forbidden route ${pathname}`);
        const response = NextResponse.redirect(new URL('/sales/my-day', request.url));
        response.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
        return response;
      }
    }

    if (role === 'LIVREUR' || role === 'DRIVER') {
      const isForbidden =
        pathname.startsWith('/ceo') ||
        pathname.startsWith('/sales') ||
        pathname.startsWith('/orders') ||
        pathname.startsWith('/finance') ||
        pathname.startsWith('/bi') ||
        pathname.startsWith('/team') ||
        pathname.startsWith('/settings');

      if (isForbidden) {
        console.warn(`[RBAC BLOCK] Livreur user attempted to access forbidden route ${pathname}`);
        const response = NextResponse.redirect(new URL('/delivery/my-deliveries', request.url));
        response.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
        return response;
      }
    }

    const response = NextResponse.next();
    response.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
    return response;

  } catch (err) {
    console.error('[Middleware Global Catch]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
