'use strict';

// ---------------------------------------------------------------------------
// What the suites of a unit the migration cut share (21.8.4–21.8.8): a
// project in the layout from before Leeway, its old plans in the project's
// tracker and the tasks its old process moved by hand, moved by the real
// move (078); the migration's cut of a unit through `cut --migrating`; and
// the migration's commit made on both branches. The tracker is the default
// task driver's, its side the one place it is named.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ok, git, initRepo, createFile, statePath } = require('./engine-harness.cjs');
const { SESSION } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const MOVE = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');

const DRIVER = /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (listDrivers('task').find(({ isDefault }) => isDefault));
const SIDE = require(path.join(__dirname, '../drivers', DRIVER.name, 'task.cjs'));

/** @typedef {{root: string, phases: string[]}} OldPlan */
/** A phase of an old plan: its title, and each task by its title, or with its text and tags. @typedef {{title: string, tasks: (string|{title: string, text?: string, tags?: string[]})[]}} OldPhase */

/**
 * An old task's text, as the plan from before Leeway wrote it, citing an
 * old spec by `cites`, its path, where given.
 * @param {string} problem @param {string} [cites]
 */
const oldTask = (problem, cites) => [
  `**Problem**: ${problem}`, '', '**Solution**: Build it.', '', '### Acceptance Criteria', '', '- It works.',
  ...(cites === undefined ? [] : ['', `**Spec Reference**: \`${cites}\``]),
].join('\n');

/** An old spec's path as the work-unit layout before Leeway kept it. @param {string} unit @param {string} topic */
const oldSpecPath = (unit, topic) => `.workflows/${unit}/specification/${topic}/specification.md`;

/**
 * A unit whose building started under the old process, of `type`, each of
 * its topics discussed, specified and planned, its implementation at
 * `building` for each.
 * @param {string} name @param {'feature'|'epic'} type @param {string[]} topics @param {string} building
 */
function buildingUnit(name, type, topics, building) {
  const items = (/** @type {Record<string, any>} */ item) => Object.fromEntries(topics.map((topic, at) => [topic, { ...item, ...(type === 'epic' ? { order: at + 1 } : {}) }]));
  return {
    name, work_type: type, status: 'in-progress', description: name, created: '2026-01-01',
    phases: {
      ...(type === 'epic' ? { discovery: { items: Object.fromEntries(topics.map((topic, at) => [topic, { source: 'discovery', summary: topic, order: at + 1 }])) } } : {}),
      discussion: { items: items({ status: 'completed' }) },
      specification: { items: items({ status: 'completed' }) },
      planning: { items: items({ status: 'completed', format: 'sample-format' }) },
      implementation: { items: items({ status: building }) },
    },
  };
}

/**
 * The files of a project in the layout from before Leeway: its README, its
 * registry, and each unit's own — its manifest, and for each topic a
 * discussion and the spec `specs` gives it.
 * @param {{manifest: Record<string, any>, specs: Record<string, string>}[]} units
 * @returns {Record<string, string>}
 */
function oldFiles(units) {
  return {
    'README.md': '# Project\n',
    '.workflows/manifest.json': jsonText({ work_units: Object.fromEntries(units.map(({ manifest }) => [manifest.name, { work_type: manifest.work_type }])) }),
    ...Object.fromEntries(units.flatMap(({ manifest, specs }) => [
      [`.workflows/${manifest.name}/manifest.json`, jsonText(manifest)],
      ...Object.entries(specs).flatMap(([topic, spec]) => [[`.workflows/${manifest.name}/discussion/${topic}.md`, `# Discussion: ${topic}\n`], [oldSpecPath(manifest.name, topic), spec]]),
    ])),
  };
}

/**
 * A project in the layout from before Leeway at `dir`, holding `files`, each
 * old plan of `plans` in its tracker by its topic, each task `byHand` names
 * moved as the old process left it, committed and moved by the real move:
 * answers the tracker's ids of each plan's root and phases, by topic.
 * @template {string} T @param {string} dir @param {Record<string, string>} files @param {Record<T, OldPhase[]>} plans
 * @param {['done'|'start'|'cancel', string][]} byHand @returns {Record<T, OldPlan>}
 */
function movedProject(dir, files, plans, byHand) {
  initRepo(dir);
  for (const [rel, text] of Object.entries(files)) createFile(dir, rel, text);
  SIDE.projectStore(dir);
  const ids = /** @type {Record<T, OldPlan>} */ (Object.fromEntries(Object.entries(plans).map(([topic, phases]) => [topic, SIDE.oldPlan(dir, topic, phases)])));
  for (const [act, title] of byHand) SIDE.taskByHand(dir, act, title);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  return ids;
}

/** The migration's cut of `unit` by `plan`, written beside the project as the directive keeps it: what the cut answered. @param {string} dir @param {string} unit @param {unknown} plan */
function migratedCut(dir, unit, plan) {
  const file = path.join(path.dirname(dir), `${unit}-plan.json`);
  fs.writeFileSync(file, JSON.stringify(plan));
  return ok(dir, ['cut', unit, '--migrating', '--file', file], { env: SESSION });
}

/** The migration's commit made, the state branch's first and the code's, as the person's yes at its gate makes them. @param {string} dir */
function migrationCommitted(dir) {
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s state']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the migration']);
}

module.exports = { DRIVER, SIDE, oldTask, oldSpecPath, buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted };
