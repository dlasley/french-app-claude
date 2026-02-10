/**
 * Reusable admin auth check for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionFromCookie, getAdminCookieName } from './admin-auth';

export function requireAdmin(request: NextRequest): NextResponse | null {
  const cookieValue = request.cookies.get(getAdminCookieName())?.value;
  if (!verifySessionFromCookie(cookieValue)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
