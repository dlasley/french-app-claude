# Progress Tracker

## Current Branch
`main`

## Last Session Summary
**Date**: 2026-02-05

### Completed Work (This Session)

#### 5. Added --writing-type Flag for Targeted Generation
Added `--writing-type` flag to generate specific writing subtypes, enabling targeted generation to improve pedagogical balance.

**Usage**:
```bash
npx tsx scripts/generate-questions.ts --type writing --writing-type conjugation --sync-db
npx tsx scripts/generate-questions.ts --type writing --writing-type sentence_building --count 5 --sync-db
```

**Changes**:
- Added `writingType` to CLIOptions interface
- Added `--writing-type` flag with validation (requires `--type writing`)
- Prompt includes subtype-specific examples when flag is used
- Post-generation filtering removes questions with wrong inferred writing type

**Valid writing types**: translation, conjugation, question_formation, sentence_building, open_ended

---

#### 7. Question Distribution Planner (plan-generation.ts)
Created new CLI tool that analyzes current distribution and generates an execution plan to reach target distribution.

**New File**: `scripts/plan-generation.ts`

**Features**:
- Analyzes current vs target distribution for question types and writing subtypes
- Uses topic compatibility mapping to estimate efficiency (reduces drift waste)
- Generates commands for each generation step with cost estimates
- Optional `--execute` flag runs the plan with confirmation prompts
- Outputs copy-paste commands for manual control

**Usage**:
```bash
npx tsx scripts/plan-generation.ts              # Show analysis and plan
npx tsx scripts/plan-generation.ts --execute    # Execute the plan
npx tsx scripts/plan-generation.ts --analyze-only
```

**Topic Compatibility Mapping** (built-in):
| Writing Type | Compatible Topics | Est. Drift |
|--------------|-------------------|------------|
| conjugation | -ER Verbs, Avoir, Être, préférer | 30% |
| question_formation | est-ce que, Conversation, Tu vs Vous | 35% |
| sentence_building | All topics | 20% |
| translation | All topics | 10% |
| open_ended | All topics | 50% |

---

#### 6. Targeted Writing Type Generation & Distribution Analysis
Ran targeted generation to improve writing subtype distribution, analyzed drift performance.

**Conjugation Generation** (all topics):
- 114 topic/difficulty combos processed
- 70 questions generated (after filtering)
- ~69% drift rate (topics like Numbers, Greetings don't support conjugation)
- Drift is expected behavior - AI correctly refuses to generate nonsensical questions

**Question Formation Generation** (targeted topics only):
- 4 compatible topics targeted: "Questions with est-ce que", "Basic Conversation Phrases", "Tu vs. Vous", "Classroom Expressions"
- 21 questions generated
- ~42% average drift (0% on "Questions with est-ce que")

**Updated Distribution** (1500 total questions, 406 writing):
| Type | Before | After | Target | Status |
|------|--------|-------|--------|--------|
| translation | 167 (53%) | 167 (41%) | 35% | 6% over |
| sentence_building | 94 (30%) | 94 (23%) | 25% | ✓ Close |
| conjugation | 8 (3%) | 78 (19%) | 18% | ✓ On target |
| question_formation | 19 (6%) | 40 (10%) | 12% | ✓ Improved |
| open_ended | 27 (9%) | 27 (7%) | 10% | 3% under |

**Key Insight**: Writing type drift is a quality filter, not a bug. The AI sensibly refuses to generate conjugation questions for vocabulary topics. For targeted generation, pre-filter to compatible topics for efficiency.

**Documentation**: Updated `scripts/README.md` with `--writing-type` flag documentation and targeted generation examples.

---

#### 4. Writing Type Inference System
Implemented pattern-based type inference for writing questions. Previously all 315 writing questions were hardcoded as `translation` type. Now types are inferred from question text.

**New Files**:
- `scripts/lib/writing-type-inference.ts` - Pattern matching engine for 5 writing types

**Modified Files**:
- `scripts/generate-questions.ts` - Now uses `inferWritingType()` instead of hardcoded `'translation'`

**Writing Types**:
| Type | Pattern Keywords |
|------|------------------|
| `translation` | translate, en français, in french |
| `conjugation` | conjugate, verb form, present tense |
| `question_formation` | write a question, create a question |
| `sentence_building` | write sentence, combine sentences, rewrite |
| `open_ended` | (fallback for dialogue, describe, creative) |

**Distribution Change** (after migration):
| Type | Before | After |
|------|--------|-------|
| translation | 100% (315) | 53% (167) |
| sentence_building | 0% | 30% (94) |
| open_ended | 0% | 9% (27) |
| question_formation | 0% | 6% (19) |
| conjugation | 0% | 3% (8) |

**Pedagogical Note**: Distribution still translation-heavy. Future question generation should target better balance: ~35% translation, ~25% sentence_building, ~18% conjugation, ~12% question_formation, ~10% open_ended.

---

#### 3. Added --type Flag to generate-questions.ts
Added ability to generate only a specific question type, enabling targeted addition of writing questions without regenerating everything.

**Changes to `scripts/generate-questions.ts`**:
- Added `questionType` to CLIOptions interface
- Added `--type` flag parsing with validation
- Modified `generateQuestionsForTopic()` to accept optional type parameter
- Prompt dynamically adjusts to generate only the specified type

**Usage**:
```bash
npx tsx scripts/generate-questions.ts --type writing --sync-db           # Add only writing questions
npx tsx scripts/generate-questions.ts --type writing --count 3 --sync-db  # 3 per topic/difficulty
```

**Impact**:
- Can add ~342 writing questions with `--count 3` to achieve ~25% writing mix
- Can add ~1,140 writing questions with default `--count 10` for ~53% writing mix

---

#### 2. Added 'writing' Question Type to Generation Pipeline
Previously, `generate-questions.ts` only generated multiple-choice, fill-in-blank, and true-false questions. This meant Assessment mode (which expects 50% writing questions) was only getting fill-in-blank questions.

**Problem Solved**: Quiz modes expect writing questions but none were being generated.

**Changes to `scripts/generate-questions.ts`**:
- Added `'writing'` to Question interface type union (line 40)
- Added `'writing'` to prompt's question type options
- Added writing question example to JSON template
- Added instructions for writing questions (translations, sentence construction)

**Impact**:
- Practice mode can now get its expected 30% writing questions
- Assessment mode can now get its expected 50/50 fill-in-blank/writing mix
- Requires regeneration to populate database with writing questions

---

#### 1. Auto-Convert PDFs in regenerate.ts Pipeline
Enhanced regenerate.ts to automatically convert PDFs when markdown doesn't exist, eliminating the need to run convert-pdfs.ts separately.

**Problem Solved**: Pipeline was stopping with "No markdown files found. Run convert-pdfs.ts first." instead of just converting the PDFs.

**Changes to `scripts/regenerate.ts`**:
- Added `--force-convert` flag to reconvert even when markdown exists
- Added inline PDF conversion using Claude Sonnet API (same logic as convert-pdfs.ts)
- Added helper functions: `extractPdfText()`, `convertPdfToMarkdown()`, `cleanConversionArtifacts()`, `checkPdftotext()`
- Updated `stepConvertPdf()` to auto-convert when markdown missing but PDFs exist
- Preserves existing behavior: uses cached markdown when available (unless --force-convert)

**New CLI Options**:
```bash
--force-convert  # Force PDF reconversion even if markdown exists
```

**Behavior**:
| Condition | Action |
|-----------|--------|
| Markdown exists | Use it (skip conversion) |
| Markdown exists + `--force-convert` | Reconvert from PDFs |
| No markdown, PDFs exist | Auto-convert PDFs |
| No markdown, no PDFs | Fail with error |

---

### Previous Session Work (2026-02-04)

#### 1. Unit Dropdown Labels
Added descriptive labels to unit dropdown in quiz configuration UI.

**Changes**:
- Added `label?: string` field to `Unit` interface in `src/types/index.ts`
- Added labels to existing units in `src/lib/units.ts`:
  - Introduction: "Basics & Greetings"
  - Unit 2: "Activities & -ER Verbs"
  - Unit 3: "Être, Avoir & Numbers"
- Updated dropdown in `src/app/page.tsx` to display: `{unit.title}: {unit.label}`
- Modified `scripts/suggest-unit-topics.ts` to suggest labels during topic extraction

#### 3. PROGRESS.md Directive Improvements
Updated CLAUDE.md with concrete, trigger-based directives for PROGRESS.md maintenance.

**Changes**:
- Replaced vague "during long sessions" with specific triggers:
  - After completing code changes that touch 2+ files
  - After finishing a feature, fix, or discrete piece of work
  - Before switching to a different area of the codebase
  - Before responding to an unrelated question
- Added TodoWrite convention: always include "Update PROGRESS.md" as final todo item

**Rationale**: Concrete triggers are easier to act on than judgment-based directives. Embedding the update in TodoWrite creates a structural checkpoint.

#### 2. Smart PDF/Markdown File Discovery in regenerate.ts
Enhanced the regeneration pipeline to automatically find and combine multiple source files per unit.

**Problem Solved**: "Ongoing Unit 2 Slides.pdf" wasn't being included when regenerating unit-2.

**Changes to `findPdfsForUnit()`**:
- Now returns array of all matching PDFs (not just one)
- Pattern matching prevents false positives (e.g., "unit 20" matching "unit 2")
- Canonical file ("French 1 Unit N.pdf") sorted first, then others alphabetically
- Special handling for `introduction` unit (matches "introduction" in filename)

**Changes to `findMarkdownForUnit()`**:
- Added special handling for `introduction` unit
- Throws error on ambiguous matches (multiple non-canonical files)
- Explicit path check before pattern search

**Changes to `stepConvertPdf()`**:
- Combines multiple PDF markdown sources into single file
- Proper output naming for introduction unit ("French 1 Introduction.md")

**Example Behavior**:
```
unit-2 → Finds: French 1 Unit 2.pdf, Ongoing Unit 2 Slides.pdf
         Combines to: French 1 Unit 2.md

introduction → Finds: French 1 Introduction.pdf (or any *introduction*.pdf)
               Outputs: French 1 Introduction.md
```

---

### Previous Session Work

#### 0. Unified Questions Table Migration (DB Schema Refactor)
Migrated from split architecture (JSON files + `writing_questions` table) to unified database-only storage.

**Schema Changes**:
- Created unified `questions` table that handles ALL question types (MCQ, T/F, fill-in-blank, writing)
- Deprecated `writing_questions` table (migration included to copy data)
- Removed JSON file writes from `generate-questions.ts`

**New `questions` Table Schema**:
```sql
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  unit_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  type TEXT NOT NULL CHECK (type IN ('multiple-choice', 'true-false', 'fill-in-blank', 'writing')),
  options TEXT[],                            -- MCQ/TF choices
  acceptable_variations TEXT[] DEFAULT '{}', -- Writing/fill-in-blank alternate answers
  writing_type TEXT,                         -- translation, conjugation, etc.
  hints TEXT[] DEFAULT '{}',
  requires_complete_sentence BOOLEAN DEFAULT FALSE,
  content_hash TEXT,                         -- MD5 for deduplication
  batch_id TEXT,                             -- Generation batch ID
  source_file TEXT,                          -- Learning material source
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Files Modified**:
- `supabase/migrations/create_unified_questions_table.sql` - Full migration with data copy
- `supabase/schema.sql` - Updated with new schema
- `scripts/generate-questions.ts` - Removed JSON writes, uses DB only
- `src/lib/question-loader.ts` - Async Supabase queries instead of JSON reads
- `src/lib/writing-questions.ts` - Updated to query `questions` table with `type='writing'`
- `src/app/api/generate-questions/route.ts` - Simplified to use unified loader

**Migration Steps**:
1. Run `supabase/migrations/create_unified_questions_table.sql` in Supabase SQL Editor
2. Verify data with queries in Step 6 of migration
3. After verification, optionally drop `writing_questions` table (Step 7)

**Benefits**:
- Single source of truth for all question types
- Eliminates JSON file sync issues
- Content hash deduplication across all question types
- Simpler codebase (no dual storage paths)

#### 1. PDF-to-Markdown Conversion Pipeline
- Created `scripts/convert-pdfs.ts` - Converts PDFs to clean markdown using Claude API
- Created `scripts/prompts/pdf-to-markdown.txt` - Conversion prompt (artifact-free output)
- Created `learnings/test-conversions/unit-2-test.md` - Manual test conversion showing expected output

**Conversion Quality Guidelines**:
- No LLM artifacts (no "Here's the content...", no code fences, no concluding summaries)
- Faithful PDF structure preservation (not reorganized)
- Vocabulary format: `- **french_word** - english_translation`
- Answer keys under `### Réponses` subsections
- YouTube links preserved

#### 2. Topic Extraction & Validation System
- Created `scripts/suggest-unit-topics.ts` - Extracts topics from markdown, reconciles with existing
- Created `scripts/lib/topic-utils.ts` - Topic comparison and similarity utilities
- Created `scripts/extract-topics.ts` - Lower-level topic extraction tool

**Topic Management Flow**:
1. Convert PDF → markdown (`convert-pdfs.ts`)
2. Extract & validate topics (`suggest-unit-topics.ts`)
3. Review suggestions, update `units.ts` manually
4. Generate questions (`generate-questions.ts`)

**Deduplication Strategy**:
- Semantic similarity check (LLM-powered)
- Quick string-based pre-filter for obvious duplicates
- Three outcomes: use existing topic, add new topic, or flag for human review

#### 3. Analysis Findings
- **Topic field is already protected**: Assigned from `units.ts`, not LLM response
- **extractTopicContent() relies on heading matches**: Faithful PDF conversion works
- **Summary sections not used**: Question generation prompt synthesizes from raw content
- **Data anomaly found**: "Numbers 20-100" in unit-2 questions but defined in unit-3 topics

#### Previous Session Work

##### Feature Flag Refactoring
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

#### 6. Content Regeneration Pipeline Design
Designed CLI tools for converting PDFs to markdown and generating questions:

**Architecture Decisions**:
- **Option C**: Single markdown files with YAML frontmatter for metadata
- Separate tools with controller: `convert-pdfs.ts`, `generate-questions.ts`, `regenerate.ts`
- Content hash deduplication via MD5 of normalized question content
- Non-destructive: additive approach, questions deduplicated not replaced

**Database Updates**:
- Added `content_hash`, `batch_id`, `source_file` columns to `writing_questions`
- Added indexes for deduplication lookups
- Created migration: `supabase/migrations/add_regeneration_columns.sql`

**Progress Safety**:
- `concept_mastery` groups by topic, not question_id - no schema changes needed
- Old question IDs preserved; new questions get new IDs
- Topic names in `units.ts` must remain stable for progress continuity

#### 7. Question Generation Script Enhancement (generate-questions.ts)
Implemented CLI parameters and database deduplication for non-destructive question regeneration:

**New CLI Options**:
```bash
--unit <unit-id>        # Generate for specific unit only
--topic <topic-name>    # Generate for specific topic only
--difficulty <level>    # Filter by difficulty (beginner|intermediate|advanced)
--count <n>             # Questions per topic/difficulty (default: 10)
--sync-db               # Sync to Supabase with deduplication
--dry-run               # Preview what would be generated
--batch-id <id>         # Custom batch ID for tracking
--source-file <path>    # Track source learning material
```

**Deduplication Strategy**:
- Content hash = `md5(question || '|' || correctAnswer || '|' || topic || '|' || difficulty)`
- Before inserting: fetch existing hashes from DB, skip duplicates
- Additive: new questions get new IDs, existing questions preserved
- Batch tracking: each generation run tagged with `batch_id` and `source_file`

**Collision Rate Warnings**:
- Calculates and displays collision percentage at end of run
- < 30%: Healthy, no warning
- 30-49%: Note about pool filling up (normal)
- 50-79%: Notice about quality degradation risk
- ≥ 80%: Warning to stop generation, topic appears saturated

**Example Usage**:
```bash
npx tsx scripts/generate-questions.ts --unit unit-3 --sync-db
npx tsx scripts/generate-questions.ts --unit unit-3 --topic "Numbers 0-20" --dry-run
npx tsx scripts/generate-questions.ts --unit unit-2 --count 25   # Override for broad topics
```

#### 8. Pipeline Controller Script (regenerate.ts)
Created controller that orchestrates the full content regeneration workflow:

**Pipeline Steps**:
1. PDF → Markdown conversion
2. Topic extraction & validation (with pause for human review)
3. Question generation (with deduplication)

**CLI Options**:
```bash
--auto          # Skip topic review for existing units
--skip-convert  # Use existing markdown
--skip-topics   # Use existing topics from units.ts
--sync-db       # Sync to database
--dry-run       # Preview mode
```

**Example Usage**:
```bash
npx tsx scripts/regenerate.ts unit-4 --auto --sync-db  # Full pipeline
npx tsx scripts/regenerate.ts unit-4 --skip-convert    # Skip PDF step
npx tsx scripts/regenerate.ts --all --auto --sync-db   # All units
```

#### 9. Global Claude Code Configuration
Created `~/.claude/CLAUDE.md` with directives that apply to all projects:
- Ensure PROGRESS.md exists in every project
- Template structure for new PROGRESS.md files
- Update rules (before commits, during long sessions)

## Uncommitted Changes
- `scripts/plan-generation.ts` - Distribution planner with topic compatibility mapping (NEW)
- `scripts/lib/writing-type-inference.ts` - Pattern-based writing type inference (NEW)
- `scripts/generate-questions.ts` - Writing type inference + `--writing-type` flag for targeted generation
- `scripts/check-writing-questions.ts` - Pagination fix for Supabase 1000 row limit
- `scripts/README.md` - Added `--writing-type` and `plan-generation.ts` documentation
- `CLAUDE.md` - Updated conventions

## Pending Items
- [x] **Run writing type migration** - Updated 148 questions with correct writing_type values
- [x] **Improve writing type distribution** - Generated 70 conjugation + 21 question_formation questions. Distribution now within ~6% of all targets
- [x] **Add writing questions** - Generated 339 questions (315 writing, 22 fill-in-blank, 2 MCQ due to AI type drift)
- [x] **Topic compatibility mapping** - Built into `plan-generation.ts`. Pre-filters topics by writing type compatibility to reduce drift waste.
- [ ] **Address question type distribution drift** - During full generation (no --type flag), AI favors MCQ/fill-in-blank over T/F (~13% T/F vs expected 25%). Options: (1) add target proportions to prompt, (2) add --balanced flag that runs each type separately, or (3) accept natural distribution
- [ ] Consider renaming component files (e.g., WritingAnswerInput.tsx → AnswerInput.tsx)
- [x] Implement `scripts/convert-pdfs.ts` for PDF → Markdown conversion
- [x] Implement topic extraction: `scripts/suggest-unit-topics.ts`, `scripts/lib/topic-utils.ts`
- [x] Enhance `scripts/generate-questions.ts` with CLI parameters, deduplication, DB sync
- [x] Create `scripts/regenerate.ts` controller script
- [x] Smart file discovery for multiple PDFs per unit
- [x] Special handling for `introduction` unit in regenerate.ts
- [ ] Test PDF conversion with API credits (script ready, needs credits)
- [ ] Fix data anomaly: "Numbers 20-100" questions in unit-2 should be in unit-3
- [x] Run migration `add_regeneration_columns.sql` on production database
- [x] Run `create_unified_questions_table.sql` migration on production database
- [x] Verify unified questions table data, then drop `writing_questions` table
- [ ] After testing: Delete obsolete files (old migration/seed scripts for `writing_questions`)
  - `supabase/migrations/create_writing_questions_table.sql`
  - `supabase/migrations/add_regeneration_columns.sql`
  - `supabase/seed-writing-questions.sql`
  - `supabase/export-writing-questions.mjs`

## Ready for Full Regeneration
The regeneration pipeline is ready. User's planned workflow:
1. Delete study codes (reset progress)
2. Truncate questions table
3. Clear `learnings/*.md` files
4. Run `npx tsx scripts/regenerate.ts --all --auto --sync-db`

## Known Issues
- ~~Database has 0 writing questions~~ **RESOLVED**: Now has 406 writing questions (27% of 1500 total)
- ~~`--type` flag in generate-questions.ts has ~7% type drift~~ **FIXED**: Added post-generation type filtering to enforce constraint
- ~~Topic content extraction returns wrong content~~ **FIXED**: Added topic aliases for English→French heading matching in `extractTopicContent()`, removed dangerous fallback that returned first 3000 chars of unrelated content
- **Writing type drift is expected** - When using `--writing-type`, topics that don't support the requested type have high drift (e.g., 69% for conjugation across all topics). This is correct behavior - use topic-aware targeting for efficiency.

## Next Steps (Suggested)
1. ✅ Consider if results page needs similar unification for metadata display
2. ❌ File renaming for component files (optional, aliases work for now)
3. ✅ Break the Progress screen into grouped tabs
4. 🔄 Content regeneration pipeline (designed, pending implementation - see Pending Items)
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
