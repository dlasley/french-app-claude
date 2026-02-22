/**
 * Controller script for the content regeneration pipeline
 *
 * Orchestrates:
 * 1. PDF → Markdown conversion (convert-pdfs.ts logic)
 * 2. Topic extraction & validation (corpus-suggest-topics.ts logic)
 * 3. Question generation (corpus-generate-questions.ts)
 * 4. Quality audit (audit-mistral.ts / audit-sonnet.ts)
 * 5. Learning resource extraction (corpus-extract-resources.ts)
 *
 * Usage:
 *   npx tsx scripts/corpus-generate.ts <unit-id> [options]
 *   npx tsx scripts/corpus-generate.ts --all [options]
 *
 * Options:
 *   --review-topics Enable interactive topic review (for expert users)
 *   --skip-convert  Skip PDF conversion (use existing markdown)
 *   --skip-topics   Skip topic extraction (use existing topics from DB)
 *   --write-db      Sync generated questions to Supabase
 *   --audit         Run quality audit after generation (requires --write-db)
 *   --auditor <m>   Audit model: 'mistral' (default) or 'sonnet'
 *   --dry-run       Show what would be done without executing
 *
 * Examples:
 *   npx tsx scripts/corpus-generate.ts unit-4
 *   npx tsx scripts/corpus-generate.ts unit-4 --write-db
 *   npx tsx scripts/corpus-generate.ts unit-4 --write-db --audit
 *   npx tsx scripts/corpus-generate.ts unit-4 --skip-convert
 *   npx tsx scripts/corpus-generate.ts --all --write-db
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import type { Unit } from '../src/types';
import { createScriptSupabase } from './lib/db-queries';
import { fetchUnitsFromDb } from '../src/lib/units-db';
import { LEARNINGS_DIR, PDF_DIR } from './lib/unit-discovery';
import {
  stepConvertPdf,
  stepExtractTopics,
  stepAutoUpdateFiles,
  stepGenerateQuestions,
  stepAuditQuestions,
  stepExtractResources,
  StepOptions,
} from './lib/pipeline-steps';
import { runScript } from './lib/script-runner';

// Initialize Anthropic client for PDF conversion
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface PipelineOptions extends StepOptions {
  unitId: string | '--all';
  audit: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const hasWriteDb = args.includes('--write-db');

  // Parse --auditor flag (default: mistral)
  const auditorIdx = args.indexOf('--auditor');
  const auditorValue = auditorIdx >= 0 ? args[auditorIdx + 1] : 'mistral';
  if (!['mistral', 'sonnet'].includes(auditorValue)) {
    console.error(`❌ Invalid --auditor value: ${auditorValue}. Must be 'mistral' or 'sonnet'.`);
    process.exit(1);
  }

  // Parse --batch-id flag
  const batchIdIdx = args.indexOf('--batch-id');
  const batchIdValue = batchIdIdx >= 0 ? args[batchIdIdx + 1] : undefined;

  // Parse --markdown-file flag
  const mdFileIdx = args.indexOf('--markdown-file');
  const mdFileValue = mdFileIdx >= 0 ? args[mdFileIdx + 1] : undefined;

  // Support both positional (first non-flag arg) and --unit flag
  const unitFlagIdx = args.indexOf('--unit');
  const unitId = unitFlagIdx >= 0 ? args[unitFlagIdx + 1] : args[0];

  const options: PipelineOptions = {
    unitId: unitId,
    reviewTopics: args.includes('--review-topics'),
    skipConvert: args.includes('--skip-convert'),
    forceConvert: args.includes('--force-convert'),
    skipTopics: args.includes('--skip-topics'),
    writeDb: hasWriteDb,
    audit: args.includes('--audit'),
    auditor: auditorValue as 'mistral' | 'sonnet',
    skipResources: args.includes('--skip-resources'),
    dryRun: args.includes('--dry-run'),
    convertOnly: args.includes('--convert-only'),
    batchId: batchIdValue,
    markdownFile: mdFileValue,
  };

  // Validate --audit requires --write-db
  if (options.audit && !options.writeDb) {
    console.error('❌ --audit requires --write-db (questions must be in DB to audit)');
    process.exit(1);
  }

  return options;
}

function printUsage(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              CONTENT REGENERATION PIPELINE                     ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  npx tsx scripts/corpus-generate.ts <unit-id> [options]
  npx tsx scripts/corpus-generate.ts --all [options]

Options:
  --review-topics Interactive topic review (for domain experts only)
  --skip-convert  Skip PDF conversion (use existing markdown)
  --force-convert Force PDF reconversion even if markdown exists
  --skip-topics   Skip topic extraction (use existing topics from DB)
  --write-db      Sync generated questions to database
  --audit         Run quality audit after generation (requires --write-db)
  --auditor <m>   Audit model: 'mistral' (default) or 'sonnet'
  --skip-resources Skip learning resource extraction
  --dry-run       Show what would be done without executing
  --convert-only  Stop after PDF conversion (skip topics, generation, audit)
  --batch-id <id>         Custom batch ID for experiment tracking
  --markdown-file <path>  Use specified markdown file (bypasses PDF conversion)

Examples:
  npx tsx scripts/corpus-generate.ts unit-4                    # Full pipeline for unit-4
  npx tsx scripts/corpus-generate.ts unit-4 --write-db         # Generate and sync to DB
  npx tsx scripts/corpus-generate.ts unit-4 --write-db --audit # Generate, sync, and audit
  npx tsx scripts/corpus-generate.ts unit-4 --skip-convert --write-db
  npx tsx scripts/corpus-generate.ts --all --write-db          # Regenerate all units

Pipeline Steps:
  1. PDF → Markdown    Convert PDF to structured markdown
  2. Topic Extraction  Extract and validate topics against DB
  3. Question Gen      Generate questions for each topic/difficulty
  4. Quality Audit     (optional, --audit) Promote pending → active/flagged
  5. Resource Extract  Extract learning resources from markdown to DB
  `);
}

/**
 * Run the pipeline for a single unit
 */
async function runPipelineForUnit(
  unitId: string,
  options: PipelineOptions,
  units: Unit[]
): Promise<void> {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  PROCESSING: ${unitId.toUpperCase()}`);
  console.log(`${'═'.repeat(65)}`);

  // Step 1: Convert PDF
  const step1 = await stepConvertPdf(unitId, options, anthropic);
  if (!step1.success || !step1.markdownPath) {
    console.log('\n  ❌ Pipeline stopped: No markdown available');
    return;
  }

  // --convert-only: stop after PDF conversion
  if (options.convertOnly) {
    console.log('\n  ✅ Conversion complete (--convert-only)');
    return;
  }

  // Step 2: Extract topics
  const step2 = await stepExtractTopics(unitId, step1.markdownPath, options, units);
  if (!step2.success) {
    console.log('\n  ❌ Pipeline stopped at topic extraction');
    return;
  }

  // Step 2.5: Auto-update DB (only for new units)
  let topics = step2.topics || [];
  const existingUnit = units.find(u => u.id === unitId);
  if (!existingUnit) {
    const step2_5 = await stepAutoUpdateFiles(unitId, options, units);
    if (!step2_5.success) {
      console.log('\n  ❌ Pipeline stopped at source file update');
      return;
    }
    topics = step2_5.topics || topics;
  }

  // Step 3: Generate questions
  const step3 = await stepGenerateQuestions(unitId, topics, options);
  if (!step3.success) {
    console.log('\n  ❌ Question generation failed');
    return;
  }

  // Step 4: Quality audit (optional)
  if (options.audit) {
    const step4 = await stepAuditQuestions(unitId, options);
    if (!step4.success) {
      console.log('\n  ⚠️  Quality audit failed (questions remain as pending)');
    }
  }

  // Step 5: Learning resource extraction (default, skip with --skip-resources)
  if (!options.skipResources && options.writeDb) {
    await stepExtractResources(unitId, options);
  }

  console.log('\n  ✅ Pipeline complete for', unitId);
}

/**
 * Discover unit IDs from local files when the units table is empty.
 * Checks markdown files in learnings/ first, falls back to PDF filenames.
 */
function discoverUnitsFromFiles(): string[] {
  const ids = new Set<string>();

  // Try markdowns first
  if (fs.existsSync(LEARNINGS_DIR)) {
    const mdFiles = fs.readdirSync(LEARNINGS_DIR)
      .filter(f => f.endsWith('.md') && !f.includes('.cohort-'));
    for (const file of mdFiles) {
      if (/introduction/i.test(file)) { ids.add('introduction'); continue; }
      const unitMatch = file.match(/unit[_\s-]?(\d+)/i);
      if (unitMatch) ids.add(`unit-${unitMatch[1]}`);
    }
  }

  // Fall back to PDF filenames if no markdowns found
  if (ids.size === 0 && fs.existsSync(PDF_DIR)) {
    const pdfFiles = fs.readdirSync(PDF_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    for (const file of pdfFiles) {
      if (/introduction/i.test(file)) { ids.add('introduction'); continue; }
      const unitMatch = file.match(/unit[_\s-]?(\d+)/i);
      if (unitMatch) ids.add(`unit-${unitMatch[1]}`);
    }
  }

  return [...ids].sort((a, b) => {
    if (a === 'introduction') return -1;
    if (b === 'introduction') return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();
  const supabase = createScriptSupabase();
  const units = await fetchUnitsFromDb(supabase);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              CONTENT REGENERATION PIPELINE                     ║
╚════════════════════════════════════════════════════════════════╝
`);

  console.log('Configuration:');
  console.log(`  Unit(s):       ${options.unitId}`);
  console.log(`  Review topics: ${options.reviewTopics ? 'Yes (interactive)' : 'No (auto)'}`);
  console.log(`  Skip convert:  ${options.skipConvert ? 'Yes' : 'No'}`);
  console.log(`  Force convert: ${options.forceConvert ? 'Yes' : 'No'}`);
  console.log(`  Skip topics:   ${options.skipTopics ? 'Yes' : 'No'}`);
  console.log(`  Write to DB:   ${options.writeDb ? 'Yes' : 'No'}`);
  console.log(`  Audit:         ${options.audit ? `Yes — ${options.auditor === 'mistral' ? 'Mistral Large' : 'Sonnet'} (pending → active/flagged)` : 'No'}`);
  console.log(`  Resources:     ${options.skipResources ? 'Skip' : 'Yes (extract from markdown)'}`);
  console.log(`  Dry run:       ${options.dryRun ? 'Yes' : 'No'}`);
  if (options.convertOnly) {
    console.log(`  Convert only:  Yes (stop after PDF conversion)`);
  }
  if (options.batchId) {
    console.log(`  Batch ID:      ${options.batchId}`);
  }
  if (options.markdownFile) {
    console.log(`  Markdown file: ${options.markdownFile}`);
  }

  if (options.unitId === '--all') {
    // Discover unit IDs: prefer DB, fall back to local files
    let unitIds = units.map(u => u.id);
    if (unitIds.length === 0) {
      unitIds = discoverUnitsFromFiles();
      if (unitIds.length === 0) {
        console.error('\n❌ No units in database and no files found in learnings/ or PDF/');
        process.exit(1);
      }
      console.log(`  No units in DB — discovered ${unitIds.length} from files: ${unitIds.join(', ')}`);
    }

    for (const id of unitIds) {
      await runPipelineForUnit(id, options, units);
    }

    // Post-processing: cross-unit topic consolidation
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  POST: Cross-Unit Topic Consolidation                      │');
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    const consolidationResult = runScript('scripts/corpus-suggest-topics.ts', ['--consolidate'], options.dryRun);
    if (consolidationResult.output) {
      console.log(consolidationResult.output);
    }
  } else {
    // Validate unit exists in DB or has matching files on disk
    const existingUnit = units.find(u => u.id === options.unitId);
    if (!existingUnit && !discoverUnitsFromFiles().includes(options.unitId)) {
      console.error(`\n❌ Unknown unit ID: ${options.unitId}`);
      console.log('   No matching files in learnings/ or PDF/');
      console.log('   Discovered units:', discoverUnitsFromFiles().join(', ') || '(none)');
      process.exit(1);
    }

    await runPipelineForUnit(options.unitId, options, units);
  }

  console.log(`\n${'═'.repeat(65)}`);
  console.log('  PIPELINE COMPLETE');
  console.log(`${'═'.repeat(65)}\n`);
}

// Run
main().catch(console.error);
