/**
 * One-time seed script: populates the units table from static data.
 * Idempotent via upsert — safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/db-seed-units.ts
 *   npx tsx scripts/db-seed-units.ts --dry-run
 *   npx tsx scripts/db-seed-units.ts --help
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createScriptSupabase } from './lib/db-queries';

const UNITS = [
  {
    id: 'introduction',
    title: '🇫🇷 Introduction',
    label: 'Basics & Greetings',
    description: 'Basic greetings, numbers, alphabet, and classroom vocabulary',
    topics: [
      { name: 'Greetings & Conversation', headings: ['salutations', 'greetings', 'basic expressions', 'conversations', 'introduction of', 'monsieur ou madame'] },
      { name: 'French Alphabet & Pronunciation', headings: ['alphabet', 'accents', 'prononciation'] },
      { name: 'Numbers 0-20', headings: ['nombres', 'numbers'] },
      { name: 'Classroom & School Supplies', headings: ['fournitures', 'supplies', 'règles', 'salle de classe'] },
      { name: 'French Culture & Geography', headings: ['culture française', 'french in africa', 'géographie'] },
    ],
  },
  {
    id: 'unit-2',
    title: '🇫🇷 Unit 2',
    label: 'Activities & -ER Verbs',
    description: 'Activities, food, verb conjugation, and preferences',
    topics: [
      { name: 'Sports & Activities Vocabulary', headings: ['jeux olympiques', 'olympic', 'qu\'est-ce que tu aimes faire'] },
      { name: 'Expressing Likes & Dislikes', headings: ['aimer', 'préférer', 'adorer', 'adverbes', 'un peu', 'beaucoup', 'pour la conversation'] },
      { name: 'Food Vocabulary', headings: ['tu manges', 'nourriture', 'food', 'aliments'] },
      { name: 'Days of the Week', headings: ['jours de la semaine', 'les jours', 'days'] },
      { name: 'Subject Pronouns & Tu vs. Vous', headings: ['subject pronouns', 'pronoms', 'tu versus vous', 'tu vs. vous', 'tutoiement'] },
      { name: '-ER Verb Conjugation', headings: ['conjugaison', 'conjugation', '-er verbs', 'present tense of -er', 'conjugate the verbs'] },
      { name: 'Articles & Noun Gender', headings: ['genre des noms', 'gender', 'masculin', 'féminin', 'articles définis', 'le, la, les'] },
      { name: 'Negation (ne...pas)', headings: ['négation', 'negation', 'ne...pas', 'negate the sentences'] },
      { name: 'Nationalities', headings: ['nationalités', 'nationalities', 'citoyens'] },
      { name: 'Classroom Expressions', headings: ['classroom expressions'] },
    ],
  },
  {
    id: 'unit-3',
    title: '🇫🇷 Unit 3',
    label: 'Être, Avoir & Numbers',
    description: 'Classroom objects, numbers, prepositions, and key verbs',
    topics: [
      { name: 'Classroom & School Vocabulary', headings: ['salle de classe', 'objets', 'qu\'est-ce c\'est', 'besoin de', 'matières scolaires', 'articles indéfinis', 'un, une, des'] },
      { name: 'Numbers 20-100 & Telling Time', headings: ['nombres de 20', 'numbers 20', 'l\'heure', 'quelle heure', 'telling time'] },
      { name: 'Prepositions (sous, sur, derrière)', headings: ['prépositions de lieu', 'prepositions', 'sous', 'sur', 'derrière'] },
      { name: 'Face & Body Parts', headings: ['visage', 'corps', 'body', 'face', 'parties du corps'] },
      { name: 'Être & Avoir', headings: ['avoir', 'être', 'etre', 'to have', 'to be', 'negation'] },
      { name: 'Question Formation (est-ce que, qui/quand/où)', headings: ['est-ce que', 'combining sentences', 'où, quand et qui'] },
      { name: 'Location Vocabulary', headings: ['endroits', 'les endroits', 'vocabulaire actif (135)'] },
      { name: 'Christmas Vocabulary', headings: ['noël', 'noel', 'christmas', 'vocabulaire de noël'] },
    ],
  },
  {
    id: 'unit-4',
    title: '🇫🇷 Unit 4',
    label: 'Aller, Futur Proche & Café',
    description: 'Verbs aller/prendre/voir, futur proche, café ordering, animals, colors, and numbers to 1000',
    topics: [
      { name: 'Animals Vocabulary', headings: ['animaux', 'les animaux'] },
      { name: 'Colors & Adjective Agreement', headings: ['couleurs', 'colors', 'agreement & colors'] },
      { name: 'Café & Ordering', headings: ['café', 'vocabulaire du café', 'prendre', 'avec la nourriture'] },
      { name: 'Cinema & Voir', headings: ['voir', 'cinéma', 'quel'] },
      { name: 'Sports & Football Vocabulary', headings: ['football', 'le football'] },
      { name: 'Aller & Futur Proche', headings: ['aller', 'futur proche', 'near future'] },
      { name: 'Avoir Expressions (faim, soif)', headings: ['faim', 'soif', 'j\'ai faim'] },
      { name: 'Numbers 60-1000', headings: ['nombres de 60', 'nombres à 1000', '60 à 100'] },
      { name: 'French Culture & History', headings: ['rencontres culturelles', 'culturelles', 'points de départ'] },
    ],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Seed Units Table

Usage: npx tsx scripts/db-seed-units.ts [options]

Options:
  --dry-run    Show what would be inserted without writing
  --help, -h   Show this help
`);
    process.exit(0);
  }

  const supabase = createScriptSupabase({ write: !dryRun });

  console.log(`Seeding ${UNITS.length} units${dryRun ? ' (dry run)' : ''}...\n`);

  for (let i = 0; i < UNITS.length; i++) {
    const unit = UNITS[i];
    const row = {
      id: unit.id,
      title: unit.title,
      label: unit.label,
      description: unit.description,
      topics: unit.topics,
      sort_order: i,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would upsert: ${unit.id} (${unit.topics.length} topics, sort_order=${i})`);
      continue;
    }

    const { error } = await supabase
      .from('units')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Failed to seed ${unit.id}: ${error.message}`);
      process.exit(1);
    }

    console.log(`  ✅ ${unit.id} — ${unit.topics.length} topics`);
  }

  console.log(`\nDone${dryRun ? ' (dry run — no changes made)' : ''}.`);
}

main().catch(console.error);
