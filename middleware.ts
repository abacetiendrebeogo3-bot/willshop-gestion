import { NextResponse, type NextRequest } from 'next/server';

/**
 * WILLShop OS — Edge Middleware Router
 * Lightweight, zero-dependency middleware.
 * Ensures instant page loads and zero server-side redirect bouncing.
 */
export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Skip static assets, Next.js internal files, images, fonts, and API routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/favicon') ||
      /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|json|woff|woff2)$/i.test(pathname)
    ) {
      return NextResponse.next();
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
