-- Add admin_label column to study_codes table
-- This field is only visible to admins and not to students

ALTER TABLE study_codes
ADD COLUMN admin_label TEXT;

COMMENT ON COLUMN study_codes.admin_label IS 'Optional label/identifier that admin can assign to a student. Not visible to students.';
