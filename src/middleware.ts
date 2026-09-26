import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next.js internals, images, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|json|woff|woff2)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Identify public paths
  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/') ||
    pathname.startsWith('/offline');

  let response = NextResponse.next({
    request,
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        '[Config Error] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from environment variables.'
      );
      if (!isPublicPath && pathname !== '/login') {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('error', 'config_missing');
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    // Edge-safe Supabase Server Client
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                response.cookies.set(name, value, options as any);
              } catch (_) {}
            });
          } catch (_) {}
        },
      },
    });

    // Refresh auth session safely
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch (authErr) {
      console.warn('[Middleware Auth Warning] Unable to fetch user session:', authErr);
      user = null;
    }

    // 3. Prevent Infinite Redirection Loops & Enforce Route Protection

    // Unauthenticated user attempting to access a protected page
    if (!user && !isPublicPath) {
      if (pathname !== '/login') {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    // Authenticated user attempting to access entrance pages (/ , /login , /signup)
    if (user && isPublicPath) {
      let userRole = 'COMMERCIAL';
      try {
        const { data: roleRows } = await supabase
          .from('user_organization_roles')
          .select('role')
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (roleRows && roleRows.length > 0 && roleRows[0]?.role) {
          userRole = roleRows[0].role;
        }
      } catch (_roleErr) {
        // Fallback default
      }

      const targetPath =
        userRole === 'LIVREUR'
          ? '/delivery/my-deliveries'
          : userRole === 'COMMERCIAL'
          ? '/sales/my-day'
          : '/ceo';

      if (pathname !== targetPath) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = targetPath;
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Authenticated user accessing role-restricted routes
    if (user && !isPublicPath) {
      let userRole = 'COMMERCIAL';
      try {
        const { data: roleRows } = await supabase
          .from('user_organization_roles')
          .select('role')
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (roleRows && roleRows.length > 0 && roleRows[0]?.role) {
          userRole = roleRows[0].role;
        }
      } catch (_roleErr) {}

      // Restricted routes for LIVREUR
      if (userRole === 'LIVREUR') {
        const allowedForLivreur = ['/delivery', '/profile', '/login', '/signup'];
        const isAllowed = allowedForLivreur.some(
          (path) => pathname === path || pathname.startsWith(path + '/')
        );
        if (!isAllowed && pathname !== '/delivery/my-deliveries') {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/delivery/my-deliveries';
          return NextResponse.redirect(redirectUrl);
        }
      }

      // Restricted routes for COMMERCIAL
      if (userRole === 'COMMERCIAL') {
        const restrictedForCommercial = [
          '/ceo',
          '/finance',
          '/strategy',
          '/team',
          '/marketing',
          '/intelligence',
          '/whatsapp',
          '/ai-agents',
          '/automation',
          '/wilty',
          '/settings',
        ];
        const isRestricted = restrictedForCommercial.some(
          (r) => pathname === r || pathname.startsWith(r + '/')
        );
        if (isRestricted && pathname !== '/sales/my-day') {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/sales/my-day';
          return NextResponse.redirect(redirectUrl);
        }
      }
    }

    return response;
  } catch (globalErr) {
    console.error('[Middleware Fatal Error Handled]', globalErr);
    if (pathname !== '/login' && !isPublicPath) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
