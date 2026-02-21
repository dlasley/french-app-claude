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

## Content Extraction: Topics, Aliases, and Sections

When `generate-questions.ts` generates questions for a topic, it needs to find the
relevant learning material to feed Claude as context. This is a multi-step process
that maps **topic names** → **heading aliases** → **markdown sections**.

### Data Sources

```
src/lib/units.ts                    learnings/French 1 Unit 2.md
┌──────────────────────────┐        ┌──────────────────────────────────────┐
│ {                        │        │ # French 1 Unit 2                    │
│   name: '-ER Verb        │        │                                      │
│          Conjugation',   │        │ ## Qu'est-ce que tu aimes faire?     │
│   headings: [            │        │ ...sports content...                 │
│     'conjugaison',       │        │                                      │
│     'conjugation',       │        │ ## Present tense of -ER verbs        │
│     '-er verbs',         │        │ ...conjugation rules...              │
│     'present tense       │        │ ### Common ER Verbs                  │
│        of -er',          │        │ ...verb list...                      │
│     'conjugate the       │        │ ### How to Conjugate -ER Verbs       │
│        verbs'            │        │ ...conjugation table...              │
│   ]                      │        │                                      │
│ }                        │        │ ## Les jours de la semaine           │
└──────────────────────────┘        │ ...days content...                   │
                                    └──────────────────────────────────────┘
```

### Extraction Flow

```
extractTopicContent(markdown, "-ER Verb Conjugation")
│
├─ Phase 1: Direct match
│  Scan all headings for one containing "-ER Verb Conjugation" literally.
│  No match found → fall through to Phase 2.
│
├─ Phase 2: Alias match
│  Look up headings array from units.ts:
│    ['conjugaison', 'conjugation', '-er verbs', 'present tense of -er', ...]
│
│  Scan every heading in the markdown file:
│
│    "## Present tense of -ER verbs"
│     └─ matches alias "present tense of -er" ──► extract section 1
│
│    "### Common ER Verbs"
│     └─ matches alias "-er verbs" ──────────────► extract section 2
│
│    "### How to Conjugate -ER Verbs"
│     └─ matches alias "conjugate the verbs" ───► extract section 3
│
│  Log: Found topic "-ER Verb Conjugation" via alias match (3 sections)
│
└─ Result: 3 sections joined with "---" separators
   Passed to Claude as learning context for question generation.
```

### Section Boundaries

Each matched section includes everything from the heading down to the next heading
at the **same or higher level**. Subsections are included:

```
## Present tense of -ER verbs    ◄── match starts here (level 2)
   paragraph content...               │
### Common ER Verbs              ◄── included (level 3, deeper)
   verb list...                        │
### How to Conjugate             ◄── this is a SEPARATE match
## Les jours de la semaine       ◄── would stop section (level 2, same level)
```

Sections shorter than 10 lines are discarded (likely just a heading with no content).

### Fallback Chain

| Step | Condition | Result |
|------|-----------|--------|
| Direct match | Heading contains topic name literally | Use that section |
| Alias match | Any `headings[]` alias found in markdown headings | Join all matched sections |
| No match | Neither works | Warning logged; Claude generates from general knowledge |

### Alias Matching Rules

- **Case-insensitive**: `"conjugation"` matches `"Conjugation"` and `"CONJUGATION"`
- **Word-boundary aware**: `"present"` won't match `"presentation"`; uses Unicode-aware lookbehind/lookahead
- **H1 skipped**: Document-level `# Title` headings are never matched (only `##` and deeper)
- **Deduplication**: Each heading index is matched at most once, even if multiple aliases hit it

---

## Quality Pipeline

After generation, two scripts evaluate and adjust question quality:

```
generate-questions.ts ──► Supabase
                              │
              ┌───────────────┼───────────────┐
              ▼                               ▼
    validate-difficulty.ts            audit-quality.ts
    (reclassify difficulty            (Sonnet evaluates
     using Haiku rubric)               correctness, grammar,
              │                        hallucination, coherence)
              ▼                               │
    UPDATE questions SET                      ▼
    difficulty = ...                  Console report with
                                     pass rates by type/model
```

### validate-difficulty.ts

Reclassifies every question's difficulty using a rubric-based AI pass.

```bash
npx tsx scripts/validate-difficulty.ts > /tmp/french-validation.log 2>&1
```

### audit-quality.ts

Evaluates questions for correctness, grammar, hallucination, and coherence.
Supports filtering by unit, difficulty, type, model, and random sampling.

```bash
# Audit all questions
npx tsx scripts/audit-quality.ts

# Compare Haiku vs Sonnet questions for unit-2
npx tsx scripts/audit-quality.ts --unit unit-2

# Audit only Sonnet-generated questions
npx tsx scripts/audit-quality.ts --model claude-sonnet-4-5-20250929

# Random sample of 50
npx tsx scripts/audit-quality.ts --limit 50
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
- Uses `prompts/pdf-to-markdown.md` for PDF conversion
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
- Uses `src/lib/units.ts` for topic-to-heading mapping

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
- Outputs suggested updates for `src/lib/units.ts`

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
- `getAllTopics()` - Collects all topic names across units
- `normalizeTopic()` - Normalizes topic names for comparison
- `findSimilarTopics()` - AI-powered fuzzy topic matching

Used by: `suggest-unit-topics.ts`

### lib/writing-type-inference.ts

Pattern-based inference of writing question subtypes from question text:
- `inferWritingType(text)` - Returns writing subtype based on keyword patterns

Writing types: `translation`, `conjugation`, `question_formation`, `sentence_building`, `open_ended`

Used by: `generate-questions.ts`

### lib/db-queries.ts

Shared database query utilities:
- `createScriptSupabase()` - Initialize Supabase client from env vars
- `fetchAllQuestions(supabase, selectFields?)` - Paginated fetch (bypasses 1000-row default limit)
- `analyzeDistribution(questions)` - Count by type and writing subtype

Used by: `plan-generation.ts`, `check-writing-questions.ts`

### lib/config.ts

Centralized configuration for pipeline scripts:
- `MODELS` - Model IDs for PDF conversion, topic extraction, similarity, and question generation
- `COST_PER_API_CALL` - Estimated cost per Haiku 4.5 API call

Used by: `regenerate.ts`, `suggest-unit-topics.ts`, `generate-questions.ts`, `lib/topic-utils.ts`, `plan-generation.ts`

### lib/file-updaters.ts

Pure functions for auto-updating source files during new unit pipeline:
- `insertUnitEntry(source, unitData)` - Insert a new unit entry into `units.ts`

Used by: `regenerate.ts` (Step 2.5: auto-update files for new units)

### prompts/pdf-to-markdown.md

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
