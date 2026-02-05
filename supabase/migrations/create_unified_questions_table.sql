-- Migration: Create unified questions table
-- Replaces writing_questions with a single table for all question types
-- Run this migration in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create the new unified questions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core fields (all question types)
  question TEXT NOT NULL,                    -- The question text
  correct_answer TEXT NOT NULL,              -- The correct answer
  explanation TEXT,                          -- Why this is correct
  unit_id TEXT NOT NULL,                     -- e.g., 'unit-2'
  topic TEXT NOT NULL,                       -- e.g., 'Days of the Week'
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  -- Question format type
  type TEXT NOT NULL CHECK (type IN ('multiple-choice', 'true-false', 'fill-in-blank', 'writing')),

  -- Type-specific fields (nullable based on type)
  options TEXT[],                            -- MCQ/TF: choices presented to user
  acceptable_variations TEXT[] DEFAULT '{}', -- Writing/fill-in-blank: alternate correct answers
  writing_type TEXT CHECK (writing_type IS NULL OR writing_type IN ('translation', 'conjugation', 'open_ended', 'question_formation', 'sentence_building')),
  hints TEXT[] DEFAULT '{}',                 -- Progressive hints (optional)
  requires_complete_sentence BOOLEAN DEFAULT FALSE,

  -- Metadata for tracking/deduplication
  content_hash TEXT,                         -- MD5 hash for deduplication
  batch_id TEXT,                             -- Generation batch identifier
  source_file TEXT,                          -- Learning material source
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for common query patterns
-- ============================================================================

-- Single column indexes
CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unit_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_content_hash ON questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_questions_batch_id ON questions(batch_id);

-- Composite index for quiz loading (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_questions_unit_topic_diff ON questions(unit_id, topic, difficulty);

-- Composite index for type-filtered queries
CREATE INDEX IF NOT EXISTS idx_questions_unit_type ON questions(unit_id, type);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access (questions are public)
CREATE POLICY "Anyone can read questions"
  ON questions FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous insert (for question generation scripts)
CREATE POLICY "Anyone can insert questions"
  ON questions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous update (for fixing questions)
CREATE POLICY "Anyone can update questions"
  ON questions FOR UPDATE
  TO anon
  USING (true);

-- Allow anonymous delete (for cleanup)
CREATE POLICY "Anyone can delete questions"
  ON questions FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- STEP 4: Migrate data from writing_questions (if exists)
-- ============================================================================

-- Only run if writing_questions table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'writing_questions') THEN
    INSERT INTO questions (
      id,
      question,
      correct_answer,
      explanation,
      unit_id,
      topic,
      difficulty,
      type,
      options,
      acceptable_variations,
      writing_type,
      hints,
      requires_complete_sentence,
      content_hash,
      batch_id,
      source_file,
      created_at,
      updated_at
    )
    SELECT
      id,
      question_en,
      COALESCE(correct_answer_fr, ''),  -- Handle NULL correct answers
      explanation,
      COALESCE(unit_id::TEXT, 'unit-1'), -- Convert UUID to TEXT, default to unit-1
      topic,
      difficulty,
      'writing',                          -- All existing questions are writing type
      NULL,                               -- No options for writing questions
      acceptable_variations,
      question_type,                      -- Maps to writing_type
      hints,
      requires_complete_sentence,
      content_hash,
      batch_id,
      source_file,
      created_at,
      updated_at
    FROM writing_questions
    ON CONFLICT (id) DO NOTHING;         -- Skip if already migrated

    RAISE NOTICE 'Migrated % rows from writing_questions', (SELECT COUNT(*) FROM writing_questions);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questions_updated_at ON questions;
CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_questions_updated_at();

-- ============================================================================
-- STEP 6: Verification queries (run manually to verify migration)
-- ============================================================================

-- Check row counts match
-- SELECT
--   (SELECT COUNT(*) FROM writing_questions) as old_count,
--   (SELECT COUNT(*) FROM questions) as new_count;

-- Check data integrity
-- SELECT type, COUNT(*) FROM questions GROUP BY type;
-- SELECT difficulty, COUNT(*) FROM questions GROUP BY difficulty;
-- SELECT unit_id, COUNT(*) FROM questions GROUP BY unit_id;

-- ============================================================================
-- STEP 7: Drop old table (RUN ONLY AFTER VERIFYING MIGRATION)
-- ============================================================================

-- DANGER: Only uncomment and run after verifying data migration is complete
-- DROP TABLE IF EXISTS writing_questions;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- After running this migration:
-- 1. Verify data with the queries in Step 6
-- 2. Update application code to use 'questions' table instead of 'writing_questions'
-- 3. Test question loading and generation
-- 4. Once verified, uncomment and run Step 7 to drop old table
--
-- Rollback (if needed):
-- DROP TABLE IF EXISTS questions;
-- (writing_questions remains untouched until explicitly dropped)
