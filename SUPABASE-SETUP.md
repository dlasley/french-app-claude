# Supabase Setup Guide

Complete guide to setting up Supabase for the French Assessment app.

## Step 1: Create Supabase Project

1. Go to **https://supabase.com**
2. Click **"Start your project"** or **"New Project"**
3. Sign in with GitHub (recommended) or email
4. Click **"New project"** in your organization
5. Configure project:
   - **Name**: `french-assessment`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your location
   - **Pricing**: Free tier (500MB database, 2GB bandwidth)
6. Click **"Create new project"**
7. Wait ~2 minutes for project to initialize

---

## Step 2: Get Your API Credentials

Once your project is ready:

1. In Supabase dashboard, go to **Settings** (gear icon)
2. Click **API** in the left sidebar
3. Copy these values:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long token)

---

## Step 3: Set Up Database Schema

### Option A: Using SQL Editor (Recommended)

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the query editor
5. Click **"Run"** (or Cmd/Ctrl + Enter)
6. You should see: "Success. No rows returned"

### Option B: Using Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

---

## Step 4: Verify Database Setup

Check that tables were created:

1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - ✅ `study_codes`
   - ✅ `quiz_history`
   - ✅ `question_results`
3. You should see these views:
   - ✅ `concept_mastery`
   - ✅ `weak_topics`
   - ✅ `strong_topics`

---

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```bash
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # Enable database sync
   NEXT_PUBLIC_ENABLE_DB_SYNC=true
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

---

## Step 6: Test Connection

### Quick Test Query

Run this in Supabase SQL Editor to test:

```sql
-- Test: Generate a study code
SELECT generate_study_code();

-- Test: Insert a test student
INSERT INTO study_codes (code, display_name)
VALUES (generate_study_code(), 'Test Student')
RETURNING *;

-- Test: View all study codes
SELECT * FROM study_codes;

-- Test: View concept mastery (should be empty initially)
SELECT * FROM concept_mastery;
```

---

## Database Schema Overview

### Tables

#### `study_codes`
Stores anonymous student identifiers.
```sql
- id: UUID (primary key)
- code: TEXT (format: "study-xxxxxxxx")
- display_name: TEXT (optional)
- created_at: TIMESTAMP
- last_active_at: TIMESTAMP
- total_quizzes: INTEGER
- total_questions: INTEGER
- correct_answers: INTEGER
```

#### `quiz_history`
Individual quiz attempts.
```sql
- id: UUID
- study_code_id: UUID (foreign key)
- quiz_date: TIMESTAMP
- unit_id: TEXT
- difficulty: TEXT (beginner/intermediate/advanced)
- total_questions: INTEGER
- correct_answers: INTEGER
- score_percentage: NUMERIC
- time_spent_seconds: INTEGER
```

#### `question_results`
Detailed question-by-question results.
```sql
- id: UUID
- quiz_history_id: UUID
- study_code_id: UUID
- question_id: TEXT
- topic: TEXT
- difficulty: TEXT
- is_correct: BOOLEAN
- user_answer: TEXT
- correct_answer: TEXT
- attempted_at: TIMESTAMP
```

### Views

#### `concept_mastery`
Aggregated performance by topic per student.
- Calculates mastery percentage
- Shows total attempts and correct answers
- Last attempted date

#### `weak_topics`
Topics where student is struggling (< 70% accuracy).

#### `strong_topics`
Topics where student has mastered (>= 85% accuracy).

---

## Security

### Row Level Security (RLS)

All tables have RLS enabled. Policies:

- ✅ Anyone can create study codes (anonymous)
- ✅ Anyone can read all study codes (no PII)
- ✅ Anyone can update study codes
- ✅ Anyone can create/read quiz history
- ✅ Anyone can create/read question results

**Why this is safe:**
- No personally identifiable information (PII) stored
- Study codes are anonymous
- Only display_name is optional (student choice)
- Teacher can see all data but can't identify students without their code

---

## Useful Queries

### Get student progress
```sql
SELECT
  sc.code,
  sc.display_name,
  sc.total_quizzes,
  sc.total_questions,
  sc.correct_answers,
  ROUND((sc.correct_answers::NUMERIC / sc.total_questions::NUMERIC) * 100, 2) as accuracy
FROM study_codes sc
WHERE sc.code = 'study-xxxxxxxx';
```

### Get concept mastery for student
```sql
SELECT * FROM concept_mastery
WHERE study_code_id = (SELECT id FROM study_codes WHERE code = 'study-xxxxxxxx')
ORDER BY mastery_percentage ASC;
```

### Get weak topics for student
```sql
SELECT * FROM weak_topics
WHERE study_code_id = (SELECT id FROM study_codes WHERE code = 'study-xxxxxxxx');
```

### Get recent quiz history
```sql
SELECT
  qh.quiz_date,
  qh.unit_id,
  qh.difficulty,
  qh.score_percentage,
  qh.total_questions
FROM quiz_history qh
JOIN study_codes sc ON sc.id = qh.study_code_id
WHERE sc.code = 'study-xxxxxxxx'
ORDER BY qh.quiz_date DESC
LIMIT 10;
```

### Admin: View all students
```sql
SELECT
  code,
  display_name,
  total_quizzes,
  total_questions,
  correct_answers,
  ROUND((correct_answers::NUMERIC / NULLIF(total_questions, 0)::NUMERIC) * 100, 2) as accuracy,
  last_active_at
FROM study_codes
ORDER BY last_active_at DESC;
```

---

## Troubleshooting

### "relation does not exist"
- Make sure you ran the schema.sql in SQL Editor
- Check Table Editor to verify tables exist

### "permission denied"
- Check RLS policies are enabled
- Verify you're using the anon key, not service key

### "connection failed"
- Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env.local
- Make sure there are no trailing spaces
- Restart dev server after changing .env.local

### "duplicate key value"
- Study codes are unique
- Use `generate_study_code()` function to ensure uniqueness

---

## Next Steps

After Supabase is set up:

1. ✅ Install Supabase client library
2. ✅ Create API routes for database operations
3. ✅ Implement study code generation in UI
4. ✅ Add progress tracking to quiz component
5. ✅ Build admin dashboard

Run:
```bash
npm install @supabase/supabase-js
```

---

## Backup & Maintenance

### Automatic Backups
- Supabase Free tier: Daily automatic backups (7 days retention)
- Paid tiers: Point-in-time recovery

### Manual Backup
1. Go to **Database** > **Backups** in Supabase dashboard
2. Click **"Create backup"**
3. Download backup file

### Database Migrations
Store schema changes in `supabase/migrations/` directory:
```
supabase/
  migrations/
    001_initial_schema.sql
    002_add_feature_x.sql
```

---

## Cost Estimate

**Free Tier Limits:**
- 500 MB database storage
- 2 GB bandwidth/month
- 50,000 monthly active users

**Estimated usage for 100 students:**
- ~5 MB database (500 questions/student)
- ~10 MB bandwidth/month
- Well within free tier limits

**When to upgrade:**
- 1000+ active students: Consider Pro ($25/month)
- Need longer backup retention
- Need priority support

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: https://github.com/supabase/supabase/issues
