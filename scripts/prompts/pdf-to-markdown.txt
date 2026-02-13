# PDF-to-Markdown Conversion Prompt

You are converting French language course materials from PDF to clean, structured markdown for use in an automated question generation pipeline.

## Output Requirements

**CRITICAL - DO NOT include these artifacts:**
- No introductory commentary like "Here's the content..." or "I'll convert this..."
- No code fence wrappers (```markdown ... ```)
- No concluding summaries like "This markdown preserves..." or "Perfect for..."
- No meta-commentary about the conversion process
- START IMMEDIATELY with the heading: # French I - [Unit Name]

## Content to EXCLUDE

Strip the following from the output entirely — this content is not used for question generation and creates noise:

- **Real person names** — Remove all real person names (teachers, administrators, staff). Replace with generic references if needed (e.g., "the teacher" or "l'enseignant(e)")
- **Classroom policies** — Rules of conduct, behavioral expectations, discipline procedures
- **Grading rubrics** — Point values, grade breakdowns, assessment criteria
- **Course logistics** — Late work policies, supply lists, office hours, contact information
- **School-specific references** — School names, room numbers, period schedules
- **Learning philosophy** — Statements about language learning methodology, study tips, motivational content

**DO preserve** fictional/example names used in exercises and dialogues (e.g., Pierre, Sophie, Marie) — these are pedagogical content, not personal information.

## Heading Structure

The output headings drive automated topic extraction. Follow these rules carefully:

1. **Document title**: `# French I - [Unit Name]` (level 1, exactly once)
2. **Topic sections**: `##` (level 2) for each distinct topic area — vocabulary set, grammar point, cultural topic, or activity theme
3. **Subsections**: `###` (level 3) for parts within a topic — exercises, answer keys, notes

**Heading naming convention**: Use bilingual headings that include both the French title and an English descriptor when the source material provides both:
- `## Les Jeux Olympiques - Olympic Sports and Activities`
- `## Conjugaison des verbes -ER - Present Tense of -ER Verbs`
- `## Vocabulaire actif - Qu'est-ce que tu aimes faire?`

If the source only uses one language, preserve it as-is. Do NOT invent translations — only include both when the PDF itself provides both.

**Section granularity**: Each `##` section should cover one teachable topic. A vocabulary list and its related grammar point should be separate `##` sections, not combined into one. Err on the side of more `##` sections rather than fewer.

## Structure Format

```
# French I - [Unit Name]

## [Topic Title - Bilingual if source provides both]

[Content: explanations, examples, dialogues]

### Exercices
[Practice activities, fill-in-blank, matching — WITHOUT answers inline]

### Réponses
[Answer keys for the exercises above]

---

## Vocabulaire actif - [Theme]
- **french_word** - english_translation
- **un(e) élève** - a student

---

## [Grammar Topic - Description]

[Grammar explanations]

| Sujet | Parler | Aimer |
|-------|--------|-------|
| je    | parle  | aime  |
| tu    | parles | aimes |
| il/elle/on | parle | aime |
| nous  | parlons | aimons |
| vous  | parlez | aimez |
| ils/elles | parlent | aiment |

### Exercices
[Practice activities]

### Réponses
[Answers]

---

## [Next Topic]
```

## Formatting Rules

1. **Section separators**: Use `---` between `##` topic sections
2. **Vocabulary lists**: Use `- **word** - translation` format
3. **Conjugation tables**: Use markdown tables with Subject column + one column per verb
4. **Numbered lists**: Preserve from source (exercises, rules, etc.)
5. **YouTube links**: Preserve as-is when present
6. **French-English pairs**: Format as `**French phrase** - English translation`
7. **Grammar tables**: Use markdown tables for any tabular data
8. **Exercises**: Place under `### Exercices` subsections
9. **Answer keys**: Place under `### Réponses` subsections, separate from exercises

## Content Preservation

MUST preserve:
- All French vocabulary with accents (é, è, ê, ë, à, â, ù, û, ô, ç, etc.)
- All answer keys and exercise solutions (under ### Réponses)
- YouTube video links
- Grammar explanations and conjugation tables
- Cultural notes and context
- Activity instructions
- Fictional names used in exercises and dialogues

DO NOT add:
- Your own commentary or observations
- Suggestions for teachers
- Quality assessments of the content
- Explanations of what the markdown is "good for"
- Translations not present in the source material

## Example Output Start

# French I - Unit 2 Daily Activities

## Les Jeux Olympiques d'été - Summer Olympic Sports
**Les sports olympiques** - Olympic sports

- **Le football** - soccer
- **Le basketball** - basketball
- **La natation** - swimming

---

## Vocabulaire actif - Qu'est-ce que tu aimes faire?
- **Jouer au foot** - to play soccer
- **Faire de la natation** - to swim
- **Regarder la télé** - to watch TV

---

## Conjugaison - Present Tense of -ER Verbs

Regular -ER verbs follow this pattern. Remove the -ER ending and add:

| Sujet | Ending | Parler | Aimer |
|-------|--------|--------|-------|
| je    | -e     | parle  | aime  |
| tu    | -es    | parles | aimes |
| il/elle/on | -e | parle | aime |
| nous  | -ons   | parlons | aimons |
| vous  | -ez    | parlez | aimez |
| ils/elles | -ent | parlent | aiment |

### Exercices
Complete with the correct form of the verb in parentheses:
1. Je _____ (parler) français.
2. Nous _____ (aimer) le football.

### Réponses
1. parle
2. aimons
