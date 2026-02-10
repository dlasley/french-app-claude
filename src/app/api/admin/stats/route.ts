import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-guard';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const { count: totalStudents } = await supabaseAdmin!
      .from('study_codes')
      .select('*', { count: 'exact', head: true });

    const { count: totalQuizzes } = await supabaseAdmin!
      .from('quiz_history')
      .select('*', { count: 'exact', head: true });

    const { data: studyCodes } = await supabaseAdmin!
      .from('study_codes')
      .select('total_questions, correct_answers');

    const totalQuestions = studyCodes?.reduce((sum: number, sc: { total_questions: number }) => sum + (sc.total_questions || 0), 0) || 0;
    const totalCorrect = studyCodes?.reduce((sum: number, sc: { correct_answers: number }) => sum + (sc.correct_answers || 0), 0) || 0;
    const averageAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: activeStudentsLast7Days } = await supabaseAdmin!
      .from('study_codes')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', sevenDaysAgo.toISOString());

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: activeStudentsLast30Days } = await supabaseAdmin!
      .from('study_codes')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      totalStudents: totalStudents || 0,
      totalQuizzes: totalQuizzes || 0,
      totalQuestions,
      averageAccuracy,
      activeStudentsLast7Days: activeStudentsLast7Days || 0,
      activeStudentsLast30Days: activeStudentsLast30Days || 0,
    });
  } catch (error) {
    console.error('Error fetching classwide stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
