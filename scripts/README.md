# Scripts Directory

## Quick Reference

### By Use Case

- **Content Regeneration**
  - `regenerate.ts` — Full pipeline: PDF → Markdown → Topics → Questions
  - `generate-questions.ts` — Generate questions for a unit/topic
  - `suggest-unit-topics.ts` — Extract topics from markdown files
  - `plan-generation.ts` — Analyze distribution and plan targeted generation
- **Database**
  - `check-writing-questions.ts` — Inspect question counts and samples
  - `test-db-connection.ts` — Verify database connection and schema

### By Script Type

- **Pipeline** — Question generation workflow
  - `regenerate.ts`, `generate-questions.ts`, `suggest-unit-topics.ts`
- **Utility** — Inspection and debugging
  - `check-writing-questions.ts`, `test-db-connection.ts`
- **Shared** — Supporting libraries and templates
  - `lib/`, `prompts/`

---

## Pipeline Overview

The content regeneration pipeline converts learning materials into quiz questions:

```
┌─────────────────────────────────────────────────────────────────┐
│                      regenerate.ts                              │
│  (orchestrator - runs the full pipeline)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   PDF files            Markdown files         Topic extraction
   (PDF/)               (learnings/)
        │                     │                     │
        └──────────┬──────────┘                     │
                   ▼                                │
          suggest-unit-topics.ts ◄──────────────────┘
          (extracts teachable topics)
                   │
                   ▼
          generate-questions.ts
          (creates questions via Claude API)
                   │
                   ▼
             Supabase DB
             (questions table)
```

### Running the Full Pipeline

```bash
# Regenerate all units and sync to database
npx tsx scripts/regenerate.ts --all --sync-db

# Regenerate a specific unit
npx tsx scripts/regenerate.ts unit-2 --sync-db

# With interactive topic review (expert users only)
npx tsx scripts/regenerate.ts --all --review-topics --sync-db
```

---

## Script Reference

### regenerate.ts (Pipeline)

**Purpose:** Orchestrates the full content regeneration pipeline.

**Usage:**
```bash
npx tsx scripts/regenerate.ts <unit-id> [options]
npx tsx scripts/regenerate.ts --all [options]

Options:
  --sync-db          Sync generated questions to Supabase
  --skip-convert     Skip PDF conversion (use existing markdown)
  --skip-topics      Skip topic extraction (use existing topics)
  --review-topics    Interactive topic review (see note below)
  --dry-run          Show what would be done without executing
```

**Note on `--review-topics`:** By default, the pipeline uses AI-extracted topics
automatically. The `--review-topics` flag enables interactive prompts to manually
review and override topic names. Use only if you are fluent in French and have
pedagogical expertise for French courseware development.

**Interrelationships:**
- Spawns `suggest-unit-topics.ts` for topic extraction
- Spawns `generate-questions.ts` for question generation
- Uses `prompts/pdf-to-markdown.txt` for PDF conversion
- Reads from `PDF/` and `learnings/` directories

---

### generate-questions.ts (Pipeline)

**Purpose:** Generates quiz questions for a unit/topic using Claude API.

**Usage:**
```bash
npx tsx scripts/generate-questions.ts [options]

Options:
  --unit <id>        Unit ID (required)
  --topic <name>     Specific topic (optional, defaults to all)
  --difficulty <d>   beginner, intermediate, or advanced
  --type <t>         multiple-choice, true-false, fill-in-blank, or writing
  --writing-type <w> Writing subtype: translation, conjugation, question_formation,
                     sentence_building, or open_ended (requires --type writing)
  --count <n>        Number of questions per topic/difficulty
  --sync-db          Upload to Supabase after generation
```

**Interrelationships:**
- Called by `regenerate.ts`
- Uses `src/lib/learning-materials.ts` for content extraction
- Uses `src/lib/topic-headings.ts` for topic-to-heading mapping

---

### plan-generation.ts (Pipeline)

**Purpose:** Analyzes current question distribution and creates an execution plan to reach target distribution.

**Usage:**
```bash
npx tsx scripts/plan-generation.ts [options]

Options:
  --execute           Execute the generation plan (prompts for confirmation)
  --analyze-only      Only show distribution analysis, don't generate a plan
  --target-writing <n> Target percentage for writing questions (default: 27)
  --help, -h          Show this help message
```

**Features:**
- Analyzes current distribution vs target percentages
- Generates an efficient plan using topic compatibility knowledge
- Estimates API calls and cost before execution
- Outputs copy-paste commands for manual control
- Optional `--execute` flag runs commands with confirmation prompts

**Interrelationships:**
- Calls `generate-questions.ts` for execution
- Queries Supabase for current question counts
- Uses built-in topic compatibility mapping to reduce drift waste

---

### suggest-unit-topics.ts (Pipeline)

**Purpose:** Extracts teachable topics from markdown learning materials using Claude API.

**Usage:**
```bash
npx tsx scripts/suggest-unit-topics.ts <markdown-file> <unit-id>

Example:
npx tsx scripts/suggest-unit-topics.ts "learnings/French 1 Unit 2.md" unit-2
```

**Interrelationships:**
- Called by `regenerate.ts`
- Uses `lib/topic-utils.ts` for topic processing
- Outputs suggested updates for `src/lib/units.ts` and `src/lib/topic-headings.ts`

---

### check-writing-questions.ts (Utility)

**Purpose:** Inspect question counts, distribution, and sample content in the database.

**Usage:**
```bash
# Show statistics only
npx tsx scripts/check-writing-questions.ts

# Include sample question text
npx tsx scripts/check-writing-questions.ts --samples
```

**Output includes:**
- Counts by unit and type
- Counts by difficulty
- Writing question subtypes
- Top 10 topics
- Sample questions (with `--samples`)

---

### test-db-connection.ts (Utility)

**Purpose:** Verify database connection and test all core tables (study_codes, quiz_history, question_results, concept_mastery view, questions).

**Usage:**
```bash
npx tsx scripts/test-db-connection.ts
```

**Tests performed:**
- Connection to Supabase
- CRUD operations on progress tracking tables
- Questions table accessibility
- Automatic cleanup of test data

---

## Shared Resources

### lib/topic-utils.ts

Shared utilities for topic processing:
- Topic name normalization
- Heading pattern matching
- Topic-to-content mapping helpers

Used by: `suggest-unit-topics.ts`

### lib/writing-type-inference.ts

Pattern-based inference of writing question subtypes from question text:
- `inferWritingType(text)` - Returns writing subtype based on keyword patterns
- `isValidWritingType(type)` - Type guard for validation
- `getValidatedWritingType(aiType, text)` - Validates AI response with fallback

Writing types: `translation`, `conjugation`, `question_formation`, `sentence_building`, `open_ended`

Used by: `generate-questions.ts`

### prompts/pdf-to-markdown.txt

Prompt template for converting PDF content to well-structured markdown.

Used by: `regenerate.ts` (PDF conversion step)

---

## Environment Requirements

All scripts require `.env.local` with:

```env
# Supabase (required for DB operations)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Anthropic (required for AI operations)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

---

## Common Workflows

### Verify Database Connection
```bash
npx tsx scripts/test-db-connection.ts
```

### Full Content Regeneration
```bash
npx tsx scripts/regenerate.ts --all --sync-db
```

### Verify Database Content
```bash
npx tsx scripts/check-writing-questions.ts --samples
```

### Generate Questions for One Topic
```bash
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Numbers 20-100" --sync-db
```

### Generate Targeted Writing Questions
```bash
# Generate conjugation questions for verb-related topics
npx tsx scripts/generate-questions.ts --type writing --writing-type conjugation --count 3 --sync-db

# Generate question_formation for specific compatible topic
npx tsx scripts/generate-questions.ts --type writing --writing-type question_formation \
  --unit unit-3 --topic "Questions with est-ce que" --count 3 --sync-db
```

**Note:** Some topic/writing-type combinations have high "drift" (AI generates different
types because the topic doesn't support the requested type). For best results, target
writing types to compatible topics (e.g., conjugation → verb topics, question_formation
→ "Questions with est-ce que").

### Plan and Balance Distribution
```bash
# Analyze current distribution and see proposed plan
npx tsx scripts/plan-generation.ts

# Execute the plan (with confirmation prompt)
npx tsx scripts/plan-generation.ts --execute

# Just show analysis, no plan
npx tsx scripts/plan-generation.ts --analyze-only
```
