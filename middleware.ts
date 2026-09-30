import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * WILLShop OS — Edge Middleware Router & RBAC Protection
 * Uses @supabase/ssr for secure JWT verification on the Edge.
 */

async function getUserRole(userId: string, request: NextRequest): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stbzctncpvgqdpybcrmg.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceKey) {
    console.error('[Middleware Security Error] SUPABASE_SERVICE_ROLE_KEY is missing');
    return 'UNAUTHORIZED';
  }

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
        return data[0].role || 'COMMERCIAL';
      }
    }
  } catch (e) {
    console.error('[Middleware Role Fetch Error]', e);
  }

  return 'UNAUTHORIZED';
}

function getHomePathForRole(role: string): string {
  if (role === 'COMMERCIAL' || role === 'SALES') {
    return '/sales/my-day';
  }
  if (role === 'LIVREUR' || role === 'DRIVER') {
    return '/delivery/my-deliveries';
  }
  if (role === 'UNAUTHORIZED') {
    return '/login';
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

    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stbzctncpvgqdpybcrmg.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const session = user ? { userId: user.id } : null;

    const isAuthRoute = pathname === '/login' || pathname === '/signup';

    // 1. Unauthenticated users trying to access protected routes
    if (!session) {
      if (!isAuthRoute) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return supabaseResponse;
    }

    // 2. Authenticated user
    let role = request.cookies.get('willshop_role')?.value;
    
    if (!role || role === 'UNAUTHORIZED') {
      role = await getUserRole(session.userId, request);
    }

    if (role === 'UNAUTHORIZED') {
      if (!isAuthRoute && pathname !== '/workspace-select') {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return supabaseResponse;
    }

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

    supabaseResponse.cookies.set('willshop_role', role, { path: '/', maxAge: 86400 * 7 });
    return supabaseResponse;

  } catch (err) {
    console.error('[Middleware Global Catch]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
