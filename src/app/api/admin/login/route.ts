import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createSessionCookie } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

const LOGIN_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 5 };

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`admin-login:${clientIp}`, LOGIN_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const { password } = await request.json();

    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const cookie = createSessionCookie();
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);

    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
