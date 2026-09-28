import { NextResponse, type NextRequest } from 'next/server';

/**
 * WILLShop OS — Edge Middleware Router & RBAC Protection
 * Zero external package imports to avoid ES module load errors.
 */

function getSupabaseSession(request: NextRequest): { userId: string } | null {
  const allCookies = request.cookies.getAll();
  const cookieMap = new Map<string, string>();
  const chunkMap = new Map<string, { idx: number; val: string }[]>();

  for (const c of allCookies) {
    const name = c.name;
    const val = c.value;
    cookieMap.set(name, val);

    if (name.includes('-auth-token.')) {
      const parts = name.split('-auth-token.');
      const prefix = parts[0];
      const chunkIdx = parseInt(parts[1], 10);
      if (!chunkMap.has(prefix)) chunkMap.set(prefix, []);
      chunkMap.get(prefix)!.push({ idx: chunkIdx, val });
    }
  }

  // Combine chunked cookies into single string candidates
  const candidates: string[] = [];
  for (const [, chunks] of chunkMap.entries()) {
    chunks.sort((a, b) => a.idx - b.idx);
    candidates.push(chunks.map((c) => c.val).join(''));
  }

  // Add individual cookie values
  for (const val of cookieMap.values()) {
    candidates.push(val);
  }

  for (let rawVal of candidates) {
    if (!rawVal) continue;

    // Clean URI encoding & quotes
    try {
      rawVal = decodeURIComponent(rawVal);
    } catch (_e) {}
    rawVal = rawVal.replace(/^["']|["']$/g, '').trim();

    if (rawVal.startsWith('base64-')) {
      try {
        rawVal = Buffer.from(rawVal.substring(7), 'base64').toString('utf8');
      } catch (_e) {}
    }

    // Try parsing as JSON or Array
    let accessToken = '';
    if (rawVal.startsWith('{') || rawVal.startsWith('[')) {
      try {
        const parsed = JSON.parse(rawVal);
        if (Array.isArray(parsed)) {
          accessToken = parsed[0] || '';
        } else if (parsed && typeof parsed === 'object') {
          accessToken = parsed.access_token || parsed.currentSession?.access_token || '';
        }
      } catch (_e) {}
    } else if (rawVal.split('.').length === 3) {
      accessToken = rawVal;
    }

    if (!accessToken && rawVal.includes('eyJ')) {
      // Find JWT substring starting with eyJ
      const match = rawVal.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (match) {
        accessToken = match[0];
      }
    }

    if (accessToken && accessToken.split('.').length === 3) {
      try {
        const parts = accessToken.split('.');
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);

        if (payload && payload.sub) {
          // Check expiration with 10s leeway
          if (!payload.exp || payload.exp * 1000 > Date.now() - 10000) {
            return { userId: payload.sub };
          }
        }
      } catch (_e) {}
    }
  }

  return null;
}

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

    if (role === 'UNAUTHORIZED') {
      if (!isAuthRoute) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
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
