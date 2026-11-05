'use strict';

// ---------------------------------------------------------------------------
// A unit whose building began under the old plan (P12), and a migrated unit
// of a type the reshape retires, cross-cutting (19.6.7, E6): their items
// still read — phaseStatus and computeNextPhase answer from them as before
// the build by its cut, the start menu's rows and the board's tabs with them,
// a retired type's unit waiting on the cut — and every way into their work is
// closed until 29.17's migration cuts them: the bridge routes them nowhere and
// revisits nothing, the linear and epic menus show the migration's line and
// the way back alone, the start menu never offers to finalise them nor manage
// to mark them done, the epic's completed topics are its decided discussions,
// and the revisit list refuses them. A retired type's unit is listed with the
// features, by its own type, its manifest read by every verb, and no phase of
// it entered; the type is refused only where a unit is made. This file goes
// with the migration.
//
// Layer: verb. World: the project world (setupFixture), nine old-shape
// units written once by hand — no verb writes a shape the design has left.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { manageDetail } = require('../../skills/leeway-engine/scripts/domain/workunit-manage.cjs');
const { call } = require('./engine-harness.cjs');
const { phaseStatus, computeNextPhase } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');
const { loadManifest } = require('../../skills/leeway-engine/scripts/domain/reads.cjs');
const { WORK_TYPE_PIPELINES, LEGACY_WORK_TYPES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { epicMenu, epicCompletedMenu } = require('../../skills/leeway-engine/scripts/domain/projections/epic.cjs');
const bridge = require('../../skills/leeway-bridge/scripts/gateway.cjs');
const linear = require('../../skills/leeway-continue-linear/scripts/gateway.cjs');
const epic = require('../../skills/leeway-continue-epic/scripts/gateway.cjs');
const start = require('../../skills/leeway/scripts/gateway.cjs');
const { startMenu } = require('../../skills/leeway-engine/scripts/domain/projections/start.cjs');
const { drawLabel } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');

const done = (...names) => Object.fromEntries(names.map((n) => [n, { status: 'completed' }]));
const at = (name, status) => ({ [name]: { status } });
const through = (name, ...phases) => Object.fromEntries(phases.map((p) => [p, { items: done(name) }]));

const UNITS = {
  'plan-feature': { phases: { ...through('plan-feature', 'discussion', 'specification'), planning: { items: at('plan-feature', 'in-progress') } } },
  'built-feature': {
    build: { position: 'auto' },
    cut: { phases: [{ name: 'One', scenarios: [], sections: [], relies_on: [] }] },
    phases: through('built-feature', 'discussion', 'specification', 'planning', 'implementation'),
  },
  'reviewing-feature': { phases: { ...through('reviewing-feature', 'discussion', 'specification', 'planning', 'implementation'), review: { items: at('reviewing-feature', 'in-progress') } } },
  'reviewed-feature': { phases: through('reviewed-feature', 'discussion', 'specification', 'planning', 'implementation', 'review') },
  'old-bugfix': { work_type: 'bugfix', phases: through('old-bugfix', 'investigation', 'specification', 'planning', 'implementation') },
  'old-epic': { work_type: 'epic', phases: { discussion: { items: done('alpha', 'beta') }, specification: { items: done('alpha') }, planning: { items: done('alpha') }, implementation: { items: at('alpha', 'in-progress') } } },
  'done-feature': { status: 'completed', phases: through('done-feature', 'discussion', 'specification', 'planning', 'implementation', 'review') },
  'dropped-feature': { status: 'cancelled', phases: { ...through('dropped-feature', 'discussion', 'specification', 'planning'), implementation: { items: at('dropped-feature', 'in-progress') } } },
  'old-concern': { work_type: 'cross-cutting', phases: through('old-concern', 'discussion', 'specification') },
};
const NAMES = Object.keys(UNITS);
const LIVE = ['plan-feature', 'built-feature', 'reviewing-feature', 'reviewed-feature', 'old-bugfix', 'old-concern'];
const SESSION = { env: { CLAUDE_CODE_SESSION_ID: 'sess-1' } };
const lines = (text, re) => text.split('\n').filter((line) => re.test(line));
const RETIRED = 'old-concern is a cross-cutting unit, a type the reshape retires — its 29.17 migration turns its spec into product-wide entries';
const waiting = (name) => (name === 'old-concern' ? RETIRED : `${name} was built under the old plan, and its build is entered once the reshape's 29.17 migration has cut it`);

describe('a unit built under the old plan reads its items and waits on the migration\'s cut (P12)', () => {
  let dir;
  before(() => {
    dir = setupFixture('legacy-build-');
    for (const [name, data] of Object.entries(UNITS)) createManifest(dir, name, data);
  });
  after(() => cleanupFixture(dir));

  it('phaseStatus and computeNextPhase read its items alone, its plan among them', () => {
    const answers = Object.fromEntries(NAMES.map((name) => {
      const manifest = loadManifest(dir, name);
      const { next_phase, phase_label } = computeNextPhase(manifest);
      const pipeline = WORK_TYPE_PIPELINES[manifest.work_type] ?? LEGACY_WORK_TYPES[manifest.work_type];
      return [name, [pipeline.map((phase) => phaseStatus(manifest, phase)).join(' '), `${next_phase}: ${phase_label}`]];
    }));
    assert.deepStrictEqual(answers, {
      'plan-feature': [' completed completed  ', 'planning: planning (in-progress)'],
      'built-feature': [' completed completed completed ', 'review: ready for review'],
      'reviewing-feature': [' completed completed completed in-progress', 'review: review (in-progress)'],
      'reviewed-feature': [' completed completed completed completed', 'done: pipeline complete'],
      'old-bugfix': ['completed completed completed ', 'review: ready for review'],
      'old-epic': [' completed completed in-progress ', 'implementation: implementation (in-progress)'],
      'done-feature': [' completed completed completed completed', 'done: pipeline complete'],
      'dropped-feature': [' completed completed in-progress ', 'implementation: implementation (in-progress)'],
      'old-concern': [' completed completed', 'done: waiting on the migration\'s cut'],
    });
  });

  it('the bridge routes it nowhere and revisits nothing', () => {
    const dumps = Object.fromEntries(LIVE.map((name) => [name, lines(bridge.format(bridge.discover(dir, name)), /^(revisitable_phases|next_route|revisit_routes): /)]));
    assert.deepStrictEqual(dumps, Object.fromEntries(LIVE.map((name) => [name, ['revisitable_phases: (none)', 'next_route: (none)', 'revisit_routes: (none)']])));
  });

  it('the linear menu shows the migration\'s line and the way back alone, its tree drawn from its items, nothing finalising', () => {
    for (const name of LIVE) {
      const view = linear.view(dir, name);
      assert.deepStrictEqual(lines(view, /^  ([a-z]|[0-9])  /), [`  b  back  back  ${name}  → (internal)`], name);
      assert.ok(view.includes(`· · · · · · · · · · · ·\n${waiting(name)}\n\n**\`◆ What next?\`**\n\n**\`b/back\`** → Return to the start menu`), name);
      assert.ok(view.includes('\nfinalising: false\n') && !view.includes('ready to finalise'), name);
    }
    assert.deepStrictEqual(lines(linear.view(dir, 'old-bugfix'), /^  [├└]─ /), [
      '  ├─ ✓ Investigation     [completed]',
      '  ├─ ✓ Specification     [completed]',
      '  ├─ ✓ Implementation    [completed]',
      '  └─ → Review            [ready]',
    ]);
    assert.deepStrictEqual(lines(linear.view(dir, 'old-concern'), /^  [├└]─ |^work_type: /), [
      'work_type: cross-cutting',
      '  ├─ ✓ Discussion       [completed]',
      '  └─ ✓ Specification    [completed]',
    ]);
  });

  it('the epic menu shows the migration\'s line and no way into its build, its completed topics its decided discussions', () => {
    const detail = epic.discover(dir, 'old-epic');
    const menu = epicMenu('old-epic', detail);
    assert.ok(menu.rendered.includes(`· · · · · · · · · · · ·\n${waiting('old-epic')}\n`), menu.rendered);
    assert.deepStrictEqual(menu.keys.filter((k) => /implementation|review|planning/.test(k.route ?? '')), []);
    assert.deepStrictEqual(epicCompletedMenu('old-epic', detail).keys.map((k) => [k.key, k.phase, k.topic]),
      [['1', 'discussion', 'alpha'], ['2', 'discussion', 'beta'], ['b', null, null]]);
  });

  it('the start menu reads its next phase off its items, never offering to finalise it, and a closed one its last', () => {
    const menu = start.discover(dir);
    assert.deepStrictEqual({
      units: ['epics', 'features', 'bugfixes'].flatMap((group) => menu[group].work_units.map((u) => `${u.name}: ${u.phase_label}${u.finalising ? ', finalising' : ''}`)),
      closed: [...menu.completed, ...menu.cancelled].map((u) => `${u.name}: ${u.last_phase}`),
    }, {
      units: [
        'old-epic: implementation (in-progress)',
        'built-feature: ready for review',
        'old-concern: waiting on the migration\'s cut',
        'plan-feature: planning (in-progress)',
        'reviewed-feature: pipeline complete',
        'reviewing-feature: review (in-progress)',
        'old-bugfix: ready for review',
      ],
      closed: ['done-feature: review', 'dropped-feature: planning'],
    });
  });

  it('a retired type\'s unit: listed with the features by its own type, read by every verb, no phase of it entered, the type refused only where a unit is made', () => {
    const row = startMenu(start.discover(dir)).keys.find((k) => k.work_unit === 'old-concern');
    assert.deepStrictEqual([row.work_type, row.route, drawLabel(row.label)],
      ['cross-cutting', '/leeway-continue-linear old-concern', 'Continue "Old Concern" — *cross-cutting, waiting on the migration\'s cut*']);
    assert.strictEqual(call(dir, ['manifest', 'get', 'old-concern', 'work_type']).stdout.trim(), 'cross-cutting');
    const refusal = (args) => JSON.parse(call(dir, args, SESSION).stderr).error;
    assert.deepStrictEqual([
      refusal(['enter', 'discussion', 'old-concern']),
      refusal(['enter', 'specification', 'old-concern']),
      refusal(['handoff', 'leeway-discussion-process', 'cross-cutting', 'old-concern']),
      refusal(['manifest', 'set', 'plan-feature', 'work_type', 'cross-cutting']),
    ], [
      RETIRED,
      RETIRED,
      'the work type must be one of epic|feature — got "cross-cutting"',
      'Invalid work_type "cross-cutting". Must be one of: epic, feature, bugfix, quick-fix',
    ]);
  });

  it('manage offers it no done, and the revisit list refuses it', () => {
    assert.deepStrictEqual(LIVE.filter((name) => manageDetail(dir, name).implementation_completed), []);
    assert.strictEqual(JSON.parse(call(dir, ['render', 'revisit-phases', 'built-feature']).stderr).error,
      'render revisit-phases: "built-feature" has no completed earlier phase to revisit');
  });

  it('the lifecycle verbs refuse it as before', () => {
    const refusal = (args) => JSON.parse(call(dir, args).stderr).error;
    assert.deepStrictEqual([
      refusal(['workunit', 'complete', 'dropped-feature', '-m', 'x']),
      refusal(['handoff', 'topic', 'old-bugfix', 'old-bugfix']),
    ], [
      'work unit "dropped-feature" is cancelled — reactivate it first',
      'the topic "old-bugfix" is concluded — its work goes on in review, from the start menu, and a message sent to it reopens it',
    ]);
  });

  it('the board places it by its items', () => {
    const board = (tab, unit) => JSON.parse(call(dir, ['board', 'sess-1', '--tab', tab, ...(unit ? ['--unit', unit] : [])], SESSION).stdout).view;
    const places = Object.fromEntries(['plan-feature', 'reviewing-feature', 'old-bugfix', 'dropped-feature']
      .map((name) => [name, board('unit', name).phases.map(({ phase, state }) => `${phase} ${state}`).slice(-2).join(', ')]));
    assert.deepStrictEqual(places, {
      'plan-feature': 'build later, review later',
      'reviewing-feature': 'build complete, review later',
      'old-bugfix': 'build complete, review later',
      'dropped-feature': 'build running, review later',
    });
    const all = board('all').units;
    assert.deepStrictEqual(all.map(({ unit, phase }) => `${unit}: ${phase}`), [
      'built-feature: review',
      'old-bugfix: review',
      'old-concern: complete',
      'old-epic: discovery',
      'plan-feature: build',
      'reviewed-feature: review',
      'reviewing-feature: review',
    ]);
    const drawn = all.filter(({ unit }) => unit !== 'built-feature');
    assert.deepStrictEqual(drawn.map(({ phase }) => phase), drawn.map(({ unit }) => board('unit', unit).now.phase), 'S1: All work places each unit where its tab does');
  });
});
