'use strict';

// ---------------------------------------------------------------------------
// A unit whose building began under the old plan (P12), and a migrated unit
// of a type the reshape retires, cross-cutting (19.6.7, E6): their items
// still read — phaseStatus and computeNextPhase answer from them as before
// the build by its cut, the start menu's rows and the board's tabs with them,
// a retired type's unit waiting on the cut — and every way into their work is
// closed until 29.17's migration cuts them: Continue refuses each but an
// epic, which goes onto its menu, where the migration's line stands with no
// way into the build, manage never offers to mark them done, and the revisit
// list refuses them.
// A retired type's unit is listed with the
// features, by its own type, waiting on the cut whatever it has in flight,
// the board placing it there too; its manifest is read by every verb, and no
// phase or topic of it is entered or sent to; the type is refused only where
// a unit is made. This file goes with the migration.
//
// Layer: verb. World: the project world (setupFixture), twelve old-shape
// units written once by hand — no verb writes a shape the design has left.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const { manageScreen, manageUnitScreen } = require('../../skills/leeway-engine/scripts/domain/projections/manage.cjs');
const { call } = require('./engine-harness.cjs');
const { phaseStatus, computeNextPhase } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');
const { loadManifest, loadAllManifests } = require('../../skills/leeway-engine/scripts/domain/reads.cjs');
const { WORK_TYPE_PIPELINES, LEGACY_WORK_TYPES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { epicMenuScreen } = require('../../skills/leeway-engine/scripts/domain/projections/epic-menu.cjs');
const { completeWorkUnit } = require('../../skills/leeway-engine/scripts/domain/workunit-lifecycle.cjs');
const { startMenuRead } = require('../../skills/leeway-engine/scripts/domain/start-menu.cjs');
const { startMenuScreen } = require('../../skills/leeway-engine/scripts/domain/projections/start-menu.cjs');
const { unitHandoff } = require('../../skills/leeway-engine/scripts/domain/unit-handoff.cjs');

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
  'old-quick-fix': { work_type: 'quick-fix', phases: { ...through('old-quick-fix', 'planning'), implementation: { items: at('old-quick-fix', 'in-progress') } } },
  'old-epic': { work_type: 'epic', phases: { discussion: { items: done('alpha', 'beta') }, specification: { items: done('alpha') }, planning: { items: done('alpha') }, implementation: { items: at('alpha', 'in-progress') } } },
  'done-feature': { status: 'completed', phases: through('done-feature', 'discussion', 'specification', 'planning', 'implementation', 'review') },
  'dropped-feature': { status: 'cancelled', phases: { ...through('dropped-feature', 'discussion', 'specification', 'planning'), implementation: { items: at('dropped-feature', 'in-progress') } } },
  // Cross-cutting units as the reshape's move leaves them: their spec items
  // dropped, a discussion in flight, an experiment in flight, and one decided.
  'old-concern': { work_type: 'cross-cutting', phases: { discussion: { items: at('old-concern', 'in-progress') } } },
  'lab-concern': { work_type: 'cross-cutting', phases: { experiment: { items: at('lab-concern', 'in-progress') }, discussion: { items: at('lab-concern', 'in-progress') } } },
  'done-concern': { work_type: 'cross-cutting', phases: through('done-concern', 'discussion') },
};
const NAMES = Object.keys(UNITS);
const RETIRED_UNITS = ['done-concern', 'lab-concern', 'old-concern'];
const LIVE = ['plan-feature', 'built-feature', 'reviewing-feature', 'reviewed-feature', 'old-bugfix', 'old-quick-fix', ...RETIRED_UNITS];
const SESSION = { env: { CLAUDE_CODE_SESSION_ID: 'sess-1' } };
/** What manage offers each, its spec unwritten where it has no build. */
const KEYS_IN_MANAGE = Object.freeze({
  'plan-feature': ['p', 'c'], 'built-feature': ['c'], 'reviewing-feature': ['p', 'c'], 'reviewed-feature': ['p', 'c'],
  'old-bugfix': ['c'], 'old-quick-fix': ['c'], 'done-concern': ['c'], 'lab-concern': ['c'], 'old-concern': ['c'],
});
const retired = (name) => `${name} is a cross-cutting unit, a type the reshape retires — it waits on the reshape's 29.17 migration, and nothing is done in it until then`;
const RETIRED = retired('old-concern');
const waiting = (name) => (RETIRED_UNITS.includes(name) ? retired(name) : `${name} was built under the old plan, and its build is entered once the reshape's 29.17 migration has cut it`);
const AT_THE_CUT = 'waiting on the migration\'s cut';

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
      'old-quick-fix': ['in-progress ', `done: ${AT_THE_CUT}`],
      'old-epic': [' completed completed in-progress ', 'implementation: implementation (in-progress)'],
      'done-feature': [' completed completed completed completed', 'done: pipeline complete'],
      'dropped-feature': [' completed completed in-progress ', 'implementation: implementation (in-progress)'],
      'old-concern': [' in-progress ', `done: ${AT_THE_CUT}`],
      'lab-concern': ['in-progress in-progress ', `done: ${AT_THE_CUT}`],
      'done-concern': [' completed ', `done: ${AT_THE_CUT}`],
    });
  });

  it('Continue refuses a feature, bugfix or quick-fix in the migration\'s line, and takes an epic onto its menu, where the line stands', () => {
    const refusals = Object.fromEntries(LIVE.map((name) => [name, JSON.parse(call(dir, ['handoff', 'unit', name]).stderr).error]));
    assert.deepStrictEqual(refusals, Object.fromEntries(LIVE.map((name) => [name, waiting(name)])));
    assert.strictEqual(unitHandoff(dir, ['old-epic']).skill, 'leeway-continue-epic');
  });

  it('the epic menu shows the migration\'s line and no way into its build', () => {
    const { statement, rows } = epicMenuScreen(dir, loadManifest(dir, 'old-epic'), []);
    assert.strictEqual(statement, waiting('old-epic'));
    assert.deepStrictEqual(rows.filter(({ next }) => next.kind === 'handoff' && /implementation|review|planning/.test(next.skill)), []);
  });

  it('the start menu says each waits on the migration\'s cut, whatever its items have in flight, and the closed ones bring the view', () => {
    const { units, closed } = startMenuRead(dir);
    assert.deepStrictEqual(Object.fromEntries(units.map(({ name, progress }) => [name, progress])),
      Object.fromEntries([...LIVE, 'old-epic'].sort().map((name) => [name, AT_THE_CUT])));
    assert.strictEqual(closed, true);
  });

  it('a retired type\'s unit: listed with the features by its own type, on the start menu and manage\'s list, read by every verb, no phase or topic of it entered nor sent to, the type refused only where a unit is made', () => {
    const row = startMenuScreen(startMenuRead(dir)).rows.find((r) => r.label.head === 'Continue cross-cutting: Old Concern');
    assert.deepStrictEqual([row.label.tail, row.next], [AT_THE_CUT, { kind: 'engine', argv: ['handoff', 'unit', 'old-concern'] }]);
    const managed = manageScreen(loadAllManifests(dir)).rows.filter(({ next }) => next.kind === 'engine' && RETIRED_UNITS.includes(next.argv[2]));
    assert.deepStrictEqual(managed.map(({ label }) => typeof label === 'string' ? label : label.tail), ['cross-cutting', 'cross-cutting', 'cross-cutting']);
    assert.strictEqual(call(dir, ['manifest', 'get', 'old-concern', 'work_type']).stdout.trim(), 'cross-cutting');
    const message = path.join(dir, '.leeway', '.cache', 'message.md');
    fs.mkdirSync(path.dirname(message), { recursive: true });
    fs.writeFileSync(message, '# A note\n');
    const refusal = (args) => JSON.parse(call(dir, args, SESSION).stderr).error;
    assert.deepStrictEqual([
      refusal(['enter', 'discovery', 'old-concern']),
      refusal(['enter', 'discussion', 'old-concern']),
      refusal(['enter', 'specification', 'old-concern']),
      refusal(['handoff', 'topic', 'old-concern', 'old-concern']),
      refusal(['topic', 'send', 'old-concern', 'old-concern', '--from', 'old-bugfix.old-bugfix', '--content', message, '--slug', 'a-note']),
      refusal(['handoff', 'leeway-discussion-process', 'cross-cutting', 'old-concern']),
      refusal(['manifest', 'set', 'plan-feature', 'work_type', 'cross-cutting']),
    ], [
      RETIRED,
      RETIRED,
      RETIRED,
      RETIRED,
      RETIRED,
      'the work type must be one of epic|feature — got "cross-cutting"',
      'Invalid work_type "cross-cutting". Must be one of: epic, feature, bugfix, quick-fix',
    ]);
  });

  it('manage offers it no done — cancel alone, a feature not past its spec its pivot — and the revisit list refuses it', () => {
    assert.deepStrictEqual(Object.fromEntries(LIVE.map((name) => [name, manageUnitScreen(dir, loadManifest(dir, name)).rows.map(({ key }) => key)])), KEYS_IN_MANAGE);
    assert.strictEqual(JSON.parse(call(dir, ['render', 'revisit-phases', 'built-feature']).stderr).error,
      'render revisit-phases: "built-feature" has no completed earlier phase to revisit');
  });

  it('the lifecycle verbs refuse it as before', () => {
    const refusal = (args) => JSON.parse(call(dir, args).stderr).error;
    assert.throws(() => completeWorkUnit(dir, 'dropped-feature', { message: 'x' }), /^Error: work unit "dropped-feature" is cancelled — reactivate it first$/);
    assert.strictEqual(refusal(['handoff', 'topic', 'old-bugfix', 'old-bugfix']),
      'the topic "old-bugfix" is concluded — its work goes on in review, from the start menu, and a message sent to it reopens it');
  });

  it('the board places it by its items, a retired type\'s unit at the cut it waits on', () => {
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
      'done-concern: cut',
      'lab-concern: cut',
      'old-bugfix: review',
      'old-concern: cut',
      'old-epic: discovery',
      'old-quick-fix: implementation',
      'plan-feature: build',
      'reviewed-feature: review',
      'reviewing-feature: review',
    ]);
    assert.deepStrictEqual([board('unit', 'old-concern').now, all.find(({ unit }) => unit === 'old-concern').standing], [{ phase: 'cut', since: null }, AT_THE_CUT]);
    const drawn = all.filter(({ unit }) => unit !== 'built-feature');
    assert.deepStrictEqual(drawn.map(({ phase }) => phase), drawn.map(({ unit }) => board('unit', unit).now.phase), 'S1: All work places each unit where its tab does');
  });
});
