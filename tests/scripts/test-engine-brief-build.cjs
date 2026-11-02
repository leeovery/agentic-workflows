'use strict';

// ---------------------------------------------------------------------------
// The build's briefs (leeway-engine/scripts/domain/brief.cjs, its records
// domain/brief-records.cjs, the templates content/briefs/) and the build's
// agents (agents/leeway-{builder,reviewer,task-writer,consolidation}.md):
// `engine brief <role> <unit> <N> [--base <branch>] [--head <commit>]` for
// a phase of the unit's cut. The task writer's brief — the phase from the cut, its
// sections verbatim and which of them it builds first, never the rest of
// the spec (12.S9, 11.S17), its scenarios, the notes held for it, its tasks
// written so far, the earlier phases' unfinished tasks, the calls made in
// the build, the entries a replacement affects, and where its task files go
// — and its template: the six principles, the task template, one `task
// create` per task with its links as it goes, every scenario given to a
// task, shared design settled while writing, an invariant's check in the
// phase that first builds it (12.3–12.5, 7.S3, 15.S12). The consolidation
// agent's brief — the notes the phase takes, its tasks whole, its range
// across repositories to its stack's tip, and where its report goes — its
// template's report and task examples reading by their grammars (12.S23,
// 13.S12). The phase review's brief, the reviewer's second template — the
// phase, its sections, its tasks' criteria, what it relies on, the decided
// calls, its range, its scenarios' runs read at the phase's HEAD (15.S5,
// 15.S18), what `verify mutants` left of the tool's survivors for that HEAD
// (15.S9), the linters (12.11.2) — where no tool exists, breaking the
// riskiest line in a scratch worktree (15.S10), and the task reviewer's
// stance, call, report and comment rules word for word (13.S9). Where a
// reviewer's report goes (13.5.9): a task's reviewer's file of the round
// under review, read from the reports on disk so it holds across a
// `/clear`, a phase's reviewer's beside its consolidation, each by the
// reviewer's letter, the report written there and the final message only
// the verdict and the nits. The
// builder's own call among the decided calls its reviewers read (13.S17);
// the builder's template laying its task out with `task worktree` first and
// committing only there (12.7.10), its ask rule and its answer to reviewers
// who disagree (13.S7). No template tells
// an agent to break a task down, keep a to-do list, check its own work or
// leave no stubs (12.3.8), or names a model or an effort. The refusals,
// nothing written and no brief stored. Each agent's definition: Opus at
// medium, the builder and the reviewer with the Skill tool (15.S22), and no
// higher-effort variant of a build agent on the roster (26.S7, 27.S7).
//
// Layer: verb. World: a project, built once and copied, with a unit past
// ready to build — its spec of two areas, its cut of three phases, the
// first two written in the tracker through the default driver, phase 1's
// tasks done, in progress, closed and not started, one added to; notes for
// later, one held for phase 3; decisions at the spec and in the build, one
// replacing a spec decision a finding relies on; the branches of phase 1's
// tasks stacked in the project's repository, each commit naming its task —
// the closed one's beside the stack — and the first in a repository nested
// in it, phase 2's in the project's; runs of the scenarios at the tasks'
// branches; the project's linters, and its verify setup, its mutation tool
// answering what each test steers it to —
// beside it a unit whose build has not begun.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, statePath, layout, writeState, readState, commitAll, commitCode, git, initRepo, fixtureFrom, cleanupFixture,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { SPEC_FILE } = require(path.join(SCRIPTS, 'domain/spec-sections.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { readTaskText } = require(path.join(SCRIPTS, 'domain/task-file.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { readConsolidation } = require(path.join(SCRIPTS, 'domain/notes.cjs'));
const { runsRel } = require(path.join(SCRIPTS, 'domain/runs.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');
const AGENTS = path.join(__dirname, '../../agents');

const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);
const UNIT = 'pay';
const SESSION_ID = 'brief-build-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ who_moved_whom: 'none' });
const LINTERS = Object.freeze([{ name: 'eslint', command: 'npx eslint .' }]);
const NESTED = 'lib';

/** The unit's spec: two areas, each part a statement, each area its scenarios. */
const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 A card is taken once. [builder: call-1]', '',
  '### 1.2 The receipt', '', '1.2.1 A receipt follows every charge. [builder: call-1]', '',
  '## 1-S. Scenarios for §1', '', '1.S1 Given a card form, when the number is typed, then it is checked. (1.1.1)', '',
  '1.S2 Given a charge, when it lands, then a receipt follows. (1.2.1)', '',
  '## 2. Refunds', '', '### 2.1 The charge', '', '2.1.1 A refund names its charge. [builder: call-1]', '',
  '## 2-S. Scenarios for §2', '', '2.S1 Given a charge, when it is refunded whole, then the card is credited. (2.1.1)', '',
  '2.S2 Given a refund, when it lands, then a receipt follows. (2.1.1)', '',
].join('\n');
const AREA_1 = SPEC.slice(SPEC.indexOf('## 1. Cards'), SPEC.indexOf('\n\n## 1-S.'));
const AREA_2 = SPEC.slice(SPEC.indexOf('## 2. Refunds'), SPEC.indexOf('\n\n## 2-S.'));
const PART_1_2 = ['### 1.2 The receipt', '', '1.2.1 A receipt follows every charge. [builder: call-1]'].join('\n');
const PART_2_1 = ['### 2.1 The charge', '', '2.1.1 A refund names its charge. [builder: call-1]'].join('\n');

/** The unit's cut: three phases, the second relying on the first and another unit, the third on the second. */
const CUT = Object.freeze({
  phases: [
    { name: 'Cards', goal: 'A customer pays by card.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'A customer is refunded.', scenarios: ['2.S1'], sections: ['2', '2.1'], relies_on: [1, 'ledger'] },
    { name: 'Refund receipts', goal: 'A refund gets its receipt.', scenarios: ['2.S2'], sections: ['2.1', '1.2'], relies_on: [2] },
  ],
});

/** A task file's text. @param {string} title @param {string} reference */
function taskText(title, reference) {
  return [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', `- Given a card, when ${title.toLowerCase()} runs, then it answers.`, '',
    '## Spec reference', reference,
  ].join('\n');
}

/** Phase 1's tasks, and phase 2's, as the world makes them. */
const TASKS = Object.freeze({
  1: [['Take a card', '§1.1'], ['Show a receipt', '§1.2'], ['Store a card', '§1.1'], ['Check the number', '§1.1']],
  2: [['Refund a charge', '§2.1']],
});

/** A task's branch, as the landing names it. @param {number} phase @param {number} n */
const branchOf = (phase, n) => taskBranch({ unit: UNIT, phase, n }, 'feat', TASKS[/** @type {1|2} */ (phase)][n - 1][0]);

/**
 * One file added in the repository at `repo`, committed on the branch checked out, for the task `trailer` names.
 * @param {string} repo @param {string} file @param {string} [trailer]
 */
function commitFile(repo, file, trailer) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), `export const ${path.basename(file, '.js')} = 1;\n`);
  git(repo, ['add', file]);
  git(repo, ['commit', '-q', '-m', `add ${file}${trailer === undefined ? '' : `\n\nLeeway-Task: ${trailer}`}`]);
}

/**
 * Task `phase`.`n`'s branch cut from `from` in the repository at `repo`, adding one file in a commit for the task; its checkout back on `main`.
 * @param {string} repo @param {[number, number]} task @param {string} from @param {string} file
 */
function branchWith(repo, [phase, n], from, file) {
  git(repo, ['checkout', '-q', '-b', branchOf(phase, n), from]);
  commitFile(repo, file, `${UNIT}-${phase}-${n}`);
  git(repo, ['checkout', '-q', 'main']);
}

/** The commit a branch of the project's repository is at. @param {string} repo @param {string} branch */
const tipOf = (repo, branch) => git(repo, ['rev-parse', branch]).trim();

/**
 * The project's verify setup as `verify setup` records it — its mutation tool
 * answering the survivors the test steers it to, none where it steers none.
 */
const VERIFY = Object.freeze({
  place: 'verify',
  feature_map: 'verify/features.md',
  ...Object.fromEntries(['launch', 'health', 'drive', 'evidence', 'cleanup'].map((part) => [part, 'true'])),
  mutation: 'sh verify/mutate.sh',
  ran: { unit: UNIT, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: null }], at: '2026-11-01T09:00:00.000Z' },
});

const MUTATE = `steer="$(git rev-parse --path-format=absolute --git-common-dir)/mutants.json"
if [ -f "$steer" ]; then cp "$steer" "$LEEWAY_RUN/survivors.json"; else echo '[]' > "$LEEWAY_RUN/survivors.json"; fi
`;

/** The survivors the mutation tool answers, steered. @param {unknown[]} survivors */
const surviving = (survivors) => fs.writeFileSync(path.join(dir, '.git', 'mutants.json'), JSON.stringify(survivors));

/** The project's verify setup recorded again naming no mutation tool. */
function withoutMutationTool() {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  const { mutation: _mutation, ...without } = project.environment.verify;
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { ...project.environment, verify: without } }, null, 2));
  commitAll(dir, 'no mutation tool');
}

/** The scenarios' runs the world records, each `[scenario, verdict, the task whose branch it ran at, when]`, in that order. */
const RUNS = Object.freeze([
  ['1.S2', 'skipped', [1, 2], '2026-11-01T10:00:00.000Z'],
  ['2.S1', 'fail', [1, 4], '2026-11-01T11:00:00.000Z'],
  ['2.S1', 'pass', [2, 1], '2026-11-01T12:00:00.000Z'],
  ['2.S1', 'pass', [1, 3], '2026-11-01T13:00:00.000Z'],
]);

/** Each run's file, from the state root, in RUNS' order. */
const runFiles = RUNS.map(([scenario], at) => `${runsRel(UNIT, scenario)}/run-00${RUNS.slice(0, at + 1).filter(([other]) => other === scenario).length}.json`);

/** A ledger write that must succeed: its short id. @param {string} dir @param {string} verb @param {string} address @param {string[]} flags @param {object} content */
const write = (dir, verb, address, flags, content) => ok(dir, ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify({ ...MADE, ...content }) }).id;

/** A decision answering a question asked at `address`: its short id. @param {string} dir @param {string} address @param {object} decision @param {string[]} [flags] */
function decided(dir, address, decision, flags = []) {
  const question = write(dir, 'ask', address, [], { by: 'claude', text: 'What is asked?' });
  return write(dir, 'decide', address, ['--answers', question, ...flags], decision);
}

/** The world's entries, by name, as their short ids. @type {Record<string, string>} */
const calls = {};

const world = fixtureFrom('brief-build-', (dir) => {
  createManifest(dir, UNIT, { build: { position: 'auto' }, cut: CUT });
  createManifest(dir, 'draft', { cut: CUT });
  for (const unit of [UNIT, 'draft']) writeState(dir, layout.unit(unit, SPEC_FILE), SPEC);
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS, verify: VERIFY } }, null, 2));
  fs.writeFileSync(path.join(dir, '.gitignore'), `${NESTED}/\n`);
  fs.mkdirSync(path.join(dir, 'verify'));
  fs.writeFileSync(path.join(dir, 'verify', 'mutate.sh'), MUTATE);
  commitAll(dir, 'init');
  const root = statePath(dir);
  for (const [phase, title] of [[1, 'Cards'], [2, 'Refunds']]) {
    ok(dir, ['task', 'phase', UNIT, String(phase), '--title', String(title)]);
    TASKS[/** @type {1|2} */ (phase)].forEach(([name, reference], i) => DRIVER.createTask(root, { unit: UNIT, phase: Number(phase), n: i + 1 }, readTaskText(taskText(name, reference))));
  }
  const task = (/** @type {number} */ n) => ({ unit: UNIT, phase: 1, n });
  DRIVER.done(root, task(1));
  DRIVER.start(root, task(2));
  DRIVER.add(root, task(2), { by: 'person', text: 'The receipt is emailed.' });
  DRIVER.close(root, task(3), 'folded into 1.1');
  for (const [text, phase] of [['Reading a card back never checks its expiry.'], ['A refund screen wants its own receipt.', '3'], ['Two card helpers do the same.']]) {
    const file = path.join(dir, '..', 'note.md');
    fs.writeFileSync(file, `${text}\n`);
    ok(dir, ['task', 'note', UNIT, '--file', file, ...(phase === undefined ? [] : ['--phase', phase])]);
  }
  commitAll(dir, 'the phases written');
  branchWith(dir, [1, 1], 'main', 'src/card.js');
  branchWith(dir, [1, 2], branchOf(1, 1), 'src/receipt.js');
  branchWith(dir, [1, 4], branchOf(1, 2), 'src/check.js');
  branchWith(dir, [1, 3], 'main', 'src/store.js');
  branchWith(dir, [2, 1], branchOf(1, 4), 'src/refund.js');
  commitFile(dir, 'src/main.js');
  RUNS.forEach(([scenario, verdict, [phase, n], at], i) => writeState(dir, runFiles[i], JSON.stringify({
    verdict, unfixed: false, at, checkout: dir, commits: [{ repo: '.', commit: tipOf(dir, branchOf(phase, n)) }], task: `${phase}.${n}`, evidence: [], recordings: [],
  })));
  commitAll(dir, 'the runs');
  const nested = initRepo(path.join(dir, NESTED));
  fs.writeFileSync(path.join(nested, 'README.md'), 'The card library.\n');
  commitCode(nested, 'init');
  branchWith(nested, [1, 1], 'main', 'card/token.js');
  const atSpec = `${UNIT}.specification`;
  const atBuild = `${UNIT}.implementation`;
  calls.spec = decided(dir, atSpec, { by: 'claude', text: 'A card is tokenised.', why: 'No number is kept.' });
  calls.byHand = decided(dir, atSpec, { by: 'person', text: 'Refunds by hand.', why: 'They are rare.' });
  calls.slow = write(dir, 'find', atSpec, ['--relies-on', calls.byHand], { by: 'claude', text: 'A refund takes a day.', how: 'seen in a spike', known: 'spike' });
  calls.builder = decided(dir, atBuild, { by: 'claude', text: 'The receipt is a PDF.\nIt is kept a year.', why: 'Customers print it.' }, ['--task', '1.2']);
  calls.api = write(dir, 'replace', atBuild, ['--replaces', calls.byHand, '--reason', 'changed-mind'], {
    by: 'person', text: 'Refunds through the API.', why: 'They come weekly now.', drops: ['refunds by hand'],
  });
});

/** @type {string} */
let dir;

/** Each test of the calling `describe` in a copy of the world, the conversation's briefs removed after it. */
function useWorld() {
  beforeEach(() => {
    dir = world(path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brief-build-'))), 'project'));
  });
  afterEach(() => {
    cleanupFixture(path.dirname(dir));
    fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
  });
}

/** The files the conversation's briefs folder holds, by name. */
const stored = () => {
  const folder = path.dirname(briefPath(SESSION_ID, 'x'));
  return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
};

/** A brief issued: its response, the brief as stored, and the record of whose it is. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8'), whose: JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')) };
}

/** A role's template as shipped. @param {string} role */
const template = (role) => fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8');

/** A role's template as shipped, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return template(role).split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** A refusal leaving the state as it was and no brief stored. @param {string[]} args @param {RegExp} pattern */
function refusedUnissued(args, pattern) {
  const { error } = refusedPristine(dir, ['brief', ...args], { env: SESSION });
  assert.match(error, pattern);
  assert.deepStrictEqual(stored(), []);
}

/** A path drawn as a brief draws it. @param {string} rel the path from the state root */
const pathDrawn = (rel) => `\`${statePath(dir, rel)}\``;

/** The range drawn for a repository, its files added. @param {string} where @param {string} tip @param {string[]} files */
function rangeDrawn(where, tip, files) {
  const width = Math.max(...files.map((file) => file.length));
  const lines = files.map((file) => ` ${file.padEnd(width)} | 1 +`);
  const total = files.length === 1 ? '1 file changed, 1 insertion(+)' : `${files.length} files changed, ${files.length} insertions(+)`;
  return `## In ${where}: \`main...${tip}\`\n\n\`\`\`\n${lines.join('\n')}\n ${total}\n\`\`\``;
}

/** The unit's decided calls as a brief draws them, the builder's own among them. */
const decidedDrawn = () => [
  `- ${calls.spec}, Claude's: A card is tokenised.\n  Why: No number is kept.`,
  `- ${calls.builder}, Claude's: The receipt is a PDF.\n  It is kept a year.\n  Why: Customers print it.`,
  `- ${calls.api}, the person's: Refunds through the API.\n  Why: They come weekly now.`,
].join('\n');

describe('the task writer\'s brief (12.5, 12.S9, 11.S17)', () => {
  useWorld();

  it('for a phase not yet written: the phase, its sections and which an earlier phase built, its scenarios, the note held for it, the earlier phases\' unfinished tasks, the calls made in the build, the entries a replacement affects, and where its files go', () => {
    const { res, brief, whose } = issued(['task-writer', UNIT, '3']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'task-writer', agent: 'leeway-task-writer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'task-writer', agent: 'leeway-task-writer', unit: UNIT, task: null, topic: null });
    const { affected } = ok(dir, ['ledger', 'affected', UNIT]);
    assert.strictEqual(affected.length, 1, 'the finding resting on the replaced decision is affected');
    assert.strictEqual(brief, `Brief ${res.id} — the task writer's, for pay phase 3\n\n${filledTemplate('task-writer', {
      'cut-phase': 'Phase 3 of pay: Refund receipts\n\nA refund gets its receipt.\n\nIt relies on phase 2.',
      'phase-sections': [`\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\``, '- §2.1, first built in phase 2\n- §1.2, first built in phase 1', PART_2_1, PART_1_2].join('\n\n'),
      'phase-scenarios': '- 2.S2: Given a refund, when it lands, then a receipt follows. (2.1.1)',
      'held-notes': '## Note 2\n\nA refund screen wants its own receipt.',
      'written-tasks': 'The phase is not written in the tracker yet.',
      'earlier-tasks': '- 1.2 Show a receipt, in progress\n- 1.4 Check the number, not started\n- 2.1 Refund a charge, not started',
      'build-calls': [
        `- ${calls.builder}, Claude's, for task 1.2: The receipt is a PDF.\n  It is kept a year.\n  Why: Customers print it.`,
        `- ${calls.api}, the person's, replacing ${calls.byHand}: Refunds through the API.\n  Why: They come weekly now.`,
      ].join('\n'),
      'affected-entries': `\`\`\`json\n${JSON.stringify(affected, null, 2)}\n\`\`\``,
      'task-files-to': pathDrawn('.cache/pay/implementation/phase-3'),
    })}`);
  });

  it('12.S9, 11.S17: a brief reads the sections its phase names and never the rest of the spec — the first phase\'s, which builds its area first, drawing a part the third never does', () => {
    const first = issued(['task-writer', UNIT, '1']).brief;
    const third = issued(['task-writer', UNIT, '3']).brief;

    assert.ok(first.includes(`# Its sections\n\n\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\`\n\n- §1, first built in this phase\n\n${AREA_1}\n\n# Its scenarios\n`), first);
    assert.ok(!third.includes('1.1.1 A card is taken once.') && !third.includes('## 1. Cards'), 'a phase naming neither the area nor the part draws neither');
  });

  it('a phase written already draws its tasks so far, and a first phase relies on nothing, has no earlier tasks and none of the note held for another phase', () => {
    const { brief } = issued(['task-writer', UNIT, '1']);

    assert.ok(brief.includes('# Notes held for this phase\n\nNone recorded.\n'), brief);
    assert.ok(brief.includes('# The phase\n\nPhase 1 of pay: Cards\n\nA customer pays by card.\n\nIt relies on nothing.\n'), brief);
    assert.ok(brief.includes('# Its tasks written so far\n\n- 1.1 Take a card, done\n- 1.2 Show a receipt, in progress\n- 1.3 Store a card, closed\n- 1.4 Check the number, not started\n\n# Earlier phases\' unfinished tasks\n\nNone recorded.\n'), brief);
  });

  it('a phase naming an area and a part of it draws the area once, the part within it', () => {
    const { brief } = issued(['task-writer', UNIT, '2']);

    assert.ok(brief.includes(`- §2, first built in this phase\n- §2.1, first built in this phase\n\n${AREA_2}\n\n# Its scenarios\n`), brief);
  });
});

describe('the consolidation agent\'s brief (12.10.3, 13.8.3, 12.S23, 13.S12)', () => {
  useWorld();

  it('the notes the phase takes — never one held for another phase — its tasks whole, its range to the stack\'s tip in each repository, a closed task\'s branch beside it read in none, where its report goes and where its task files go', () => {
    const { res, brief, whose } = issued(['consolidation', UNIT, '1', '--base', 'main']);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'consolidation', agent: 'leeway-consolidation', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'consolidation', agent: 'leeway-consolidation', unit: UNIT, task: null, topic: null });
    const whole = (/** @type {number} */ n, /** @type {string} */ stands) => {
      const [name, reference] = TASKS[1][n - 1];
      return taskText(name, reference).replace(/^#/gm, '##').replace(`## ${name}\n`, `## 1.${n} ${name}\n\n${stands}\n`);
    };
    assert.strictEqual(brief, `Brief ${res.id} — the consolidation agent's, for pay phase 1\n\n${filledTemplate('consolidation', {
      'phase-notes': '## Note 1\n\nReading a card back never checks its expiry.\n\n## Note 3\n\nTwo card helpers do the same.',
      'phase-tasks': [
        whole(1, 'It is done.'), `${whole(2, 'It is in progress.')}\n\n### Added by the person\n\nThe receipt is emailed.`, whole(3, 'It was closed: folded into 1.1'), whole(4, 'It is not started.'),
      ].join('\n'),
      'phase-diff-range': [
        rangeDrawn('the project\'s repository', branchOf(1, 4), ['src/card.js', 'src/check.js', 'src/receipt.js']), rangeDrawn(`\`${NESTED}\``, branchOf(1, 1), ['card/token.js']),
      ].join('\n\n'),
      'consolidation-to': pathDrawn('pay/build/phases/phase-1/consolidation.md'),
      'task-files-to': pathDrawn('.cache/pay/implementation/phase-1'),
    })}`);
  });

  it('a note another phase\'s report took is not this phase\'s to take', () => {
    writeState(dir, 'pay/build/phases/phase-2/consolidation.md', '## The notes\n\n- Note 3: dropped — the helpers were merged.\n');

    const { brief } = issued(['consolidation', UNIT, '1', '--base', 'main']);

    assert.ok(brief.includes('# The notes\n\n## Note 1\n\nReading a card back never checks its expiry.\n\n# The phase\'s tasks\n'), brief);
  });
});

describe('the phase review\'s brief, the reviewer\'s second template (12.11.2, 6.5.2)', () => {
  useWorld();

  /**
   * The phase review's brief for phase `phase` by reviewer `letter`, its runs read at `tip` and the mutation tool run over the phase from the checkout there first.
   * @param {number} phase @param {string} tip @param {string} [letter]
   */
  function reviewedAt(phase, tip, letter = 'a') {
    git(dir, ['checkout', '-q', tip]);
    ok(dir, ['verify', 'mutants', UNIT, String(phase)]);
    return issued(['phase-review', UNIT, String(phase), '--base', 'main', '--head', tip, '--letter', letter]);
  }

  /** A run of RUNS drawn as a brief draws it. @param {number} at its place in RUNS */
  const runDrawn = (at) => `  - ${RUNS[at][1]}, recorded ${RUNS[at][3]}: ${pathDrawn(runFiles[at])}`;

  it('the phase, its sections, each of its tasks\' criteria but a closed one\'s, what it relies on, the decided calls, its range, its scenarios\' runs at its HEAD, what survived the mutation tool and the linters — dispatched as the reviewer', () => {
    const { res, brief, whose } = reviewedAt(2, branchOf(2, 1));

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'phase-review', agent: 'leeway-reviewer', pointer: `brief:${res.id}` });
    assert.deepStrictEqual(whose, { role: 'phase-review', agent: 'leeway-reviewer', unit: UNIT, task: null, topic: null });
    assert.strictEqual(brief, `Brief ${res.id} — the phase review's, for pay phase 2\n\n${filledTemplate('phase-review', {
      'cut-phase': 'Phase 2 of pay: Refunds\n\nA customer is refunded.\n\nIt relies on phase 1, the work unit ledger.',
      'phase-sections': [`\`${statePath(dir, layout.unit(UNIT, SPEC_FILE))}\``, '- §2, first built in this phase\n- §2.1, first built in this phase', AREA_2].join('\n\n'),
      'phase-criteria': '## 2.1 Refund a charge\n\n- Given a card, when refund a charge runs, then it answers.',
      'relied-on': [
        '## Phase 1: Cards', '', 'A customer pays by card.', '', 'Its sections: §1', '', 'Its tasks:', '',
        '- 1.1 Take a card, done\n- 1.2 Show a receipt, in progress\n- 1.3 Store a card, closed\n- 1.4 Check the number, not started', '',
        '## The work unit ledger', '', 'This phase relies on its delivery.',
      ].join('\n').replace('\n\n## The work', '\n## The work'),
      'decided-calls': decidedDrawn(),
      'phase-diff-range': rangeDrawn('the project\'s repository', branchOf(2, 1), ['src/check.js', 'src/card.js', 'src/receipt.js', 'src/refund.js'].sort()),
      'recorded-runs': ['- 2.S1: proven', runDrawn(1), runDrawn(2)].join('\n'),
      mutants: 'None survived.',
      linters: '- eslint: npx eslint .',
      'phase-report-to': pathDrawn('pay/build/phases/phase-2/review-a.md'),
    })}`);
  });

  it('15.S5, 15.S18: the runs are read at the phase\'s HEAD — a run at a commit beyond it never counts, so a scenario whose only run there failed reads not proven, one with none not proven, and one only skipped named, not run', () => {
    withoutMutationTool();
    const second = issued(['phase-review', UNIT, '2', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);
    const first = issued(['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);

    assert.ok(second.brief.includes(`# Its scenarios' runs, at the phase's HEAD\n\n- 2.S1: not proven\n${runDrawn(1)}\n\n#`), second.brief);
    assert.ok(first.brief.includes(`# Its scenarios' runs, at the phase's HEAD\n\n- 1.S1: not proven\n- 1.S2: named, not run\n${runDrawn(0)}\n\n#`), first.brief);
  });

  it('15.S9: what `verify mutants` left alive on the lines the phase changed, at the phase\'s HEAD, reaches the pair — none of what it left on lines the phase never changed, nor what it left at another HEAD — and the brief never runs the tool', () => {
    git(dir, ['checkout', '-q', branchOf(1, 2)]);
    surviving([{ path: 'src/card.js', line: 1, mutant: 'left at another HEAD' }]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    surviving([{ path: 'src/check.js', line: 1, mutant: '1 → 0' }, { path: 'src/card.js', line: 2, mutant: 'a line the phase never wrote' }]);
    git(dir, ['checkout', '-q', branchOf(1, 4)]);
    ok(dir, ['verify', 'mutants', UNIT, '1']);
    surviving([{ path: 'src/check.js', line: 1, mutant: 'the brief ran the tool' }]);

    const { brief } = issued(['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'a']);

    assert.ok(brief.includes('# What survived the mutation tool\n\n- src/check.js:1 — 1 → 0\n\n#'), brief);
  });

  it('15.S10: a setup naming no mutation tool says so, and the template has each reviewer break the riskiest line instead', () => {
    withoutMutationTool();

    const { brief } = issued(['phase-review', UNIT, '2', '--base', 'main', '--head', branchOf(2, 1), '--letter', 'a']);

    assert.ok(brief.includes('# What survived the mutation tool\n\nThe verify setup names no mutation tool.\n\n#'), brief);
  });

  it('the criteria leave a closed task out and carry each addition', () => {
    const { brief } = reviewedAt(1, branchOf(1, 4));
    const criteria = (/** @type {number} */ n) => `## 1.${n} ${TASKS[1][n - 1][0]}\n\n- Given a card, when ${TASKS[1][n - 1][0].toLowerCase()} runs, then it answers.`;

    assert.ok(brief.includes(`# Its tasks' criteria\n\n${criteria(1)}\n${criteria(2)}\n\n### Added by the person\n\nThe receipt is emailed.\n${criteria(4)}\n\n# What it relies on\n\nNone recorded.\n`), brief);
  });
});

describe('where a reviewer\'s report goes (13.5.9)', () => {
  useWorld();

  const REPORT = '## Findings\n\n- bug: The receipt is never sent.\n  Scenario: A customer pays and waits for a receipt.\n\nVerdict: fail\n';
  const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';

  /** The reviewer's brief for task 1.2 by reviewer `letter`, in the conversation `session` names. @param {string} letter @param {string} [session] */
  const reviewing = (letter, session = SESSION_ID) => ok(dir, ['brief', 'reviewer', UNIT, '1.2', '--base', 'main', '--letter', letter], { env: { CLAUDE_CODE_SESSION_ID: session } });

  /** The report place a brief draws. @param {{id: string}} res @param {string} [session] */
  const placeIn = (res, session = SESSION_ID) => /# Where your report goes\n\n(.*)\n/.exec(fs.readFileSync(briefPath(session, res.id), 'utf8'))?.[1];

  /** A round's report written by reviewer `letter`. @param {number} round @param {string} letter @param {string} [text] */
  const reported = (round, letter, text = REPORT) => writeState(dir, `pay/build/tasks/1.2/round-${round}-${letter}.md`, text);

  it('each reviewer of a task\'s first round writes to its own file of round 1', () => {
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-1-a.md'));
    assert.strictEqual(placeIn(reviewing('b')), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
  });

  it('the round is read from the reports on disk: the round one reviewer has reported holds for the other after a /clear, and a round both reported is followed by the next', () => {
    reported(1, 'a');
    const cleared = 'brief-build-after-clear';
    try {
      assert.strictEqual(placeIn(reviewing('b', cleared), cleared), pathDrawn('pay/build/tasks/1.2/round-1-b.md'));
    } finally {
      fs.rmSync(conversationDir(cleared), { recursive: true, force: true });
    }
    reported(1, 'b');
    assert.strictEqual(placeIn(reviewing('a')), pathDrawn('pay/build/tasks/1.2/round-2-a.md'));
  });

  it('refused: a letter none of the reviewers\', a report already written for its round, and a task whose last round passed or was settled', () => {
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'c'], /^c is no reviewer's letter — the reviewers are a and b$/);
    reported(1, 'a');
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^pay\/build\/tasks\/1\.2\/round-1-a\.md is written already — that reviewer's report of the round is in$/);
    reported(1, 'b');
    writeState(dir, 'pay/build/tasks/1.2/round-1-settled.md', 'Settled.\n');
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^round 1 of task 1\.2 of pay was settled — its review is over$/);
    reported(2, 'a', PASSED);
    reported(2, 'b', PASSED);
    refusedUnissued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a'], /^round 2 of task 1\.2 of pay passed — its review is over$/);
  });

  it('a phase\'s reviewer writes to its letter\'s file beside the consolidation, refused once written', () => {
    withoutMutationTool();
    const phaseReview = ['phase-review', UNIT, '1', '--base', 'main', '--head', branchOf(1, 4), '--letter', 'b'];
    const first = 'brief-build-phase-review';
    try {
      assert.strictEqual(placeIn(ok(dir, ['brief', ...phaseReview], { env: { CLAUDE_CODE_SESSION_ID: first } }), first), pathDrawn('pay/build/phases/phase-1/review-b.md'));
    } finally {
      fs.rmSync(conversationDir(first), { recursive: true, force: true });
    }
    writeState(dir, 'pay/build/phases/phase-1/review-b.md', REPORT);
    refusedUnissued(phaseReview, /^pay\/build\/phases\/phase-1\/review-b\.md is written already — that reviewer's report of the round is in$/);
  });
});

describe('the builder\'s calls (13.11.10)', () => {
  useWorld();

  it('13.S17: a call the builder took, recorded in the build, is among the decided calls the builder\'s brief and its reviewers\' carry', () => {
    const builder = issued(['builder', UNIT, '1.2']).brief;
    const reviewer = issued(['reviewer', UNIT, '1.2', '--base', 'main', '--letter', 'a']).brief;

    for (const brief of [builder, reviewer]) assert.ok(brief.includes(`# The decided calls\n\n${decidedDrawn()}\n`), brief);
  });
});

describe('the build\'s templates', () => {
  it('7.S3, 15.S12: the template gives the six principles, the task template — whose example reads by its grammar — one task create per task with its links as it goes, every scenario given to a task, shared design settled while writing, and an invariant\'s check in the phase that first builds it', () => {
    const words = template('task-writer');
    const example = /\n```markdown\n([\s\S]*?)\n```\n/.exec(words)?.[1] ?? '';

    assert.deepStrictEqual([...words.matchAll(/^([1-6])\. /gm)].map(([, n]) => n).slice(0, 6), ['1', '2', '3', '4', '5', '6']);
    assert.strictEqual(readTaskText(example.replace(/\{feat[^}]*\}/, 'feat').replace(/\{[^}]*\}/g, 'x')).type, 'feat');
    for (const line of [
      'A task likely to run past about 10,000 changed lines is probably two. There is no lower bound.',
      'Tasks are written at the phase\'s start against the code, at product altitude, naming no mechanism the record did not decide.',
      '`task create {unit} {N} --file {file}`, one call per task, as you go.',
      '`task link {unit} {N}.{n} --after {task}`',
      'Each of the phase\'s scenarios goes to the task that makes it true, and every one of them goes to a task.',
      'Settle a design several tasks touch as you write them, never leaving it to two builders',
      'An invariant in a section first built in this phase gets the task that adds its check',
    ]) assert.ok(words.includes(line), line);
  });

  it('the template\'s report example reads by the consolidation report\'s grammar, and its task example by the task template\'s', () => {
    const [report, task] = [...template('consolidation').matchAll(/\n```markdown\n([\s\S]*?)\n```\n/g)].map(([, example]) => example);

    assert.deepStrictEqual(readConsolidation(report).map(({ notes, kind }) => [notes, kind]), [[[1], 'dropped'], [[2, 4], 'task']]);
    assert.strictEqual(readTaskText(task.replace(/\{feat[^}]*\}/, 'fix').replace(/\{[^}]*\}/g, 'x')).type, 'fix');
  });

  it('15.S5, 15.S9, 15.S10, 13.S9: the template makes a scenario not proven at the HEAD and a mutant that survived in a criterion\'s code findings, breaks the riskiest line in a scratch worktree where no tool exists, and carries the task reviewer\'s stance, call, report, comment and reference rules word for word', () => {
    const words = template('phase-review');
    const from = (/** @type {string} */ text) => text.slice(text.indexOf('# A failed review'));

    for (const rule of [
      'A mutant that survived in code a criterion covers is a finding.',
      'Where the verify setup names no mutation tool, break the riskiest line of each criterion\'s code in a scratch worktree of your own, never the phase\'s: a break the tests do not catch is a finding.',
      'A scenario its runs leave "not proven", or "named, not run", at the phase\'s HEAD is a finding, and reads so in your report, in those words.',
    ]) assert.ok(words.includes(rule), rule);
    assert.ok(words.includes('where the phase meets what it relies on from earlier phases'), words);
    assert.strictEqual(from(words), from(template('reviewer')).replace('Review the task as a professional would', 'Review the phase as a professional would'));
  });

  it('13.S7: the template has the builder decide against the brief and the design where the reviewers disagree, and its ask rule keeps every question for the person off the builder', () => {
    const words = template('builder');

    for (const line of [
      'Where the two reviewers disagree, or you reject a finding, decide against this brief and the design, and say why in the round\'s summary. The next round reads the whole task again.',
      'A feasible way the person would leave to you — how the code does what the record decided — is yours: take it, and report it as your call with why',
      'A question the person would want to answer — what the product does, or a decision the record holds that the work shows wrong — is never yours.',
      'A problem you cannot build past: stop, and report what you met and where the work stands.',
      'You never ask the person.',
    ]) assert.ok(words.includes(line), line);
  });

  it('13.5.9: each reviewer\'s template has the report written whole to its file and the final message carry only the nits and the verdict', () => {
    for (const [role, slot] of [['reviewer', 'round-report-to'], ['phase-review', 'phase-report-to']]) {
      const words = template(role);
      assert.ok(words.includes(`# Where your report goes\n\n{{${slot}}}\n`), role);
      assert.ok(words.includes('Write the whole report to the file under "Where your report goes". Your final message then holds only the report\'s nits, each as the report words it, and its verdict line, and nothing else.'), role);
    }
  });

  it('12.7.10: the builder lays its task out with task worktree before anything else, and builds, runs and commits only there', () => {
    const words = template('builder');

    assert.ok(words.includes('Before anything else, lay the task out in the worktree you were started in: from its root, run the engine\'s `task worktree {unit} {task}`'), words);
    assert.ok(words.includes('Build, run and commit only there.'), words);
    assert.ok(words.indexOf('# Where you work') < words.indexOf('# Where the task leaves a call open'), 'laying the task out comes before the work');
  });

  it('15.S15: no builder\'s or reviewer\'s template names a skill\'s path', () => {
    for (const role of ['builder', 'fix', 'reviewer', 'phase-review']) assert.doesNotMatch(template(role), /\.claude\/skills|SKILL\.md/, role);
  });

  it('12.3.8: none tells an agent to break a task down, keep a to-do list, check its own work or leave no stubs, nor names a model or an effort', () => {
    const steering = /break (?:it|the task|this task) down|to-?do list|check (?:your|its) (?:own )?work|verify your (?:own )?work|\bstubs?\b|\beffort\b|\bopus\b|\bsonnet\b/i;
    assert.match('Keep a to-do list, and check your own work.', steering, 'the rule catches what it forbids');

    for (const role of ['builder', 'fix', 'reviewer', 'task-writer', 'consolidation', 'phase-review']) assert.doesNotMatch(template(role), steering, role);
  });
});

describe('the refusals, nothing written and no brief stored', () => {
  useWorld();

  it('arguments of another shape, a unit the project lacks, a unit whose build has not begun, and a phase its cut lacks', () => {
    for (const args of [['task-writer', UNIT], ['task-writer', UNIT, '1', 'more'], ['consolidation', UNIT, '1'], ['phase-review', UNIT, '--base', 'main', '--head', 'main', '--letter', 'a'], ['phase-review', UNIT, '1', '--base', 'main', '--letter', 'a']]) refusedUnissued(args, /^Usage: /);
    refusedUnissued(['task-writer', UNIT, 'one'], /^task-id: "one" is not a phase/);
    refusedUnissued(['task-writer', 'nope', '1'], /^Work unit "nope" not found$/);
    refusedUnissued(['task-writer', 'draft', '1'], /^brief: draft's build has not begun — a phase is briefed once ready to build's yes begins it$/);
    refusedUnissued(['task-writer', UNIT, '4'], /^brief: pay's cut has no phase 4 — its phases are 1 to 3$/);
  });

  it('a phase not written, whose tasks and range the consolidation and the phase review draw', () => {
    for (const args of [['consolidation', UNIT, '3', '--base', 'main'], ['phase-review', UNIT, '3', '--base', 'main', '--head', 'main', '--letter', 'a']]) refusedUnissued(args, /^phase 3 of pay is not written — its tasks are written as it starts$/);
  });

  it('a cut naming a section or a scenario the spec lacks', () => {
    const manifest = JSON.parse(readState(dir, layout.manifest(UNIT)));
    const named = (/** @type {object} */ first) => writeState(dir, layout.manifest(UNIT), JSON.stringify({ ...manifest, cut: { phases: [{ ...CUT.phases[0], ...first }, ...CUT.phases.slice(1)] } }));
    named({ sections: ['1', '5'] });
    commitAll(dir, 'a section the spec lacks');
    refusedUnissued(['task-writer', UNIT, '1'], /^phase 1 of the cut names §5, which the spec lacks$/);
    named({ scenarios: ['1.S9'] });
    commitAll(dir, 'a scenario the spec lacks');
    refusedUnissued(['task-writer', UNIT, '1'], /^phase 1 of the cut holds 1\.S9, which the spec lacks$/);
  });

  it('a range\'s base no repository holding the phase\'s work has, tasks that are no one stack, and a phase no repository holds work on', () => {
    refusedUnissued(['phase-review', UNIT, '1', '--base', 'trunk', '--head', 'main', '--letter', 'a'], /^the base trunk is no local branch in any repository holding phase 1 of pay's tasks$/);
    git(dir, ['branch', '-f', branchOf(1, 4), 'main']);
    commitFile(dir, 'src/aside.js');
    git(dir, ['branch', '-f', branchOf(1, 4), 'HEAD']);
    git(dir, ['reset', '-q', '--hard', 'HEAD~1']);
    refusedUnissued(['consolidation', UNIT, '1', '--base', 'main'], new RegExp(`^phase 1 of pay's tasks are no one stack in the project's repository — ${branchOf(1, 1)}, ${branchOf(1, 2)}, ${branchOf(1, 4)} each hold work another lacks`));
    git(dir, ['branch', '-D', branchOf(2, 1)]);
    refusedUnissued(['phase-review', UNIT, '2', '--base', 'main', '--head', 'main', '--letter', 'a'], /^no repository of the project holds work on phase 2 of pay's tasks$/);
  });

  it('a head that is no commit of the project\'s repository, a mutation tool not yet run over the phase at the head, and no verify setup recorded', () => {
    const at = (/** @type {string} */ head) => ['phase-review', UNIT, '2', '--base', 'main', '--head', head, '--letter', 'a'];
    for (const head of ['nope', '-x']) refusedUnissued(at(head), new RegExp(`^${head} is no commit of the project's repository — the phase's runs are read at its HEAD there$`));
    const tip = tipOf(dir, branchOf(2, 1));
    refusedUnissued(at(branchOf(2, 1)), new RegExp(`^the mutation tool has not run over phase 2 of pay at ${tip} — engine verify mutants pay 2, run from the checkout at that HEAD, runs it$`));
    const project = JSON.parse(readState(dir, layout.projectManifest));
    writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { linters: LINTERS } }, null, 2));
    commitAll(dir, 'no verify setup');
    refusedUnissued(at(branchOf(2, 1)), /^the project has no verify setup recorded — /);
  });
});

describe('the build\'s agents (26.4, 26.5.3, 15.10.6)', () => {
  /** An agent's definition's frontmatter, by key. @param {string} agent @returns {Record<string, string>} */
  const frontmatter = (agent) => {
    const head = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8'))?.[1] ?? '';
    return Object.fromEntries(head.split('\n').map((line) => /^(\w+): (.*)$/.exec(line)).filter((match) => match !== null).map((match) => [match[1], match[2]]));
  };
  const BUILD = ['leeway-builder', 'leeway-reviewer', 'leeway-task-writer', 'leeway-consolidation'];

  it('15.S22: the builder\'s and the reviewer\'s definitions give each the Skill tool', () => {
    for (const agent of ['leeway-builder', 'leeway-reviewer']) assert.ok(frontmatter(agent).tools.split(', ').includes('Skill'), agent);
  });

  it('26.S7, 26.S8, 26.S11, 27.S7: the roster holds no other builder, reviewer, task writer or consolidation agent to pick, and no agent of it runs another model or above medium but the root-cause validation', () => {
    const roster = fs.readdirSync(AGENTS).filter((file) => file.endsWith('.md')).map((file) => file.slice(0, -'.md'.length));
    const variants = roster.filter((agent) => BUILD.some((build) => agent !== build && agent.startsWith(build)));
    assert.deepStrictEqual(variants, []);
    for (const agent of roster) {
      const { model, effort } = frontmatter(agent);
      assert.strictEqual(model, 'opus', agent);
      if (agent !== 'leeway-investigation-root-cause-validation') assert.ok(effort === undefined || effort === 'medium', `${agent}: ${effort}`);
    }
  });
});
