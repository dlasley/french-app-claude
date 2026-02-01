-- French Assessment App - Database Schema
-- Anonymous study code system with progress tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Study Codes Table
-- Stores anonymous student identifiers and basic info
CREATE TABLE study_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  display_name TEXT, -- Optional: student can add their name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_quizzes INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,

  -- Indexes for fast lookups
  CONSTRAINT code_format CHECK (code ~ '^study-[a-z0-9]{8}$')
);

-- Index on code for fast lookups
CREATE INDEX idx_study_codes_code ON study_codes(code);
CREATE INDEX idx_study_codes_created_at ON study_codes(created_at DESC);

-- Quiz History Table
-- Stores individual quiz attempts
CREATE TABLE quiz_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_code_id UUID REFERENCES study_codes(id) ON DELETE CASCADE,
  quiz_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unit_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  score_percentage NUMERIC(5,2) NOT NULL,
  time_spent_seconds INTEGER,

  -- Indexes
  CONSTRAINT valid_score CHECK (score_percentage >= 0 AND score_percentage <= 100)
);

CREATE INDEX idx_quiz_history_study_code ON quiz_history(study_code_id, quiz_date DESC);
CREATE INDEX idx_quiz_history_date ON quiz_history(quiz_date DESC);

-- Question Results Table
-- Stores individual question attempts for detailed analytics
CREATE TABLE question_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_history_id UUID REFERENCES quiz_history(id) ON DELETE CASCADE,
  study_code_id UUID REFERENCES study_codes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_results_study_code ON question_results(study_code_id);
CREATE INDEX idx_question_results_topic ON question_results(study_code_id, topic);

-- Concept Mastery View
-- Aggregates performance by topic for each student
CREATE VIEW concept_mastery AS
SELECT
  study_code_id,
  topic,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
  ROUND(
    (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as mastery_percentage,
  MAX(attempted_at) as last_attempted
FROM question_results
GROUP BY study_code_id, topic;

-- Weak Topics View
-- Identifies topics where student is struggling (< 70% accuracy)
CREATE VIEW weak_topics AS
SELECT
  study_code_id,
  topic,
  total_attempts,
  correct_attempts,
  mastery_percentage
FROM concept_mastery
WHERE mastery_percentage < 70 AND total_attempts >= 3
ORDER BY mastery_percentage ASC;

-- Strong Topics View
-- Identifies topics where student has mastered (>= 85% accuracy)
CREATE VIEW strong_topics AS
SELECT
  study_code_id,
  topic,
  total_attempts,
  correct_attempts,
  mastery_percentage
FROM concept_mastery
WHERE mastery_percentage >= 85 AND total_attempts >= 5
ORDER BY mastery_percentage DESC;

-- Function to generate unique study code
CREATE OR REPLACE FUNCTION generate_study_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: study-xxxxxxxx (8 random alphanumeric chars)
    new_code := 'study-' || lower(substring(md5(random()::text) from 1 for 8));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM study_codes WHERE code = new_code) INTO code_exists;

    -- If unique, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE study_codes
  SET last_active_at = NOW()
  WHERE id = NEW.study_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_active on quiz submission
CREATE TRIGGER update_study_code_last_active
AFTER INSERT ON quiz_history
FOR EACH ROW
EXECUTE FUNCTION update_last_active();

-- Function to calculate overall stats
CREATE OR REPLACE FUNCTION calculate_overall_stats(code_id UUID)
RETURNS TABLE(
  total_quizzes BIGINT,
  total_questions BIGINT,
  correct_answers BIGINT,
  overall_accuracy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT qh.id)::BIGINT as total_quizzes,
    COUNT(qr.id)::BIGINT as total_questions,
    SUM(CASE WHEN qr.is_correct THEN 1 ELSE 0 END)::BIGINT as correct_answers,
    ROUND(
      (SUM(CASE WHEN qr.is_correct THEN 1 ELSE 0 END)::NUMERIC /
       COUNT(qr.id)::NUMERIC) * 100,
      2
    ) as overall_accuracy
  FROM quiz_history qh
  LEFT JOIN question_results qr ON qr.quiz_history_id = qh.id
  WHERE qh.study_code_id = code_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE study_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_results ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read/write their own data
-- Everyone can create new study codes
CREATE POLICY "Anyone can create study codes"
  ON study_codes FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anyone can read any study code (anonymous, no PII)
CREATE POLICY "Anyone can read study codes"
  ON study_codes FOR SELECT
  TO anon
  USING (true);

-- Anyone can update their own study code
CREATE POLICY "Anyone can update study codes"
  ON study_codes FOR UPDATE
  TO anon
  USING (true);

-- Quiz history policies
CREATE POLICY "Anyone can create quiz history"
  ON quiz_history FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read quiz history"
  ON quiz_history FOR SELECT
  TO anon
  USING (true);

-- Question results policies
CREATE POLICY "Anyone can create question results"
  ON question_results FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read question results"
  ON question_results FOR SELECT
  TO anon
  USING (true);

-- Sample data for testing (optional)
-- Uncomment to insert test data
/*
INSERT INTO study_codes (code, display_name)
VALUES ('study-test1234', 'Test Student');

INSERT INTO quiz_history (study_code_id, unit_id, difficulty, total_questions, correct_answers, score_percentage)
SELECT id, 'introduction', 'beginner', 10, 8, 80.00
FROM study_codes WHERE code = 'study-test1234';
*/

-- Helpful queries for admin dashboard
COMMENT ON TABLE study_codes IS 'Anonymous student identifiers';
COMMENT ON TABLE quiz_history IS 'Individual quiz attempts';
COMMENT ON TABLE question_results IS 'Detailed question-by-question results';
COMMENT ON VIEW concept_mastery IS 'Topic mastery by student';
COMMENT ON VIEW weak_topics IS 'Topics where student needs help';
COMMENT ON VIEW strong_topics IS 'Topics where student excels';
