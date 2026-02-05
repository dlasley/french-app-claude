# Test Plan: Question Generation Pipeline

This document outlines the test plan for the content regeneration pipeline including:
- `scripts/generate-questions.ts` (enhanced with CLI, deduplication, DB sync)
- `scripts/regenerate.ts` (pipeline controller)
- Supporting scripts (`convert-pdfs.ts`, `suggest-unit-topics.ts`)

## Prerequisites

- [✅] Database accessible
- [✅] `create_unified_questions_table.sql` migration applied
- [✅] API credits available for LLM calls
- [✅] At least one PDF in `PDF/` directory
- [✅] At least one markdown in `learnings/` directory

---

## 1. generate-questions.ts Tests

### 1.1 CLI Parameter Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Help flag | `npx tsx scripts/generate-questions.ts --help` | Shows usage info, exits 0 |
| Unit filter | `npx tsx scripts/generate-questions.ts --unit unit-2 --dry-run` | Only processes unit-2 topics |
| Invalid unit | `npx tsx scripts/generate-questions.ts --unit unit-99 --dry-run` | Error message, lists valid units |
| Topic filter | `npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --dry-run` | Matches "Days of the Week" |
| Difficulty filter | `npx tsx scripts/generate-questions.ts --unit unit-2 --difficulty beginner --dry-run` | Only beginner level |
| Count override | `npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --count 25 --dry-run` | Shows 25 per topic/difficulty |
| Invalid count | `npx tsx scripts/generate-questions.ts --count abc --dry-run` | Error: must be positive integer |
| Combined filters | `npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --difficulty beginner --dry-run` | Single topic/difficulty combo |

**Run:**
```bash
# Test each command above
npx tsx scripts/generate-questions.ts --help
npx tsx scripts/generate-questions.ts --unit unit-2 --dry-run
npx tsx scripts/generate-questions.ts --unit unit-99 --dry-run
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --dry-run
npx tsx scripts/generate-questions.ts --unit unit-2 --difficulty beginner --dry-run
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --count 25 --dry-run
npx tsx scripts/generate-questions.ts --count abc --dry-run
```

[✅]### 1.2 Dry Run Mode

| Test | Command | Expected Result |
|------|---------|-----------------|
| No API calls | `--dry-run` | No LLM API calls made |
| Shows estimates | `--dry-run` | Reports estimated question count |
| No DB writes | `--sync-db --dry-run` | No database inserts |

**Verify:**
```bash
npx tsx scripts/generate-questions.ts --unit unit-2 --dry-run
# Should show "Would process X topic/difficulty combinations"
# Should show "Estimated questions: ~Y"
```

[✅]### 1.3 Deduplication Tests

| Test | Expected Result |
|------|-----------------|
| Content hash computation | Same question text → same hash |
| Hash includes difficulty | Same question at different difficulties → different hashes |
| All hashes fetched | Hash lookup fetches ALL existing hashes (cross-topic) |
| New hash insertion | New questions get inserted with hash |
| Within-run dedup | Same question generated twice in one run → only inserted once |

**Note:** Since the LLM generates different questions each run, exact duplicates are rare.
Deduplication primarily prevents:
- Re-importing the same static data
- Catching natural LLM repetition over many runs on narrow topics

**Test Procedure:**
```bash
# 1. Generate questions and note the hash count
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --difficulty beginner --sync-db
# Output: "Found X existing question hashes"

# 2. Run again - hash count should include questions from step 1
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --difficulty beginner --sync-db
# Output: "Found Y existing question hashes" where Y > X

# 3. Verify hashes are populated in database
```

[✅]### 1.4 Database Sync Tests

| Test | Expected Result |
|------|-----------------|
| Without --sync-db | No DB connection attempted, warning shown |
| With --sync-db | Connects to Supabase, fetches existing hashes |
| Missing credentials | Error message about missing env vars |
| Insert success | Questions inserted with content_hash, batch_id, source_file |
| Insert failure handling | Error logged, continues processing |

**Verify in Supabase:**
```sql
-- Check new questions have metadata
SELECT id, topic, difficulty, type, content_hash, batch_id, source_file
FROM questions
WHERE batch_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

[✅]### 1.5 Batch Tracking Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Auto batch ID | (no --batch-id) | Format: `batch_YYYY-MM-DD_timestamp` |
| Custom batch ID | `--batch-id my-batch-001` | Uses provided ID |
| Source file tracking | `--source-file learnings/unit-2.md` | Stored in DB |

**Verify:**
```bash
npx tsx scripts/generate-questions.ts --unit unit-2 --topic "Days" --difficulty beginner --sync-db --batch-id test-batch-001 --source-file "learnings/unit-2.md"
```

**Verify in database:**
```sql
SELECT id, LEFT(question, 40) AS question_preview, batch_id, source_file, content_hash
FROM questions
WHERE batch_id = 'test-batch-001'
LIMIT 5;
```

[✅]### 1.6 Collision Rate & Quality Warnings

| Collision Rate | Expected Warning |
|---------------|------------------|
| < 30% | No warning (healthy) |
| 30-49% | 📝 Note: Some collisions detected |
| 50-79% | ⚠️ NOTICE: Moderate collision rate |
| ≥ 80% | ⚠️ WARNING: Very high collision rate |

**Note:** High collision rates only occur when the LLM naturally generates duplicate
questions over many runs on the same narrow topic. This indicates topic saturation.

---

## 2. regenerate.ts Tests

[✅]### 2.1 CLI Parameter Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Help flag | `npx tsx scripts/regenerate.ts --help` | Shows usage info |
| Single unit | `npx tsx scripts/regenerate.ts unit-2 --dry-run` | Processes unit-2 |
| All units | `npx tsx scripts/regenerate.ts --all --dry-run` | Processes all units |
| Invalid unit | `npx tsx scripts/regenerate.ts unit-abc` | Error: invalid format |
| Auto mode | `npx tsx scripts/regenerate.ts unit-2 --auto --dry-run` | Skips topic review |

**Run:**
```bash
npx tsx scripts/regenerate.ts --help
npx tsx scripts/regenerate.ts unit-2 --dry-run
npx tsx scripts/regenerate.ts --all --auto --dry-run
```

### 2.2 Pipeline Step Tests

[✅]#### Step 1: PDF Conversion

| Test | Condition | Expected Result |
|------|-----------|-----------------|
| PDF found | PDF exists in PDF/ | Reports found PDF |
| PDF not found | No matching PDF | Falls back to existing markdown |
| --skip-convert | Flag set | Skips step, uses existing markdown |
| No markdown | No PDF or markdown | Pipeline stops with error |

**Test:**
```bash
# With PDF present
npx tsx scripts/regenerate.ts unit-2 --dry-run

# With --skip-convert
npx tsx scripts/regenerate.ts unit-2 --skip-convert --dry-run
```

[✅]#### Step 2: Topic Extraction

| Test | Condition | Expected Result |
|------|-----------|-----------------|
| Existing unit + --auto | Unit in units.ts | Uses existing topics, no prompt |
| Existing unit, no --auto | Unit in units.ts | Runs extraction, prompts for review |
| --skip-topics | Flag set | Uses units.ts topics directly |
| New unit | Unit not in units.ts | Requires topic extraction |

**Test:**
```bash
# Auto mode (no prompt)
npx tsx scripts/regenerate.ts unit-2 --auto --dry-run

# Skip topics
npx tsx scripts/regenerate.ts unit-2 --skip-topics --dry-run
```

#### Step 3: Question Generation

| Test | Condition | Expected Result |
|------|-----------|-----------------|
| Basic generation | Topics available | Generates questions |
| --sync-db passthrough | Flag set | Passes to generate-questions.ts |
| --dry-run passthrough | Flag set | No actual generation |

### 2.3 Combined Flag Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Full auto pipeline | `--auto --sync-db` | No prompts, syncs to DB |
| Skip to questions | `--skip-convert --skip-topics --sync-db` | Only generates questions |
| Preview all | `--all --auto --dry-run` | Shows plan for all units |

---

## 3. Integration Tests

### 3.1 End-to-End Pipeline Test

**Scenario:** New unit with PDF

```bash
# 1. Place new PDF: PDF/French 1 Unit 4.pdf

# 2. Run full pipeline (dry run first)
npx tsx scripts/regenerate.ts unit-4 --dry-run

# 3. Run with topic review
npx tsx scripts/regenerate.ts unit-4 --sync-db
# - Verify PDF conversion
# - Review suggested topics
# - Update units.ts if needed
# - Continue to question generation

# 4. Verify results in database
```

### 3.2 Existing Unit Refresh Test

**Scenario:** Regenerate questions for existing unit

```bash
# 1. Check current question count
npx tsx scripts/generate-questions.ts --unit unit-2 --sync-db --dry-run

# 2. Run with deduplication
npx tsx scripts/regenerate.ts unit-2 --auto --sync-db

# 3. Verify deduplication worked
# - Check "Found X existing question hashes" in output
# - Verify no duplicate content_hash values in DB
```

### 3.3 Progress Data Safety Test

**Scenario:** Verify student progress isn't affected

```sql
-- 1. Note existing question IDs for a topic
SELECT DISTINCT question_id FROM question_results WHERE topic = 'Days of the Week';

-- 2. Regenerate questions for that topic (via CLI)

-- 3. Verify old question IDs still exist
-- 4. Verify concept_mastery view still works
SELECT * FROM concept_mastery WHERE topic = 'Days of the Week' LIMIT 5;
```

---

## 4. Error Handling Tests

| Test | How to Trigger | Expected Behavior |
|------|---------------|-------------------|
| Missing Supabase creds | Remove env vars, use --sync-db | Clear error message |
| API rate limit | Rapid repeated calls | Graceful handling, continues |
| Invalid JSON response | (hard to trigger) | Error logged, continues |
| Network failure | Disconnect during run | Error logged, partial results |

---

## 5. Performance Tests

| Metric | Test | Acceptable Range |
|--------|------|------------------|
| Single topic generation | 1 topic, 3 difficulties | < 60 seconds |
| Full unit generation | All topics, all difficulties | < 15 minutes |
| Hash lookup | With 1000+ existing questions | < 2 seconds |
| Batch insert | 30 questions | < 5 seconds |

---

## 6. Verification Queries

Run these SQL queries to verify data integrity:

```sql
-- Check all new questions have content_hash
SELECT COUNT(*) as missing_hash
FROM questions
WHERE content_hash IS NULL
AND created_at > NOW() - INTERVAL '1 day';

-- Check for duplicate hashes (should be 0)
SELECT content_hash, COUNT(*) as count
FROM questions
WHERE content_hash IS NOT NULL
GROUP BY content_hash
HAVING COUNT(*) > 1;

-- Check batch distribution
SELECT batch_id, COUNT(*) as questions
FROM questions
WHERE batch_id IS NOT NULL
GROUP BY batch_id
ORDER BY batch_id DESC;

-- Check question type distribution
SELECT type, COUNT(*) as count
FROM questions
GROUP BY type
ORDER BY count DESC;

-- Check difficulty distribution
SELECT difficulty, COUNT(*) as count
FROM questions
GROUP BY difficulty
ORDER BY count DESC;
```

---

## Test Execution Checklist

- [ ] 1.1 CLI Parameter Tests
- [ ] 1.2 Dry Run Mode Tests
- [ ] 1.3 Deduplication Tests
- [ ] 1.4 Database Sync Tests
- [ ] 1.5 Batch Tracking Tests
- [ ] 2.1 regenerate.ts CLI Tests
- [ ] 2.2 Pipeline Step Tests
- [ ] 2.3 Combined Flag Tests
- [ ] 3.1 End-to-End Pipeline Test
- [ ] 3.2 Existing Unit Refresh Test
- [ ] 3.3 Progress Data Safety Test
- [ ] 4. Error Handling Tests
- [ ] 5. Performance Tests
- [ ] 6. Run Verification Queries
