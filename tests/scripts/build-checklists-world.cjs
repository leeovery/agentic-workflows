'use strict';

// ---------------------------------------------------------------------------
// What the build checklists' suites share (test-engine-build-checklists-
// start.cjs, -close.cjs and -review.cjs): the world, built once a process
// and copied, and over a test's project the calls its tests make
// (`checklistHelpers`).
//
// The world: a feature, `pay`, its build begun in auto, its cut three
// phases — Cards (1.S1, 1.S2) and Refunds (2.S1) relying on nothing, Reports
// (3.S1) on Refunds and on another unit, `billing`, under way; Cards written
// in the tracker, 1.1 holding 1.S1 and 1.2 holding 1.S2, each with its
// branch, 1.2's stacked on 1.1's, and Refunds written, 2.1 holding 2.S1,
// with its branch. The default task driver runs its real tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const {
  ok, git, writeState, readManifest, readState, layout, commitAll, commitCode, createFile, fixtureFrom, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { taskBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));
const { REVIEWER_LETTERS } = require(path.join(SCRIPTS, 'kernel/reviewers.cjs'));

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

/** A reviewer's report: its findings, and its verdict. @param {string[]} findings @param {'pass'|'fail'} verdict */
const reportOf = (findings, verdict) => `# Review\n\n## Findings\n\n${findings.length === 0 ? 'None.' : findings.join('\n')}\n\nVerdict: ${verdict}\n`;

const DROPS_CENTS = '- bug: the receipt drops the cents\n  Scenario: a refund of 9.99';
const WHY = 'The receipt keeps its cents once 1.3 lands.\n';
const SETTLED = layout.unit(UNIT, 'build', 'phases', 'phase-1', 'settlement.json');

/**
 * The calls a test makes over its project.
 * @param {() => string} project
 */
function checklistHelpers(project) {
  /** A checklist's answer. @param {'phase-start'|'phase-close'} point @param {number} number */
  const show = (point, number) => ok(project(), ['checklist', 'show', point, UNIT, String(number)], { env: SESSION });

  /** Where one item of a phase's checklist stands. @param {'phase-start'|'phase-close'} point @param {number} number @param {string} key */
  const item = (point, number, key) => show(point, number).items.find((/** @type {{key: string}} */ shown) => shown.key === key).state;

  /** The unit's manifest with `fields` written over it. @param {Record<string, unknown>} fields */
  const manifestWith = (fields) => createManifest(project(), UNIT, { ...readManifest(project(), UNIT), ...fields });

  /** Each named checklist closed on the unit's manifest, as its close records it. @param {string[]} names */
  const closed = (names) => manifestWith({ checklists: { ...readManifest(project(), UNIT).checklists, ...Object.fromEntries(names.map((name) => [name, { items: {}, closed: FROZEN_AT }])) } });

  /** Each named task landed on the default branch, as a landing names it. @param {string[]} shown */
  function landed(shown) {
    for (const task of shown) git(project(), ['commit', '-q', '--allow-empty', '-m', `feat(${UNIT}): landed ${task}`, '-m', `Task: ${UNIT}-${task.replace('.', '-')}`]);
  }

  /** A round of a task's review, each reviewer's verdict given. @param {string} shown @param {number} roundNumber @param {Array<'pass'|'fail'>} verdicts */
  function round(shown, roundNumber, verdicts) {
    verdicts.forEach((verdict, i) => writeState(project(), layout.unit(UNIT, 'build', 'tasks', shown, `round-${roundNumber}-${REVIEWER_LETTERS[i]}.md`),
      reportOf(verdict === 'pass' ? [] : ['- serious: the card is charged twice\n  Scenario: a card taken twice'], verdict)));
  }

  /** The phase review's report from reviewer `letter`. @param {number} number @param {string} letter @param {string[]} findings @param {'pass'|'fail'} verdict */
  const phaseReport = (number, letter, findings, verdict) => writeState(project(), layout.unit(UNIT, 'build', 'phases', `phase-${number}`, `review-${letter}.md`), reportOf(findings, verdict));

  /** The orchestrator's why, written beside the project. */
  const why = () => writeState(project(), layout.cache(UNIT, 'why.md'), WHY);

  /** Phase 1's review settled, with the arguments given after the why. @param {string[]} args */
  const settle = (args) => ok(project(), ['task', 'settle', UNIT, '--phase', '1', '--file', why(), ...args], { env: SESSION });

  /** Where phase 1's review item stands, and the way on it names while open. */
  const reviewItem = () => (({ state, way }) => ({ state, way }))(show('phase-close', 1).items.find((/** @type {{key: string}} */ shown) => shown.key === 'phase-review-passed'));

  /** A run of a scenario recorded at the commit given, as `verify run` records one. @param {string} scenario @param {string} commit @param {'pass'|'fail'} verdict */
  function ran(scenario, commit, verdict) {
    writeState(project(), layout.unit(UNIT, 'build', 'runs', scenario, 'run-001.json'), JSON.stringify({
      verdict, unfixed: false, at: FROZEN_AT, checkout: project(), commits: [{ repo: '.', commit }], task: null, evidence: [], recordings: [],
    }));
  }

  /** A branch's commit. @param {string} branch */
  const tipOf = (branch) => git(project(), ['rev-parse', `refs/heads/${branch}`]).trim();

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
    const manifest = JSON.parse(readState(project(), layout.projectManifest));
    writeState(project(), layout.projectManifest, JSON.stringify({ ...manifest, environment: { verify: {
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      ran: { unit: UNIT, scenario: '1.S1', verdict: 'pass', commits: [{ repo: '.', commit: tipOf('main') }], at: FROZEN_AT },
    } } }, null, 2));
  }

  return {
    show, item, manifestWith, closed, landed, round, phaseReport, why, settle, reviewItem, ran, tipOf, everyItem, verifySetUp,
  };
}

module.exports = {
  UNIT, SESSION, DROPS_CENTS, WHY, SETTLED, branchOf, taskFile, world, checklistHelpers,
};
