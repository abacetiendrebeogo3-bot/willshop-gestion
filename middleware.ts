import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  try {
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

    // 2. Define public routes that do not require authentication
    const isPublicPath =
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/offline');

    // 3. Check for Supabase session cookies
    const allCookies = request.cookies.getAll();
    const supabaseCookie = allCookies.find(
      (c) => c.name.startsWith('sb-') || c.name.includes('auth-token')
    );

    let isAuthenticated = false;
    let userRole = 'COMMERCIAL';

    if (supabaseCookie && supabaseCookie.value) {
      try {
        const rawVal = decodeURIComponent(supabaseCookie.value);
        let parsed: any = null;
        try {
          parsed = JSON.parse(rawVal);
        } catch (_) {}

        if (parsed) {
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.access_token) {
            isAuthenticated = true;
          } else if (parsed.access_token || parsed.user) {
            isAuthenticated = true;
          }
        } else if (supabaseCookie.value.length > 20) {
          isAuthenticated = true;
        }

        if (parsed?.user?.user_metadata?.role) {
          userRole = parsed.user.user_metadata.role;
        } else if (parsed?.user_role) {
          userRole = parsed.user_role;
        }
      } catch (_) {
        isAuthenticated = false;
      }
    }

    // 4. Handle unauthenticated visitors
    if (!isAuthenticated) {
      if (isPublicPath) {
        return NextResponse.next();
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    // 5. Handle authenticated users visiting entrance pages
    if (isAuthenticated) {
      if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname =
          userRole === 'LIVREUR'
            ? '/delivery/my-deliveries'
            : userRole === 'COMMERCIAL'
            ? '/sales/my-day'
            : '/ceo';
        return NextResponse.redirect(redirectUrl);
      }

      // Role-based route protection for LIVREUR
      if (userRole === 'LIVREUR') {
        const allowedForLivreur = ['/delivery', '/profile', '/login', '/signup'];
        const isAllowed = allowedForLivreur.some(
          (path) => pathname === path || pathname.startsWith(path + '/')
        );
        if (!isAllowed) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/delivery/my-deliveries';
          return NextResponse.redirect(redirectUrl);
        }
      }

      // Role-based route protection for COMMERCIAL
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
        if (isRestricted) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/sales/my-day';
          return NextResponse.redirect(redirectUrl);
        }
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error('[Middleware Error Handled]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
