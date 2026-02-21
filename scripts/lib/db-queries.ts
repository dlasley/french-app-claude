/**
 * Shared database query utilities for pipeline scripts.
 *
 * Provides Supabase client init, paginated question fetch,
 * and distribution analysis — used by corpus-plan-generation.ts.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load environment variables (idempotent — safe to call multiple times)
config({ path: resolve(__dirname, '../../.env.local') });

export interface QuestionRow {
  id: string;
  unit_id: string;
  difficulty: string;
  type: string;
  writing_type: string | null;
  topic: string;
  question?: string;
  correct_answer?: string;
}

export interface DistributionAnalysis {
  total: number;
  byType: Record<string, number>;
  byWritingType: Record<string, number>;
  writingTotal: number;
}

/**
 * Create a Supabase client using env vars.
 * Exits the process if credentials are missing.
 *
 * @param opts.write - Use SUPABASE_SECRET_KEY for write access (bypasses RLS).
 *                     Falls back to anon key with a warning if secret key is missing.
 */
export function createScriptSupabase(opts?: { write?: boolean }): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  if (opts?.write) {
    if (!secretKey) {
      console.warn('⚠️  SUPABASE_SECRET_KEY not set — using anon key (may fail with RLS)');
    }
    return createClient(supabaseUrl, secretKey || anonKey);
  }

  return createClient(supabaseUrl, anonKey);
}

export const PAGE_SIZE = 1000;

/**
 * Fetch all questions from the database with pagination
 * to bypass Supabase's 1000-row default limit.
 */
export async function fetchAllQuestions(
  supabase: SupabaseClient,
  selectFields = 'id, unit_id, difficulty, type, writing_type, topic',
): Promise<QuestionRow[]> {
  let all: QuestionRow[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('questions')
      .select(selectFields)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Error fetching questions: ${error.message}`);
    }

    if (data && data.length > 0) {
      all = all.concat(data as unknown as QuestionRow[]);
      page++;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return all;
}

/**
 * Generic paginated fetch for any Supabase table.
 *
 * @param supabase - Supabase client
 * @param table - Table name
 * @param buildQuery - Callback to apply filters/ordering to the base query
 * @param selectFields - Columns to select (default: '*')
 */
export async function fetchAllPages<T>(
  supabase: SupabaseClient,
  table: string,
  buildQuery: (query: any) => any,
  selectFields = '*',
): Promise<T[]> {
  let all: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const baseQuery = supabase.from(table).select(selectFields);
    const query = buildQuery(baseQuery);
    const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Error fetching ${table}: ${error.message}`);
    }

    if (data && data.length > 0) {
      all = all.concat(data as T[]);
      page++;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return all;
}

/**
 * Analyze question distribution by type and writing subtype.
 */
export function analyzeDistribution(questions: QuestionRow[]): DistributionAnalysis {
  const byType: Record<string, number> = {};
  const byWritingType: Record<string, number> = {};

  for (const q of questions) {
    byType[q.type] = (byType[q.type] || 0) + 1;
    if (q.type === 'writing') {
      const wt = q.writing_type || 'unspecified';
      byWritingType[wt] = (byWritingType[wt] || 0) + 1;
    }
  }

  return {
    total: questions.length,
    byType,
    byWritingType,
    writingTotal: byType['writing'] || 0,
  };
}
