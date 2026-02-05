# Claude Code Instructions

## Project Overview
French language learning quiz application for French 1 classes. Built with Next.js 15, uses Anthropic Semantic API for AI-powered evaluation and Supabase for data persistence.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: React 18, Tailwind CSS
- **AI**: Anthropic Semantic API (Opus 4.5 for evaluation)
- **Database**: Supabase (PostgreSQL)
- **Language**: TypeScript

## Key Architecture Patterns

### Question Types
The `Question` type (`src/types/index.ts`) supports:
- `multiple-choice` - Standard MCQ
- `true-false` - Binary choice
- `fill-in-blank` - Single-line typed answer
- `writing` - Multi-line typed answer

### Tiered Evaluation System
For typed-answer questions (fill-in-blank, writing), evaluation follows this fallback chain:
1. **Empty check** - Reject < 2 chars
2. **Exact match** - Normalized comparison (accents stripped, lowercase)
3. **Fuzzy logic** - Levenshtein distance with difficulty-based thresholds
4. **Semantic API** - Opus 4.5 fallback for low-confidence cases

See `src/app/api/evaluate-writing/route.ts` for implementation.

### Unified TypedAnswerQuestion Component
`src/components/WritingQuestion/` contains unified components for both fill-in-blank and writing questions:
- `TypedAnswerQuestion` (index.tsx) - Main component, auto-selects variant
- `AnswerInput` - Supports `variant: 'single-line' | 'multi-line'`
- `EvaluationResultDisplay` - Shows results, corrections, superuser metadata
- `QuestionDisplay` - Header with difficulty, topic, type badges
- `QuestionHints` - Progressive hints for superusers

### Quiz Modes
Two quiz modes in `src/lib/quiz-modes.ts`:
- `practice` - Mixed question types (35% MCQ, 15% T/F, 20% fill-in-blank, 30% writing)
- `assessment` - Typed answers only (50/50 fill-in-blank and writing)

### Data Types
- `Question` (src/types) - Unified quiz question format
- `WritingQuestion` (src/lib/writing-questions.ts) - Database format with snake_case fields
- Use `toQuestion()` helper when converting DB format to component format

## Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run generate-questions  # Generate questions via AI
```

## Dev Server
When starting the dev server, redirect output to a log file:
```bash
pkill -f "next dev" 2>/dev/null; npm run dev > /tmp/nextjs-dev.log 2>&1 &
```
View logs with: `tail -f /tmp/nextjs-dev.log`

## Important Directories
```
src/
├── app/              # Next.js pages and API routes
│   ├── api/          # API endpoints
│   │   ├── evaluate-writing/   # Tiered evaluation
│   │   └── generate-questions/ # Question generation
│   └── quiz/[unitId]/          # Main quiz page
├── components/
│   └── WritingQuestion/        # Typed answer components
├── lib/              # Utilities
│   ├── question-loader.ts      # Question loading + meta-filtering
│   ├── quiz-modes.ts           # Quiz mode definitions (practice/assessment)
│   ├── superuser-override.ts   # Superuser toggle utilities
│   └── writing-questions.ts    # Evaluation helpers
├── hooks/            # Custom React hooks
└── types/            # TypeScript definitions
```

## Conventions
- Use `Question` type for components, convert from `WritingQuestion` when needed
- Superuser metadata display uses purple color scheme
- All question types should track `evaluationResults` for consistent scoring
- Meta-questions (learning philosophy, teacher info) are filtered at runtime

## Things to Avoid
- Don't add inline evaluation code - use TypedAnswerQuestion component
- Don't create separate handling for fill-in-blank vs writing - they share components
- Don't commit `.claude/settings.local.json` or backup files
- Don't generate meta-questions about learning strategies or teacher info

## Testing Considerations
- Superuser mode shows evaluation metadata (tier used, similarity scores)
- Test both question types use the same Submit button UI
- Verify tiered evaluation fallback works (exact → fuzzy → API)

## PROGRESS.md Maintenance

This project uses PROGRESS.md to track session work and enable recovery from lost context.

### Concrete Update Triggers
Update PROGRESS.md immediately after ANY of these events:
- **Completing code changes that touch 2+ files**
- **Finishing a feature, fix, or discrete piece of work**
- **Before switching to a different area of the codebase**
- **Before responding to an unrelated question**
- **Before commits** (and clear "Uncommitted Changes" after commit succeeds)

### TodoWrite Convention
When using TodoWrite for multi-step tasks, ALWAYS include as the final todo:
```
{ content: "Update PROGRESS.md", status: "pending", activeForm: "Updating PROGRESS.md" }
```
This creates a structural checkpoint that triggers documentation.

### What to Update
- **Last Session Summary** - What was done (be specific about files and changes)
- **Uncommitted Changes** - Current working state
- **Pending Items** - What's left to do
- **Next Steps** - Recommendations for future sessions
