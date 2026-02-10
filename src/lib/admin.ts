/**
 * Admin Dashboard API Client
 * Calls server-side admin API routes (protected by cookie auth)
 */

import type { QuizHistory, ConceptMastery } from './supabase';

export interface ClasswideStats {
  totalStudents: number;
  totalQuizzes: number;
  totalQuestions: number;
  averageAccuracy: number;
  activeStudentsLast7Days: number;
  activeStudentsLast30Days: number;
}

export interface StudentSummary {
  code: string;
  displayName: string | null;
  adminLabel: string | null;
  wrongAnswerCountdown: number | null;
  totalQuizzes: number;
  totalQuestions: number;
  correctAnswers: number;
  overallAccuracy: number;
  lastActive: string;
  createdAt: string;
}

export interface StudentDetailedProgress {
  studyCode: StudentSummary;
  quizHistory: QuizHistory[];
  conceptMastery: ConceptMastery[];
  weakTopics: ConceptMastery[];
}

/**
 * Get class-wide statistics
 */
export async function getClasswideStats(): Promise<ClasswideStats | null> {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get all students with summary data
 */
export async function getAllStudents(sortBy: 'lastActive' | 'accuracy' | 'quizzes' = 'lastActive'): Promise<StudentSummary[]> {
  try {
    const res = await fetch(`/api/admin/students?sortBy=${sortBy}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Search students by code or display name
 */
export async function searchStudents(query: string): Promise<StudentSummary[]> {
  if (!query) return [];

  try {
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Get detailed progress for a specific student
 */
export async function getStudentProgress(code: string): Promise<StudentDetailedProgress | null> {
  try {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update admin label for a study code
 */
export async function updateAdminLabel(code: string, adminLabel: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminLabel }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Update wrong answer countdown override for a study code
 */
export async function updateCountdownOverride(code: string, seconds: number | null): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrongAnswerCountdown: seconds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a single student and all their data
 */
export async function deleteStudent(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/students/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete multiple students at once
 */
export async function deleteStudents(codes: string[]): Promise<{
  success: boolean;
  deleted: number;
  failed: string[];
}> {
  try {
    const res = await fetch('/api/admin/students/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes }),
    });

    if (!res.ok) {
      return { success: false, deleted: 0, failed: codes };
    }

    return await res.json();
  } catch {
    return { success: false, deleted: 0, failed: codes };
  }
}

/**
 * Export all student data as CSV
 */
export function exportStudentsToCSV(students: StudentSummary[]): string {
  const formatDateTimePST = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const headers = [
    'Study Code',
    'Display Name',
    'Admin Label',
    'Total Quizzes',
    'Total Questions',
    'Correct Answers',
    'Accuracy %',
    'Last Active (PST)',
    'Created At (PST)',
  ];

  const rows = students.map((s) => [
    s.code,
    s.displayName || 'Anonymous',
    s.adminLabel || '',
    s.totalQuizzes.toString(),
    s.totalQuestions.toString(),
    s.correctAnswers.toString(),
    s.overallAccuracy.toFixed(2),
    formatDateTimePST(s.lastActive),
    formatDateTimePST(s.createdAt),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}
