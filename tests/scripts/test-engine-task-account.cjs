'use strict';

// ---------------------------------------------------------------------------
// A task's account and its review rounds' reports
// (leeway-engine/scripts/domain/task-account.cjs, the reports' grammar
// domain/round-report.cjs, its lists domain/list-items.cjs): `engine task
// account <unit> <task>` and `engine task settle <unit> <task> --file
// <why>`. A reviewer's report read by its grammar — its findings, each with
// its call and its user scenario, then its verdict, which says what the
// findings do: nothing serious and no bug passes (13.4.1, 13.4.3, 13.4.4) —
// its findings and its verdict as a careful writer writes them, a line
// shaped like a finding that opens none refused, naming it, and a finding
// with no scenario still refused; the account read by its five sections,
// its differences counted, `None` never one, and each round summarised,
// with the settlement after each round settled (12.14.5, 12.14.6); the
// rounds read with the reviewers' count raised or lowered, a round before
// the last by the letters it holds and the last against the count
// (13.3.4, 2.4.6); the verb's answer, the account, every round's reports
// and the figures committed in one state commit (12.S42), the figures the
// task's own change across its repositories, a stack's earlier task and a
// submodule's pointer not counted, its criteria, its additions, whoever
// made them (13.11.3), and when it started — the tracker's, outliving a
// state merge that drops the start's commit — and finished (15.3.4); a
// failed last round
// settled by the orchestrator, then the task's account taken, a later round
// passing or not (13.4.6); and every refusal writing and committing nothing
// — a last round with a bug standing (13.S3) and no repository holding the
// task's branch among them.
//
// Layer: verb. World: a project with one work unit, built once and copied:
// its first phase written in the tracker, its second task started and its
// branch stacked on its first's in the project's repository, where the
// first's commit sits below two of its own, and in a repository nested in
// the project; its two rounds' reports — the first failing on a bug, the
// second passing with a nit (13.S4) — and its account, each in its build
// folder, copied into a folder of each test's own, which holds the files it
// hands the verbs. The grammar's describes call the readers with values.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refuses, refusedPristine, statePath, layout, writeState, readState, stateGit, lastMessage, touched, commitAll, commitCode, git, initRepo, addSubmodule, tip, fixtureFrom,
  withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest, templateFolder, useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { readReport, taskRounds, roundUnderReview } = require(path.join(SCRIPTS, 'domain/round-report.cjs'));
const { readAccount } = require(path.join(SCRIPTS, 'domain/task-account.cjs'));
const { appendEntry } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

const [DRIVER] = listDrivers('task').filter((driver) => driver.isDefault);

const UNIT = 'pay';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'task-account-session' });
const NESTED = 'lib';
const TASK = Object.freeze({ unit: UNIT, phase: 1, n: 2 });
const CARD = taskBranch({ unit: UNIT, phase: 1, n: 1 }, 'feat', 'Take a card');
const RECEIPT = taskBranch({ unit: UNIT, phase: 1, n: 2 }, 'feat', 'Show a receipt');

/** A reviewer's report of a task's round, state-relative. @param {string} task @param {number} round @param {string} letter */
const roundAt = (task, round, letter) => layout.unit(UNIT, `build/tasks/${task}/round-${round}-${letter}.md`);

/** A report of the findings given, each `[call, text]`, its verdict as they give it. @param {Array<[string, string]>} findings */
function reportOf(findings) {
  const items = findings.map(([call, text]) => `- ${call}: ${text}\n  Scenario: a customer meets it.`);
  const passes = findings.every(([call]) => call === 'nit');
  return `Read whole.\n\n## Findings\n\n${items.length === 0 ? 'None.' : items.join('\n')}\n\nVerdict: ${passes ? 'pass' : 'fail'}\n`;
}

/** Task 1.2's rounds' reports: the first failing on a bug, the second passing with a nit. */
const ROUNDS = Object.freeze({
  [roundAt('1.2', 1, 'a')]: reportOf([['bug', 'The receipt omits the amount.']]),
  [roundAt('1.2', 1, 'b')]: reportOf([]),
  [roundAt('1.2', 2, 'a')]: reportOf([['nit', 'receipt.js names task 1.2 in a comment.']]),
  [roundAt('1.2', 2, 'b')]: reportOf([]),
});

/** An account, its sections as given over task 1.2's. @param {Record<string, string>} [over] */
function accountOf(over = {}) {
  const sections = {
    'What was done': 'A receipt follows every charge, its amount on it.',
    'Where in the code': '- src/receipt.js: the receipt drawn from the charge',
    'What the tests prove': '- A charge prints its receipt, with the amount.',
    'Differs from the task': '- The card form now names its charge too, which the task did not ask for.\n  The receipt reads it.\n- The receipt test reads a fixed clock.',
    Reviews: '### Round 1\n\nThe amount was missing; the builder added it.\n\n### Round 2\n\nPassed, one nit fixed.',
    ...over,
  };
  return Object.entries(sections).map(([title, body]) => `## ${title}\n\n${body}`).join('\n\n');
}

/** A task file of the template, its acceptance scenarios as given. @param {string} title @param {string[]} scenarios */
function taskText(title, scenarios) {
  return [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', ...scenarios.map((scenario) => `- ${scenario}`), '', '## Spec reference', '§1',
  ].join('\n');
}

/** One commit on the branch checked out in `repo`, its files written, its message naming the task. @param {string} repo @param {string} id @param {Record<string, string>} files */
function workCommit(repo, id, files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', `work on ${id}\n\nLeeway-Task: ${id}`]);
}

/**
 * The unit, its first phase written — 1.1 and 1.2, 1.2 started — and their
 * branches: 1.1's in the project's repository adding src/card.js; 1.2's
 * cut from it, adding src/receipt.js, then its test and an edit to
 * src/card.js; and 1.2's in `lib`, adding a file. 1.2's rounds' reports
 * and its account written in its build folder.
 */
const accountWorld = fixtureFrom('task-account-', (dir) => {
  createManifest(dir, UNIT, {});
  fs.writeFileSync(path.join(dir, '.gitignore'), `${NESTED}/\n`);
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(templateFolder('task-account-files-'), 'task.md');
  for (const [title, scenarios] of [['Take a card', ['A card is taken.']], ['Show a receipt', ['A charge prints a receipt.', 'The receipt shows the amount.', 'A refund prints none.']]]) {
    fs.writeFileSync(file, taskText(title, scenarios));
    ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
  }
  ok(dir, ['task', 'start', UNIT, '1.2'], { env: SESSION });
  git(dir, ['checkout', '-q', '-b', CARD]);
  workCommit(dir, 'pay-1-1', { 'src/card.js': 'export const card = 1;\nexport const take = 2;\n' });
  git(dir, ['checkout', '-q', '-b', RECEIPT]);
  workCommit(dir, 'pay-1-2', { 'src/receipt.js': 'export const receipt = 1;\nexport const amount = 2;\nexport const total = 3;\n' });
  workCommit(dir, 'pay-1-2', { 'src/receipt.test.js': 'test(receipt);\ntest(amount);\n', 'src/card.js': 'export const card = 1;\nexport const take = 3;\n' });
  git(dir, ['checkout', '-q', 'main']);
  const nested = initRepo(path.join(dir, NESTED));
  fs.writeFileSync(path.join(nested, 'README.md'), 'The card library.\n');
  commitCode(nested, 'init');
  git(nested, ['checkout', '-q', '-b', RECEIPT]);
  workCommit(nested, 'pay-1-2', { 'token.js': 'export const token = 1;\n' });
  git(nested, ['checkout', '-q', 'main']);
  for (const [at, text] of Object.entries(ROUNDS)) writeState(dir, at, text);
  writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf());
});

/** @type {string} */
let dir;

/** Task 1.2's account taken: the verb's answer. */
const take = () => ok(dir, ['task', 'account', UNIT, '1.2']);

/** A refusal leaving the tree and the state branch as they were: its error. @param {string[]} args @param {RegExp} pattern */
function refusedWith(args, pattern) {
  const { error } = refusedPristine(dir, ['task', 'account', ...args]);
  assert.match(error, pattern);
}

describe('a reviewer\'s report, read by its grammar (13.4.1, 13.5.11)', () => {
  it('its findings, each with its call, its text and its user scenario, then its verdict; `None.` holds no finding; a heading in a fenced block beneath a finding is its text', () => {
    assert.deepStrictEqual(readReport('Read whole.\n\n## Findings\n\n- serious: the token is kept\n  in plain text.\n  Scenario: a customer saves a card.\n- nit: a stray comment.\n  Scenario: a reader meets it.\n  ```md\n  ## not a heading\n  ```\n\nVerdict: fail\n'), {
      verdict: 'fail',
      findings: [
        { call: 'serious', text: 'the token is kept\nin plain text.\nScenario: a customer saves a card.', scenario: 'a customer saves a card.' },
        { call: 'nit', text: 'a stray comment.\nScenario: a reader meets it.\n```md\n## not a heading\n```', scenario: 'a reader meets it.' },
      ],
    });
    assert.deepStrictEqual(readReport('## Findings\n\nNone.\n\nVerdict: pass'), { verdict: 'pass', findings: [] });
  });

  it('12.10.1: its notes for later, a section of their own before its findings, are no findings — whatever words their items open on', () => {
    const report = [
      'Read whole.', '', '## Notes for later', '', '- bug-prone date parsing beyond the task, at src/dates.js', '- nit: a helper two tasks could share, at src/card.js', '',
      '## Findings', '', '- nit: a stray comment.', '  Scenario: a reader meets it.', '', 'Verdict: pass',
    ].join('\n');

    assert.deepStrictEqual(readReport(report), { verdict: 'pass', findings: [{ call: 'nit', text: 'a stray comment.\nScenario: a reader meets it.', scenario: 'a reader meets it.' }] });
  });

  it('13.4.3, 13.4.4: its verdict says what its findings do — a bug or a serious finding fails it, nits alone pass it — and one saying otherwise does not read', () => {
    for (const call of ['serious', 'bug']) {
      assert.strictEqual(readReport(reportOf([['nit', 'a name.'], [call, 'a fault.']])).verdict, 'fail', call);
      assert.throws(() => readReport(reportOf([[call, 'a fault.']]).replace('Verdict: fail', 'Verdict: pass')), /^Error: it says pass with a serious finding or a bug standing$/, call);
    }
    assert.strictEqual(readReport(reportOf([['nit', 'a name.'], ['nit', 'a word.']])).verdict, 'pass');
    assert.throws(() => readReport(reportOf([['nit', 'a name.']]).replace('Verdict: pass', 'Verdict: fail')), /^Error: it says fail with nothing serious and no bug, which passes$/);
  });

  it('read as a careful writer writes it: prose before the first finding, `*` bullets, calls in any case and bold, every line to the next finding its own — a fence and a heading below level two among them — its scenario bold or bulleted, and `None` as all it holds', () => {
    const report = [
      '## Findings', '', 'I read the diff whole.', '',
      '* Bug: the total is wrong', '  **Scenario:** a customer pays twice.',
      '- **SERIOUS:** the token is kept in plain text.', '', '```js', '- nit: inside a fence', '```', '', '### Why it matters', '', '- Scenario: a customer saves a card.',
      '- **nit**: a stray comment.', 'Scenario: a reader meets it.', '', 'Verdict: fail',
    ].join('\n');
    assert.deepStrictEqual(readReport(report).findings, [
      { call: 'bug', text: 'the total is wrong\n**Scenario:** a customer pays twice.', scenario: 'a customer pays twice.' },
      { call: 'serious', text: 'the token is kept in plain text.\n\n```js\n- nit: inside a fence\n```\n\n### Why it matters\n\n- Scenario: a customer saves a card.', scenario: 'a customer saves a card.' },
      { call: 'nit', text: 'a stray comment.\nScenario: a reader meets it.', scenario: 'a reader meets it.' },
    ]);
    for (const none of ['None', '**None.**', 'None found.', '- None.', 'None.\n\n---']) assert.deepStrictEqual(readReport(`## Findings\n\n${none}\n\nVerdict: pass`), { verdict: 'pass', findings: [] }, none);
  });

  it('a finding opens on a `-`, `*`, `+`, `N.` or `N)` marker, its call emphasised or not, then a colon or a dash; its scenario after its text on that line, or on one of its own, emphasised, italic or named the user scenario', () => {
    const report = [
      '## Findings', '',
      '2. serious — the cache is lost on restart. Scenario: a customer restarts mid-checkout.',
      '+ _bug_: the total is wrong', '  *Scenario:* a customer pays twice.',
      '- **Nit** – a stray comment', '  _Scenario:_ a reader meets it.',
      '1) bug - the receipt omits the amount', '  User scenario: a refund prints.',
      '', 'Verdict: fail',
    ].join('\n');
    assert.deepStrictEqual(readReport(report).findings, [
      { call: 'serious', text: 'the cache is lost on restart. Scenario: a customer restarts mid-checkout.', scenario: 'a customer restarts mid-checkout.' },
      { call: 'bug', text: 'the total is wrong\n*Scenario:* a customer pays twice.', scenario: 'a customer pays twice.' },
      { call: 'nit', text: 'a stray comment\n_Scenario:_ a reader meets it.', scenario: 'a reader meets it.' },
      { call: 'bug', text: 'the receipt omits the amount\nUser scenario: a refund prints.', scenario: 'a refund prints.' },
    ]);
  });

  it('a line shaped like a finding that opens none is refused, naming it: a heading or a line beginning with a call, a call followed by neither a colon nor a dash, a finding below the margin, an item on a word that is no call, and an item before the first finding — the reviewer grouping by severity among them', () => {
    const form = 'each finding opens at the margin on its call, `- serious: …`, `- bug: …` or `- nit: …`';
    const under = (/** @type {string} */ line) => `"${line}" under ## Findings`;
    for (const [findings, faults] of [
      ['### Serious\n\nNone.\n\n### Nits\n\n- The README names the task.', [
        `${under('### Serious')} begins with a call but opens no finding — ${form}`, `${under('### Nits')} begins with a call but opens no finding — ${form}`,
        `${under('- The README names the task.')} is a finding with no call — ${form}`,
      ]],
      ['- nit: a name.\n  Scenario: a reader.\n- Serious (data loss): the cache is lost.\n  Scenario: a restart.', [`${under('- Serious (data loss): the cache is lost.')} begins with a call but opens no finding — ${form}`]],
      ['-bug: the cache is lost.\n  Scenario: a restart.', [`${under('-bug: the cache is lost.')} begins with a call but opens no finding — ${form}`]],
      ['- nit: a name.\n  Scenario: a reader.\n  - serious: the cache is lost.', [`${under('- serious: the cache is lost.')} opens a finding below the margin — ${form}`]],
      ['- nit: a name.\n  Scenario: a reader.\n- major: the cache is lost.', [`${under('- major: the cache is lost.')} opens on "major", which is no call — a finding's call is serious, bug or nit`]],
    ]) {
      assert.throws(() => readReport(`## Findings\n\n${findings}\n\nVerdict: pass`), (err) => err instanceof Error && err.message === faults.join('; '), String(findings));
    }
  });

  it('its verdict as a careful writer writes it, still its last line: in any case, bold or not, a period after it or none', () => {
    for (const verdict of ['**Verdict:** pass', '**Verdict**: Pass', 'verdict: PASS.', 'Verdict: **pass**']) assert.strictEqual(readReport(`## Findings\n\nNone.\n\n${verdict}`).verdict, 'pass', verdict);
    for (const verdict of ['Verdict: pass — all good', 'Verdict: passed']) {
      assert.throws(() => readReport(`## Findings\n\nNone.\n\n${verdict}`), /^Error: its last line is not `Verdict: pass` or `Verdict: fail`$/, verdict);
    }
  });

  it('one that does not read, every fault named: findings not its last section, no verdict last, a finding with no scenario, nothing under its findings that is a finding or `None` alone', () => {
    const nothing = 'nothing under ## Findings is a finding — each finding opens at the margin on its call, `- serious: …`, `- bug: …` or `- nit: …` — or all it holds is `None.`';
    for (const [text, faults] of [
      ['## Findings\n\nNone.\n\n## After\n\nVerdict: pass', 'its last heading at level one or two is not `## Findings`'],
      ['## Findings\n\nNone.\n\nVerdict: pass\n\nSigned.', 'its last line is not `Verdict: pass` or `Verdict: fail`'],
      ['Verdict: pass', 'its last heading at level one or two is not `## Findings`'],
      ['## Findings\n\n- bug: a fault.\n- nit: a name.\n  Scenario: a reader.\n\nVerdict: fail', 'finding 1 (bug) names no user scenario — a line `Scenario: …` in it'],
      ['## Findings\n\n* BUG: a fault.\n  The scenario is unclear.\n\nVerdict: fail', 'finding 1 (bug) names no user scenario — a line `Scenario: …` in it'],
      ['## Findings\n\n1. a fault.\n- minor: a name.\n\nVerdict: fail', '"1. a fault." under ## Findings is a finding with no call — each finding opens at the margin on its call, `- serious: …`, `- bug: …` or `- nit: …`; "- minor: a name." under ## Findings opens on "minor", which is no call — a finding\'s call is serious, bug or nit'],
      ['## Findings\n\nVerdict: pass', nothing],
      ['## Findings\n\nNone serious, but the parser drops lines.\n\nNone.\n\nVerdict: pass', nothing],
    ]) {
      assert.throws(() => readReport(text), (err) => err instanceof Error && err.message === faults, text);
    }
  });
});

describe('an account, read by its grammar (12.14.5, 12.14.6)', () => {
  it('each section\'s text by its heading, each way the work differs as one line, and each round\'s summary; `None.` differs in none', () => {
    assert.deepStrictEqual(readAccount(accountOf(), 2), {
      sections: {
        'What was done': 'A receipt follows every charge, its amount on it.',
        'Where in the code': '- src/receipt.js: the receipt drawn from the charge',
        'What the tests prove': '- A charge prints its receipt, with the amount.',
        'Differs from the task': '- The card form now names its charge too, which the task did not ask for.\n  The receipt reads it.\n- The receipt test reads a fixed clock.',
        Reviews: '### Round 1\n\nThe amount was missing; the builder added it.\n\n### Round 2\n\nPassed, one nit fixed.',
      },
      differences: ['The card form now names its charge too, which the task did not ask for. The receipt reads it.', 'The receipt test reads a fixed clock.'],
      reviews: ['The amount was missing; the builder added it.', 'Passed, one nit fixed.'],
    });
    assert.strictEqual(readAccount(accountOf({ 'Differs from the task': 'None.' }), 2).differences.length, 0);
  });

  it('its lists as a careful writer writes them: `*` bullets and numbers, a lead-in, a thematic break no item; `None` as all it holds, an item or not, and an item beginning `None` never a difference', () => {
    for (const [differs, count] of [
      ['* The card form changed.\n* The receipt test reads a fixed clock.', 2], ['1. The card form changed.', 1], ['It differs in one way:\n\n- The card form changed.', 1],
      ['None', 0], ['None — built as written.', 0], ['- None.', 0], ['- None.\n- The card form changed.', 1], ['None. One thing to note:\n\n- The card form changed.', 1],
      ['- The card form changed.\n\n- - -', 1],
    ]) {
      assert.strictEqual(readAccount(accountOf({ 'Differs from the task': String(differs) }), 2).differences.length, count, String(differs));
    }
  });

  it('13.4.6: after each round the orchestrator settled, wherever it sits, `### Settled` follows it, over what was done about it, and after no other; a round\'s heading in any case, and none carrying a status', () => {
    const settledFirst = '### round 1\n\nThe total stayed wrong.\n\n### Settled\n\nThe orchestrator rounded it itself.\n\n### ROUND 2\n\nPassed.';
    assert.deepStrictEqual(readAccount(accountOf({ Reviews: settledFirst }), 2, [1]).reviews, ['The total stayed wrong.', 'The orchestrator rounded it itself.', 'Passed.']);
    const settledFaults = '## Reviews summarises each of the task\'s 2 review rounds, under `### Round 1`, `### Settled`, `### Round 2` — after each round the orchestrator settled, what was done about it, under `### Settled`';
    for (const text of [accountOf(), accountOf({ Reviews: '### Round 1\n\nWrong.\n\n### Round 2\n\nPassed.\n\n### Settled\n\nRounded.' })]) {
      assert.throws(() => readAccount(text, 2, [1]), (err) => err instanceof Error && err.message === settledFaults, text);
    }
    const unsettled = '## Reviews summarises each of the task\'s 2 review rounds, under `### Round 1`, `### Round 2`';
    for (const reviews of [settledFirst, '### Round 1 — failed\n\nWrong.\n\n### Round 2\n\nPassed.']) {
      assert.throws(() => readAccount(accountOf({ Reviews: reviews }), 2), (err) => err instanceof Error && err.message === unsettled, reviews);
    }
  });

  it('one that does not read, every fault named: a title, text before its first section, its sections out of order or one missing, an empty section, differences that are no list, a round\'s summary missing, numbered otherwise or carrying a status, and an empty one', () => {
    const order = 'its sections are `## What was done`, `## Where in the code`, `## What the tests prove`, `## Differs from the task`, `## Reviews`, in that order, and no other at level two';
    for (const [text, faults] of [
      [`# Task 1.2\n\n${accountOf()}`, 'it holds a level-one heading — an account has no title, only its sections; it opens with `## What was done`'],
      [`Done.\n\n${accountOf()}`, 'it opens with `## What was done`'],
      [accountOf().replace('## Where in the code', '## Where'), order],
      [accountOf({ 'What the tests prove': '' }), '## What the tests prove is empty'],
      [accountOf({ 'Differs from the task': 'The card form changed.' }), '## Differs from the task is a list, an item for each way the work differs from the task, or `None.`'],
      [accountOf({ Reviews: '### Round 1\n\nThe amount was missing.' }), '## Reviews summarises each of the task\'s 2 review rounds, under `### Round 1`, `### Round 2`'],
      [accountOf({ Reviews: 'Two rounds.\n\n### Round 2\n\nPassed.\n\n### Round 1 — failed\n\nA bug.' }), '## Reviews holds nothing but its rounds\' summaries, each under `### Round N`; ## Reviews summarises each of the task\'s 2 review rounds, under `### Round 1`, `### Round 2`'],
      [accountOf({ Reviews: '### Round 1\n\nA bug.\n\n### Round 2\n' }), '### Round 2 is empty'],
    ]) {
      assert.throws(() => readAccount(text, 2), (err) => err instanceof Error && err.message === faults, text);
    }
  });
});

describe('the rounds read with the reviewers\' count changed (13.3.4, 2.4.6)', () => {
  const folder = useTempFolder('task-account-count-');
  beforeEach(() => { dir = accountWorld(path.join(folder(), 'project')); });

  /** Each of task 1.2's rounds read with the count's letters given: its number, its reviewers' letters, and whether it passes. @param {string[]} letters */
  const rounds = (letters) => taskRounds(dir, TASK, letters).map(({ round, reports, passes }) => [round, reports.map(({ reviewer }) => reviewer), passes]);

  it('raised to three: a round before the last read by the letters it holds, the last judged against three — under review until its third reviewer reports, then read whole', () => {
    const three = ['a', 'b', 'c'];

    assert.throws(() => taskRounds(dir, TASK, three), { message: 'round 2 of task 1.2 of pay has no report from reviewer c — pay/build/tasks/1.2/round-2-c.md' });
    assert.strictEqual(roundUnderReview(dir, TASK, three), 2);
    writeState(dir, roundAt('1.2', 2, 'c'), reportOf([['bug', 'The receipt rounds the total.']]));
    assert.deepStrictEqual(rounds(three), [[1, ['a', 'b'], false], [2, ['a', 'b', 'c'], false]]);
    assert.strictEqual(roundUnderReview(dir, TASK, three), 3);
  });

  it('lowered to one: the rounds of two before the last read whole, the last by its one reviewer — its review over once that one passes', () => {
    writeState(dir, roundAt('1.2', 3, 'a'), reportOf([]));

    assert.deepStrictEqual(rounds(['a']), [[1, ['a', 'b'], false], [2, ['a', 'b'], true], [3, ['a'], true]]);
    assert.throws(() => roundUnderReview(dir, TASK, ['a']), { message: 'round 3 of task 1.2 of pay passed — its review is over' });
  });
});

describe('task account (12.14.4, 6.3.13)', () => {
  const folder = useTempFolder('task-account-');
  beforeEach(() => { dir = accountWorld(path.join(folder(), 'project')); });

  /** A file of the test's own, its text as given: its path. @param {string} name @param {string} text */
  const fileOf = (name, text) => {
    fs.writeFileSync(path.join(folder(), name), text);
    return path.join(folder(), name);
  };

  it('12.S42, 13.S4: a task through two rounds, its last passing on a nit — the account, both rounds\' four reports and its figures committed in one state commit, the figures answered, counting every addition the task holds, whoever made it (13.11.3)', () => {
    for (const by of ['orchestrator', 'person']) ok(dir, ['task', 'add', UNIT, '1.2', '--file', fileOf('addition.md', 'Mask the reprint.\n'), '--by', by]);
    const res = withFrozenClock(take);

    const started = DRIVER.started(statePath(dir), TASK);
    assert.match(started, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const figures = { files: 4, added: 7, removed: 1, criteria: 3, additions: 2, started, finished: FROZEN_AT };
    assert.deepStrictEqual(res, { ok: true, task: '1.2', id: 'pay-1-2', rounds: 2, figures, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(lastMessage(dir), 'task(pay): account 1.2');
    assert.deepStrictEqual(touched(statePath(dir), 'HEAD'), [
      'A\tpay/build/tasks/1.2.md', 'A\tpay/build/tasks/1.2/figures.json',
      ...Object.keys(ROUNDS).map((at) => `A\t${at}`),
    ].sort());
    assert.deepStrictEqual(JSON.parse(readState(dir, layout.unit(UNIT, 'build/tasks/1.2/figures.json'))), figures);
  });

  it('15.3.4: the figures count the task\'s own commits in each repository holding its branch, from below its first — the stack\'s earlier task\'s commit beneath it left out — and none where its branch holds none of them', () => {
    git(path.join(dir, NESTED), ['checkout', '-q', '-b', 'scratch', RECEIPT]);
    git(path.join(dir, NESTED), ['commit', '-q', '--amend', '-m', 'work on another task']);
    git(path.join(dir, NESTED), ['branch', '-f', RECEIPT, 'scratch']);

    assert.deepStrictEqual((({ files, added, removed }) => ({ files, added, removed }))(take().figures), { files: 3, added: 6, removed: 1 });
  });

  it('15.3.4: when it started is the tracker\'s, so it outlives a second clone\'s merge of the state, whose commit holds only the remote\'s tip below it', () => {
    const started = DRIVER.started(statePath(dir), TASK);
    stateGit(dir, ['reset', '-q', '--soft', stateGit(dir, ['commit-tree', 'HEAD^{tree}', '-m', 'state: merge the remote\'s']).trim()]);

    assert.strictEqual(take().figures.started, started);
  });

  it('15.3.4: a submodule\'s pointer the task moved is no file of its figures, as `verify mutants` leaves it out', () => {
    const source = initRepo(path.join(folder(), 'ext-source'));
    git(source, ['commit', '-q', '--allow-empty', '-m', 'ext']);
    addSubmodule(dir, 'ext', source);
    const pinning = path.join(folder(), 'pinning');
    git(dir, ['worktree', 'add', '-q', pinning, RECEIPT]);
    git(pinning, ['update-index', '--add', '--cacheinfo', `160000,${tip(source, 'HEAD')},ext`]);
    git(pinning, ['commit', '-q', '-m', 'pin ext\n\nLeeway-Task: pay-1-2']);
    git(dir, ['worktree', 'remove', '--force', pinning]);

    assert.deepStrictEqual((({ files, added, removed }) => ({ files, added, removed }))(take().figures), { files: 4, added: 7, removed: 1 });
  });

  it('13.S3: a task whose last round has a bug standing, however many rounds before it', () => {
    writeState(dir, roundAt('1.2', 3, 'a'), reportOf([['bug', 'The total is wrong.']]));
    writeState(dir, roundAt('1.2', 3, 'b'), reportOf([['nit', 'a name.']]));

    refusedWith([UNIT, '1.2'], /^task account: round 3 of task 1\.2 of pay did not pass — an account is taken once every reviewer of a round passes the task, or the orchestrator settles it: engine task settle pay 1\.2 --file <why>$/);
  });

  it('13.4.6: a task a question waiting parks, its last round passed, naming the question\'s raise', () => {
    const tags = { unit: UNIT, topic: null, phase: 'implementation', session: SESSION.CLAUDE_CODE_SESSION_ID };
    const { id: question } = appendEntry(statePath(dir), { event: 'asked', ...tags, by: 'claude', who_moved_whom: 'none', text: 'Does a receipt show the tax?', part_of: null, relies_on: [], cites: [], task: '1.2' }, []);
    const rows = [{ key: '1', name: 'Shown', text: 'The receipt shows the tax', notice: 'a line for tax' }, { key: '2', name: 'Folded', text: 'The total holds the tax', notice: 'no tax line' }];
    appendEntry(statePath(dir), {
      event: 'parked', ...tags, question, replaces: null, reason: null, cause: null, relies_on: [], task: '1.2', number: 1,
      call: { question: 'Should a receipt show the tax?', rows, lean: '1', why: 'Customers ask.', sort: 'one', mechanism: 'A line.', product_wide: false }, rows_judged: [], why_asking: 'Every call asks.',
    }, []);

    refusedWith([UNIT, '1.2'], /^task account: task 1\.2 of pay waits on Q1, parked for the person — they answer it through its raise: raise draw pay Q1$/);
  });

  it('13.4.6: a task stuck on a failed round, settled by the orchestrator in one state commit, then its account taken, carrying what was done', () => {
    writeState(dir, roundAt('1.2', 3, 'a'), reportOf([['bug', 'The total is wrong.']]));
    writeState(dir, roundAt('1.2', 3, 'b'), reportOf([]));
    const why = fileOf('why.md', '  The total kept failing on rounding; the orchestrator rounded it itself.\n');

    const settled = ok(dir, ['task', 'settle', UNIT, '1.2', '--file', why]);
    assert.deepStrictEqual(settled, { ok: true, task: '1.2', id: 'pay-1-2', round: 3, committed: stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['task(pay): settle 1.2, round 3', ['A\tpay/build/tasks/1.2/round-3-settled.md']]);
    assert.strictEqual(readState(dir, layout.unit(UNIT, 'build/tasks/1.2/round-3-settled.md')), 'The total kept failing on rounding; the orchestrator rounded it itself.\n');

    const reviews = '### Round 1\n\nThe amount was missing.\n\n### Round 2\n\nPassed, one nit fixed.\n\n### Round 3\n\nThe total stayed wrong.';
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf({ Reviews: reviews }));
    refusedWith([UNIT, '1.2'], /^task account: pay\/build\/tasks\/1\.2\.md does not read as an account — ## Reviews summarises each of the task's 3 review rounds, under `### Round 1`, `### Round 2`, `### Round 3`, `### Settled` — after each round the orchestrator settled, what was done about it, under `### Settled`$/);
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf({ Reviews: `${reviews}\n\n### Settled\n\nThe orchestrator rounded the total itself.` }));
    const res = take();
    assert.deepStrictEqual([res.rounds, res.settled, lastMessage(dir)], [3, [3], 'task(pay): account 1.2']);
  });

  it('13.4.6: a round settled, then reviewed again and passed — the account still says what was done about the settled round, where it sits', () => {
    writeState(dir, roundAt('1.2', 3, 'a'), reportOf([['bug', 'The total is wrong.']]));
    writeState(dir, roundAt('1.2', 3, 'b'), reportOf([]));
    const why = fileOf('why.md', 'The orchestrator rounded the total itself.\n');
    ok(dir, ['task', 'settle', UNIT, '1.2', '--file', why]);
    writeState(dir, roundAt('1.2', 4, 'a'), reportOf([]));
    writeState(dir, roundAt('1.2', 4, 'b'), reportOf([]));

    const rounds = '### Round 1\n\nThe amount was missing.\n\n### Round 2\n\nPassed, one nit fixed.\n\n### Round 3\n\nThe total stayed wrong.';
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf({ Reviews: `${rounds}\n\n### Round 4\n\nPassed.` }));
    refusedWith([UNIT, '1.2'], /^task account: pay\/build\/tasks\/1\.2\.md does not read as an account — ## Reviews summarises each of the task's 4 review rounds, under `### Round 1`, `### Round 2`, `### Round 3`, `### Settled`, `### Round 4` — after each round the orchestrator settled, what was done about it, under `### Settled`$/);
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf({ Reviews: `${rounds}\n\n### Settled\n\nRounded by the orchestrator.\n\n### Round 4\n\nPassed.` }));
    assert.deepStrictEqual((({ rounds: count, settled }) => [count, settled])(take()), [4, [3]]);
  });

  it('a task settled only on a failed last round, once: refused after a passing round, a second time, with no round, ended, and from no file or an empty one', () => {
    const why = fileOf('why.md', 'Stuck.\n');
    const settle = (/** @type {string[]} */ args, /** @type {RegExp} */ pattern) => assert.match(refusedPristine(dir, ['task', 'settle', ...args]).error, pattern);

    settle([UNIT, '1.2', '--file', why], /^task settle: round 2 of task 1\.2 of pay passed — only a failed round is settled; its account is taken as it stands$/);
    settle([UNIT, '1.1', '--file', why], /^task settle: task 1\.1 of pay has no review round's reports — its reviewers write them in pay\/build\/tasks\/1\.1\/$/);
    writeState(dir, roundAt('1.2', 3, 'a'), reportOf([['bug', 'The total is wrong.']]));
    writeState(dir, roundAt('1.2', 3, 'b'), reportOf([]));
    settle([UNIT, '1.2', '--file', path.join(folder(), 'missing.md')], /^task settle: there is no file .*missing\.md$/);
    fs.writeFileSync(why, '\n');
    settle([UNIT, '1.2', '--file', why], /^task settle: .*why\.md holds nothing to settle by$/);
    fs.writeFileSync(why, 'Stuck.\n');
    ok(dir, ['task', 'settle', UNIT, '1.2', '--file', why]);
    settle([UNIT, '1.2', '--file', why], /^task settle: round 3 of task 1\.2 of pay is settled already — pay\/build\/tasks\/1\.2\/round-3-settled\.md$/);
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: SESSION });
    settle([UNIT, '1.2', '--file', why], /^task settle: task 1\.2 of pay is done — a round is settled as the task lands, before task done$/);
    assert.match(refuses(dir, ['task', 'settle', UNIT, '1.2']).error, /^Usage: engine task settle <unit> <task> --file <why> \| <unit> --phase <N> --file <why> \[--fixes <task>,…\]$/);
  });

  it('no repository of the project holding the task\'s branch, as the reviewer\'s brief refuses it; a branch holding none of the task\'s commits counts nothing', () => {
    git(dir, ['branch', '-D', RECEIPT]);
    git(path.join(dir, NESTED), ['branch', '-D', RECEIPT]);
    refusedWith([UNIT, '1.2'], new RegExp(`^task account: no repository of the project holds work on task 1\\.2 of pay's branch, ${RECEIPT}$`));

    git(dir, ['branch', RECEIPT, 'main']);
    assert.deepStrictEqual((({ files, added, removed }) => ({ files, added, removed }))(take().figures), { files: 0, added: 0, removed: 0 });
  });

  it('an account that does not read, naming its file and every fault, and one summarising another count of rounds', () => {
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), `# Show a receipt\n\n${accountOf({ 'What the tests prove': '' })}`);
    refusedWith([UNIT, '1.2'], /^task account: pay\/build\/tasks\/1\.2\.md does not read as an account — it holds a level-one heading — an account has no title, only its sections; it opens with `## What was done`; ## What the tests prove is empty$/);
    writeState(dir, layout.unit(UNIT, 'build/tasks/1.2.md'), accountOf({ Reviews: '### Round 1\n\nThe amount was missing.' }));
    refusedWith([UNIT, '1.2'], /^task account: pay\/build\/tasks\/1\.2\.md does not read as an account — ## Reviews summarises each of the task's 2 review rounds, under `### Round 1`, `### Round 2`$/);
  });

  it('no account written, no round\'s reports, the last round missing a reviewer\'s report, a round before it holding none, and a report that does not read', () => {
    fs.rmSync(statePath(dir, layout.unit(UNIT, 'build/tasks/1.2.md')));
    refusedWith([UNIT, '1.2'], /^task account: task 1\.2 of pay has no account — its builder writes it at pay\/build\/tasks\/1\.2\.md$/);
    refusedWith([UNIT, '1.1'], /^task account: task 1\.1 of pay has no review round's reports — its reviewers write them in pay\/build\/tasks\/1\.1\/$/);
    fs.rmSync(statePath(dir, roundAt('1.2', 2, 'b')));
    refusedWith([UNIT, '1.2'], /^task account: round 2 of task 1\.2 of pay has no report from reviewer b — pay\/build\/tasks\/1\.2\/round-2-b\.md$/);
    writeState(dir, roundAt('1.2', 2, 'b'), 'Passed.\n');
    refusedWith([UNIT, '1.2'], /^task account: pay\/build\/tasks\/1\.2\/round-2-b\.md does not read as a reviewer's report — its last heading at level one or two is not `## Findings`; its last line is not `Verdict: pass` or `Verdict: fail`; brief reviewer b again, and its report replaces it$/);
    writeState(dir, roundAt('1.2', 2, 'b'), reportOf([]));
    for (const letter of ['a', 'b']) fs.rmSync(statePath(dir, roundAt('1.2', 1, letter)));
    refusedWith([UNIT, '1.2'], /^task account: round 1 of task 1\.2 of pay has no reviewer's report — its reviewers write them in pay\/build\/tasks\/1\.2\/$/);
  });

  it('a task ended, one the tracker lacks, a unit the project lacks, and arguments of another shape', () => {
    ok(dir, ['task', 'done', UNIT, '1.2'], { env: SESSION });
    refusedWith([UNIT, '1.2'], /^task account: task 1\.2 of pay is done — its account is taken as it lands, before task done$/);
    refusedWith([UNIT, '1.9'], /^task account: task 1\.9 of pay is not in the tracker$/);
    refusedWith(['nope', '1.2'], /^task account: Work unit "nope" not found$/);
    assert.match(refuses(dir, ['task', 'account', UNIT]).error, /^Usage: engine task account <unit> <task>$/);
  });
});
