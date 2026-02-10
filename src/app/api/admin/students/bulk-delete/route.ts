import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-guard';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const { codes } = await request.json();

    if (!Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: 'No codes provided' }, { status: 400 });
    }

    const failed: string[] = [];
    let deleted = 0;

    for (const code of codes) {
      const { error } = await supabaseAdmin!
        .from('study_codes')
        .delete()
        .eq('code', code);

      if (error) {
        failed.push(code);
      } else {
        deleted++;
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      deleted,
      failed,
    });
  } catch (error) {
    console.error('Error bulk deleting students:', error);
    return NextResponse.json({ error: 'Failed to delete students' }, { status: 500 });
  }
}
