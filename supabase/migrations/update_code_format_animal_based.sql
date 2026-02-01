-- Update study code format to support animal-based codes
-- Removes format constraint to allow maximum flexibility
-- The UNIQUE constraint on the code column still ensures no duplicates
-- Application-level validation handles format requirements

-- Remove old constraint that enforced "study-xxxxxxxx" format
-- This allows:
-- - Old format: "study-abc12345" (for backward compatibility)
-- - New format: "happy elephant" (adjective + space + animal)
-- - Future formats: any variation we need
ALTER TABLE study_codes
DROP CONSTRAINT IF EXISTS code_format;

-- No new constraint added - validation happens in application layer
-- The code column remains TEXT with UNIQUE constraint for duplicate prevention
