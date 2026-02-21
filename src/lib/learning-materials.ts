import fs from 'fs';
import path from 'path';

/** Minimal shape needed from units — avoids coupling to full Unit type. */
interface UnitWithTopics {
  topics: Array<{ name: string; headings: string[] }>;
}

/**
 * Look up heading patterns for a topic from the provided units data.
 */
function getTopicHeadings(topic: string, units: UnitWithTopics[]): string[] {
  for (const unit of units) {
    const found = unit.topics.find(t => t.name === topic);
    if (found) return found.headings;
  }
  return [];
}

/**
 * Derive the markdown filename for a unit ID.
 * Follows the naming convention used by corpus-generate.ts / lib/unit-discovery.ts.
 */
function getMarkdownFilename(unitId: string): string {
  const label = unitId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `French 1 ${label}.md`;
}

/**
 * Load learning materials for a specific unit
 */
export function loadUnitMaterials(unitId: string): string {
  try {
    const fileName = getMarkdownFilename(unitId);
    const filePath = path.join(process.cwd(), 'learnings', fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error loading materials for unit ${unitId}:`, error);
    throw new Error(`Failed to load learning materials for unit: ${unitId}`);
  }
}

/**
 * Extract relevant content for a specific topic from the unit materials
 */
export function extractTopicContent(materials: string, topic: string, units: UnitWithTopics[]): string {
  // Split content into sections
  const lines = materials.split('\n');
  const relevantLines: string[] = [];
  let isRelevant = false;
  let sectionDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      // Check if this heading is relevant to the topic
      if (headingText.toLowerCase().includes(topic.toLowerCase()) ||
          topic.toLowerCase().includes(headingText.toLowerCase())) {
        isRelevant = true;
        sectionDepth = level;
        relevantLines.push(line);
      } else if (isRelevant && level <= sectionDepth) {
        // We've reached a new section at the same or higher level
        break;
      } else if (isRelevant) {
        relevantLines.push(line);
      }
    } else if (isRelevant) {
      relevantLines.push(line);
    }
  }

  // If we found specific content, return it
  if (relevantLines.length > 10) {
    return relevantLines.join('\n');
  }

  // Fallback: try heading patterns from centralized topic-headings mapping
  const aliases = getTopicHeadings(topic, units);

  // Collect ALL matching sections via alias (multi-section extraction)
  const collectedSections: string[] = [];
  const matchedHeadingIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      if (headingMatch[1].length === 1) continue; // Skip document-level headings
      const headingText = headingMatch[2].toLowerCase();
      const hasAlias = aliases.some(alias => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![a-zA-ZÀ-ÿ])${escaped}(?![a-zA-ZÀ-ÿ])`, 'i');
        return regex.test(headingText);
      });

      if (hasAlias && !matchedHeadingIndices.has(i)) {
        matchedHeadingIndices.add(i);
        const level = headingMatch[1].length;
        const sectionLines: string[] = [line];

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const nextHeading = nextLine.match(/^(#{1,6})\s+/);
          if (nextHeading && nextHeading[1].length <= level) {
            break;
          }
          sectionLines.push(nextLine);
        }

        if (sectionLines.length > 10) {
          collectedSections.push(sectionLines.join('\n'));
        }
      }
    }
  }

  if (collectedSections.length > 0) {
    const count = collectedSections.length;
    console.log(`    ℹ️  Found topic "${topic}" via alias match (${count} section${count > 1 ? 's' : ''})`);
    return collectedSections.join('\n\n---\n\n');
  }

  // No match found - log warning and return empty to trigger skip
  console.warn(`    ⚠️  No content found for topic "${topic}" - questions may be off-topic`);

  // Return a minimal prompt that instructs Claude to work from general knowledge
  return `Topic: ${topic}\n\nNote: No specific learning materials found for this topic. Generate questions based on standard French 1 curriculum content for this topic.`;
}
