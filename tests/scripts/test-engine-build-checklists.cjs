'use strict';

// ---------------------------------------------------------------------------
// A build phase's checklists, as the engine checks them
// (leeway-engine/scripts/domain/phase-checks.cjs, through checklist.cjs):
// every item of a phase's start and close but the shared design settled is
// the engine's, worked out at each call (6.4.8, 6.4.9). Its tasks written —
// each phase scenario an acceptance scenario of exactly one task not closed
// (12.4.3, 12.S14); what it relies on done — an earlier phase closed and its
// stack merged, another unit completed (12.6.2, 12.6.3, 12.S13), a phase
// relying on nothing unfinished starting beside one in its review (12.7.5,
// 12.S17); its tasks passed by their pairs, a settled round among them
// (13.4.6); its phase review reported by every reviewer of the count,
// passing, or failing with a settlement answering its reports and every fix
// it names done, the way on named while it is open (12.11.1–12.11.3,
// 13.10.1, 12.S24, 13.S13); `task settle --phase` writing that settlement
// with the reports it answers, refusing what it cannot settle, and settling
// again at any time — a fix closed, or one found owed after a settlement
// naming none; each scenario proven at the phase's tips or reported not
// proven in every report (15.4.3, 12.S6, 11.S6); its notes consolidated;
// its stack merged, or in step waiting at its gate (7.2.4, 7.S7); phase 1's
// close refused until the verify setup is recorded (12.3.3, 12.S5); and a
// close committing every record its phase's folder holds. And
// `task start` refused before its phase's start checklist closes, a fix
// phase past the cut never (12.S7, P14). The land verbs' refusals are
// test-engine-land-verbs.cjs's; the checklists' verbs and their records,
// test-engine-checklist.cjs's.
//
// Layer: verb. World, built once and copied: a feature, `pay`, its build
// begun in auto, its cut three phases — Cards (1.S1, 1.S2) and Refunds
// (2.S1) relying on nothing, Reports (3.S1) on Refunds and on another unit,
// `billing`, under way; Cards written in the tracker, 1.1 holding 1.S1 and
// 1.2 holding 1.S2, each with its branch, 1.2's stacked on 1.1's, and
// Refunds written, 2.1 holding 2.S1, with its branch. The default task
// driver runs its real tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, git, stateGit, writeState, readManifest, readState, statePath, lastMessage, touched, layout, commitAll, commitCode, createFile, fixtureFrom, cleanupFixture, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { REVIEWER_LETTERS } = require(path.join(SCRIPTS, 'kernel/reviewers.cjs'));
const { fingerprint } = require(path.join(SCRIPTS, 'kernel/fingerprint.cjs'));

const UNIT = 'pay';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'build-checklists' });

/** @param {string} name @param {string[]} scenarios @param {Array<number|string>} reliesOn */
const phase = (name, scenarios, reliesOn) => ({ name, goal: `${name} work.`, scenarios, sections: [scenarios[0].split('.')[0]], relies_on: reliesOn });

const CUT = { phases: [phase('Cards', ['1.S1', '1.S2'], []), phase('Refunds', ['2.S1'], []), phase('Reports', ['3.S1'], [2, 'billing'])] };

/** The tasks the world writes, each with the scenarios it holds and the branch it is built on. */
const TASKS = Object.freeze([
  { shown: '1.1', title: 'Take a card', scenarios: ['1.S1'], from: 'main' },
  { shown: '1.2', title: 'Check a card', scenarios: ['1.S2'], from: '1.1' },
  { shown: '2.1', title: 'Refund a card', scenarios: ['2.S1'], from: 'main' },
]);

/** A task's branch, as the landing names it. @param {string} shown */
function branchOf(shown) {
  const { title } = /** @type {{title: string}} */ (TASKS.find((task) => task.shown === shown));
  const [phaseOf, n] = shown.split('.').map(Number);
  return taskBranch({ unit: UNIT, phase: phaseOf, n }, 'feat', title);
}

/** A task's file, holding the scenarios given, written beside the project. @param {string} dir @param {string} title @param {string[]} scenarios */
function taskFile(dir, title, scenarios) {
  const file = path.join(dir, '..', `${path.basename(dir)}-task.md`);
  fs.writeFileSync(file, [
    `# ${title}`, '', '## Type', 'feat', '', '## Problem', `${title} is missing.`, '', '## Solution', `Add ${title.toLowerCase()}.`, '',
    '## Outcome', `${title} works.`, '', '## Acceptance scenarios', ...scenarios.map((scenario) => `- ${scenario}`), '', '## Spec reference', '§1', '',
  ].join('\n'));
  return file;
}

const world = fixtureFrom('build-checklists-', (dir) => {
  createManifest(dir, 'billing', {});
  createManifest(dir, UNIT, { build: { position: 'auto' }, cut: CUT });
  createFile(dir, 'app.txt', 'app\n');
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  ok(dir, ['task', 'phase', UNIT, '2', '--title', 'Refunds']);
  for (const task of TASKS) {
    ok(dir, ['task', 'create', UNIT, task.shown.split('.')[0], '--file', taskFile(dir, task.title, task.scenarios)]);
    git(dir, ['checkout', '-q', '-b', branchOf(task.shown), task.from === 'main' ? 'main' : branchOf(task.from)]);
    createFile(dir, `${task.shown}.txt`, `${task.title}\n`);
    commitCode(dir, task.title);
  }
  git(dir, ['checkout', '-q', 'main']);
  fs.rmSync(taskFile(dir, '', []));
});

let dir = '';
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** A checklist's answer. @param {'phase-start'|'phase-close'} point @param {number} number */
const show = (point, number) => ok(dir, ['checklist', 'show', point, UNIT, String(number)], { env: SESSION });

/** Where one item of a phase's checklist stands. @param {'phase-start'|'phase-close'} point @param {number} number @param {string} key */
const item = (point, number, key) => show(point, number).items.find((/** @type {{key: string}} */ shown) => shown.key === key).state;

/** The unit's manifest with `fields` written over it. @param {Record<string, unknown>} fields */
const manifestWith = (fields) => createManifest(dir, UNIT, { ...readManifest(dir, UNIT), ...fields });

/** Each named checklist closed on the unit's manifest, as its close records it. @param {string[]} names */
const closed = (names) => manifestWith({ checklists: { ...readManifest(dir, UNIT).checklists, ...Object.fromEntries(names.map((name) => [name, { items: {}, closed: FROZEN_AT }])) } });

/** Each named task landed on the default branch, as a landing names it. @param {string[]} shown */
function landed(shown) {
  for (const task of shown) git(dir, ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed ${task}`, '-m', `Task: ${UNIT}-${task.replace('.', '-')}`]);
}

/** A reviewer's report: its findings, and its verdict. @param {string[]} findings @param {'pass'|'fail'} verdict */
const reportOf = (findings, verdict) => `# Review\n\n## Findings\n\n${findings.length === 0 ? 'None.' : findings.join('\n')}\n\nVerdict: ${verdict}\n`;

/** A round of a task's review, each reviewer's verdict given. @param {string} shown @param {number} roundNumber @param {Array<'pass'|'fail'>} verdicts */
function round(shown, roundNumber, verdicts) {
  verdicts.forEach((verdict, i) => writeState(dir, layout.unit(UNIT, 'build', 'tasks', shown, `round-${roundNumber}-${REVIEWER_LETTERS[i]}.md`),
    reportOf(verdict === 'pass' ? [] : ['- serious: the card is charged twice\n  Scenario: a card taken twice'], verdict)));
}

/** The phase review's report from reviewer `letter`. @param {number} number @param {string} letter @param {string[]} findings @param {'pass'|'fail'} verdict */
const phaseReport = (number, letter, findings, verdict) => writeState(dir, layout.unit(UNIT, 'build', 'phases', `phase-${number}`, `review-${letter}.md`), reportOf(findings, verdict));

const DROPS_CENTS = '- bug: the receipt drops the cents\n  Scenario: a refund of 9.99';
const WHY = 'The receipt keeps its cents once 1.3 lands.\n';
const SETTLED = layout.unit(UNIT, 'build', 'phases', 'phase-1', 'settlement.json');

/** The orchestrator's why, written beside the project. */
const why = () => writeState(dir, layout.cache(UNIT, 'why.md'), WHY);

/** Phase 1's review settled, with the arguments given after the why. @param {string[]} args */
const settle = (args) => ok(dir, ['task', 'settle', UNIT, '--phase', '1', '--file', why(), ...args], { env: SESSION });

/** Where phase 1's review item stands, and the way on it names while open. */
const reviewItem = () => (({ state, way }) => ({ state, way }))(show('phase-close', 1).items.find((/** @type {{key: string}} */ shown) => shown.key === 'phase-review-passed'));

/** A run of a scenario recorded at the commit given, as `verify run` records one. @param {string} scenario @param {string} commit @param {'pass'|'fail'} verdict */
function ran(scenario, commit, verdict) {
  writeState(dir, layout.unit(UNIT, 'build', 'runs', scenario, 'run-001.json'), JSON.stringify({
    verdict, unfixed: false, at: FROZEN_AT, checkout: dir, commits: [{ repo: '.', commit }], task: null, evidence: [], recordings: [],
  }));
}

/** A branch's commit. @param {string} branch */
const tipOf = (branch) => git(dir, ['rev-parse', `refs/heads/${branch}`]).trim();

/**
 * Every item of a phase's close holding: its tasks passed, its review
 * passing, its scenarios proven at its tip, its tasks landed.
 * @param {number} number @param {string[]} tasks @param {string[]} scenarios
 */
function everyItem(number, tasks, scenarios) {
  for (const task of tasks) round(task, 1, ['pass', 'pass']);
  for (const letter of REVIEWER_LETTERS) phaseReport(number, letter, [], 'pass');
  for (const scenario of scenarios) ran(scenario, tipOf(branchOf(/** @type {string} */ (tasks.at(-1)))), 'pass');
  landed(tasks);
}

/** The verify setup recorded on the project manifest, as `verify setup` records it. */
function verifySetUp() {
  const project = JSON.parse(readState(dir, layout.projectManifest));
  writeState(dir, layout.projectManifest, JSON.stringify({ ...project, environment: { verify: {
    place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
    ran: { unit: UNIT, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: tipOf('main') }], at: FROZEN_AT },
  } } }, null, 2));
}

describe('a phase\'s start: its tasks written, what it relies on done (6.4.8)', () => {
  it('reads its tasks written once each phase scenario is an acceptance scenario of exactly one task not closed — never for a phase the tracker lacks (12.4.3, 12.S14)', () => {
    const written = () => item('phase-start', 1, 'tasks-written');
    const seen = [written(), item('phase-start', 3, 'tasks-written')];
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Take a card again', ['1.S1'])]);
    seen.push(written());
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Folded into 1.1.']);
    seen.push(written());
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);

    assert.deepStrictEqual([...seen, written()], ['done', 'open', 'open', 'done', 'open']);
  });

  it('reads an earlier phase relied on as done once it is closed and its stack merged, another unit once completed — a phase relying on nothing done beside one in its review (12.6.3, 12.7.5, 12.S13, 12.S17)', () => {
    const relied = () => item('phase-start', 3, 'relies-on-done');
    const seen = [item('phase-start', 2, 'relies-on-done'), relied()];
    createManifest(dir, 'billing', { status: 'completed' });
    seen.push(relied());
    landed(['2.1']);
    seen.push(relied());
    closed(['phase-2-start', 'phase-2-close']);
    seen.push(relied());
    git(dir, ['reset', '-q', '--hard', 'HEAD~1']);
    seen.push(relied());
    landed(['2.1']);
    seen.push(relied());
    createManifest(dir, 'billing', { status: 'cancelled' });

    assert.deepStrictEqual([...seen, relied()], ['done', 'open', 'open', 'open', 'done', 'open', 'done', 'open']);
  });

  it('closes on the shared design settled once the engine\'s items hold, and a task of the phase starts only then (12.S7); a fix phase past the cut has no start to wait on (P14)', () => {
    const refusal = 'task start: phase 1 of pay has not started — its tasks start once its start checklist closes: checklist close phase-start pay 1';
    assert.strictEqual(refusedPristine(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION }).error, refusal);
    ok(dir, ['checklist', 'done', 'phase-start', UNIT, '1', 'design-settled'], { env: SESSION });
    ok(dir, ['checklist', 'close', 'phase-start', UNIT, '1'], { env: SESSION });
    ok(dir, ['task', 'phase', UNIT, '4', '--title', 'Fixes']);
    ok(dir, ['task', 'create', UNIT, '4', '--file', taskFile(dir, 'Fix the total', ['Given a total, when it is fixed, then it adds up.'])]);

    assert.deepStrictEqual([ok(dir, ['task', 'start', UNIT, '1.1'], { env: SESSION }).task, ok(dir, ['task', 'start', UNIT, '4.1'], { env: SESSION }).task], ['1.1', '4.1']);
  });
});

describe('a phase\'s close (6.4.9)', () => {
  it('reads its tasks passed once each task not closed passed its pair — every reviewer of a round, or the round settled — a report that does not read said as a warning (13.4.6)', () => {
    const passed = () => item('phase-close', 1, 'tasks-passed');
    const seen = [passed()];
    round('1.1', 1, ['pass', 'pass']);
    round('1.2', 1, ['pass', 'fail']);
    seen.push(passed());
    writeState(dir, layout.unit(UNIT, 'build', 'tasks', '1.2', 'round-1-settled.md'), 'The finding came back fixed; settled.\n');
    seen.push(passed());
    writeState(dir, layout.unit(UNIT, 'build', 'tasks', '1.2', 'round-2-a.md'), '# Review\n\nNo verdict.\n');
    const unread = show('phase-close', 1);
    fs.rmSync(path.join(dir, '.leeway', UNIT, 'build', 'tasks', '1.2'), { recursive: true });
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);

    assert.deepStrictEqual([...seen, unread.items[0].state, passed()], ['open', 'open', 'done', 'open', 'done']);
    assert.match(unread.warnings.join('\n'), /pay\/build\/tasks\/1\.2\/round-2-a\.md does not read as a reviewer's report/);
  });

  it('reads its phase review passed once every reviewer of the count reported it passing — or, where it failed, once a settlement answers its reports as they stand and every fix it names is done, every task of the phase done answering nothing (12.11.3, 13.10.1, 12.S24, 13.S13)', () => {
    const reviewed = () => item('phase-close', 1, 'phase-review-passed');
    const seen = [reviewed()];
    phaseReport(1, 'a', [], 'pass');
    seen.push(reviewed());
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    const unsettled = reviewItem();
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    const owed = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: SESSION });
    seen.push(reviewed());
    phaseReport(1, 'a', ['- bug: the refund is never logged\n  Scenario: a refund of 9.99'], 'fail');
    seen.push(reviewed());
    settle([]);
    seen.push(reviewed());
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [], 'pass');

    assert.deepStrictEqual([...seen, reviewed()], ['open', 'open', 'done', 'open', 'done', 'done']);
    assert.deepStrictEqual([unsettled, owed], [
      { state: 'open', way: 'phase 1\'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: task settle pay --phase 1 --file <why> [--fixes <task>,…]' },
      { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is open' },
    ]);
  });

  it('reads a settlement that does not read as answering nothing, said as the way on, and settles anew over it', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    settle([]);
    writeState(dir, SETTLED, '{"why": "Kept."}\n');
    const unread = reviewItem();
    settle([]);

    assert.deepStrictEqual(unread, {
      state: 'open',
      way: 'pay/build/phases/phase-1/settlement.json does not read as a settlement — it holds {"why", "fixes", "reports"}; phase 1\'s review failed, and no settlement answers it — write its fixes as tasks of the phase, then settle it, naming them: task settle pay --phase 1 --file <why> [--fixes <task>,…]',
    });
    assert.strictEqual(item('phase-close', 1, 'phase-review-passed'), 'done');
  });

  it('reads a settlement naming a fix since closed as open, its way on the settlement given again — which is let through, passing once its new fixes are done (13.10.1)', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    ok(dir, ['task', 'close', UNIT, '1.3', '--reason', 'The cents are lost in the receipt, not the total.']);
    const closedFix = reviewItem();
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Print the cents', ['1.S2'])]);
    settle(['--fixes', '1.4']);
    const resettled = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.4'], { env: SESSION });

    assert.deepStrictEqual([closedFix, resettled, item('phase-close', 1, 'phase-review-passed')], [
      { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is closed — settle it again, naming the fixes that stand: task settle pay --phase 1 --file <why> [--fixes <task>,…]' },
      { state: 'open', way: 'phase 1\'s review failed, and task 1.4, a fix of it, is open' },
      'done',
    ]);
  });

  it('reads each scenario proven by its runs at the phase\'s tips, or reported not proven, in those words, in every report of its review — a run at code the tips do not hold proving nothing (15.4.3, 12.S6, 11.S6)', () => {
    const reported = () => item('phase-close', 1, 'scenarios-reported');
    const tip = tipOf(branchOf('1.2'));
    const seen = [reported()];
    ran('1.S1', tip, 'pass');
    ran('1.S2', tip, 'pass');
    seen.push(reported());
    ran('1.S2', tip, 'fail');
    phaseReport(1, 'a', ['- serious: 1.S2 not proven — its run fails\n  Scenario: an unknown brand offered'], 'fail');
    phaseReport(1, 'b', [], 'pass');
    seen.push(reported());
    phaseReport(1, 'b', ['- serious: 1.S2 fails at the tips\n  Scenario: an unknown brand offered'], 'fail');
    seen.push(reported());
    phaseReport(1, 'b', ['- serious: 1.S2 reads not proven at the tips\n  Scenario: an unknown brand offered'], 'fail');
    seen.push(reported());
    ran('1.S1', tipOf(branchOf('2.1')), 'pass');

    assert.deepStrictEqual([...seen, reported()], ['open', 'done', 'open', 'open', 'done', 'open']);
  });

  it('proves nothing where the phase\'s tips cannot be read, said as a warning', () => {
    ran('1.S1', tipOf(branchOf('1.2')), 'pass');
    ran('1.S2', tipOf(branchOf('1.2')), 'pass');
    git(dir, ['branch', '-q', '-D', branchOf('1.2'), branchOf('1.1')]);
    const answer = show('phase-close', 1);

    assert.strictEqual(answer.items.find((/** @type {{key: string}} */ shown) => shown.key === 'scenarios-reported').state, 'open');
    assert.match(answer.warnings.join('\n'), /^phase 1 of pay's scenarios are judged at its stack's tips, which cannot be read — no repository of the project holds work on phase 1 of pay's tasks$/m);
  });

  it('reads its notes consolidated once a note waiting is taken by the consolidation\'s record', () => {
    const consolidated = () => item('phase-close', 1, 'notes-consolidated');
    const seen = [consolidated()];
    ok(dir, ['task', 'note', UNIT, '--file', writeState(dir, layout.cache(UNIT, 'note.md'), 'The total is never rounded.\n')], { env: SESSION });
    seen.push(consolidated());
    writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', 'consolidation.md'), '## The notes\n\n- Note 1: dropped — the total is rounded on display.\n');

    assert.deepStrictEqual([...seen, consolidated()], ['done', 'open', 'done']);
  });

  it('reads its stack merged once every task not closed landed on the default branch — in step, waiting at its gate (7.2.4, 7.S7)', () => {
    const merged = () => item('phase-close', 1, 'stack-merged');
    const seen = [merged()];
    landed(['1.1']);
    seen.push(merged());
    landed(['1.2']);
    seen.push(merged());
    git(dir, ['reset', '-q', '--hard', 'HEAD~2']);
    manifestWith({ build: { position: 'step' } });

    assert.deepStrictEqual([...seen, merged()], ['open', 'open', 'done', 'done']);
  });

  it('closes phase 1 only once the verify setup is recorded, every item holding (12.3.3, 12.S5); a later phase\'s close asks none', () => {
    everyItem(1, ['1.1', '1.2'], ['1.S1', '1.S2']);
    everyItem(2, ['2.1'], ['2.S1']);
    const items = show('phase-close', 1).items.map((/** @type {{key: string, state: string}} */ shown) => `${shown.key} ${shown.state}`);
    const refusal = refusedPristine(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION }).error;
    assert.strictEqual(ok(dir, ['checklist', 'close', 'phase-close', UNIT, '2'], { env: SESSION }).checklist, 'phase-2-close');
    verifySetUp();

    assert.deepStrictEqual(items, ['tasks-passed done', 'phase-review-passed done', 'scenarios-reported done', 'notes-consolidated done', 'stack-merged done']);
    assert.strictEqual(refusal, 'checklist close: phase 1 of pay closes once the verify setup is recorded — the first phase gets the product running and drivable: verify setup pay --file <setup.json> --scenario <scenario>');
    assert.strictEqual(ok(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION }).checklist, 'phase-1-close');
  });

  it('commits, at its close, every record its folder holds beside the manifest — its review\'s reports and its consolidation report, never a file the layout does not place, which the person\'s gitignore may cover — so a second clone reads a passing review and a settled one as this clone does', () => {
    everyItem(2, ['2.1'], ['2.S1']);
    writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-2', 'consolidation.md'), '## The notes\n\nNone.\n');
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '*.swp\n');
    for (const stray of ['.review-a.md.swp', 'review-a.txt', '.DS_Store']) writeState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-2', stray), 'stray\n');
    const { committed } = ok(dir, ['checklist', 'close', 'phase-close', UNIT, '2'], { env: SESSION });
    const closing = touched(statePath(dir), 'HEAD');
    everyItem(1, ['1.1', '1.2'], ['1.S1', '1.S2']);
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    settle([]);
    verifySetUp();
    ok(dir, ['checklist', 'close', 'phase-close', UNIT, '1'], { env: SESSION });

    assert.notStrictEqual(committed, null, 'the close commits');
    assert.deepStrictEqual(closing, ['A\tpay/build/phases/phase-2/consolidation.md', 'A\tpay/build/phases/phase-2/review-a.md', 'A\tpay/build/phases/phase-2/review-b.md', 'M\tpay/manifest.json']);
    assert.deepStrictEqual(stateGit(dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${UNIT}/build/phases`]).trim().split('\n'), [
      'pay/build/phases/phase-1/review-a.md', 'pay/build/phases/phase-1/review-b.md', 'pay/build/phases/phase-1/settlement.json',
      'pay/build/phases/phase-2/consolidation.md', 'pay/build/phases/phase-2/review-a.md', 'pay/build/phases/phase-2/review-b.md',
    ]);
  });
});

describe('a phase review\'s settlement (13.10.1)', () => {
  it('writes the why, its fixes once each and the reports it answers by their texts\' fingerprints, alone, and commits it with those reports', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    const { phase: settled, fixes } = settle(['--fixes', '1.3,1.3']);
    const print = (/** @type {string} */ letter) => fingerprint(readState(dir, layout.unit(UNIT, 'build', 'phases', 'phase-1', `review-${letter}.md`)));

    assert.deepStrictEqual([settled, fixes], [1, ['1.3']]);
    assert.deepStrictEqual(JSON.parse(readState(dir, SETTLED)), { why: WHY.trimEnd(), fixes: ['1.3'], reports: { 'review-a.md': print('a'), 'review-b.md': print('b') } });
    assert.deepStrictEqual([lastMessage(dir), touched(statePath(dir), 'HEAD')], ['task(pay): settle phase 1\'s review', [
      'A\tpay/build/phases/phase-1/review-a.md', 'A\tpay/build/phases/phase-1/review-b.md', `A\t${SETTLED}`,
    ]]);
  });

  it('settles again at any time, the newer settlement replacing the older: one naming none widened to name a fix found owed after it, the review open until that fix is done', () => {
    phaseReport(1, 'a', [], 'pass');
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'done', UNIT, task], { env: SESSION });
    settle([]);
    const seen = [item('phase-close', 1, 'phase-review-passed')];
    ok(dir, ['task', 'create', UNIT, '1', '--file', taskFile(dir, 'Keep the cents', ['1.S2'])]);
    settle(['--fixes', '1.3']);
    const widened = reviewItem();
    ok(dir, ['task', 'done', UNIT, '1.3'], { env: SESSION });

    assert.deepStrictEqual([...seen, widened, item('phase-close', 1, 'phase-review-passed')], [
      'done', { state: 'open', way: 'phase 1\'s review failed, and task 1.3, a fix of it, is open' }, 'done',
    ]);
    assert.deepStrictEqual(JSON.parse(readState(dir, SETTLED)).fixes, ['1.3']);
  });

  it('refuses, writing nothing, a unit the project lacks, a review not complete, one passing, and each fix no task\'s id, no task of the phase, one the tracker lacks or one it has closed', () => {
    const refused = (/** @type {string[]} */ args, unit = UNIT) => refusedPristine(dir, ['task', 'settle', unit, '--phase', '1', '--file', why(), ...args], { env: SESSION }).error;
    const seen = [refused([], 'nowhere'), refused([])];
    phaseReport(1, 'a', [], 'pass');
    seen.push(refused([]));
    phaseReport(1, 'b', [], 'pass');
    seen.push(refused([]));
    phaseReport(1, 'b', [DROPS_CENTS], 'fail');
    ok(dir, ['task', 'close', UNIT, '1.2', '--reason', 'Not needed.']);
    seen.push(refused(['--fixes', 'cents,2.1,1.9,1.2,1.1']));

    assert.deepStrictEqual(seen, [
      'task settle: Work unit "nowhere" not found',
      'task settle: phase 1 of pay has no phase review reported — its reviewers write their reports in pay/build/phases/phase-1/ — a phase review is settled once every reviewer of the count has reported it',
      'task settle: the phase review has no report at pay/build/phases/phase-1/review-b.md — a phase review is settled once every reviewer of the count has reported it',
      'task settle: phase 1 of pay\'s review passed — only a failed review is settled',
      'task settle: task-id: "cents" is not a task — it is {phase}.{n}; --fixes names task 2.1, which is no task of phase 1 of pay; --fixes names task 1.9, which the tracker does not hold in phase 1 of pay; --fixes names task 1.2, which the tracker has closed — a fix is a task still to be done',
    ]);
  });

  it('refuses with its usage given a task and a phase, neither, or fixes for a task', () => {
    const usage = 'Usage: engine task settle <unit> <task> --file <why> | <unit> --phase <N> --file <why> [--fixes <task>,…]';
    const given = [['1.1', '--phase', '1'], [], ['1.1', '--fixes', '1.2']].map((args) => refusedPristine(dir, ['task', 'settle', UNIT, ...args, '--file', why()], { env: SESSION }).error);

    assert.deepStrictEqual(given, [usage, usage, usage]);
  });
});
