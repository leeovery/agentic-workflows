'use strict';

// ---------------------------------------------------------------------------
// The build's screens (leeway-engine/scripts/domain/build-screens.cjs, drawn
// by domain/projections/build.cjs) and task start's refusal in step
// (domain/task-verbs.cjs).
//
// Layer: verb. World, built once and copied: a feature, `pay`, its build
// begun in step, its cut three phases — Cards and Reports relying on
// nothing, Refunds on Cards — Cards started, Refunds written, Reports not yet written. Task 1.1 is in
// progress at its gate: its branch holds its work, its first round failed
// on a bug, its second passed, its account is taken, a run proved its
// scenario, one of its two criteria, and the ledger holds a call of
// Claude's made for it, one of the person's, and one of Claude's for 1.2.
// Task 1.2, not started, has its account taken after the orchestrator
// settled its one failed round, nothing differing from it. Task 1.3, linked
// after 1.2, has no account. Five questions are asked, waiting where a test
// parks them; a second world, made once from the first, has all five parked.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSectionsAsync, output, refusedPristine, git, writeState, readManifest, layout, commitAll, fixtureFrom, cleanupFixture, sectionOf, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest, templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { titlecase } = require(path.join(SCRIPTS, 'domain/conventions.cjs'));

const UNIT = 'pay';

const CUT = {
  phases: [
    { name: 'Cards', goal: 'Cards are taken.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'Refunds reach the card.', scenarios: ['2.S1'], sections: ['2'], relies_on: [1] },
    { name: 'Reports', goal: 'Reports add up.', scenarios: ['3.S1'], sections: ['3'], relies_on: [] },
  ],
};

/** The tasks the world writes, each `[phase, title, criteria]`. */
const TASKS = Object.freeze([
  [1, 'Take a card', ['1.S1 A card is taken at the till.', 'A taken card shows its last four digits.']],
  [1, 'Show a receipt', ['1.S2 A charge prints its receipt.']],
  [1, 'Mail the receipt', ['A receipt is mailed to the customer.']],
  [2, 'Refund a card', ['2.S1 A refund reaches the card.']],
]);

/** A task's file of the template. @param {string} title @param {string[]} criteria */
const taskText = (title, criteria) => [
  `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
  '## Outcome', `${title} works at the till, and the customer sees it.`, '', '## Acceptance scenarios', ...criteria.map((criterion) => `- ${criterion}`), '', '## Spec reference', '§1', '',
].join('\n');

/** A reviewer's report of the findings given, each `[call, text]`. @param {Array<[string, string]>} findings */
function reportOf(findings) {
  const items = findings.map(([call, text]) => `- ${call}: ${text}\n  Scenario: a customer meets it.`);
  return `## Findings\n\n${items.length === 0 ? 'None.' : items.join('\n')}\n\nVerdict: ${findings.every(([call]) => call === 'nit') ? 'pass' : 'fail'}\n`;
}

/** Task 1.1's account. */
const ACCOUNT = [
  '## What was done', 'A card is taken at the till, and the receipt line names its last four digits.',
  '## Where in the code', 'The till and the card.\n\n- src/card.js: the card taken and masked\n- src/till.js: the till asks for the card',
  '## What the tests prove', 'Two tests take a card and read its masked digits back.',
  '```text\ntill ──▶ card ──▶ receipt\n```',
  '## Differs from the task', '- The till also beeps once the card is taken, which the task did not ask for.',
  '## Reviews', '### Round 1', 'The digits were shown whole; the builder masked them.', '### Round 2', 'Passed.',
].join('\n\n');

/** Task 1.2's account, its one round settled. */
const SETTLED_ACCOUNT = [
  '## What was done', 'A charge prints its receipt.', '## Where in the code', '- src/receipt.js', '## What the tests prove', '- A charge prints one receipt.',
  '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'A void charge printed a receipt.', '### Settled', 'A void charge is the refunds phase\'s.',
].join('\n\n');

/**
 * A task's branch from main holding a commit naming it for each file given:
 * its tip.
 * @param {string} dir @param {number} n the task of phase 1 @param {string} title @param {Array<[string, string]>} files
 */
function branchWith(dir, n, title, files) {
  git(dir, ['checkout', '-q', '-b', taskBranch({ unit: UNIT, phase: 1, n }, 'feat', title), 'main']);
  for (const [name, text] of files) {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', `feat(${UNIT}): ${name}\n\nLeeway-Task: ${UNIT}-1-${n}`]);
  }
  const tip = git(dir, ['rev-parse', 'HEAD']).trim();
  git(dir, ['checkout', '-q', 'main']);
  return tip;
}

/** A ledger write that must succeed: its short id. @param {string} dir @param {string} verb @param {string[]} flags @param {object} content */
const write = (dir, verb, flags, content) => ok(dir, ['ledger', verb, `${UNIT}.implementation`, ...flags], { env: { CLAUDE_CODE_SESSION_ID: 'world' }, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', ...content }) }).id;

/** A call made for `task`, Claude's unless `by` says. @param {string} dir @param {string} task @param {string} text @param {string} [by] */
function callFor(dir, task, text, by = 'claude') {
  const question = write(dir, 'ask', [], { text: `What of ${text}?` });
  write(dir, 'decide', ['--answers', question, '--task', task], { by, text, why: 'The till needs it.' });
}

/** The questions the world asks, which a test parks tasks on. */
const QUESTIONS = Object.freeze([
  'Does a refund print a receipt?', 'Is a refund capped at the charge?', 'Does a void charge show on the statement?', 'Is the receipt mailed or printed?', 'Does the till keep the card?',
]);

/** The questions a test parks: their short ids, in order. */
const made = { asked: /** @type {string[]} */ ([]) };

const world = fixtureFrom('engine-build-screens-', (dir) => {
  createManifest(dir, UNIT, { build: { position: 'step' }, cut: CUT, checklists: { 'phase-1-start': { items: {}, closed: FROZEN_AT } } });
  commitAll(dir, 'the world');
  const file = path.join(templateFolder('engine-build-screens-files-'), 'task.md');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  ok(dir, ['task', 'phase', UNIT, '2', '--title', 'Refunds']);
  for (const [phase, title, criteria] of TASKS) {
    fs.writeFileSync(file, taskText(/** @type {string} */ (title), /** @type {string[]} */ (criteria)));
    ok(dir, ['task', 'create', UNIT, String(phase), '--file', file]);
  }
  ok(dir, ['task', 'link', UNIT, '1.3', '--after', '1.2']);
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-screens-world-'));
  try {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'world' } });
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
  const tip = branchWith(dir, 1, 'Take a card', [['src/card.js', 'export const card = 1;\n'], ['src/till.js', 'export const till = 1;\nexport const beep = 2;\n']]);
  branchWith(dir, 2, 'Show a receipt', [['src/receipt.js', 'export const receipt = 1;\n']]);
  for (const [task, round, letter, findings] of /** @type {Array<[string, number, string, Array<[string, string]>]>} */ ([
    ['1.1', 1, 'a', [['bug', 'The digits show whole.']]], ['1.1', 1, 'b', [['bug', 'The digits show whole.'], ['serious', 'The digits are logged.'], ['nit', 'A stray comment.']]], ['1.1', 2, 'a', []], ['1.1', 2, 'b', [['nit', 'A name.']]],
    ['1.2', 1, 'a', [['bug', 'A void charge prints a receipt.']]], ['1.2', 1, 'b', []],
  ])) writeState(dir, layout.unit(UNIT, `build/tasks/${task}/round-${round}-${letter}.md`), reportOf(findings));
  writeState(dir, layout.unit(UNIT, 'build/tasks/1.1.md'), ACCOUNT);
  writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), SETTLED_ACCOUNT);
  writeState(dir, layout.unit(UNIT, 'build/runs/1.S1/run-001.json'), JSON.stringify({
    verdict: 'pass', unfixed: false, at: FROZEN_AT, checkout: dir, commits: [{ repo: '.', commit: tip }], task: '1.1', evidence: [], recordings: [],
  }));
  commitAll(dir, 'the work');
  ok(dir, ['task', 'account', UNIT, '1.1']);
  fs.writeFileSync(file, 'A void charge is the refunds phase\'s.\n');
  ok(dir, ['task', 'settle', UNIT, '1.2', '--file', file]);
  ok(dir, ['task', 'account', UNIT, '1.2']);
  callFor(dir, '1.1', 'The till masks the digits');
  callFor(dir, '1.1', 'The till beeps', 'person');
  callFor(dir, '1.2', 'The receipt is printed');
  made.asked = QUESTIONS.map((text) => write(dir, 'ask', [], { text }));
});

let dir = ''; // the project
let config = ''; // the system config: the conversations' folders

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-screens-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true });
});

/** The engine as the conversation runs it. */
const env = () => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' });

/** A screen that must draw: its sections. @param {string[]} args */
const screen = (args) => output(dir, ['render', ...args], { env: env() });

/** A screen that must refuse, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['render', ...args], { env: env() }).error;

/** Claude's call on the first question, which a test parks tasks on — on another, asking that. */
const CALL = Object.freeze({
  question: QUESTIONS[0],
  rows: [
    { key: '1', name: 'Print', text: 'A refund prints a receipt', notice: 'the customer holds proof of the refund' },
    { key: '2', name: 'None', text: 'A refund prints nothing', notice: 'the refund shows only on the statement' },
  ],
  lean: '1',
  why: 'A customer keeps proof.',
  sort: 'several',
  mechanism: 'The till prints on refund.',
  product_wide: false,
});

/** One of the world's questions, the first unless `at` says, parked on each task given, as a builder's call parks it. @param {string[]} tasks @param {number} [at] */
async function parkOn(tasks, at = 0, into = dir) {
  const call = { ...CALL, question: QUESTIONS[at] };
  const { conversation } = raiseHelpers(() => into, () => config, call);
  for (const task of tasks) {
    await okSectionsAsync(into, ['raise', `${UNIT}.implementation`, '--answers', made.asked[at], '--parks', task], { env: conversation(), stdin: JSON.stringify(call) });
  }
}

/** Where the world's five questions park: Q1 and Q5 task 1.1, Q2 and Q4 task 1.2, Q3 task 2.1. */
const FIVE = Object.freeze([['1.1'], ['1.2'], ['2.1'], ['1.2'], ['1.1']]);

/** The world with its five questions parked as FIVE says, made once. @type {{template: string|null}} */
const fiveParked = { template: null };

/** The test's project made a copy of the world with its five questions parked. */
async function parkFive() {
  if (fiveParked.template === null) {
    const template = world(templateFolder('engine-build-screens-five-template-'));
    for (const [at, tasks] of FIVE.entries()) await parkOn(tasks, at, template);
    fiveParked.template = template;
  }
  cleanupFixture(dir);
  dir = copyWorld(fiveParked.template, fs.mkdtempSync(path.join(os.tmpdir(), 'engine-build-screens-five-')));
}

/** The unit's build switched to a position, through its door. @param {'auto'|'step'} to */
const position = (to) => ok(dir, ['workunit', 'position', UNIT, to], { env: env() });

/** The product's name as running it is said. */
const product = () => titlecase(path.basename(dir)).toUpperCase();

/** Task 1.1's account as its gate and its print draw it, above anything the print adds. */
const ACCOUNT_DRAWN = [
  '▪ Take a card (task 1.1)',
  '',
  '✓ Passed its review in round 2, after 1 round of fixes',
  '',
  '- Phase: 1 — Cards',
  '- Position: 1 of 3 in phase',
  '',
  'WHAT IT DOES',
  '  Take a card works at the till, and the customer sees it.',
  '',
  'WHAT WAS DONE',
  '  A card is taken at the till, and the receipt line names its',
  '  last four digits.',
  '  · The till and the card.',
  '  · src/card.js: the card taken and masked',
  '  · src/till.js: the till asks for the card',
  '  · Two tests take a card and read its masked digits back.',
  '    till ──▶ card ──▶ receipt',
  '  ✓ Proves 2 criteria · 2 files changed · +3 −0',
  '',
  'DIFFERS FROM THE TASK (1)',
  '  △ The till also beeps once the card is taken, which the task',
  '    did not ask for.',
].join('\n');

describe('the gate after a task, in step (12.14.3, 12.12.7, 3.3.8, 13.4.7)', () => {
  it('carries the task\'s description, its account and diagrams, its verdict with the round it passed in after its rounds of fixes, and the engine\'s figures, then asks — no review report printed (3.S16, 12.S27, 12.S41, 13.S19)', () => {
    const out = screen(['step-gate', UNIT, '1.1']);

    assert.strictEqual(sectionOf(out, 'DISPLAY: step gate'), `${ACCOUNT_DRAWN}\n`);
    assert.strictEqual(sectionOf(out, 'MENU: step gate — 1.1'), [
      '· · · · · · · · · · · ·',
      '**`◆ Approve this task?`**',
      '',
      '**`y/yes`**       → Approve it and continue to the next task',
      '**`a/auto`**      → Approve it and run the rest of the build in auto',
      '**`t/technical`** → Retell the result from the code\'s perspective',
      '**`s/show`**      → Show the result as diagrams',
      '**Ask**         → Ask questions about the task (doesn\'t approve or',
      `${'\u00a0'.repeat(14)}reject)`,
      '**Comment**     → Request changes',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /The digits show whole|Verdict:/, 'no review report is printed (12.12.6)');
  });

  it('a/auto runs the rest of the build in auto through the door verb; yes, the technical retelling and the diagrams carry on as the workflow says (3.S20, 3.3.6)', () => {
    const picked = Object.fromEntries(['y', 't', 's', 'a'].map((key) => {
      screen(['step-gate', UNIT, '1.1']);
      return [key, ok(dir, ['gate', 'step gate', '--pick', key], { env: env() }).next];
    }));
    ok(dir, picked.a.argv, { env: env() });

    assert.deepStrictEqual(picked, {
      y: { kind: 'continue' }, t: { kind: 'continue' }, s: { kind: 'continue' }, a: { kind: 'engine', argv: ['workunit', 'position', UNIT, 'auto'] },
    });
    assert.match(refused(['step-gate', UNIT, '1.1']), /^render step-gate: pay builds in auto, where no gate follows a task — /, 'in auto no gate follows a task (3.S17)');
  });

  it('is refused before the task\'s account is taken, once the task is done, and in auto — writing nothing', () => {
    const seen = [refused(['step-gate', UNIT, '1.3'])];
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    seen.push(refused(['step-gate', UNIT, '1.1']));
    position('auto');
    seen.push(refused(['step-gate', UNIT, '1.1']), refused(['step-gate', UNIT]));

    assert.deepStrictEqual(seen, [
      'render step-gate: task 1.3 of pay has no account taken — it lands once its account is: task account pay 1.3',
      'render step-gate: task 1.1 of pay is done — its gate comes as it lands, before task done',
      'render step-gate: pay builds in auto, where no gate follows a task — the person meets only danger, the authority gates and the questions parked',
      'render step-gate: Usage: engine render step-gate <work-unit> <task>',
    ]);
  });
});

describe('the landing summary (12.12.5, 12.12.6)', () => {
  it('says what changed, the criteria its tests prove, what running the product proved with the proof a press away, the pair\'s verdict and rounds and the task\'s calls — and beneath it the questions waiting, none here (12.S26, 12.S54, 12.S55)', () => {
    const out = screen(['task-landed', UNIT, '1.1']);

    assert.strictEqual(sectionOf(out, 'DISPLAY: task landed'), [
      '▪ Take a card (task 1.1)',
      '',
      '✓ Landed — its reviewer pair passed it in round 2, after 1',
      '  round of fixes · 1 call went to the ledger',
      '',
      'WHAT CHANGED',
      '  A card is taken at the till, and the receipt line names its',
      '  last four digits.',
      '',
      'ITS TESTS PROVE (2)',
      '  ├─ A card is taken at the till.',
      '  └─ A taken card shows its last four digits.',
      '',
      `RUNNING ${product()} PROVED 1 OF 1`,
      '  ↳ The proof is on 1.1\'s page on the board.',
      '',
      'NO QUESTIONS WAITING FOR YOU',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /The digits show whole|Verdict:|=== MENU/, 'no review report, and no gate (12.12.6)');
  });

  it('beneath it, every question waiting: their count, then a line each with the tasks it parks (12.S26, 12.13.7)', async () => {
    await parkOn(['1.2', '1.3']);
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf('1 QUESTION WAITING FOR YOU')), ['1 QUESTION WAITING FOR YOU', `  └─ ⚑ Q1 ${CALL.question} · parks 1.2 and 1 more`, '']);
  });

  it('with five questions waiting, the count reads five and each has its line (12.S26)', async () => {
    await parkFive();
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf('5 QUESTIONS WAITING FOR YOU')), [
      '5 QUESTIONS WAITING FOR YOU',
      `  ├─ ⚑ Q1 ${QUESTIONS[0]} · parks 1.1`,
      `  ├─ ⚑ Q2 ${QUESTIONS[1]} · parks 1.2`,
      `  ├─ ⚑ Q3 ${QUESTIONS[2]} · parks 2.1`,
      `  ├─ ⚑ Q4 ${QUESTIONS[3]} · parks 1.2`,
      `  └─ ⚑ Q5 ${QUESTIONS[4]} · parks 1.1`,
      '',
    ]);
  });

  it('a task whose last round the orchestrator settled says so, and one no run proves reads not proven', () => {
    const lines = sectionOf(screen(['task-landed', UNIT, '1.2']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual([lines.slice(2, 4), lines.slice(lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`), lines.indexOf('NO QUESTIONS WAITING FOR YOU'))], [
      ['✓ Landed — the orchestrator settled its review in round 1 · 1', '  call went to the ledger'],
      [`RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Not proven: A charge prints its receipt.', ''],
    ]);
  });

  it('a scenario its runs no longer prove at the task\'s code reads not proven, in its criterion\'s words', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S1/run-002.json'), JSON.stringify({ ...run, verdict: 'fail', at: '2026-12-01T00:00:00.000Z' }));
    const lines = sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').split('\n');
    const at = lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`);

    assert.deepStrictEqual(lines.slice(at, at + 3), [`RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Not proven: A card is taken at the till.', '  ↳ The proof is on 1.1\'s page on the board.']);
  });

  it('a run at code the task\'s branch does not hold — another task\'s — never counts for it, however late', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    const elsewhere = git(dir, ['rev-parse', taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Show a receipt')]).trim();
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S1/run-002.json'), JSON.stringify({ ...run, verdict: 'fail', at: '2026-12-01T00:00:00.000Z', commits: [{ repo: '.', commit: elsewhere }] }));

    assert.ok(sectionOf(screen(['task-landed', UNIT, '1.1']), 'DISPLAY: task landed').includes(`RUNNING ${product()} PROVED 1 OF 1\n`));
  });

  it('a scenario whose only run at the task\'s code was skipped reads named, not run, and no proof is pointed to', () => {
    const run = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', UNIT, 'build/runs/1.S1/run-001.json'), 'utf8'));
    const tip = git(dir, ['rev-parse', taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Show a receipt')]).trim();
    writeState(dir, layout.unit(UNIT, 'build/runs/1.S2/run-001.json'), JSON.stringify({ ...run, verdict: 'skipped', task: '1.2', commits: [{ repo: '.', commit: tip }] }));
    const lines = sectionOf(screen(['task-landed', UNIT, '1.2']), 'DISPLAY: task landed').split('\n');

    assert.deepStrictEqual(lines.slice(lines.indexOf(`RUNNING ${product()} PROVED 0 OF 1`), lines.indexOf('NO QUESTIONS WAITING FOR YOU')), [
      `RUNNING ${product()} PROVED 0 OF 1`, '  └─ △ Named, not run: A charge prints its receipt.', '',
    ]);
  });

  it('is refused before the task\'s account is taken, for a task the tracker lacks, and for a unit the project lacks, writing nothing', () => {
    assert.deepStrictEqual([refused(['task-landed', UNIT, '1.3']), refused(['task-landed', UNIT, '1.9']), refused(['task-landed', 'nothing', '1.1'])], [
      'render task-landed: task 1.3 of pay has no account taken — it lands once its account is: task account pay 1.3',
      'render task-landed: task 1.9 of pay is not in the tracker',
      'render task-landed: there is no work unit "nothing"',
    ]);
  });
});

describe('a task\'s account, printed when asked (12.14.1, 12.14.2)', () => {
  it('any task\'s: its description and account with its diagrams, and each round\'s summary under its heading, a settlement\'s among them; nothing differing said so; one not yet landed says no account is written', () => {
    const printed = ['1.1', '1.2', '1.3'].map((task) => sectionOf(screen(['task-account', UNIT, task]), 'DISPLAY: task account'));

    assert.deepStrictEqual(printed, [
      [
        ACCOUNT_DRAWN,
        '',
        'REVIEWS',
        '  Round 1',
        '    The digits were shown whole; the builder masked them.',
        '  Round 2',
        '    Passed.',
        '',
      ].join('\n'),
      [
        '▪ Show a receipt (task 1.2)',
        '',
        '✓ Settled by the orchestrator in round 1',
        '',
        '- Phase: 1 — Cards',
        '- Position: 2 of 3 in phase',
        '',
        'WHAT IT DOES',
        '  Show a receipt works at the till, and the customer sees it.',
        '',
        'WHAT WAS DONE',
        '  A charge prints its receipt.',
        '  · src/receipt.js',
        '  · A charge prints one receipt.',
        '  ✓ Proves 1 criterion · 1 file changed · +1 −0',
        '',
        'DIFFERS FROM THE TASK',
        '  Nothing: it was built as the task was written.',
        '',
        'REVIEWS',
        '  Round 1',
        '    A void charge printed a receipt.',
        '  Settled',
        '    A void charge is the refunds phase\'s.',
        '',
      ].join('\n'),
      [
        '▪ Mail the receipt (task 1.3)',
        '',
        '- Phase: 1 — Cards',
        '- Position: 3 of 3 in phase',
        '',
        'WHAT IT DOES',
        '  Mail the receipt works at the till, and the customer sees it.',
        '',
        '  No account is written yet: its builder writes it as the task lands.',
        '',
      ].join('\n'),
    ]);
  });

  it('a task closed keeps its place among every task of its phase, and with no account says it closed without one', () => {
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Folded into 1.1.'], { env: env() });
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Mailing waits for later.'], { env: env() });
    const [receipt, mail] = ['1.2', '1.3'].map((task) => sectionOf(screen(['task-account', UNIT, task]), 'DISPLAY: task account').split('\n'));
    const place = (/** @type {string[]} */ lines) => lines.find((line) => line.startsWith('- Position'));

    assert.deepStrictEqual([place(receipt), place(mail), mail.at(-2)], ['- Position: 2 of 3 in phase', '- Position: 3 of 3 in phase', '  No account was written: it closed without one.']);
  });
});

describe('the headline (12.12.4)', () => {
  it('names the tasks started together in one block, each with its number, title and phase, what it is about to change and what to watch, under the build\'s step marker (12.S25, 3.3.10)', () => {
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    const payload = writeState(dir, layout.cache(UNIT, 'headline.json'), JSON.stringify({
      tasks: [
        { task: '1.1', changes: 'The till takes a card.', watch: 'The last four digits on the receipt.' },
        { task: '1.2', changes: 'A charge prints its receipt.', watch: 'The receipt prints once a charge, never twice.' },
      ],
    }));
    const out = screen(['build-headline', UNIT, '--file', payload]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Build (phase 1 of 3) · auto`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build headline'), [
      '▪ Starting 2 tasks',
      '',
      '  ├─ 1.1 Take a card',
      '  │     Phase 1 · Cards',
      '  │     About to change: The till takes a card.',
      '  │     Watch when it lands: The last four digits on the',
      '  │       receipt.',
      '  │',
      '  └─ 1.2 Show a receipt',
      '        Phase 1 · Cards',
      '        About to change: A charge prints its receipt.',
      '        Watch when it lands: The receipt prints once a charge,',
      '          never twice.',
      '',
    ].join('\n'));
  });

  it('is refused for a task not started, a task named twice, no task, and a payload of another shape, writing nothing', () => {
    const payload = (/** @type {unknown} */ given) => writeState(dir, layout.cache(UNIT, 'headline.json'), JSON.stringify(given));
    const named = (/** @type {string} */ task) => ({ task, changes: 'A change.', watch: 'A thing.' });
    const refusals = [
      { tasks: [named('1.2')] }, { tasks: [named('1.1'), named('1.1')] }, { tasks: [] }, { tasks: [{ ...named('1.1'), changes: ' ' }] }, { tasks: [named('1.1')], more: 1 },
    ].map((given) => refused(['build-headline', UNIT, '--file', payload(given)]));

    assert.deepStrictEqual([...refusals, refused(['build-headline', UNIT])], [
      'render build-headline: task 1.2 of pay is not started — the headline names tasks as they start: task start pay 1.2',
      'render build-headline: the payload names task 1.1 twice',
      'render build-headline: the payload names the tasks started together, one at least',
      'render build-headline: tasks[0]\'s task, changes and watch are each words',
      'render build-headline: the payload must be {tasks}',
      'render build-headline: Usage: engine render build-headline <work-unit> --file <payload.json>',
    ]);
  });
});

describe('the build\'s phases and tasks, printed when asked (12.12.11, 7.4.2)', () => {
  it('each phase of the cut with its state, its tasks with theirs and what holds them — a task after another, a phase after one it relies on — and a phase not yet written drawn from the cut, under the step marker naming the position (12.S51, 3.S19)', () => {
    const out = screen(['build-progress', UNIT]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build marker'), '**`□ Build (phase 1 of 3) · step`**\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build progress'), [
      '0 of 4 tasks done · 1 running',
      '',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  ├─ ◐ 1.1 Take a card         [in progress]',
      '  │  ├─ ○ 1.2 Show a receipt      [not started]',
      '  │  └─ ○ 1.3 Mail the receipt    [after 1.2]',
      '  │',
      '  ├─ Phase 2 of 3 · Refunds       [written · after phase 1]',
      '  │  └─ ○ 2.1 Refund a card       [not started]',
      '  │',
      '  └─ Phase 3 of 3 · Reports       [not yet written]',
      '',
    ].join('\n'));
  });

  it('a task a question parks waits on it and runs no more, and a phase whose review owes fixes says so in the standing\'s words; the marker names the position it was switched to (3.S19)', async () => {
    await parkOn(['1.1', '1.2']);
    for (const [letter, findings] of /** @type {Array<[string, Array<[string, string]>]>} */ ([['a', []], ['b', [['bug', 'A refund on a closed till.']]]])) {
      writeState(dir, layout.unit(UNIT, `build/phases/phase-1/review-${letter}.md`), reportOf(findings));
    }
    position('auto');
    const auto = sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build marker');
    position('step');
    const out = screen(['build-progress', UNIT]);

    assert.deepStrictEqual([auto, sectionOf(out, 'DISPLAY: build marker')], ['**`□ Build (phase 1 of 3) · auto`**\n', '**`□ Build (phase 1 of 3) · step`**\n']);
    assert.deepStrictEqual(sectionOf(out, 'DISPLAY: build progress').split('\n').slice(0, 9), [
      '0 of 4 tasks done · 0 running',
      '',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  │  ⚑ fixes owed: phase 1\'s review failed, and no',
      '  │  │    settlement answers it — write its fixes as tasks of the',
      '  │  │    phase, then settle it, naming them: task settle pay',
      '  │  │    --phase 1 --file <why> [--fixes <task>,…]',
      '  │  ├─ ⚑ 1.1 Take a card         [waits on Q1]',
      '  │  ├─ ⚑ 1.2 Show a receipt      [waits on Q1]',
    ]);
  });

  it('a phase waits after another unit it relies on only while that unit is not finished', () => {
    const manifest = readManifest(dir, UNIT);
    manifest.cut.phases[1].relies_on = ['billing'];
    writeState(dir, layout.manifest(UNIT), JSON.stringify(manifest, null, 2));
    const tagged = () => sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build progress').split('\n').find((line) => line.includes('Refunds'));
    const before = tagged();
    createManifest(dir, 'billing', { status: 'completed' });

    assert.deepStrictEqual([before, tagged()], ['  ├─ Phase 2 of 3 · Refunds       [written · after billing]', '  ├─ Phase 2 of 3 · Refunds       [written]']);
  });
});

describe('a task linked after another (12.6.4)', () => {
  it('waits after it only while it is not done', () => {
    const tagged = () => sectionOf(screen(['build-progress', UNIT]), 'DISPLAY: build progress').split('\n').find((line) => line.includes('1.3 Mail the receipt'));
    const before = tagged();
    position('auto');
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: env() });

    assert.deepStrictEqual([before, tagged()], ['  │  └─ ○ 1.3 Mail the receipt    [after 1.2]', '  │  └─ ○ 1.3 Mail the receipt    [not started]']);
  });
});

describe('the stop report (12.12.9, 12.13.22)', () => {
  it('when every task left is parked or waits after one that is: the build stopped, the five questions waiting first with a line each, what was built, and what each answer lets run (12.S38, 12.S26)', async () => {
    await parkFive();
    const out = screen(['build-stop', UNIT]);

    assert.strictEqual(sectionOf(out, 'DISPLAY: build stop'), '⚑ The build has stopped: nothing more can be built until you answer\n');
    assert.strictEqual(sectionOf(out, 'DISPLAY: build stop report'), [
      '5 QUESTIONS WAITING FOR YOU',
      `  ├─ ⚑ Q1 ${QUESTIONS[0]} · parks 1.1`,
      `  ├─ ⚑ Q2 ${QUESTIONS[1]} · parks 1.2`,
      `  ├─ ⚑ Q3 ${QUESTIONS[2]} · parks 2.1`,
      `  ├─ ⚑ Q4 ${QUESTIONS[3]} · parks 1.2`,
      `  └─ ⚑ Q5 ${QUESTIONS[4]} · parks 1.1`,
      '',
      'WHAT WAS BUILT',
      '  0 of 4 tasks done · 0 running',
      '  ├─ Phase 1 of 3 · Cards         [running]',
      '  │  ├─ ⚑ 1.1 Take a card         [waits on Q1, Q5]',
      '  │  ├─ ⚑ 1.2 Show a receipt      [waits on Q2, Q4]',
      '  │  └─ ○ 1.3 Mail the receipt    [after 1.2]',
      '  │',
      '  ├─ Phase 2 of 3 · Refunds       [written · after phase 1]',
      '  │  └─ ⚑ 2.1 Refund a card       [waits on Q3]',
      '  │',
      '  └─ Phase 3 of 3 · Reports       [not yet written]',
      '',
      'WHAT RUNS ONCE YOU ANSWER',
      '  ├─ Q1',
      '  │     1.1 Take a card',
      '  ├─ Q2',
      '  │     1.2 Show a receipt',
      '  │     then 1.3',
      '  ├─ Q3',
      '  │     2.1 Refund a card',
      '  ├─ Q4',
      '  │     1.2 Show a receipt',
      '  │     then 1.3',
      '  └─ Q5',
      '        1.1 Take a card',
      '',
    ].join('\n'));
  });

  it('is refused while no question waits, and while a task can still be built — one in progress or one ready that no question parks — writing nothing (12.12.9, 12.13.22)', async () => {
    const none = refused(['build-stop', UNIT]);
    await parkOn(['1.2']);
    const running = refused(['build-stop', UNIT]);
    await parkOn(['1.1'], 1);

    assert.deepStrictEqual([none, running, refused(['build-stop', UNIT])], [
      'render build-stop: no question waits on the person in pay\'s build — it stops only where nothing can go on without their answer (12.13.22)',
      'render build-stop: pay\'s build goes on with task 1.1, which no question parks — it stops only where nothing can go on without the person\'s answer (12.13.22)',
      'render build-stop: pay\'s build goes on with task 2.1, which no question parks — it stops only where nothing can go on without the person\'s answer (12.13.22)',
    ]);
  });
});

/** A phase of the review's fixes past the cut, phase 4, written with a task of each title given. @param {string[]} titles */
function fixPhase(titles) {
  ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes'], { env: env() });
  for (const title of titles) {
    fs.writeFileSync(path.join(config, 'fix.md'), taskText(title, [`${title} works.`]));
    ok(dir, ['task', 'create', UNIT, '4', '--file', path.join(config, 'fix.md')], { env: env() });
  }
}

describe('the gate before a phase\'s stack merges, in step (7.2.4)', () => {
  it('stops once the phase review passed, its yes merging the phase through land phase (7.S8)', () => {
    for (const letter of ['a', 'b']) writeState(dir, layout.unit(UNIT, `build/phases/phase-1/review-${letter}.md`), reportOf([]));
    const out = screen(['phase-merge-gate', UNIT, '1']);
    const next = ok(dir, ['gate', 'phase merge', '--pick', 'y'], { env: env() }).next;

    assert.strictEqual(sectionOf(out, 'MENU: phase merge — 1'), [
      '· · · · · · · · · · · ·',
      'Phase 1, "Cards", is ready to merge: its tasks land on the default branch as one stack.',
      '',
      '**`◆ Merge phase 1?`**',
      '',
      '**`y/yes`**   → Merge it and carry on with the build',
      '**Comment** → Tell me what to change before it merges',
      '',
    ].join('\n'));
    assert.deepStrictEqual(next, { kind: 'engine', argv: ['land', 'phase', UNIT, '1'] });
  });

  it('a phase of the review\'s fixes, named for its round, stops once its tasks are done, and is refused before and once it has merged, writing nothing', () => {
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    fixPhase(['Mask the reprint']);
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: env() });
    const before = refused(['phase-merge-gate', UNIT, '4']);
    ok(dir, ['task', 'done', UNIT, '4.1'], { env: env() });
    const ready = screen(['phase-merge-gate', UNIT, '4']);
    git(dir, ['commit', '-q', '--allow-empty', '-m', `fix(${UNIT}): landed`, '-m', `Task: ${UNIT}-4-1`]);

    assert.deepStrictEqual([before, refused(['phase-merge-gate', UNIT, '4'])], [
      'render phase-merge-gate: phase 4 of pay merges once its tasks are done — task 4.1 is in progress',
      'render phase-merge-gate: phase 4 of pay is merged already — its tasks are on the default branch',
    ]);
    assert.match(ready, /Phase 4, "the review's fixes, round 1", is ready to merge/);
  });

  it('is refused for a phase the tracker lacks, before the phase review passed, in auto, and for no phase, writing nothing', () => {
    const before = [refused(['phase-merge-gate', UNIT, '9']), refused(['phase-merge-gate', UNIT, '1'])];
    position('auto');

    assert.deepStrictEqual([...before, refused(['phase-merge-gate', UNIT, '1']), refused(['phase-merge-gate', UNIT, 'one']), refused(['phase-merge-gate', UNIT])], [
      'render phase-merge-gate: phase 9 of pay is not written — no stack of its waits to merge',
      'render phase-merge-gate: phase 1 of pay merges once its phase review has passed and its fixes are done — phase 1 of pay has no phase review reported — its reviewers write their reports in pay/build/phases/phase-1/',
      'render phase-merge-gate: pay builds in auto, where a phase\'s stack merges with no gate — the person meets only danger, the authority gates and the questions parked',
      'render phase-merge-gate: task-id: "one" is not a phase — it is a whole number from 1',
      'render phase-merge-gate: Usage: engine render phase-merge-gate <work-unit> <N>',
    ]);
  });
});

describe('task start in step: one task at a time (12.7.9)', () => {
  it('refuses a task while another of the unit\'s is in flight or at its gate, writing nothing; in auto both start (12.S52)', () => {
    const error = refusedPristine(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).error;
    position('auto');

    assert.strictEqual(error, 'task start: pay builds in step, one task at a time — task 1.1 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
    assert.strictEqual(ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() }).task, '1.2');
  });

  it('holds the next while a task of the review\'s fixes past the cut is in progress, started in another conversation, writing nothing', () => {
    ok(dir, ['task', 'done', UNIT, '1.1'], { env: env() });
    fixPhase(['Mask the reprint', 'Mask the copy']);
    ok(dir, ['task', 'start', UNIT, '4.1'], { env: { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2' } });

    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '4.2'], { env: env() }).error,
      'task start: pay builds in step, one task at a time — task 4.1 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
  });

  it('starts the next while a question parks the task in flight — a parked task holds nothing new to test — and starts the task in flight again; the next waits on the one then in flight', async () => {
    ok(dir, ['task', 'start', UNIT, '1.1'], { env: env() });
    await parkOn(['1.1']);
    ok(dir, ['task', 'start', UNIT, '1.2'], { env: env() });

    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '1.3'], { env: env() }).error,
      'task start: pay builds in step, one task at a time — task 1.2 is in flight or at its gate, and the next starts once the person\'s go there is given and it is done');
  });
});
