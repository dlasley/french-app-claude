import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin but not /admin/login
  if (pathname === '/admin' || (pathname.startsWith('/admin/') && pathname !== '/admin/login')) {
    const sessionCookie = request.cookies.get('admin_session');

    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Cookie presence check only — full HMAC verification happens in API routes
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
