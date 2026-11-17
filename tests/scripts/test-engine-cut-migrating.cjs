'use strict';

// ---------------------------------------------------------------------------
// `engine cut <unit> --migrating --file <plan.json>` and `engine task
// close-plan` (ledger-engine/scripts/domain/cut-migrating.cjs,
// task-verbs.cjs; 21.7.1, 21.8.4–21.8.8, 21.5.21, 11.5.8, 11.5.9, P3, E6,
// E13): a unit whose building started cut by the migration, its plan
// applied whole — its old plans' phases the cut, the built ones name, goal,
// the areas their old plan built and built, the unfinished ones their
// scenarios, written into the joined spec's block for their area, their
// sections and what they rely on; each phase's tracker parent adopted,
// every task's id and tracker state as they stood but the type of each not
// ended, its other tags kept; the tasks of the phases not built it holds
// done named done before, a cancelled one not among them; the areas each
// task of them not ended cites by an old spec's path, in each of its forms,
// recorded once each, a path naming another unit or a topic not joined
// citing none and a task citing none left out; the notes for later written
// whole; the build begun in step and the old plan's items gone; all held
// for the migration's commit, then the unit marked. The unit read after as
// the build reads it: its built phases merged and closed, with no
// checklist, in the build's standing, its progress, an adopted phase
// written, and its review's fix numbering; how much of an area was built
// before the migration, from the phases placing it alone; its joined
// spec's areas on the board's section page, in the task writer's and
// builder's briefs and as the review's areas; concluded from the move on,
// before any cut, for the spec's land and the layout's hook. Refused, the
// tracker read through and nothing written to it or anywhere else: a plan
// marking built a phase with a task open, or not built one with none, the
// tracker winning; a built phase naming a section outside the area of its
// old plan's topic; a link holding a task not ended after an unfinished one
// of a later phase or another unit's, naming each by its titles and the
// remedy, the tracker's, the tracker left as it was so a plan cut in the
// link's order is then taken; and, writing nothing at all, a built phase
// naming no tracker parent or no section, a phase still to build placing no
// scenario, an area of the joined spec no phase places, and every refusal
// of the verb's own —
// outside the migration, a unit marked or not joined, a plan of another
// shape or whose cut the spec refuses. A run killed at each of its writes
// run again to what a whole run leaves, and a run again whose plan holds no
// notes taking away those a run before wrote. Each phase's tasks named in
// its old plan's order, its task ids from the unit's task map by number and
// then the letters after them, pigeon's five phases the tracker holds out of
// that order among them, and a run again after the task map went keeping
// each name. `task close-plan` in the migration alone: the
// plan of a unit that built nothing closed under its root, a bugfix's
// reproducing task among its tasks, the build's first phase then written
// free of it (21.8.4); a unit whose spec the migration joined refused, and
// a plan holding a task done, the tracker winning. A quick-fix's tasks
// typed fix (21.5.21).
//
// Layer: verb, the kills spawned. World: a project in today's layout — an
// epic of two specs, one built and one partly, a feature built with its
// review owed, and a feature and a bugfix with nothing built, each with its
// old plan in the project's tracker — moved by the real move (078)
// (migrated-world.cjs), so the specs are joined as the move joins them;
// made once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, refuses, okSections, git, statePath, readState, writeState, cleanupFixture, killedAt } = harness;
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { SESSION, stateUnborn, refusedUntouched } = require('./migration-world.cjs');
const { DRIVER, SIDE, oldTask, movedProject } = require('./migrated-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { jsonText } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const { briefPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { markPath, migratedType, oldPlanOrder } = require(path.join(SCRIPTS, 'domain/cut-migrating.cjs'));
const { areaBuilt } = require(path.join(SCRIPTS, 'domain/derivations.cjs'));

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
    review: { items: { cart: { status: 'in-progress', reviewed_tasks: ['cart-1-1'] } } },
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

/** A bugfix whose investigation and spec concluded and whose plan was written, nothing built. */
const CRASH = {
  name: 'crash', work_type: 'bugfix', status: 'in-progress', description: 'crash', created: '2026-01-01',
  phases: {
    investigation: { items: { crash: { status: 'completed' } } },
    specification: { items: { crash: { status: 'completed' } } },
    planning: { items: { crash: { status: 'completed', format: 'sample-format' } } },
  },
};

const OLD = {
  'README.md': '# Shop\n',
  '.workflows/manifest.json': jsonText({
    work_units: Object.fromEntries([['shop', 'epic'], ['tally', 'feature'], ['memo', 'feature'], ['crash', 'bugfix'], ['relay', 'feature']].map(([name, type]) => [name, { work_type: type }])),
  }),
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
  '.workflows/relay/manifest.json': jsonText(feature('relay', 'completed')),
  '.workflows/relay/discussion/relay.md': '# Discussion: Relay\n',
  '.workflows/relay/specification/relay/specification.md': '# Specification: Relay\n\n## Relaying\n\nOne hop.\n',
  '.workflows/crash/manifest.json': jsonText(CRASH),
  '.workflows/crash/investigation/crash.md': '# Investigation: Crash\n',
  '.workflows/crash/specification/crash/specification.md': '# Specification: Crash\n\n## The fix\n\nNo crash on save.\n',
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

/** @typedef {import('./migrated-world.cjs').OldPlan} OldPlan */
/** The tracker's ids of each old plan's root and phases, the same in every copy of the world. @type {Record<'cart'|'pay'|'tally'|'memo'|'crash'|'relay', OldPlan>} */
let PLANS;

/** @param {string} dir */
function buildWorld(dir) {
  return movedProject(dir, OLD, {
    cart: [{ title: 'The cart', tasks: ['Hold items', 'Show the cart'] }, { title: 'Saving', tasks: ['Save the cart', 'Share the cart'] }],
    pay: [
      { title: 'Cards', tasks: ['Take a card'] },
      {
        title: 'Charges',
        tasks: [
          { title: 'Charge the card', text: oldTask('Nothing is charged.', '.workflows/specification/pay/specification.md') },
          { title: 'Refund a charge', text: oldTask('A charge is kept for good.', '.workflows/shop/specification/pay/specification.md') },
          { title: 'Email a receipt', text: oldTask('A charge is silent: `docs/workflow/specification/pay/specification.md`, and `.workflows/specification/cart/specification.md`.', 'docs/workflow/specification/pay.md') },
        ],
      },
      { title: 'Export', tasks: [{ title: 'Export payments', text: oldTask('Payments stay in the shop, as till\'s `.workflows/till/specification/cart/specification.md` keeps its carts and `.workflows/shop/specification/ledger/specification.md` its books.') }, 'Export as sheets'] },
    ],
    tally: [{ title: 'Counts', tasks: ['Count a day'] }, { title: 'Totals', tasks: ['Total a week'] }],
    memo: [{ title: 'Memos', tasks: ['Write a memo', 'Pin a memo'] }],
    crash: [{ title: 'The crash', tasks: ['Reproduce the crash', 'Fix the crash'] }],
    relay: [{ title: 'Relays', tasks: ['Relay 1', 'Relay 2', 'Relay 1b'] }],
  }, [
    ['done', 'Hold items'], ['done', 'Show the cart'], ['done', 'Save the cart'], ['cancel', 'Share the cart'],
    ['done', 'Take a card'], ['done', 'Charge the card'], ['start', 'Refund a charge'], ['cancel', 'Export as sheets'],
    ['done', 'Count a day'], ['done', 'Total a week'],
    ['done', 'Relay 1'], ['done', 'Relay 2'], ['done', 'Relay 1b'],
  ]);
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

/** The epic's plan as the directive writes it: three phases built, each with the area its old plan built, two not, the tracker parents named. */
function shopPlan() {
  const [cart1, cart2] = PLANS.cart.phases;
  const [pay1, pay2, pay3] = PLANS.pay.phases;
  return {
    phases: [
      { name: 'The cart', goal: 'Items held.', sections: ['1'], built: true, tracker: cart1 },
      { name: 'Saving', goal: 'Carts kept.', sections: ['1'], built: true, tracker: cart2 },
      { name: 'Cards', goal: 'Cards taken.', sections: ['2'], built: true, tracker: pay1 },
      { name: 'Charges', goal: 'Cards charged and refunded.', scenarios: ['2.S1', '2.S2'], sections: ['2'], relies_on: [3], tracker: pay2 },
      { name: 'Export', goal: 'Payments exported.', scenarios: ['2.S3'], sections: ['2'], relies_on: [4], tracker: pay3 },
    ],
    scenarios: { 2: SCENARIOS },
    notes: NOTES,
    answers: { uncovered: 'none' },
  };
}

/** The feature's plan as the directive writes it: both phases built. */
function tallyPlan() {
  const [counts, totals] = PLANS.tally.phases;
  return { phases: [{ name: 'Counts', goal: 'Days counted.', sections: ['1'], built: true, tracker: counts }, { name: 'Totals', goal: 'Weeks totalled.', sections: ['1'], built: true, tracker: totals }] };
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

/** The tracker's store as the state holds it. */
const store = () => DRIVER.storeFiles().map((file) => readState(dir, file));

/**
 * A call that must refuse having written nothing to the tracker's store, the
 * unit's spec or manifest, or its mark — the tracker's setup, which any
 * refused tracker verb keeps, apart: its error.
 * @param {string} unit @param {string[]} args
 */
function trackerUntouched(unit, args) {
  const spec = () => (fs.existsSync(statePath(dir, `${unit}/spec.md`)) ? readState(dir, `${unit}/spec.md`) : null);
  const held = () => [store(), spec(), readState(dir, `${unit}/manifest.json`), fs.existsSync(markPath(dir, unit)), stateUnborn(dir)];
  const before = held();
  const { error } = refuses(dir, args, { env: SESSION });
  assert.deepStrictEqual(held(), before, `engine ${args.join(' ')} wrote on refusing`);
  return error;
}

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

  it('21.S28: two specs joined, one built and one partly, cut through the verbs — the built plan\'s phases name, goal, sections and built, the unfinished ones their scenarios, sections and relies-on, their scenarios in spec.md\'s block for their area; each phase naming its tracker parent; every task\'s id and tracker state as they stood, each neither done nor closed now typed feat beside its other tags; the tasks done before, and the areas each task not ended cites; the build begun in step and the items of the old plan and its review gone, all held, the unit marked (21.5.21, 11.5.8, 11.5.9, P3)', () => {
    const before = SIDE.apartFromNames(statePath(dir), 'shop', false);
    const plan = shopPlan();

    assert.deepStrictEqual(cut('shop', plan), {
      ok: true, unit: 'shop', phases: 5, built: 3,
      adopted: [{ phase: 1, tasks: ['1.1', '1.2'] }, { phase: 2, tasks: ['2.1', '2.2'] }, { phase: 3, tasks: ['3.1'] }, { phase: 4, tasks: ['4.1', '4.2', '4.3'] }, { phase: 5, tasks: ['5.1', '5.2'] }],
      typed: ['4.2', '4.3', '5.1'], scenarios: 3, notes: 2, committed: null, note: HELD,
    });
    const { phases, spec, cut: written, build } = manifestOf('shop');
    assert.deepStrictEqual([written, Object.keys(phases), spec], [{ phases: plan.phases }, ['discovery', 'discussion'], { joined: ['cart', 'pay'] }]);
    assert.deepStrictEqual(build, { position: 'step', done_before: ['4.1'], cites: { '4.2': ['2'], '4.3': ['1', '2'] } },
      'done before: the done task of a phase not built, never a cancelled one; cites: an old spec by each of its paths, once each, a path naming another unit or a topic not joined citing none, a task citing none left out');
    assert.strictEqual(readState(dir, 'shop/spec.md'), CUT_SPEC);
    assert.deepStrictEqual(SIDE.apartFromNames(statePath(dir), 'shop', false), before);
    assert.deepStrictEqual(tracked('shop', 5), [
      ['1.1 done null', '1.2 done null'], ['2.1 done null', '2.2 closed null'], ['3.1 done null'], ['4.1 done null', '4.2 in-progress feat', '4.3 open feat'], ['5.1 open feat', '5.2 closed null'],
    ]);
    assert.deepStrictEqual(SIDE.tagsOf(statePath(dir), 'Refund a charge').toSorted(), ['api', 'feat', 'planned'], 'typed, its old tags kept');
    assert.deepStrictEqual([stateUnborn(dir), fs.existsSync(markPath(dir, 'shop'))], [true, true]);
  });

  it('reads a built phase merged and closed wherever a phase is read — the build\'s standing, its progress, no checklist of its own — the first not built the one the build goes on in', () => {
    cut('shop', shopPlan());

    assert.deepStrictEqual(phaseLines('shop'), [
      'phase: phase 1 of 5, "The cart": merged — tasks 1.1 done, 1.2 done',
      'phase: phase 2 of 5, "Saving": merged — tasks 2.1 done, 2.2 closed',
      'phase: phase 3 of 5, "Cards": merged — tasks 3.1 done',
      'phase: phase 4 of 5, "Charges": written — tasks 4.1 done, 4.2 in progress, 4.3 not started',
      'phase: phase 5 of 5, "Export": written — tasks 5.1 not started, 5.2 closed',
    ]);
    const menu = harness.output(dir, ['render', 'start-menu'], { env: SESSION }).replace(/\*\n\s+\*/g, ' ');
    assert.strictEqual(/Shop — \*([^*]+)\*/.exec(menu)?.[1], 'build, phase 4 of 5',
      'the phase the build goes on in written, its tasks the old plan\'s');
    for (const end of ['start', 'close']) {
      assert.strictEqual(refuses(dir, ['checklist', 'show', `phase-${end}`, 'shop', '2'], { env: SESSION }).error,
        `checklist show: shop's phase 2 was built before the migration cut it, so it has no checklist to ${end} it`);
    }
    assert.deepStrictEqual(ok(dir, ['checklist', 'show', 'phase-start', 'shop', '4'], { env: SESSION }).items.find(({ key }) => key === 'relies-on-done').state, 'done');
  });

  it('tells how much of an area was built before the migration from the phases placing it — by their sections, scenarios or a task\'s citation — built where each placing it was built, partly where some was or holds a task done before, none where none was and for a unit that landed nothing before, a task of phase 12 never phase 1\'s (21.8.8)', () => {
    const built = (/** @type {string[]} */ sections) => ({ name: 'Built', goal: 'Built.', sections, built: true });
    const toBuild = (/** @type {string[]} */ sections) => ({ name: 'To build', goal: 'To build.', sections, scenarios: [], relies_on: [] });
    const unit = (/** @type {object[]} */ phases, build = {}) => ({ cut: { phases }, build: { position: 'step', ...build } });
    const areas = (/** @type {Record<string, any>} */ manifest, /** @type {string[]} */ numbers) => numbers.map((area) => areaBuilt(manifest, area));

    assert.deepStrictEqual([
      areas(unit([built(['1']), built(['1.2']), toBuild(['2']), toBuild(['3'])], { done_before: ['3.1'] }), ['1', '2', '3', '4']),
      areas(unit([built(['1']), toBuild(['1', '2'])]), ['1', '2']),
      areas(unit([built(['1']), toBuild(['2'])], { cites: { '2.1': ['1'] } }), ['1', '2']),
      areas(unit([toBuild(['1']), toBuild(['2'])], { cites: { '2.1': ['1'] } }), ['1', '2']),
      areas(unit([toBuild(['1'])], { done_before: ['12.1'] }), ['1']),
      areas(unit([built(['2'])], { cites: { '12.1': ['1'] } }), ['1']),
    ], [
      ['built', 'partly', null, null],
      ['partly', null],
      ['partly', null],
      [null, null],
      [null],
      [null],
    ], 'built by each phase placing it, a part placing its area; partly where a phase still to build places it too, holds a task done before alone or cites it; none where no phase built or done before places it');
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
    assert.ok(briefText(['task-writer', 'shop', '5']).includes(`- §2, first built in phase 3, before the migration cut the unit\n\n${area}`), 'the task writer reads the area its phase draws on, first built by a phase built before');
    assert.ok(briefText(['builder', 'shop', '4.4']).includes(area), 'the builder reads the area its task cites');
    const old = briefText(['builder', 'shop', '4.2']);
    assert.deepStrictEqual([old.includes(area), old.includes('## 1. Cart')], [true, false], 'an old task, citing §2 by an old spec\'s path, briefed on §2 alone');
    assert.deepStrictEqual(ok(dir, ['board', SESSION.CLAUDE_CODE_SESSION_ID, '--tab', 'unit', '--unit', 'shop'], { env: SESSION }).view.spec.state, 'complete');
  });

  it('holds the joined spec concluded from the move on, before any cut: its land refused, a Write or Edit of it refused by the layout\'s hook (21.8.5, 11.9.1)', () => {
    const spec = statePath(dir, 'shop/spec.md');

    assert.strictEqual(refuses(dir, ['spec', 'land', 'shop'], { env: SESSION }).error, 'spec land: shop\'s spec is concluded, and a concluded spec is never corrected — a later change replaces its entry on the ledger');
    for (const [tool, input] of [['Write', { file_path: spec, content: 'x' }], ['Edit', { file_path: spec, old_string: 'a', new_string: 'b' }]]) {
      const stdin = JSON.stringify({ session_id: SESSION.CLAUDE_CODE_SESSION_ID, cwd: dir, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
      const { code, stderr } = harness.call(dir, ['layout', 'guard'], { env: SESSION, stdin });
      assert.deepStrictEqual({ code, stderr }, { code: 2, stderr: '.ledger/shop/spec.md is shop\'s concluded spec, never corrected — a later change replaces its entry on the ledger\n' }, tool);
    }
  });

  it('a unit whose every phase was built goes on to its review: the joined spec\'s areas its areas, its fix phase numbered past the built phases (P14)', () => {
    assert.deepStrictEqual(cut('tally', tallyPlan()).typed, []);

    const lines = okSections(dir, ['enter', 'review', 'tally'], { env: SESSION }).sections.split('\n');
    assert.deepStrictEqual(lines.filter((line) => /^(area|fix phase): /.test(line)), ['area: 1-tally — §1 Tally', 'fix phase: phase 3, where round 1\'s fix tasks are written']);
  });

  it('21.S29: the tracker stands where the manifest disagrees — the task it credits still in progress, the disagreement an open note; a plan marking a phase built while it holds a task open, or not built while it holds none, refused, the tracker winning, nothing written to it or the unit', () => {
    const plan = shopPlan();
    const built = { ...plan, phases: plan.phases.map((phase, at) => (at === 3 ? { name: phase.name, goal: phase.goal, sections: ['2'], built: true, tracker: phase.tracker } : phase)) };
    const [counts, totals] = PLANS.tally.phases;

    assert.strictEqual(trackerUntouched('shop', cutArgs('shop', { ...built, scenarios: { 2: [SCENARIOS[2]] }, phases: built.phases.map((phase, at) => (at === 4 ? { ...phase, scenarios: ['2.S1'] } : phase)) })),
      'cut: phase 4 is marked built, and the tracker holds task 4.2, task 4.3 neither done nor closed — the tracker wins: a phase built has every task ended');
    assert.strictEqual(trackerUntouched('tally', cutArgs('tally', {
      phases: [{ name: 'Counts', goal: 'Days counted.', sections: ['1'], built: true, tracker: counts }, { name: 'Totals', goal: 'Weeks totalled.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: totals }],
      scenarios: { 1: ['Given a week of counts, when it ends, then its total shows.'] },
    })), 'cut: phase 2 is not marked built, and the tracker holds no task of it neither done nor closed — the tracker wins: mark it built');

    cut('shop', plan);
    assert.deepStrictEqual([readState(dir, 'shop/build/notes.md'), DRIVER.show(statePath(dir), { unit: 'shop', phase: 4, n: 2 })?.status],
      [`## Note 1\n\n${NOTES[0]}\n\n## Note 2\n\n${NOTES[1]}\n`, 'in-progress']);
  });

  it('refuses, nothing written to the tracker or the unit, a phase marked built naming a section outside the area of its old plan\'s topic — the topic its plan\'s root names', () => {
    const plan = shopPlan();
    assert.strictEqual(trackerUntouched('shop', cutArgs('shop', { ...plan, phases: plan.phases.map((phase, at) => (at === 2 ? { ...phase, sections: ['1', '2'] } : phase)) })),
      'cut: phase 3 is marked built with §1, outside §2, the area of its old plan\'s topic, pay — a phase built before the migration names only what its old plan built');
  });

  it('says a phase\'s review passes with nothing to read only where nothing was built since the migration: a phase whose every task was closed since, none landed before, is no such phase', () => {
    cut('shop', shopPlan());
    ok(dir, ['task', 'close', 'shop', '5.1', '--reason', 'Exports wait for the shop\'s accounts.'], { env: SESSION });
    const { error } = refuses(dir, ['brief', 'phase-review', 'shop', '5', '--letter', 'a'], { env: SESSION });
    assert.doesNotMatch(error, /nothing to read/);
    assert.strictEqual(ok(dir, ['checklist', 'show', 'phase-close', 'shop', '5'], { env: SESSION }).items.find(({ key }) => key === 'phase-review-passed').state, 'open');
  });

  it('21.S30: the notes for later, taken at the next phase\'s end and numbered on by the next note; the bank and the staging gone with the old plan\'s items', () => {
    cut('shop', shopPlan());
    writeState(dir, '.cache/shop/note.md', 'The receipt wants the shop\'s logo.\n');

    assert.deepStrictEqual(ok(dir, ['task', 'note', 'shop', '--file', statePath(dir, '.cache/shop/note.md')], { env: SESSION }).number, 3);
    assert.deepStrictEqual(ok(dir, ['checklist', 'show', 'phase-close', 'shop', '4'], { env: SESSION }).items.find(({ key }) => key === 'notes-consolidated').state, 'open');
    assert.ok(!/staging|bank/.test(readState(dir, 'shop/manifest.json')), 'no staging, banked finding or old item stands on the manifest');
  });

  it('refuses, nothing written to the tracker or the unit, a link holding a task neither done nor closed after one neither, of a later phase or another unit\'s — `task link`\'s rule (12.6.4, 7.1.14) — naming each by its title, and the remedy the tracker\'s, never a piece\'s; a link after an ended task, another unit\'s among them, or holding an ended one, holding nothing up', () => {
    const root = statePath(dir);
    DRIVER.adopt(root, 'memo', 1, PLANS.memo.phases[0]);
    cut('tally', tallyPlan());
    for (const [title, after] of [['Refund a charge', 'Export payments'], ['Email a receipt', 'Take a card'], ['Email a receipt', 'Write a memo'], ['Refund a charge', 'Count a day'], ['Charge the card', 'Export payments']]) SIDE.linkBy(root, title, after);

    assert.strictEqual(trackerUntouched('shop', cutArgs('shop', shopPlan())), [
      'cut: task 4.2, "Refund a charge", is held after task 5.1, "Export payments", of a later phase — a task waits on its own phase\'s or an earlier one\'s alone, so 4.2 would never start: the link is the tracker\'s, which no piece of the plan settles — where it no longer holds, task unlink shop 4.2 --after 5.1 --file <plan.json> takes it off',
      'task 4.3, "Email a receipt", is held after task 1.1 of memo, "Write a memo", another unit\'s — a task waits on its own unit\'s alone, so 4.3 would never start: the link is the tracker\'s, which no piece of the plan settles — where it no longer holds, task unlink shop 4.3 --after memo-1-1 --file <plan.json> takes it off',
    ].join('; '));

    const plan = cutArgs('shop', shopPlan()).at(-1);
    const unlinked = [['4.2', '5.1'], ['4.3', 'memo-1-1']].map(([task, after]) => ok(dir, ['task', 'unlink', 'shop', task, '--after', after, '--file', String(plan)], { env: SESSION }));
    assert.deepStrictEqual(unlinked.map(({ task, after }) => [task, after]), [['4.2', '5.1'], ['4.3', 'memo-1-1']]);
    cut('shop', shopPlan());
    const after = (/** @type {number} */ n) => DRIVER.show(root, { unit: 'shop', phase: 4, n })?.after.map(({ unit, phase, n: m }) => `${unit}-${phase}-${m}`);
    assert.deepStrictEqual([after(2)?.includes('shop-5-1'), after(3)?.includes('memo-1-1'), after(3)?.includes('shop-3-1')], [false, false, true]);
  });

  it('refuses, nothing written to the tracker or the unit, another unit\'s task neither done nor closed held after one of the unit\'s neither — that unit cut first, before the unit\'s tasks had names — the remedy named through the unit\'s plan, which task unlink takes; a link after one of the unit\'s ended, or holding another unit\'s ended, holding nothing up', () => {
    const root = statePath(dir);
    const [counts, totals] = PLANS.tally.phases;
    DRIVER.adopt(root, 'memo', 1, PLANS.memo.phases[0]);
    SIDE.reopenTask(root, 'Total a week');
    for (const [title, after] of [['Total a week', 'Email a receipt'], ['Total a week', 'Take a card'], ['Count a day', 'Email a receipt']]) SIDE.linkBy(root, title, after);
    cut('tally', {
      phases: [{ name: 'Counts', goal: 'Days counted.', sections: ['1'], built: true, tracker: counts }, { name: 'Totals', goal: 'Weeks totalled.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: totals }],
      scenarios: { 1: ['Given a week of counts, when it ends, then its total shows.'] },
    });
    const plan = String(cutArgs('shop', shopPlan()).at(-1));
    const unlink = (/** @type {string} */ task) => ['task', 'unlink', 'shop', task, '--after', '4.3', '--file', plan];

    assert.deepStrictEqual([trackerUntouched('shop', cutArgs('shop', shopPlan())), trackerUntouched('shop', unlink('memo-1-1'))], [
      'cut: task 2.1 of tally, "Total a week", is held after task 4.3, "Email a receipt", another unit\'s — a task waits on its own unit\'s alone, so task 2.1 of tally would never start: the link is the tracker\'s, which no piece of the plan settles — where it no longer holds, task unlink shop tally-2-1 --after 4.3 --file <plan.json> takes it off',
      'task memo-1-1 is held after no task of shop\'s — the link is not there to take off',
    ]);

    const unlinked = ok(dir, unlink('tally-2-1'), { env: SESSION });
    cut('shop', shopPlan());
    assert.deepStrictEqual([unlinked.task, unlinked.after, DRIVER.show(root, { unit: 'tally', phase: 2, n: 1 })?.after], ['tally-2-1', '4.3', [{ unit: 'shop', phase: 3, n: 1 }]]);
  });

  it('task unlink refuses a link the tracker does not hold, a task no adopted phase holds, two tasks neither of them the unit\'s, no plan, and a unit cut already, writing nothing', () => {
    const root = statePath(dir);
    DRIVER.adopt(root, 'memo', 1, PLANS.memo.phases[0]);
    cut('tally', tallyPlan());
    for (const after of ['Write a memo', 'Email a receipt']) SIDE.linkBy(root, 'Total a week', after);
    const plan = String(cutArgs('shop', shopPlan()).at(-1));
    const unlink = (/** @type {string} */ task, /** @type {string} */ after, /** @type {string[]} */ file = ['--file', plan]) => trackerUntouched('shop', ['task', 'unlink', 'shop', task, '--after', after, ...file]);
    assert.deepStrictEqual([unlink('4.2', '5.1'), unlink('9.1', '5.1'), unlink('tally-2-1', 'memo-1-1'), unlink('4.2', '5.1', [])], [
      'task 4.2 is held after no task 5.1 — the link is not there to take off',
      'no phase the cut adopts holds task 9.1',
      'task unlink: neither tally-2-1 nor memo-1-1 is shop\'s — the cut of shop takes off a link one of whose tasks is its own',
      'Usage: engine task unlink <unit> <task> --after <task> --file <plan.json>',
    ]);
    cut('shop', shopPlan());
    assert.match(unlink('4.2', '5.1'), /^task unlink: the migration has cut shop already/);
  });

  it('a link refused for its phases\' order leaves the tracker as it was, so the plan cutting them in the order the link holds is taken', () => {
    SIDE.linkBy(statePath(dir), 'Refund a charge', 'Export payments');
    const plan = shopPlan();
    const [charges, exporting] = plan.phases.slice(3);
    trackerUntouched('shop', cutArgs('shop', plan));

    assert.deepStrictEqual(cut('shop', { ...plan, phases: [...plan.phases.slice(0, 3), { ...exporting, relies_on: [3] }, { ...charges, relies_on: [4] }] }).adopted.slice(3),
      [{ phase: 4, tasks: ['4.1', '4.2'] }, { phase: 5, tasks: ['5.1', '5.2', '5.3'] }]);
    assert.deepStrictEqual(DRIVER.show(statePath(dir), { unit: 'shop', phase: 5, n: 2 })?.after, [{ unit: 'shop', phase: 4, n: 1 }]);
  });

  it('a run again whose plan holds no notes takes away the notes a run killed before its mark wrote', () => {
    writeState(dir, 'shop/build/notes.md', '## Note 1\n\nWritten by a run killed before its mark.\n');
    cut('shop', { ...shopPlan(), notes: [] });
    assert.strictEqual(fs.existsSync(statePath(dir, 'shop/build/notes.md')), false);
  });

  it('runs only while the migration does, as `task close-plan` and `task unlink` do, writing nothing outside it (E13)', () => {
    migrationDone();
    const head = git(statePath(dir), ['rev-parse', 'HEAD']);
    const plan = cutArgs('shop', shopPlan());
    const outside = [plan, ['task', 'close-plan', 'memo', '--parent', PLANS.memo.root], ['task', 'unlink', 'shop', '4.2', '--after', '5.1', '--file', String(plan.at(-1))]].map((args) => {
      const before = harness.treeSnapshot(dir);
      const { error } = refuses(dir, args, { env: SESSION });
      assert.deepStrictEqual(harness.treeSnapshot(dir), before, `engine ${args.join(' ')} wrote on refusing`);
      return error;
    });

    assert.deepStrictEqual(outside, [
      'cut: a unit is cut by the migration only while it runs — the state branch has its first commit, so the migration is done',
      'a plan from before Ledger is taken in only while the migration runs — the state branch has its first commit, so the migration is done',
      'task unlink: a unit is cut by the migration only while it runs — the state branch has its first commit, so the migration is done',
    ]);
    assert.strictEqual(git(statePath(dir), ['rev-parse', 'HEAD']), head);
  });

  it('refuses, writing nothing, a unit it has cut, one whose specs the move did not join, and a plan of another shape, its scenarios or notes amiss, its cut refused by the spec its scenarios leave, an area of the spec placed by no phase, or a phase as the migration holds none — built with no tracker parent or no section, or still to build placing no scenario', () => {
    const plan = shopPlan();
    const cuts = [
      ['memo', plan, 'cut: memo\'s specs were not joined by the migration — it cuts only a unit whose building started, its spec.md those specs joined'],
      ['shop', 'not json', /^cut: .*shop-plan\.json holds no plan: /],
      ['shop', { ...plan, staging: [] }, /^cut: .*shop-plan\.json holds no plan — a plan is \{"phases"/],
      ['shop', { ...plan, scenarios: { 2: ['Given a card,\nwhen it is charged'], first: ['x'] }, notes: ['', '## Note 9\n\nA note in a note.'] },
        'cut: scenario 2.S1 is not one line of text; the plan\'s scenarios name "first", which is no area\'s number; note 1 holds nothing; note 2 holds a heading at level one or two, which would read as another note — "## Note 9"'],
      ['shop', { ...plan, scenarios: { ...plan.scenarios, 3: ['Given more.'] } }, 'cut: the plan\'s scenarios are for area 3, which spec.md lacks'],
      ['shop', { ...plan, phases: plan.phases.map((phase, at) => (at === 4 ? { ...phase, scenarios: [], tracker: plan.phases[3].tracker } : phase)) },
        `cut: phases 4 and 5 name one tracker parent, ${plan.phases[3].tracker}; phase 5 places no scenario — a phase still to build proves one at least; scenario 2.S3 is in no phase`],
      ['shop', { ...plan, scenarios: { 2: SCENARIOS.slice(0, 2) }, phases: plan.phases.map((phase, at) => (at === 4 ? { ...phase, scenarios: [] } : phase)) },
        'cut: phase 5 places no scenario — a phase still to build proves one at least'],
      ['shop', { ...plan, phases: plan.phases.map((phase, at) => (at === 0 ? { name: phase.name, goal: phase.goal, sections: ['1'], built: true } : phase)) },
        'cut: phase 1 is marked built and names no tracker parent — a phase built before the migration is its old plan\'s, adopted from the tracker'],
      ['shop', { ...plan, phases: plan.phases.map((phase, at) => (at === 2 ? { ...phase, sections: [] } : phase)) },
        'cut: phase 3 is marked built and names no section — a phase built before the migration names the area its old plan built'],
      ['shop', { ...plan, phases: plan.phases.map((phase, at) => (at < 2 ? { ...phase, sections: ['2'] } : phase)) },
        'cut: §1 Cart is placed by no phase — a phase built before the migration names the area its old plan built in its sections, and an area none built is placed by a phase still to build'],
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

describe('the old plan\'s task order, which the migration\'s cut gives adoption (21.8.8)', () => {
  // pigeon's five phases the tracker holds out of their plan's order, each
  // task named by the tracker's id `t:{task id}` and listed in the store's
  // order, the task added late last: app-shell-and-ux 5 (5-1b) and 10
  // (10-15b) beside 1, whose ids 10's share a prefix with; bluetooth-
  // switching 4 (4-9a); peer-networking 2 (2-7) and 5 (5-0, first); and a
  // phase whose store holds a lettered task before the one it follows.
  const run = (/** @type {number} */ from, /** @type {number} */ to) => Array.from({ length: to - from + 1 }, (_, at) => String(from + at));
  /**
   * A phase of an old plan and its task ids in the store's order: `late`, then `moved`, after the rest.
   * @param {string} phase @param {number} last @param {string[]} late @param {string[]} [moved] @returns {[string, string[]]}
   */
  const phaseOf = (phase, last, late, moved = []) => [phase, [...run(1, last).filter((n) => !moved.includes(n)), ...late, ...moved].map((n) => `${phase}-${n}`)];
  /** A topic's old plan's task map, each id the tracker's `t:{id}`. @param {string} topic @param {[string, string[]][]} phases */
  const mapOf = (topic, phases) => ({ task_map: Object.fromEntries([topic, ...phases.flatMap(([phase, ids]) => [phase, ...ids])].map((id) => [id, `t:${id}`])) });
  const PIGEON = {
    phases: {
      planning: {
        items: {
          'app-shell-and-ux': mapOf('app-shell-and-ux', [phaseOf('app-shell-and-ux-1', 3, []), phaseOf('app-shell-and-ux-5', 13, ['1b']), phaseOf('app-shell-and-ux-10', 19, ['15b'])]),
          'bluetooth-switching': mapOf('bluetooth-switching', [phaseOf('bluetooth-switching-4', 17, ['9a'])]),
          'peer-networking': mapOf('peer-networking', [phaseOf('peer-networking-2', 16, [], ['7']), phaseOf('peer-networking-5', 14, ['0'])]),
          reordered: mapOf('reordered', [['reordered-1', ['reordered-1-2b', 'reordered-1-1', 'reordered-1-2']]]),
        },
      },
    },
  };
  const ordered = (/** @type {string} */ phase, /** @type {string[]} */ ns) => ns.map((n) => `t:${phase}-${n}`);

  it('orders each phase\'s tasks by the old plan\'s own ids, by number and then the letters after it — 1 < 1b < 2, 9 < 9a < 10 — never the store\'s order, and a phase\'s ids apart from another\'s that shares their prefix', () => {
    assert.deepStrictEqual([
      oldPlanOrder(PIGEON, 't:app-shell-and-ux-5'),
      oldPlanOrder(PIGEON, 't:app-shell-and-ux-10'),
      oldPlanOrder(PIGEON, 't:app-shell-and-ux-1'),
      oldPlanOrder(PIGEON, 't:bluetooth-switching-4'),
      oldPlanOrder(PIGEON, 't:peer-networking-2'),
      oldPlanOrder(PIGEON, 't:peer-networking-5'),
      oldPlanOrder(PIGEON, 't:reordered-1'),
    ], [
      ordered('app-shell-and-ux-5', ['1', '1b', ...run(2, 13)]),
      ordered('app-shell-and-ux-10', [...run(1, 15), '15b', ...run(16, 19)]),
      ordered('app-shell-and-ux-1', run(1, 3)),
      ordered('bluetooth-switching-4', [...run(1, 9), '9a', ...run(10, 17)]),
      ordered('peer-networking-2', run(1, 16)),
      ordered('peer-networking-5', run(0, 14)),
      ordered('reordered-1', ['1', '2', '2b']),
    ]);
  });

  it('gives no order for a parent no old plan\'s phase holds, or a unit with no old plan', () => {
    assert.deepStrictEqual([oldPlanOrder(PIGEON, 't:app-shell-and-ux-5-1'), oldPlanOrder(PIGEON, 't:elsewhere'), oldPlanOrder({ phases: {} }, 't:app-shell-and-ux-5')], [[], [], []]);
  });

  describe('through the cut', () => {
    beforeEach(() => { dir = world(); });
    afterEach(() => cleanupFixture(path.dirname(dir)));

    it('names a phase\'s tasks in the old plan\'s order from the unit\'s task map — a task the plan added late, 1b, after 1 and before 2 — where the tracker made them in another; and a run again killed after the manifest, its task map gone with the old plan\'s items, keeps each name', () => {
      const root = statePath(dir);
      const manifest = manifestOf('relay');
      const ids = Object.fromEntries(['relay-1-1', 'relay-1-2', 'relay-1-1b'].map((id, at) => [id, SIDE.idOf(root, ['Relay 1', 'Relay 2', 'Relay 1b'][at])]));
      manifest.phases.planning.items.relay.task_map = { relay: PLANS.relay.root, 'relay-1': PLANS.relay.phases[0], ...ids };
      writeState(dir, 'relay/manifest.json', jsonText(manifest));
      const plan = { phases: [{ name: 'Relays', goal: 'Hops relayed.', sections: ['1'], built: true, tracker: PLANS.relay.phases[0] }] };
      const named = () => (DRIVER.tasks(root, 'relay', 1) ?? []).map(({ ref, title }) => `${ref.phase}.${ref.n} ${title}`);
      assert.deepStrictEqual(cut('relay', plan).adopted, [{ phase: 1, tasks: ['1.1', '1.2', '1.3'] }]);
      assert.deepStrictEqual(named(), ['1.1 Relay 1', '1.2 Relay 1b', '1.3 Relay 2']);

      fs.rmSync(markPath(dir, 'relay'));
      assert.deepStrictEqual([cut('relay', plan).adopted, named()], [[{ phase: 1, tasks: ['1.1', '1.2', '1.3'] }], ['1.1 Relay 1', '1.2 Relay 1b', '1.3 Relay 2']]);
    });
  });
});

describe('the plan from before Ledger of a unit that built nothing, closed through `task close-plan` (21.8.4)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('refuses, writing nothing, to close a plan of a unit whose spec the migration joined — its building started, its cut carrying its plans on (21.8.4, 21.8.8)', () => {
    assert.strictEqual(untouched(['task', 'close-plan', 'shop', '--parent', PLANS.pay.root]),
      'shop\'s building started before the migration — its specs joined — so its plan is not closed — its cut carries it on: cut shop --migrating --file <plan.json>');
  });

  it('closes the plan of a unit that built nothing under its root, each task not ended with the migration\'s reason, the plan none of the build\'s — the build\'s first phase written after it — a run again closing nothing (21.8.4)', () => {
    const args = ['task', 'close-plan', 'memo', '--parent', PLANS.memo.root];
    assert.deepStrictEqual(ok(dir, args, { env: SESSION }), { ok: true, parent: PLANS.memo.root, closed: 2, committed: null, note: HELD });
    const reason = 'closed by the migration — nothing of its unit was built, so the unit\'s build is planned afresh from its spec';
    assert.deepStrictEqual(SIDE.planStanding(statePath(dir), 'memo'), { 'Write a memo': ['closed', reason], 'Pin a memo': ['closed', reason] });
    const once = store();
    assert.deepStrictEqual([ok(dir, args, { env: SESSION }).closed, store()], [0, once]);
    assert.deepStrictEqual(ok(dir, ['task', 'phase', 'memo', '1', '--title', 'Memos'], { env: SESSION }).phase, 1);
    assert.deepStrictEqual([tracked('memo', 1), stateUnborn(dir)], [[[]], true]);
  });

  it('closes a nothing-built bugfix\'s plan whole, its first task, the reproducing one, among them (21.8.4)', () => {
    assert.strictEqual(ok(dir, ['task', 'close-plan', 'crash', '--parent', PLANS.crash.root], { env: SESSION }).closed, 2);
    assert.deepStrictEqual(Object.values(SIDE.planStanding(statePath(dir), 'crash')).map(([status]) => status), ['closed', 'closed']);
  });

  it('refuses, closing nothing, a plan holding a task done — the tracker winning, its unit built some of it (21.8.4)', () => {
    SIDE.taskByHand(statePath(dir), 'done', 'Write a memo');
    assert.strictEqual(trackerUntouched('memo', ['task', 'close-plan', 'memo', '--parent', PLANS.memo.root]),
      `the plan from before Ledger under ${PLANS.memo.root} holds "Write a memo" done, so unit memo built some of it — the tracker wins: the migration cuts the unit, carrying its plan on, and closes none of it`);
  });

  it('types a quick-fix\'s tasks fix, as a bugfix\'s, and any other unit\'s feat (21.5.21)', () => {
    assert.deepStrictEqual(['quick-fix', 'bugfix', 'feature', 'epic'].map(migratedType), ['fix', 'fix', 'feat', 'feat']);
  });
});
