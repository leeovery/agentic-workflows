'use strict';

// ---------------------------------------------------------------------------
// What the build's screens suites share (test-engine-build-screens.cjs, the
// screens that report; test-engine-build-gates.cjs, the gates;
// test-engine-build-step.cjs, step's one task at a time): the world, built
// once a process and copied (`buildScreensWorld`), and over a test's
// project and system config, the calls its tests make (`buildScreenHelpers`).
//
// The world: a feature, `pay`, its build begun in step, its cut three
// phases — Cards and Reports relying on nothing, Refunds on Cards — Cards
// started, Refunds written, Reports not yet written. Task 1.1 is in progress
// at its gate: its branch holds its work, its first round failed on a bug,
// its second passed, its account is taken, a run proved its scenario, one of
// its two criteria, and the ledger holds a call of Claude's made for it, one
// of the person's, and one of Claude's for 1.2. Task 1.2, not started, has
// its account taken after the orchestrator settled its one failed round,
// nothing differing from it. Task 1.3, linked after 1.2, has no account.
// Five questions are asked, waiting where a test parks them; and a test may
// park a task on a replacement of the call for 1.2 (`proposeOn`), and enter
// the build in another conversation, as a /clear leaves it (`takenOver`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, okSections, okSectionsAsync, output, refusedPristine, git, writeState, createFile, layout, commitAll, fixtureFrom, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest, templateFolder } = require('./discovery-test-utils.cjs');
const { raiseHelpers } = require('./raise-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

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

/** A call made for `task`, Claude's unless `by` says: its short id. @param {string} dir @param {string} task @param {string} text @param {string} [by] */
function callFor(dir, task, text, by = 'claude') {
  const question = write(dir, 'ask', [], { text: `What of ${text}?` });
  return write(dir, 'decide', ['--answers', question, '--task', task], { by, text, why: 'The till needs it.' });
}

/** The questions the world asks, which a test parks tasks on. */
const QUESTIONS = Object.freeze([
  'Does a refund print a receipt?', 'Is a refund capped at the charge?', 'Does a void charge show on the statement?', 'Is the receipt mailed or printed?', 'Does the till keep the card?',
]);

/** The questions a test parks, their short ids in order, and the call for 1.2 a test proposes to replace. */
const made = { asked: /** @type {string[]} */ ([]), printed: '' };

const buildScreensWorld = fixtureFrom('engine-build-screens-', (dir) => {
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
  made.printed = callFor(dir, '1.2', 'The receipt is printed');
  made.asked = QUESTIONS.map((text) => write(dir, 'ask', [], { text }));
});

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

/**
 * The calls a test makes, over its project and its system config.
 * @param {() => string} dir @param {() => string} config
 */
function buildScreenHelpers(dir, config) {
  /** The engine as the conversation runs it. */
  const env = () => ({ LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1' });

  /** A screen that must draw: its sections. @param {string[]} args */
  const screen = (args) => output(dir(), ['render', ...args], { env: env() });

  /** A screen that must refuse, writing nothing: its error. @param {string[]} args */
  const refused = (args) => refusedPristine(dir(), ['render', ...args], { env: env() }).error;

  /** The unit's build switched to a position, through its door. @param {'auto'|'step'} to */
  const position = (to) => ok(dir(), ['workunit', 'position', UNIT, to], { env: env() });

  /**
   * One of the world's questions, the first unless `at` says, parked on each
   * task given, as a builder's call parks it — in the project, unless `into`
   * names another.
   * @param {string[]} tasks @param {number} [at] @param {string} [into]
   */
  async function parkOn(tasks, at = 0, into = dir()) {
    const call = { ...CALL, question: QUESTIONS[at] };
    const { conversation } = raiseHelpers(() => into, config, call);
    for (const task of tasks) {
      await okSectionsAsync(into, ['raise', `${UNIT}.implementation`, '--answers', made.asked[at], '--parks', task], { env: conversation(), stdin: JSON.stringify(call) });
    }
  }

  /**
   * A replacement of the call for 1.2 proposed as a builder meets it,
   * parking `task`.
   * @param {string} task
   */
  async function proposeOn(task) {
    const call = { ...CALL, question: 'Is the receipt mailed after all?' };
    const { conversation } = raiseHelpers(dir, config, call);
    await okSectionsAsync(dir(), ['raise', `${UNIT}.implementation`, '--replaces', made.printed, '--reason', 'was-wrong', '--parks', task], { env: conversation(), stdin: JSON.stringify(call) });
  }

  /**
   * The build entered in another conversation, as a /clear leaves it, the
   * build's skill installed: the entry's phase 1 and in-flight lines, then
   * that conversation's recovery note's in-flight lines.
   */
  function takenOver() {
    createFile(dir(), '.claude/skills/leeway-implementation-process/SKILL.md', '# The build\n');
    const conversation = { ...env(), CLAUDE_CODE_SESSION_ID: 'sess-2', CLAUDE_PID: String(process.pid) };
    const lines = okSections(dir(), ['enter', 'implementation', UNIT], { env: conversation }).sections.split('\n');
    const note = output(dir(), ['conversation', 'position'], { env: conversation }).split('\n');
    return [...lines.filter((line) => /^(phase: phase 1 |in flight: )/.test(line)), ...note.filter((line) => line.startsWith('in flight: '))];
  }

  return { env, screen, refused, position, parkOn, proposeOn, takenOver };
}

module.exports = { UNIT, QUESTIONS, CALL, ACCOUNT_DRAWN, taskText, reportOf, buildScreensWorld, buildScreenHelpers };
