// Regenerate every fixture's answers.json from its committed transcript —
// harness path (never hand-edit fixture files).
//   pnpm --filter @workflow-ui/bridge exec tsx scripts/regen-answers.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAnswers } from '../src/convert.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

for (const name of fs.readdirSync(FIXTURES)) {
  const transcript = path.join(FIXTURES, name, 'transcript.jsonl');
  if (!fs.existsSync(transcript)) continue;
  const journal = fs
    .readFileSync(transcript, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const answers = deriveAnswers(journal);
  fs.writeFileSync(path.join(FIXTURES, name, 'answers.json'), JSON.stringify(answers, null, 2) + '\n');
  console.log(`${name}: ${Object.keys(answers).length} answers`);
}
