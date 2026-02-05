-- Migration: Add regeneration pipeline columns to writing_questions
-- Safe to run multiple times (idempotent)
-- Run this on existing production database before using the regeneration scripts

-- Add columns for content deduplication and batch tracking
ALTER TABLE writing_questions
ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE writing_questions
ADD COLUMN IF NOT EXISTS batch_id TEXT;

ALTER TABLE writing_questions
ADD COLUMN IF NOT EXISTS source_file TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_writing_questions_content_hash
ON writing_questions(content_hash);

CREATE INDEX IF NOT EXISTS idx_writing_questions_batch_id
ON writing_questions(batch_id);

-- Add column comments
COMMENT ON COLUMN writing_questions.content_hash IS
'MD5 hash of normalized question content for deduplication during regeneration';

COMMENT ON COLUMN writing_questions.batch_id IS
'Identifies which generation batch created this question (e.g., 2026-02-04_unit3)';

COMMENT ON COLUMN writing_questions.source_file IS
'Path to the markdown learning file used to generate this question';

-- Backfill content_hash for existing questions (optional)
-- This enables deduplication against existing questions
UPDATE writing_questions
SET content_hash = md5(
  lower(
    regexp_replace(
      question_en || '|' || COALESCE(correct_answer_fr, '') || '|' || topic || '|' || difficulty,
      '\s+', ' ', 'g'
    )
  )
)
WHERE content_hash IS NULL;
