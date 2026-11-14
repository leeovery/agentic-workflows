'use strict';

// ---------------------------------------------------------------------------
// `engine cut <unit> --migrating --file <plan.json>` and `engine task adopt`
// (leeway-engine/scripts/domain/cut-migrating.cjs, task-verbs.cjs; 21.7.1,
// 21.8.4–21.8.8, 21.5.21, 11.5.8, 11.5.9, P3, E6, E13): a unit whose
// building started cut by the migration, its plan applied whole — its old
// plans' phases the cut, the built ones name, goal and built, the
// unfinished ones their scenarios, written into the joined spec's block for
// their area, their sections and what they rely on; each phase's tracker
// parent adopted, every task's id and tracker state as they stood but the
// type of each not ended; the notes for later written whole; the build begun
// in step and the old plan's items gone; all held for the migration's
// commit, then the unit marked. The unit read after as the build reads it:
// its built phases merged and closed, with no checklist, in the build's
// standing, its progress and its review's fix numbering; its joined spec's
// areas on the board's section page, in the task writer's and builder's
// briefs and as the review's areas; concluded from the move on, before any
// cut, for the spec's land and the layout's hook. A plan
// marking built a phase with a task open refused, the tracker winning; every
// refusal of the verb's own writing nothing — outside the migration, a unit
// marked or not joined, a plan of another shape or whose cut the spec
// refuses; and a run killed at each of its writes run again to what a whole
// run leaves. `task adopt` in the migration alone: a nothing-built plan's
// tasks adopted and closed through the task verbs (21.8.4).
//
// Layer: verb, the kills spawned. World: a project in today's layout — an
// epic of two specs, one built and one partly, a feature built with its
// review owed, and one with nothing built, each with its old plan in the
// project's tracker — moved by the real move (078), so the specs are
// joined as the move joins them; made once and copied for each test. The
// tracker is the default task driver's, its side the one place it is named.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, refuses, okSections, git, initRepo, createFile, statePath, readState, writeState, cleanupFixture, killedAt } = harness;
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { SESSION, stateUnborn, refusedUntouched } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { markPath } = require(path.join(SCRIPTS, 'domain/cut-migrating.cjs'));
const MOVE = require('../../skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs');

const DRIVER = /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (listDrivers('task').find(({ isDefault }) => isDefault));
const SIDE = require(path.join(__dirname, '../drivers', DRIVER.name, 'task.cjs'));
const HELD = 'held for the migration\'s commit';

const OLD_SHOP = {
  name: 'shop', work_type: 'epic', status: 'in-progress', description: 'shop', created: '2026-01-01',
  phases: {
    discovery: { items: { cart: { source: 'discovery', summary: 'Cart', order: 1 }, pay: { source: 'discovery', summary: 'Pay', order: 2 } } },
    discussion: { items: { cart: { status: 'completed' }, pay: { status: 'completed' } } },
    specification: { items: { cart: { status: 'completed', order: 1 }, pay: { status: 'completed', order: 2 } } },
    planning: { items: { cart: { status: 'completed', format: 'sample-format' }, pay: { status: 'completed', format: 'sample-format' } } },
    implementation: {
      items: {
        cart: { status: 'completed' },
        pay: { status: 'in-progress', completed_tasks: ['pay-1-1', 'pay-2-1', 'pay-2-2'], bank: [{ finding: 'The charge retries without a cap.' }], staging: [{ batch: 1 }], analysis_staging: [{ batch: 1 }] },
      },
    },
  },
};

/** A feature of one spec and one plan, its implementation at `building`, or none. @param {string} name @param {string|null} building */
const feature = (name, building) => ({
  name, work_type: 'feature', status: 'in-progress', description: name, created: '2026-01-01',
  phases: {
    discussion: { items: { [name]: { status: 'completed' } } },
    specification: { items: { [name]: { status: 'completed' } } },
    planning: { items: { [name]: { status: 'completed', format: 'sample-format' } } },
    ...(building === null ? {} : { implementation: { items: { [name]: { status: building } } } }),
  },
});

const OLD = {
  'README.md': '# Shop\n',
  '.workflows/manifest.json': jsonText({ work_units: { shop: { work_type: 'epic' }, tally: { work_type: 'feature' }, memo: { work_type: 'feature' } } }),
  '.workflows/shop/manifest.json': jsonText(OLD_SHOP),
  '.workflows/shop/discussion/cart.md': '# Discussion: Cart\n',
  '.workflows/shop/discussion/pay.md': '# Discussion: Pay\n',
  '.workflows/shop/specification/cart/specification.md': '# Specification: Cart\n\n## Adding\n\nOne tap.\n\n## Saving\n\nKept a week.\n',
  '.workflows/shop/specification/pay/specification.md': '# Specification: Pay\n\n## Cards\n\nVisa and more.\n\n### Refunds\n\nWhole or part.\n',
  '.workflows/tally/manifest.json': jsonText(feature('tally', 'completed')),
  '.workflows/tally/discussion/tally.md': '# Discussion: Tally\n',
  '.workflows/tally/specification/tally/specification.md': '# Specification: Tally\n\n## Counting\n\nBy day.\n',
  '.workflows/memo/manifest.json': jsonText(feature('memo', null)),
  '.workflows/memo/discussion/memo.md': '# Discussion: Memo\n',
  '.workflows/memo/specification/memo/specification.md': '# Specification: Memo\n\n## Writing\n\nOne line.\n',
};

/** The joined spec the move writes for the epic. */
const JOINED = '# Shop\n\n## 1. Cart\n\n#### Adding\n\nOne tap.\n\n#### Saving\n\nKept a week.\n\n## 2. Pay\n\n#### Cards\n\nVisa and more.\n\n##### Refunds\n\nWhole or part.\n';

const SCENARIOS = [
  'Given a card, when it is charged, then the shop is paid.',
  'Given a charge, when it is refunded, then the card is credited.',
  'Given a month of payments, when they are exported, then a file holds each.',
];

/** The joined spec once the cut wrote its block of scenarios. */
const CUT_SPEC = `${JOINED}\n## 2-S. Scenarios for §2\n\n${SCENARIOS.map((text, at) => `2.S${at + 1} ${text}`).join('\n\n')}\n`;

const NOTES = [
  'Banked in task 4.1\'s review: the charge retries without a cap.',
  'The manifest credits task 4.2 as done, and the tracker holds it in progress — the tracker\'s state stands.',
];

/** @typedef {{root: string, phases: string[]}} OldPlan */
/** The tracker's ids of each old plan's root and phases, the same in every copy of the world. @type {{cart: OldPlan, pay: OldPlan, tally: OldPlan, memo: OldPlan}} */
let PLANS;

/** @param {string} dir */
function buildWorld(dir) {
  initRepo(dir);
  for (const [rel, text] of Object.entries(OLD)) createFile(dir, rel, text);
  SIDE.projectStore(dir);
  const plans = {
    cart: SIDE.oldPlan(dir, 'cart', [{ title: 'The cart', tasks: ['Hold items', 'Show the cart'] }, { title: 'Saving', tasks: ['Save the cart', 'Share the cart'] }]),
    pay: SIDE.oldPlan(dir, 'pay', [
      { title: 'Cards', tasks: ['Take a card'] },
      { title: 'Charges', tasks: ['Charge the card', 'Refund a charge', 'Email a receipt'] },
      { title: 'Export', tasks: ['Export payments'] },
    ]),
    tally: SIDE.oldPlan(dir, 'tally', [{ title: 'Counts', tasks: ['Count a day'] }, { title: 'Totals', tasks: ['Total a week'] }]),
    memo: SIDE.oldPlan(dir, 'memo', [{ title: 'Memos', tasks: ['Write a memo', 'Pin a memo'] }]),
  };
  for (const [act, title] of [
    ['done', 'Hold items'], ['done', 'Show the cart'], ['done', 'Save the cart'], ['cancel', 'Share the cart'],
    ['done', 'Take a card'], ['done', 'Charge the card'], ['start', 'Refund a charge'],
    ['done', 'Count a day'], ['done', 'Total a week'],
  ]) SIDE.taskByHand(dir, act, title);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'the old layout']);
  MOVE.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  return plans;
}

/** @type {string|null} */
let template = null;

/** The world at a fresh folder. */
function world() {
  if (template === null) {
    template = templateFolder('cut-migrating-template-');
    PLANS = buildWorld(template);
  }
  return copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cut-migrating-')), 'shop'));
}

/** The epic's plan as the directive writes it: three phases built, two not, the tracker parents named. */
function shopPlan() {
  const [cart1, cart2] = PLANS.cart.phases;
  const [pay1, pay2, pay3] = PLANS.pay.phases;
  return {
    phases: [
      { name: 'The cart', goal: 'Items held.', built: true, tracker: cart1 },
      { name: 'Saving', goal: 'Carts kept.', built: true, tracker: cart2 },
      { name: 'Cards', goal: 'Cards taken.', built: true, tracker: pay1 },
      { name: 'Charges', goal: 'Cards charged and refunded.', scenarios: ['2.S1', '2.S2'], sections: ['2'], relies_on: [3], tracker: pay2 },
      { name: 'Export', goal: 'Payments exported.', scenarios: ['2.S3'], sections: ['2'], relies_on: [4], tracker: pay3 },
    ],
    scenarios: { 2: SCENARIOS },
    notes: NOTES,
    answers: { uncovered: 'none' },
  };
}

/** @type {string} */
let dir;

/** The plan written where the directive keeps it, outside the project: the cut's argv. @param {string} unit @param {unknown} plan */
function cutArgs(unit, plan) {
  const file = path.join(path.dirname(dir), `${unit}-plan.json`);
  fs.writeFileSync(file, typeof plan === 'string' ? plan : JSON.stringify(plan));
  return ['cut', unit, '--migrating', '--file', file];
}

/** @param {string} unit @param {unknown} plan */
const cut = (unit, plan) => ok(dir, cutArgs(unit, plan), { env: SESSION });

/** A call that must refuse, writing and committing nothing: its error. @param {string[]} args */
const untouched = (args) => refusedUntouched(dir, args, { env: SESSION }, harness);

/** A unit's manifest in the state. @param {string} unit */
const manifestOf = (unit) => JSON.parse(readState(dir, `${unit}/manifest.json`));

/** Each phase's tasks as the tracker holds them: `{N}.{n}`, its status and its type. @param {string} unit @param {number} phases */
function tracked(unit, phases) {
  const root = statePath(dir);
  return Array.from({ length: phases }, (_, at) => (DRIVER.tasks(root, unit, at + 1) ?? []).map((task) => `${task.ref.phase}.${task.ref.n} ${task.status} ${task.type}`));
}

/** The build standing's line for each phase, as entering the build draws it. @param {string} unit */
function phaseLines(unit) {
  return okSections(dir, ['enter', 'implementation', unit], { env: SESSION }).sections.split('\n').filter((line) => line.startsWith('phase: '));
}

/** A brief issued in this conversation: its text. @param {string[]} args */
function briefText(args) {
  const { id } = ok(dir, ['brief', ...args], { env: SESSION });
  return fs.readFileSync(briefPath(SESSION.CLAUDE_CODE_SESSION_ID, id), 'utf8');
}

/** The state branch given its first commit, as the migration's commit gives it. */
function migrationDone() {
  git(statePath(dir), ['add', '-A']);
  git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);
}

describe('the migration\'s cut of a unit whose building started (21.7.1, 21.8.6–21.8.8, E6)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('21.S28: two specs joined, one built and one partly, cut through the verbs — the built plan\'s phases name, goal and built, the unfinished ones their scenarios, sections and relies-on, their scenarios in spec.md\'s block for their area; each phase naming its tracker parent; every task\'s id and tracker state as they stood, each neither done nor closed now typed feat; the build begun in step and the old plan\'s items gone, all held, the unit marked (21.5.21, 11.5.8, 11.5.9, P3)', () => {
    const before = SIDE.apartFromNames(statePath(dir), 'shop', false);
    const plan = shopPlan();

    assert.deepStrictEqual(cut('shop', plan), {
      ok: true, unit: 'shop', phases: 5, built: 3,
      adopted: [{ phase: 1, tasks: ['1.1', '1.2'] }, { phase: 2, tasks: ['2.1', '2.2'] }, { phase: 3, tasks: ['3.1'] }, { phase: 4, tasks: ['4.1', '4.2', '4.3'] }, { phase: 5, tasks: ['5.1'] }],
      typed: ['4.2', '4.3', '5.1'], scenarios: 3, notes: 2, committed: null, note: HELD,
    });
    const { phases, spec, cut: written, build } = manifestOf('shop');
    assert.deepStrictEqual([written, build, Object.keys(phases), spec], [{ phases: plan.phases }, { position: 'step' }, ['discovery', 'discussion'], { joined: true }]);
    assert.strictEqual(readState(dir, 'shop/spec.md'), CUT_SPEC);
    assert.deepStrictEqual(SIDE.apartFromNames(statePath(dir), 'shop', false), before);
    assert.deepStrictEqual(tracked('shop', 5), [
      ['1.1 done api', '1.2 done api'], ['2.1 done api', '2.2 closed api'], ['3.1 done api'], ['4.1 done api', '4.2 in-progress feat', '4.3 open feat'], ['5.1 open feat'],
    ]);
    assert.deepStrictEqual([stateUnborn(dir), fs.existsSync(markPath(dir, 'shop'))], [true, true]);
  });

  it('reads a built phase merged and closed wherever a phase is read — the build\'s standing, tracker parent or none, its progress, no checklist of its own — the first not built the one the build goes on in', () => {
    const plan = shopPlan();
    const { tracker: _cart1, ...untracked } = plan.phases[0];
    cut('shop', { ...plan, phases: [untracked, ...plan.phases.slice(1)] });

    assert.deepStrictEqual(phaseLines('shop'), [
      'phase: phase 1 of 5, "The cart": merged',
      'phase: phase 2 of 5, "Saving": merged — tasks 2.1 done, 2.2 closed',
      'phase: phase 3 of 5, "Cards": merged — tasks 3.1 done',
      'phase: phase 4 of 5, "Charges": written — tasks 4.1 done, 4.2 in progress, 4.3 not started',
      'phase: phase 5 of 5, "Export": written — tasks 5.1 not started',
    ]);
    const menu = harness.output(dir, ['render', 'start-menu'], { env: SESSION }).replace(/\*\n\s+\*/g, ' ');
    assert.deepStrictEqual(['Tally', 'Shop'].map((title) => new RegExp(`${title} — \\*([^*]+)\\*`).exec(menu)?.[1]), ['waiting on the migration\'s cut', 'build, phase 4 of 5, not yet written']);
    for (const end of ['start', 'close']) {
      assert.strictEqual(refuses(dir, ['checklist', 'show', `phase-${end}`, 'shop', '2'], { env: SESSION }).error,
        `checklist show: shop's phase 2 was built before the migration cut it, so it has no checklist to ${end} it`);
    }
    assert.deepStrictEqual(ok(dir, ['checklist', 'show', 'phase-start', 'shop', '4'], { env: SESSION }).items.find(({ key }) => key === 'relies-on-done').state, 'done');
  });

  it('reads the joined spec as joined: an area whole on the board\'s section page and in the task writer\'s brief, an area a builder\'s task cites in its brief, the spec complete on the board', () => {
    cut('shop', shopPlan());
    const area = '## 2. Pay\n\n#### Cards\n\nVisa and more.\n\n##### Refunds\n\nWhole or part.';
    const task = statePath(dir, '.cache/shop/build/phase-4/task-writer/receipt.md');
    writeState(dir, '.cache/shop/build/phase-4/task-writer/receipt.md', [
      '# Email a receipt', '', '## Type', 'feat', '', '## Problem', 'A refund sends nothing.', '', '## Solution', 'Email the receipt.', '',
      '## Outcome', 'Someone refunded has a receipt.', '', '## Acceptance scenarios', `- 2.S2: ${SCENARIOS[1]}`, '', '## Spec reference', '§2', '',
    ].join('\n'));
    ok(dir, ['task', 'create', 'shop', '4', '--file', task], { env: SESSION });

    const { view } = ok(dir, ['board', SESSION.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--unit', 'shop', '--page', 'section:2'], { env: SESSION });
    assert.deepStrictEqual(view, { kind: 'section', unit: 'shop', number: '2', title: 'Pay', changed_by: [], text: area.slice('## 2. Pay\n\n'.length) });
    assert.ok(briefText(['task-writer', 'shop', '5']).includes(`- §2, first built in phase 4\n\n${area}`), 'the task writer reads the area its phase draws on');
    assert.ok(briefText(['builder', 'shop', '4.4']).includes(area), 'the builder reads the area its task cites');
    assert.deepStrictEqual(ok(dir, ['board', SESSION.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--unit', 'shop'], { env: SESSION }).view.spec.state, 'complete');
  });

  it('holds the joined spec concluded from the move on, before any cut: its land refused, a Write or Edit of it refused by the layout\'s hook (21.8.5, 11.9.1)', () => {
    const spec = statePath(dir, 'shop/spec.md');

    assert.strictEqual(refuses(dir, ['spec', 'land', 'shop'], { env: SESSION }).error, 'spec land: shop\'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger');
    for (const [tool, input] of [['Write', { file_path: spec, content: 'x' }], ['Edit', { file_path: spec, old_string: 'a', new_string: 'b' }]]) {
      const stdin = JSON.stringify({ session_id: SESSION.CLAUDE_CODE_SESSION_ID, cwd: dir, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
      const { code, stderr } = harness.call(dir, ['layout', 'guard'], { env: SESSION, stdin });
      assert.deepStrictEqual({ code, stderr }, { code: 2, stderr: '.leeway/shop/spec.md is shop\'s concluded spec, never corrected — a later change replaces its entry on the ledger\n' }, tool);
    }
  });

  it('a unit whose every phase was built goes on to its review: the joined spec\'s areas its areas, its fix phase numbered past the built phases (P14)', () => {
    const [counts, totals] = PLANS.tally.phases;
    assert.deepStrictEqual(cut('tally', { phases: [{ name: 'Counts', goal: 'Days counted.', built: true, tracker: counts }, { name: 'Totals', goal: 'Weeks totalled.', built: true, tracker: totals }] }).typed, []);

    const lines = okSections(dir, ['enter', 'review', 'tally'], { env: SESSION }).sections.split('\n');
    assert.deepStrictEqual(lines.filter((line) => /^(area|fix phase): /.test(line)), ['area: 1-tally — §1 Tally', 'fix phase: phase 3, where round 1\'s fix tasks are written']);
  });

  it('21.S29: the tracker stands where the manifest disagrees — the task it credits still in progress, the disagreement an open note; a plan marking a phase built while it holds a task open refused, the tracker winning, the names given kept and nothing else written', () => {
    const plan = shopPlan();
    const built = { ...plan, phases: plan.phases.map((phase, at) => (at === 3 ? { name: phase.name, goal: phase.goal, built: true, tracker: phase.tracker } : phase)) };
    const spec = readState(dir, 'shop/spec.md');
    const manifest = readState(dir, 'shop/manifest.json');

    assert.strictEqual(refuses(dir, cutArgs('shop', { ...built, scenarios: { 2: [SCENARIOS[2]] }, phases: built.phases.map((phase, at) => (at === 4 ? { ...phase, scenarios: ['2.S1'] } : phase)) }), { env: SESSION }).error,
      'phase 4 is marked built, and the tracker holds task 4.2, task 4.3 neither done nor closed — the tracker wins: a phase built has every task ended');
    assert.deepStrictEqual([readState(dir, 'shop/spec.md'), readState(dir, 'shop/manifest.json'), fs.existsSync(markPath(dir, 'shop')), stateUnborn(dir)], [spec, manifest, false, true]);
    assert.deepStrictEqual(tracked('shop', 4)[3], ['4.1 done api', '4.2 in-progress api', '4.3 open api']);

    cut('shop', plan);
    assert.deepStrictEqual([readState(dir, 'shop/build/notes.md'), DRIVER.show(statePath(dir), { unit: 'shop', phase: 4, n: 2 })?.status],
      [`## Note 1\n\n${NOTES[0]}\n\n## Note 2\n\n${NOTES[1]}\n`, 'in-progress']);
  });

  it('21.S30: the banked findings notes for later, taken at the next phase\'s end and numbered on by the next note; the staging gone with the old plan\'s items', () => {
    cut('shop', shopPlan());
    writeState(dir, '.cache/shop/note.md', 'The receipt wants the shop\'s logo.\n');

    assert.deepStrictEqual(ok(dir, ['task', 'note', 'shop', '--file', statePath(dir, '.cache/shop/note.md')], { env: SESSION }).number, 3);
    assert.deepStrictEqual(ok(dir, ['checklist', 'show', 'phase-close', 'shop', '4'], { env: SESSION }).items.find(({ key }) => key === 'notes-consolidated').state, 'open');
    assert.ok(!/staging|bank/.test(readState(dir, 'shop/manifest.json')), 'no staging, banked finding or old item stands on the manifest');
  });

  it('runs only while the migration does, as `task adopt` does, writing nothing outside it (E13)', () => {
    migrationDone();
    const head = git(statePath(dir), ['rev-parse', 'HEAD']);
    const outside = [cutArgs('shop', shopPlan()), ['task', 'adopt', 'memo', '1', '--parent', PLANS.memo.phases[0]]].map((args) => {
      const before = harness.treeSnapshot(dir);
      const { error } = refuses(dir, args, { env: SESSION });
      assert.deepStrictEqual(harness.treeSnapshot(dir), before, `engine ${args.join(' ')} wrote on refusing`);
      return error;
    });

    assert.deepStrictEqual(outside, [
      'cut: a unit is cut by the migration only while it runs — the state branch has its first commit, so the migration is done',
      'a plan from before Leeway is adopted only while the migration runs — the state branch has its first commit, so the migration is done',
    ]);
    assert.strictEqual(git(statePath(dir), ['rev-parse', 'HEAD']), head);
  });

  it('refuses, writing nothing, a unit it has cut, one whose specs the move did not join, and a plan of another shape, its scenarios or notes amiss, or its cut refused by the spec its scenarios leave', () => {
    const plan = shopPlan();
    const cuts = [
      ['memo', plan, 'cut: memo\'s specs were not joined by the migration — it cuts only a unit whose building started, its spec.md those specs joined'],
      ['shop', 'not json', /^cut: .*shop-plan\.json holds no plan: /],
      ['shop', { ...plan, staging: [] }, /^cut: .*shop-plan\.json holds no plan — a plan is \{"phases"/],
      ['shop', { ...plan, scenarios: { 2: ['Given a card,\nwhen it is charged'], first: ['x'] }, notes: ['', '## Note 9\n\nA note in a note.'] },
        'cut: scenario 2.S1 is not one line of text; the plan\'s scenarios name "first", which is no area\'s number; note 1 holds nothing; note 2 holds a heading at level one or two, which would read as another note — "## Note 9"'],
      ['shop', { ...plan, scenarios: { ...plan.scenarios, 3: ['Given more.'] } }, 'cut: the plan\'s scenarios are for area 3, which spec.md lacks'],
      ['shop', { ...plan, phases: plan.phases.map((phase, at) => (at === 4 ? { ...phase, scenarios: [], tracker: plan.phases[3].tracker } : phase)) },
        `cut: phases 4 and 5 name one tracker parent, ${plan.phases[3].tracker}; scenario 2.S3 is in no phase`],
    ];
    for (const [unit, given, refusal] of cuts) {
      const error = untouched(cutArgs(String(unit), given));
      if (typeof refusal === 'string') assert.strictEqual(error, refusal);
      else assert.match(error, /** @type {RegExp} */ (refusal));
    }
    cut('shop', plan);
    assert.strictEqual(untouched(cutArgs('shop', plan)), `cut: the migration has cut shop already — its mark is ${markPath(dir, 'shop')}`);
  });

  it('a run killed at each of its writes — after the tracker\'s steps, writing the spec, the notes or the manifest, before its mark — run again to what a whole run leaves', () => {
    const plan = shopPlan();
    const whole = world();
    const kept = dir;
    dir = whole;
    cut('shop', plan);
    const leaves = (/** @type {string} */ at) => [readState(at, 'shop/spec.md'), readState(at, 'shop/build/notes.md'), readState(at, 'shop/manifest.json'), stateUnborn(at), fs.existsSync(markPath(at, 'shop'))];
    const expected = [...leaves(whole), tracked('shop', 5)];
    dir = kept;
    try {
      for (const at of [
        { method: 'renameSync', file: 'shop/spec.md', when: 'before' },
        { method: 'renameSync', file: 'shop/spec.md', when: 'after' },
        { method: 'renameSync', file: 'shop/build/notes.md', when: 'after' },
        { method: 'renameSync', file: 'shop/manifest.json', when: 'after' },
        { method: 'renameSync', file: 'migrate/cut/shop.json', when: 'before' },
      ]) killedAt(/** @type {import('./engine-harness.cjs').KillPoint} */ (at), dir, cutArgs('shop', plan), { env: SESSION });
      cut('shop', plan);
      assert.deepStrictEqual([...leaves(dir), tracked('shop', 5)], expected);
    } finally {
      cleanupFixture(path.dirname(whole));
    }
  });
});

describe('a plan from before Leeway adopted through the task verbs (21.8.8, 21.8.4)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('adopts a phase of a nothing-built unit\'s plan, again to the same with nothing written, and closes its tasks through the task verbs, each commit held', () => {
    const args = ['task', 'adopt', 'memo', '1', '--parent', PLANS.memo.phases[0]];
    const adopted = ok(dir, args, { env: SESSION });
    const store = DRIVER.storeFiles().map((file) => readState(dir, file));

    assert.deepStrictEqual(adopted, { ok: true, phase: 1, parent: PLANS.memo.phases[0], tasks: ['1.1', '1.2'], committed: null, note: HELD });
    assert.deepStrictEqual([ok(dir, args, { env: SESSION }).tasks, DRIVER.storeFiles().map((file) => readState(dir, file))], [['1.1', '1.2'], store]);
    for (const task of ['1.1', '1.2']) ok(dir, ['task', 'close', 'memo', task, '--reason', 'Nothing was built under the old plan; the spec is written fresh.'], { env: SESSION });
    assert.deepStrictEqual([tracked('memo', 1), stateUnborn(dir)], [[['1.1 closed api', '1.2 closed api']], true]);
  });
});
