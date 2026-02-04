# Progress Tracker

> **Claude Directive**: Always update this file before making git commits. Include what was done in the session and clear the Uncommitted Changes section after committing.

## Current Branch
`main`

## Last Session Summary
**Date**: 2026-02-04

### Completed Work

#### 1. Feature Flag Refactoring
- Merged `STUDY_CODES` and `PROGRESS_TRACKING` flags into single `SHOW_STUDY_CODE` flag
- Flag now only controls UI visibility (study code text, QR code)
- Study code creation and progress tracking always run silently in background
- Progress page and nav link always visible regardless of flag

**Behavior**:
| Flag | Study code created | Quiz saves to DB | Code/QR visible | Progress visible |
|------|-------------------|------------------|-----------------|------------------|
| true | Yes | Yes | Yes | Yes |
| false | Yes | Yes | No | Yes |

**Modified files**:
- `src/lib/feature-flags.ts` - Replaced two flags with `SHOW_STUDY_CODE`
- `src/app/page.tsx` - Always create study code, gate UI only
- `src/app/progress/page.tsx` - Gate StudyCodeDisplay on new flag
- `src/app/quiz/[unitId]/page.tsx` - Remove PROGRESS_TRACKING guard
- `src/components/Navigation.tsx` - Always show progress link
- `.env.local`, `.env.example` - Updated flag names

#### 2. Database Schema Consolidation
- Consolidated `supabase/schema.sql` with all migrations baked in
- Removed duplicate/conflicting `create_writing_questions.sql` (JSONB version)
- Kept `create_writing_questions_table.sql` (TEXT[] version matches app code)
- Removed redundant `idx_study_codes_code` index (UNIQUE constraint already indexes)
- Added `admin_label`, `is_superuser` columns to study_codes table
- Removed `code_format` constraint (app validates, supports animal-based codes)

#### 3. Writing Questions Export Script
- Created `supabase/export-writing-questions.mjs` - exports questions to SQL INSERT script
- Created `supabase/seed-writing-questions.sql` - 50 questions from prod, ready to seed
- Fixed SQL escaping for single quotes in TEXT[] arrays

#### 4. Git/GitHub Cleanup
- Removed `data/` directory contents from tracking (question bank JSON files)
- Added `/data/*` and `!/data/DATA.md` to .gitignore
- Added `/learnings/` to .gitignore (proprietary course materials)
- Repo set to public for Vercel auto-deploy compatibility

#### 5. Bulk Student Deletion Feature
- Added `deleteStudent()` and `deleteStudents()` functions to `src/lib/admin.ts`
- Created reusable `src/components/ConfirmationModal.tsx` with danger variant
- Added checkbox selection column to admin student table with select all
- Added floating bulk action bar when students are selected
- Added delete button to individual student detail view
- Added DELETE RLS policy for `study_codes` table in schema.sql
- **Note**: Must run this SQL in Supabase to enable deletions:
  ```sql
  CREATE POLICY "Anyone can delete study codes"
    ON study_codes FOR DELETE
    TO anon
    USING (true);
  ```

## Uncommitted Changes
None - all changes committed and pushed.

## Pending Items
- [ ] Consider renaming component files (e.g., WritingAnswerInput.tsx → AnswerInput.tsx)

## Known Issues
- None currently

## Next Steps (Suggested)
1. ✅ Consider if results page needs similar unification for metadata display
2. ❌ File renaming for component files (optional, aliases work for now)
3. ✅ Break the Progress screen into grouped tabs
4. I want to be able to easily regenerate the app with new material as it becomes available
5. Allow superusers to define question type and difficulty mix?
6. ✅ TOP PRIORITY: Allow users to select their quiz in practice mode or assessment mode.
Create a new user onboarding runthrough sequence.
7. Add appropriate effect animations to milestone events.
8. ❌ The Intermediate level should include an appropriate mix of Beginner questions, and the Advanced level should include an appropriate level of Beginner and Intermediate questions.
9. Adaptive Testing and Spaced Repetition (ask Gemini): In student assessment and testing design, in which a student may be randomly presented with a test drawn from a pool of available questions, and may retake a test multiple times, are there known methods or schemes to represent them with questions that they recently got wrong to reinforce learnings? And then diminish these questions weighting in the random selection as they demonstrate mastery?
10. ✅ This is correct French typography behavior. In French, there must be a space before ?, !, :, and ;. "Quelle heure est-il ?" -- Jackson says it doesn't matter.
11. Figure out how to score partially correct typed responses
12. ✅ Check to see if user is still superuser at each quiz question
13. ✅ Group the content in the Progress page and the Quiz & Assessment conclusion pages into tabs.
14. Add x second delay to moving to the next question to encnourage reading the feedback on wrong or poor answers. Especially text input answers.
15. ✅ Remove the help text from the fill in blank questions, and maybe the written questions. Some of them explicitly give away the answers.
16. ✅ Change db password in .env.local
17. ❌ Some questions are in French, such as "Lequel de ces énoncés utilise correctement 'préférer'?"
18. Use strong_topics view in My Progress and Admin screens: strong_topics and weak_topics are convenience views — they save the app from having to filter concept_mastery client-side. But since strong_topics isn't actually queried anywhere in the codebase, it could be removed without impact. Alternatively, you could query concept_mastery directly with a WHERE clause and drop both strong_topics and weak_topics.


---

## How to Update This File
At the end of each session, update:
1. **Last Session Summary** - What was done
2. **Uncommitted Changes** - Current working state
3. **Pending Items** - What's left to do
4. **Next Steps** - Recommendations for future sessions
