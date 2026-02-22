/**
 * Unit file resolution utilities.
 *
 * Extracted from corpus-generate.ts — handles finding PDFs and markdown
 * files for a given unit ID.
 */

import fs from 'fs';
import path from 'path';
import { extractPdfText } from './pdf-conversion';

// Directory paths
const PDF_DIR = path.join(process.cwd(), 'PDF');
const LEARNINGS_DIR = path.join(process.cwd(), 'learnings');

export { PDF_DIR, LEARNINGS_DIR };

/** Derive the canonical label from a unit ID (e.g. "unit-2" → "Unit 2", "introduction" → "Introduction") */
export function getUnitLabel(unitId: string): string {
  return unitId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Derive the canonical filename for a unit (e.g. "French 1 Unit 2.pdf", "French 1 Introduction.md") */
export function getCanonicalFilename(unitId: string, ext: '.md' | '.pdf'): string {
  return `French 1 ${getUnitLabel(unitId)}${ext}`;
}

/**
 * Build a regex pattern that matches filenames for a given unit ID.
 * For unit-N IDs, requires the number to be followed by a non-digit (or end of string)
 * to avoid "unit 2" matching "unit 20".
 */
function buildUnitFilePattern(unitId: string): RegExp {
  const label = getUnitLabel(unitId);
  // Extract trailing number if present (e.g. "Unit 2" → "2")
  const trailingNum = label.match(/\d+$/);
  if (trailingNum) {
    // Boundary-safe: require non-digit after the number
    const escaped = label.replace(/\d+$/, '');
    return new RegExp(`${escaped.trim()}[\\s_-]?${trailingNum[0]}(?:\\D|$)`, 'i');
  }
  // No trailing number (e.g. "Introduction") — simple substring match
  return new RegExp(label, 'i');
}

/**
 * Find all PDF files for a unit
 * Returns all PDFs matching the unit pattern (canonical first, then others)
 */
export function findPdfsForUnit(unitId: string): string[] {
  const matches: string[] = [];

  if (!fs.existsSync(PDF_DIR)) {
    return matches;
  }

  const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  const pattern = buildUnitFilePattern(unitId);
  const canonical = getCanonicalFilename(unitId, '.pdf');

  for (const file of files) {
    if (pattern.test(file)) {
      matches.push(path.join(PDF_DIR, file));
    }
  }

  // Sort with canonical first, then alphabetically
  matches.sort((a, b) => {
    const aIsCanonical = path.basename(a).toLowerCase() === canonical.toLowerCase();
    const bIsCanonical = path.basename(b).toLowerCase() === canonical.toLowerCase();
    if (aIsCanonical && !bIsCanonical) return -1;
    if (!aIsCanonical && bIsCanonical) return 1;
    return a.localeCompare(b);
  });

  return matches;
}

/**
 * Find markdown file for a unit
 * Searches for files containing "unit X" or "unit-X" (case-insensitive)
 * Throws on ambiguous matches, returns null if nothing found
 */
export function findMarkdownForUnit(unitId: string): string | null {
  const canonical = getCanonicalFilename(unitId, '.md');

  // Priority 1: Check explicit paths first (no ambiguity possible)
  const explicitPaths = [
    path.join(LEARNINGS_DIR, canonical),
    path.join(LEARNINGS_DIR, `${unitId}.md`),
    path.join(LEARNINGS_DIR, 'test-conversions', `${unitId}-test.md`),
  ];

  for (const p of explicitPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Priority 2: Search by pattern
  const pattern = buildUnitFilePattern(unitId);
  const searchDirs = [LEARNINGS_DIR, path.join(LEARNINGS_DIR, 'test-conversions')];
  const matches: string[] = [];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      if (pattern.test(file)) {
        matches.push(path.join(dir, file));
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    console.log(`  📄 Found markdown via pattern match: ${matches[0]}`);
    return matches[0];
  }

  // Multiple matches - ambiguous, report error
  console.error(`  ❌ Ambiguous: found ${matches.length} markdown files matching "${unitId}":`);
  for (const m of matches) {
    console.error(`     - ${m}`);
  }
  console.error(`  💡 Rename files or use explicit path with corpus-suggest-topics.ts directly`);
  throw new Error(`Ambiguous markdown files for ${unitId}`);
}

/**
 * Combine text from multiple PDF files
 */
export function combinePdfTexts(pdfPaths: string[]): string {
  return pdfPaths
    .map(p => extractPdfText(p))
    .join('\n\n');
}
