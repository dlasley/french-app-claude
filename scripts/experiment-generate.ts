/**
 * Experiment pipeline orchestrator
 *
 * Replaces run-experiment.sh with a TypeScript implementation.
 * Uses shared pipeline steps from lib/pipeline-steps.ts.
 *
 * Workflow (8 steps):
 * 1. Save current markdown as Cohort B source
 * 2. Reconvert PDF with updated prompt
 * 3. Save new markdown as Cohort C source
 * 4. Restore original markdown
 * 5. Create experiment + snapshot control
 * 6. Generate + audit Cohort B
 * 7. Generate + audit Cohort C
 * 8. Compare experiment cohorts
 *
 * Usage:
 *   npx tsx scripts/experiment-generate.ts --unit unit-2
 *   npx tsx scripts/experiment-generate.ts --unit unit-2 --auditor sonnet --dry-run
 *
 * Monitor with: tail -f /tmp/experiment-run.log
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import {
  stepConvertPdf,
  stepGenerateQuestions,
  stepAuditQuestions,
  stepExtractTopics,
  StepOptions,
} from './lib/pipeline-steps';
import { runScriptAsync } from './lib/script-runner';
import { findMarkdownForUnit } from './lib/unit-discovery';

// Initialize Anthropic client for PDF conversion
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ExperimentOptions {
  unit: string;
  name?: string;
  researchQuestion: string;
  hypothesis: string;
  variable: string;
  metric: string;
  auditor: 'mistral' | 'sonnet';
  dryRun: boolean;
  // Model overrides
  generationModelStructured?: string;
  generationModelTyped?: string;
  validationModel?: string;
  auditModel?: string;
}

function parseArgs(): ExperimentOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  }

  const unit = getArg('--unit');
  if (!unit) {
    console.error('❌ --unit is required');
    process.exit(1);
  }

  const auditorValue = getArg('--auditor') || 'mistral';
  if (!['mistral', 'sonnet'].includes(auditorValue)) {
    console.error(`❌ Invalid --auditor value: ${auditorValue}. Must be 'mistral' or 'sonnet'.`);
    process.exit(1);
  }

  return {
    unit,
    name: getArg('--name'),
    researchQuestion: getArg('--research-question') || 'Does reconverted markdown improve question quality?',
    hypothesis: getArg('--hypothesis') || 'Reconverted markdown will improve gate pass rate by 5+pp',
    variable: getArg('--variable') || 'source_material',
    metric: getArg('--metric') || 'gate_pass_rate',
    auditor: auditorValue as 'mistral' | 'sonnet',
    dryRun: args.includes('--dry-run'),
    generationModelStructured: getArg('--generation-model-structured'),
    generationModelTyped: getArg('--generation-model-typed'),
    validationModel: getArg('--validation-model'),
    auditModel: getArg('--audit-model'),
  };
}

function printUsage(): void {
  console.log(`
Experiment Pipeline Orchestrator

Usage:
  npx tsx scripts/experiment-generate.ts --unit <unit-id> [options]

Options:
  --unit <id>                          Target unit (required)
  --name <name>                        Experiment name (auto-generated if omitted)
  --research-question <text>           Research question
  --hypothesis <text>                  Falsifiable prediction
  --variable <text>                    Independent variable (default: source_material)
  --metric <text>                      Primary metric (default: gate_pass_rate)
  --auditor <model>                    Audit model: 'mistral' (default) or 'sonnet'
  --generation-model-structured <m>    Override structured question generation model
  --generation-model-typed <m>         Override typed question generation model
  --validation-model <m>               Override answer validation model
  --audit-model <m>                    Override audit model
  --dry-run                            Show what would be done without executing
  --help, -h                           Show this help

Examples:
  npx tsx scripts/experiment-generate.ts --unit unit-2
  npx tsx scripts/experiment-generate.ts --unit unit-2 --auditor sonnet --dry-run
  `);
}

async function main() {
  const options = parseArgs();
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '_').slice(0, 15);

  // Resolve markdown path
  const markdownPath = findMarkdownForUnit(options.unit);
  if (!markdownPath) {
    console.error(`❌ No markdown found for ${options.unit}`);
    process.exit(1);
  }

  const cohortBPath = markdownPath.replace(/\.md$/, '.cohort-b.md');
  const cohortCPath = markdownPath.replace(/\.md$/, '.cohort-c.md');

  console.log('============================================================');
  console.log('  PIPELINE QUALITY EXPERIMENT');
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log(`  Unit: ${options.unit}`);
  console.log(`  Markdown: ${markdownPath}`);
  console.log(`  Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log('============================================================');
  console.log('');

  // ── Step 1/8: Save current markdown as Cohort B source ──
  console.log('=== Step 1/8: Save current markdown as Cohort B source ===');
  if (options.dryRun) {
    console.log(`  [DRY RUN] Would copy ${markdownPath} → ${cohortBPath}`);
  } else {
    fs.copyFileSync(markdownPath, cohortBPath);
    console.log(`  Saved: ${cohortBPath}`);
  }
  console.log('');

  // ── Step 2/8: Reconvert PDF with updated prompt ──
  console.log('=== Step 2/8: Reconvert PDF with updated prompt ===');
  const convertOptions: StepOptions = {
    dryRun: options.dryRun,
    writeDb: false,
    forceConvert: true,
    auditor: options.auditor,
  };
  const convertResult = await stepConvertPdf(options.unit, convertOptions, anthropic);
  if (!convertResult.success) {
    console.error('  ❌ PDF conversion failed');
    process.exit(1);
  }
  console.log('');

  // ── Step 3/8: Save new markdown as Cohort C source ──
  console.log('=== Step 3/8: Save new markdown as Cohort C source ===');
  if (options.dryRun) {
    console.log(`  [DRY RUN] Would copy ${markdownPath} → ${cohortCPath}`);
  } else {
    fs.copyFileSync(markdownPath, cohortCPath);
    console.log(`  Saved: ${cohortCPath}`);
  }
  console.log('');

  // ── Step 4/8: Restore original markdown ──
  console.log('=== Step 4/8: Restore original markdown ===');
  if (options.dryRun) {
    console.log(`  [DRY RUN] Would restore ${cohortBPath} → ${markdownPath}`);
  } else {
    fs.copyFileSync(cohortBPath, markdownPath);
    console.log(`  Restored: ${markdownPath}`);
  }
  console.log('');

  // ── Step 5/8: Create experiment + snapshot control ──
  console.log('=== Step 5/8: Create experiment + snapshot control ===');
  const experimentName = options.name || `Pipeline quality experiment ${timestamp}`;
  let experimentId = 'dry-run-id';

  if (options.dryRun) {
    console.log(`  [DRY RUN] Would create experiment: "${experimentName}"`);
  } else {
    // Capture UUID from stdout via --output-id
    const { execSync } = await import('child_process');
    const createArgs = [
      '--unit', options.unit,
      '--name', experimentName,
      '--research-question', options.researchQuestion,
      '--hypothesis', options.hypothesis,
      '--variable', options.variable,
      '--metric', options.metric,
      '--output-id',
    ];
    const cmd = `npx tsx scripts/experiment-create.ts ${createArgs.map(a => `"${a}"`).join(' ')}`;
    experimentId = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log(`  Experiment ID: ${experimentId}`);
  }
  console.log('');

  // Resolve topics for generation
  const topicOptions: StepOptions = {
    dryRun: options.dryRun,
    writeDb: false,
    skipTopics: true,
    auditor: options.auditor,
  };
  const topicResult = await stepExtractTopics(options.unit, markdownPath, topicOptions);
  const topics = topicResult.topics || [];

  // ── Step 6/8: Generate + audit Cohort B ──
  console.log('=== Step 6/8: Generate + audit Cohort B ===');
  console.log('  Writing directly to experiment_questions...');
  const cohortBBatchId = `cohort-b-${timestamp}`;
  const cohortBOptions: StepOptions = {
    dryRun: options.dryRun,
    writeDb: true,
    batchId: cohortBBatchId,
    markdownFile: cohortBPath,
    auditor: options.auditor,
    experimentId,
    cohort: 'B',
    generationModelStructured: options.generationModelStructured,
    generationModelTyped: options.generationModelTyped,
    validationModel: options.validationModel,
    auditModel: options.auditModel,
  };
  await stepGenerateQuestions(options.unit, topics, cohortBOptions);
  await stepAuditQuestions(options.unit, cohortBOptions);
  console.log('');

  // ── Step 7/8: Generate + audit Cohort C ──
  console.log('=== Step 7/8: Generate + audit Cohort C ===');
  console.log('  Writing directly to experiment_questions...');
  const cohortCBatchId = `cohort-c-${timestamp}`;
  const cohortCOptions: StepOptions = {
    dryRun: options.dryRun,
    writeDb: true,
    batchId: cohortCBatchId,
    markdownFile: cohortCPath,
    auditor: options.auditor,
    experimentId,
    cohort: 'C',
    generationModelStructured: options.generationModelStructured,
    generationModelTyped: options.generationModelTyped,
    validationModel: options.validationModel,
    auditModel: options.auditModel,
  };
  await stepGenerateQuestions(options.unit, topics, cohortCOptions);
  await stepAuditQuestions(options.unit, cohortCOptions);
  console.log('');

  // ── Step 8/8: Compare experiment cohorts ──
  console.log('=== Step 8/8: Compare experiment cohorts ===');
  const exportPath = `data/experiment-${timestamp}.json`;
  const reportPath = `docs/experiment-report-${timestamp}.md`;

  if (options.dryRun) {
    console.log(`  [DRY RUN] Would compare cohorts for experiment ${experimentId}`);
    console.log(`  [DRY RUN] Would export to ${exportPath}`);
    console.log(`  [DRY RUN] Would write report to ${reportPath}`);
  } else {
    await runScriptAsync('scripts/experiment-compare.ts', [
      '--experiment-id', experimentId,
      '--output', exportPath,
      '--report', reportPath,
    ]);
  }
  console.log('');

  console.log('============================================================');
  console.log('  EXPERIMENT COMPLETE');
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log(`  Experiment ID: ${experimentId}`);
  console.log(`  Report: ${reportPath}`);
  console.log(`  Data: ${exportPath}`);
  console.log('============================================================');
}

main().catch(console.error);
