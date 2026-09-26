import { NextResponse, type NextRequest } from 'next/server';

/**
 * Decode JWT token payload safely using native Edge Web APIs (atob).
 * Requires zero network calls and zero external dependencies,
 * eliminating 100% of Vercel Edge Runtime invocation crashes.
 */
function getSessionFromRequest(request: NextRequest) {
  try {
    const cookies = request.cookies.getAll();
    const authCookie = cookies.find(
      (c) => c.name.startsWith('sb-') || c.name.includes('auth-token')
    );

    if (!authCookie || !authCookie.value) return null;

    let accessToken = '';
    let rawValue = authCookie.value;

    try {
      rawValue = decodeURIComponent(authCookie.value);
    } catch (_) {}

    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed) && parsed[0]) {
        accessToken = typeof parsed[0] === 'string' ? parsed[0] : parsed[0]?.access_token;
      } else if (parsed?.access_token) {
        accessToken = parsed.access_token;
      }
    } catch (_) {
      if (rawValue.startsWith('eyJ')) {
        accessToken = rawValue;
      }
    }

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.startsWith('eyJ')) {
      return null;
    }

    const parts = accessToken.split('.');
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonPayload = atob(paddedBase64);
    const payload = JSON.parse(jsonPayload);

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    const userRole =
      payload.user_metadata?.role ||
      payload.app_metadata?.role ||
      (payload.role === 'authenticated' ? 'COMMERCIAL' : payload.role) ||
      'COMMERCIAL';

    return {
      userId: payload.sub,
      email: payload.email,
      role: userRole,
    };
  } catch (_) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // 1. Skip static assets, Next.js internal files, images, fonts, and API routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/favicon') ||
      /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|json|woff|woff2)$/i.test(pathname)
    ) {
      return NextResponse.next();
    }

    // 2. Identify public entrance routes
    const isPublicPath =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname.startsWith('/login/') ||
      pathname.startsWith('/signup/') ||
      pathname.startsWith('/offline');

    // 3. Extract user session from cookie
    const session = getSessionFromRequest(request);
    const isAuthenticated = !!session;
    const userRole = session?.role || 'COMMERCIAL';

    // 4. Handle unauthenticated visitors
    if (!isAuthenticated) {
      if (isPublicPath) {
        return NextResponse.next();
      }
      if (pathname !== '/login') {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // 5. Handle authenticated users
    if (isAuthenticated) {
      // Redirect away from entrance pages (/ , /login , /signup)
      if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
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

    return NextResponse.next();
  } catch (err) {
    console.error('[Middleware Global Catch]', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
