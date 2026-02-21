/**
 * Fetch units from the database (for scripts and server-side code).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Unit } from '@/types';

export async function fetchUnitsFromDb(supabase: SupabaseClient): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, title, label, description, topics, sort_order')
    .order('sort_order');

  if (error) {
    throw new Error(`Failed to fetch units: ${error.message}`);
  }

  return data as Unit[];
}
