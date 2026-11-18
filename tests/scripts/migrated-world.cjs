'use strict';

// ---------------------------------------------------------------------------
// What the suites of a unit the migration cut share (21.8.4–21.8.8): a
// project in the layout from before Ledger, its old plans in the project's
// tracker and the tasks its old process moved by hand, moved by the real
// move (078); the migration's cut of a unit through `cut --migrating`; and
// the migration's commit made on both branches. The cut and the merges'
// world (080): a project moved by the real move whose every kind of piece
// waits on the directive — an epic being built, two of its topics in no
// spec and one a dead end, one a joined spec covers as a source, one
// cancelled on the map and one in discussion, a manifest crediting a task the tracker holds
// open, research that fed several of its topics; a feature nothing of which
// was built, its plan in the tracker; a cross-cutting unit; and a completed
// quick-fix, its building's item kept as its own and no piece. The tracker
// is the default task driver's, its side the one place it is named.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ok, git, initRepo, createFile, statePath } = require('./engine-harness.cjs');
const { SESSION } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const MOVE = require('../../skills/ledger-migrate/scripts/migrations/078-reshape-move.cjs');

const DRIVER = /** @type {import('../../skills/ledger-engine/scripts/domain/drivers.cjs').TaskDriver} */ (listDrivers('task').find(({ isDefault }) => isDefault));
const SIDE = require(path.join(__dirname, '../drivers', DRIVER.name, 'task.cjs'));

/** @typedef {{root: string, phases: string[]}} OldPlan */
/** A phase of an old plan: its title, and each task by its title, or with its text and tags. @typedef {{title: string, tasks: (string|{title: string, text?: string, tags?: string[]})[]}} OldPhase */

/**
 * An old task's text, as the plan from before Ledger wrote it, citing an
 * old spec by `cites`, its path, where given.
 * @param {string} problem @param {string} [cites]
 */
const oldTask = (problem, cites) => [
  `**Problem**: ${problem}`, '', '**Solution**: Build it.', '', '### Acceptance Criteria', '', '- It works.',
  ...(cites === undefined ? [] : ['', `**Spec Reference**: \`${cites}\``]),
].join('\n');

/** An old spec's path as the work-unit layout before Ledger kept it. @param {string} unit @param {string} topic */
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
 * The files of a project in the layout from before Ledger: its README, its
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
 * A project in the layout from before Ledger at `dir`, holding `files`, each
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

/**
 * An old plan's planning item, its tracker root and its task map — each
 * phase and task by the old plan's id, `{topic}-{N}` and `{topic}-{N}-{n}`,
 * to the tracker's — as the old process kept them; the titles of each
 * phase's tasks, in order.
 * @param {string} dir @param {string} topic @param {OldPlan} plan @param {string[][]} titles
 */
function plannedItem(dir, topic, plan, titles) {
  const map = Object.fromEntries(plan.phases.flatMap((parent, at) => [
    [`${topic}-${at + 1}`, parent],
    ...titles[at].map((title, n) => [`${topic}-${at + 1}-${n + 1}`, SIDE.idOf(dir, title)]),
  ]));
  return { status: 'completed', format: 'sample-format', external_id: plan.root, task_map: map };
}

// The cut and the merges' world (the header's): its plans' phases, each its
// title and its tasks', and the tasks the old process moved.
const CUT_AND_MERGES_PLANS = Object.freeze({
  cart: [{ title: 'The cart', tasks: ['Hold items', 'Show the cart'] }, { title: 'Saving', tasks: ['Save the cart', 'Share the cart'] }],
  pay: [
    { title: 'Cards', tasks: ['Take a card'] },
    { title: 'Charges', tasks: ['Charge the card', { title: 'Refund a charge', text: oldTask('A charge is kept for good.', '.workflows/shop/specification/pay/specification.md') }] },
    { title: 'Export', tasks: [{ title: 'Export payments', text: oldTask('Payments stay in the shop.') }] },
  ],
  memo: [{ title: 'Memos', tasks: ['Write a memo', 'Pin a memo'] }],
});
/** @type {['done'|'start'|'cancel', string][]} */
const CUT_AND_MERGES_MOVES = [
  ['done', 'Hold items'], ['done', 'Show the cart'], ['done', 'Save the cart'], ['cancel', 'Share the cart'],
  ['done', 'Take a card'], ['done', 'Charge the card'], ['start', 'Refund a charge'],
];

/** The research that fed several of the epic's topics, as its file has it. */
const EXPLORATION = '# Research: Exploration\n\n## Buyers\n\nThey come back for reviews.\n\n## Gifts\n\nWrapped at the till.\n';

/**
 * The cut and the merges' world at `dir` (the header's), moved by the real
 * move, the migration under way in it: answers the tracker's ids of each
 * plan's root and phases, by topic.
 * @param {string} dir @returns {Record<'cart'|'pay'|'memo', OldPlan>}
 */
function cutAndMergesProject(dir) {
  initRepo(dir);
  SIDE.projectStore(dir);
  const plans = /** @type {Record<'cart'|'pay'|'memo', OldPlan>} */ (Object.fromEntries(Object.entries(CUT_AND_MERGES_PLANS).map(([topic, phases]) => [topic, SIDE.oldPlan(dir, topic, phases)])));
  for (const [act, title] of CUT_AND_MERGES_MOVES) SIDE.taskByHand(dir, act, title);
  const titles = (/** @type {'cart'|'pay'|'memo'} */ topic) => CUT_AND_MERGES_PLANS[topic].map(({ tasks }) => tasks.map((task) => (typeof task === 'string' ? task : task.title)));
  const row = (/** @type {number} */ order, /** @type {Record<string, unknown>} */ more = {}) => ({ source: 'discovery', summary: 'A topic', order, ...more });
  const shop = {
    name: 'shop', work_type: 'epic', status: 'in-progress', description: 'The shop', created: '2026-01-01',
    phases: {
      discovery: { items: { cart: row(1), pay: row(2), reviews: row(3), gifts: row(4), wrap: row(5, { handled: true }), refunds: row(6), wishlist: row(7, { cancelled: true }), coupons: row(8) } },
      discussion: { items: { cart: { status: 'completed' }, pay: { status: 'completed' }, reviews: { status: 'in-progress' }, wrap: { status: 'completed' }, refunds: { status: 'completed' }, coupons: { status: 'cancelled' } } },
      specification: { items: { cart: { status: 'completed', order: 1, sources: { cart: { status: 'incorporated' } } }, pay: { status: 'completed', order: 2, sources: { pay: { status: 'incorporated' }, refunds: { status: 'incorporated' } } } } },
      planning: { items: { cart: plannedItem(dir, 'cart', plans.cart, titles('cart')), pay: { ...plannedItem(dir, 'pay', plans.pay, titles('pay')), external_dependencies: { cart: { state: 'resolved', internal_id: 'cart-2-1', description: 'A charge reads the saved cart.' } } } } },
      implementation: {
        items: {
          cart: { status: 'completed', completed_phases: [1, 2], completed_tasks: ['cart-1-1', 'cart-1-2', 'cart-2-1'] },
          pay: { status: 'in-progress', completed_phases: [1], completed_tasks: ['pay-1-1', 'pay-2-1', 'pay-2-2'] },
        },
      },
    },
  };
  const memo = {
    name: 'memo', work_type: 'feature', status: 'in-progress', description: 'Memos', created: '2026-01-02',
    phases: { discussion: { items: { memo: { status: 'completed' } } }, specification: { items: { memo: { status: 'completed' } } }, planning: { items: { memo: plannedItem(dir, 'memo', plans.memo, titles('memo')) } } },
  };
  const caching = {
    name: 'caching', work_type: 'cross-cutting', status: 'in-progress', description: 'Caching across the product', created: '2026-01-03',
    phases: { discussion: { items: { invalidation: { status: 'completed' } } }, specification: { items: { caching: { status: 'completed', sources: { invalidation: { status: 'incorporated' } } } } } },
  };
  const typo = {
    name: 'typo', work_type: 'quick-fix', status: 'completed', description: 'A typo', created: '2026-01-04',
    phases: { scoping: { items: { typo: { status: 'completed' } } }, specification: { items: { typo: { status: 'completed' } } }, implementation: { items: { typo: { status: 'completed' } } } },
  };
  const files = {
    'README.md': '# Shop\n',
    '.workflows/manifest.json': jsonText({ work_units: { shop: { work_type: 'epic' }, memo: { work_type: 'feature' }, caching: { work_type: 'cross-cutting' }, typo: { work_type: 'quick-fix' } }, roadmap: { horizons: ['next'], items: {} } }),
    '.workflows/shop/manifest.json': jsonText(shop),
    '.workflows/shop/discussion/cart.md': '# Discussion: Cart\n\n## Adding\n\nOne tap.\n',
    '.workflows/shop/discussion/pay.md': '# Discussion: Pay\n\n## Cards\n\nVisa and more.\n',
    '.workflows/shop/discussion/reviews.md': '# Discussion: Reviews\n\n## Who\n\nStill open.\n',
    '.workflows/shop/discussion/wrap.md': '# Discussion: Wrap\n\n## Paper\n\nA dead end: the till wraps.\n',
    '.workflows/shop/discussion/refunds.md': '# Discussion: Refunds\n\n## Whole or part\n\nEither, joined into the pay spec.\n',
    '.workflows/shop/discussion/coupons.md': '# Discussion: Coupons\n\n## None\n\nCancelled: no coupons.\n',
    '.workflows/shop/research/exploration.md': EXPLORATION,
    '.workflows/shop/specification/cart/specification.md': '# Specification: Cart\n\n## Adding\n\nOne tap.\n\n## Saving\n\nKept a week.\n',
    '.workflows/shop/specification/pay/specification.md': '# Specification: Pay\n\n## Cards\n\nVisa and more.\n\n## Refunds\n\nWhole or part.\n',
    '.workflows/shop/planning/pay/planning.md': '# Plan: Pay\n\n## Phases\n\n### Phase 1: Taking cards\n\n**Goal**: Cards taken.\n\n### Phase 2: Charges\n\nCards charged and refunded.\n\n### Phase 3: Export\n\nPayments exported.\n',
    '.workflows/shop/planning/pay/phase-2-tasks.md': '# Phase 2: Charges\n\n## pay-2-1 | Charge the card\n\n## pay-2-2 | Refund a charge\n',
    '.workflows/memo/manifest.json': jsonText(memo),
    '.workflows/memo/discussion/memo.md': '# Discussion: Memo\n',
    '.workflows/memo/specification/memo/specification.md': '# Specification: Memo\n\n## Writing\n\nOne line.\n',
    '.workflows/caching/manifest.json': jsonText(caching),
    '.workflows/caching/discussion/invalidation.md': '# Discussion: Invalidation\n\n## Purging\n\nEvery write purges its keys.\n',
    '.workflows/caching/specification/caching/specification.md': '# Specification: Caching\n\n## Invalidation\n\nEvery write purges its keys.\n',
    '.workflows/typo/manifest.json': jsonText(typo),
    '.workflows/typo/specification/typo/specification.md': '# Typo\n\nFix the header.\n',
  };
  for (const [rel, text] of Object.entries(files)) createFile(dir, rel, text);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  return plans;
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

module.exports = { DRIVER, SIDE, oldTask, oldSpecPath, buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted, cutAndMergesProject, EXPLORATION };
