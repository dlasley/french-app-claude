import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-guard';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase-admin';

function mapStudentRow(sc: Record<string, unknown>) {
  const totalQuestions = (sc.total_questions as number) || 0;
  const correctAnswers = (sc.correct_answers as number) || 0;
  return {
    code: sc.code,
    displayName: sc.display_name,
    adminLabel: sc.admin_label,
    wrongAnswerCountdown: sc.wrong_answer_countdown ?? null,
    totalQuizzes: (sc.total_quizzes as number) || 0,
    totalQuestions,
    correctAnswers,
    overallAccuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
    lastActive: sc.last_active_at,
    createdAt: sc.created_at,
  };
}

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const sortBy = request.nextUrl.searchParams.get('sortBy') || 'lastActive';
  const query = request.nextUrl.searchParams.get('q');

  try {
    let dbQuery = supabaseAdmin!
      .from('study_codes')
      .select('*')
      .order('last_active_at', { ascending: false });

    if (query) {
      dbQuery = dbQuery.or(`code.ilike.%${query}%,display_name.ilike.%${query}%,admin_label.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Error fetching students:', error);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    const students = (data || []).map(mapStudentRow);

    if (sortBy === 'accuracy') {
      students.sort((a, b) => (b.overallAccuracy as number) - (a.overallAccuracy as number));
    } else if (sortBy === 'quizzes') {
      students.sort((a, b) => (b.totalQuizzes as number) - (a.totalQuizzes as number));
    }

    return NextResponse.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}
