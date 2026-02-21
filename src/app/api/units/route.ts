import { NextResponse } from 'next/server';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';

export async function GET() {
  if (!isSupabaseAvailable()) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase!
    .from('units')
    .select('id, title, label, description, topics, sort_order')
    .order('sort_order');

  if (error) {
    console.error('Failed to fetch units:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
