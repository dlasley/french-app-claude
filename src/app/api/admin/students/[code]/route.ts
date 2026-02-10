import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-guard';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { code } = await params;

  try {
    const { data: studyCodeData } = await supabaseAdmin!
      .from('study_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (!studyCodeData) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const totalQuestions = studyCodeData.total_questions || 0;
    const correctAnswers = studyCodeData.correct_answers || 0;
    const studyCode = {
      code: studyCodeData.code,
      displayName: studyCodeData.display_name,
      adminLabel: studyCodeData.admin_label,
      wrongAnswerCountdown: studyCodeData.wrong_answer_countdown ?? null,
      totalQuizzes: studyCodeData.total_quizzes || 0,
      totalQuestions,
      correctAnswers,
      overallAccuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
      lastActive: studyCodeData.last_active_at,
      createdAt: studyCodeData.created_at,
    };

    const { data: quizHistory } = await supabaseAdmin!
      .from('quiz_history')
      .select('*')
      .eq('study_code_id', studyCodeData.id)
      .order('quiz_date', { ascending: false });

    const { data: conceptMastery } = await supabaseAdmin!
      .from('concept_mastery')
      .select('*')
      .eq('study_code_id', studyCodeData.id)
      .order('mastery_percentage', { ascending: false });

    const { data: weakTopics } = await supabaseAdmin!
      .from('weak_topics')
      .select('*')
      .eq('study_code_id', studyCodeData.id)
      .order('mastery_percentage', { ascending: true });

    return NextResponse.json({
      studyCode,
      quizHistory: quizHistory || [],
      conceptMastery: conceptMastery || [],
      weakTopics: weakTopics || [],
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { code } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if ('adminLabel' in body) updates.admin_label = body.adminLabel;
    if ('wrongAnswerCountdown' in body) updates.wrong_answer_countdown = body.wrongAnswerCountdown;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabaseAdmin!
      .from('study_codes')
      .update(updates)
      .eq('code', code);

    if (error) {
      console.error('Error updating student:', error);
      return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isSupabaseAdminAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { code } = await params;

  try {
    const { error } = await supabaseAdmin!
      .from('study_codes')
      .delete()
      .eq('code', code);

    if (error) {
      console.error('Error deleting student:', error);
      return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}
