'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review of a unit the migration cut, as the
// review phase's skill runs it (21.8.8, 14.1.1): a task that landed before
// the migration — one of a phase built before it, or one the tracker held
// done as it adopted its phase — read as landed by every reader, the
// review's change what landed since. A feature cut mid-build, its last
// phase built since by today's build: its area's brief drawing the landings
// since, the board's round drawn, round 1 failing, its one fix task landed
// on top through its gate and its phase's, round 2 passing, and finish's
// review passed. An epic whose every phase was built before the migration:
// its change empty, standing at the default branch, never refused; each
// area briefed and drawn on the board as built before, read as the default
// branch holds it; a finding on one fixed on top, that area read again in
// round 2 with the fix its change, built before no longer; and finish. The
// build of a cut unit is
// test-pipeline-simulation-build-migrated.cjs's.
//
// Layer: simulation. World: this file's own — a project in the layout from
// before Leeway, the old plans in the project's tracker, moved by the real
// move (078), both units cut by `cut --migrating` and the migration's
// commit made (migrated-world.cjs), the feature's last phase then built and
// closed through the verbs — built once and copied per scenario, which
// replays the engine calls the review phase's prose makes, in order, the
// oracle (pipeline-oracle.cjs) auditing the whole state after every
// mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const {
  Sim, readyForSim, worldFrom, startPhase, briefOf, landed, placeIn, answerGate, buildLoop, builders, taskBuilt, writePhaseTasks,
  testsRead, areaRead, reviewNext, finished, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const {
  oldTask, oldSpecPath, buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted,
} = require('./migrated-world.cjs');

const QUILL = 'quill';
const ATLAS = 'atlas';

const UNDONE = '## Findings\n\n- bug: an undo past the first edit loses the note\n  Scenario: two edits undone\n\nVerdict: fail\n';
const UNPINNED = '## Findings\n\n- bug: a pin dropped is gone on reload\n  Scenario: a pin kept\n\nVerdict: fail\n';

/** The project from before Leeway, both units moved and cut, the migration's commit made: built once. */
function buildMigrated(/** @type {string} */ dir) {
  const plans = movedProject(dir, oldFiles([
    { manifest: buildingUnit(QUILL, 'feature', [QUILL], 'in-progress'), specs: { [QUILL]: '# Specification: Quill\n\n## Notes\n\nA note holds its words.\n' } },
    { manifest: buildingUnit(ATLAS, 'epic', ['maps', 'pins'], 'completed'), specs: { maps: '# Specification: Maps\n\n## Tiles\n\nA map is drawn from tiles.\n', pins: '# Specification: Pins\n\n## Dropping\n\nA pin marks a place.\n' } },
  ]), {
    [QUILL]: [
      { title: 'Notes', tasks: ['Keep a note', 'Show a note'] },
      { title: 'Editing', tasks: ['Edit a note', { title: 'Undo an edit', text: oldTask('An edit is lost for good.', oldSpecPath(QUILL, QUILL)) }] },
    ],
    maps: [{ title: 'Tiles', tasks: ['Draw a tile'] }],
    pins: [{ title: 'Pins', tasks: ['Drop a pin'] }],
  }, [['done', 'Keep a note'], ['done', 'Show a note'], ['done', 'Edit a note'], ['start', 'Undo an edit'], ['done', 'Draw a tile'], ['done', 'Drop a pin']]);
  migratedCut(dir, QUILL, {
    phases: [
      { name: 'Notes', goal: 'A note is kept.', built: true, tracker: plans[QUILL].phases[0] },
      { name: 'Editing', goal: 'A note is edited.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: plans[QUILL].phases[1] },
    ],
    scenarios: { 1: ['Given a note edited, when the edit is undone, then the note holds its words again.'] },
  });
  migratedCut(dir, ATLAS, {
    phases: [
      { name: 'Tiles', goal: 'A map is drawn.', built: true, tracker: plans.maps.phases[0] },
      { name: 'Pins', goal: 'A place is marked.', built: true, tracker: plans.pins.phases[0] },
    ],
  });
  migrationCommitted(dir);
  readyForSim(dir);
}

/** @type {string|null} */
let template = null;

/** The project moved and cut, at a fresh folder. */
function migrated() {
  if (template === null) {
    template = path.join(templateFolder('pipeline-review-migrated-moved-'), 'project');
    buildMigrated(template);
  }
  return copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-review-migrated-moved-')), 'project'));
}

/** The feature's last phase built since the migration, through its gates, and closed: its review next. */
const world = worldFrom('pipeline-review-migrated-', (sim) => {
  const loop = buildLoop(sim, QUILL);
  sim.run(['enter', 'implementation', QUILL]);
  startPhase(sim, QUILL, 2);
  const builder = loop.brief(['builder', QUILL, '2.2']);
  const tree = loop.isolated('2.2');
  loop.committed(tree, '2.2', { ...VERIFY_FILES, 'src/undo.js': 'export const undo = 1;\n' });
  loop.setUp(tree, builder, '1.S1');
  loop.pairRound('2.2');
  loop.accounted('2.2', ['Passed.']);
  sim.render(['task-landed', QUILL, '2.2'], { expect: 'content' });
  sim.render(['step-gate', QUILL, '2.2'], { expect: 'content' });
  answerGate(sim, 'step gate', '--pick', 'y');
  loop.landedTask('2.2');
  for (const letter of ['a', 'b']) landed(placeIn(sim, loop.brief(['phase-review', QUILL, '2', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
  sim.render(['phase-merge-gate', QUILL, '2'], { expect: 'content' });
  sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
  sim.run(['checklist', 'close', 'phase-close', QUILL, '2']);
  loop.cleared();
}, migrated);

/** The area reader's brief of `area` in the round under review, by its first reviewer: its text. @param {Sim} sim @param {string} wu @param {number} area */
const areaBrief = (sim, wu, area) => briefOf(sim, sim.run(['brief', 'review-area', wu, '--area', String(area), '--base', 'main', '--letter', 'a']));

/** Finish's review-passed item, as its checklist shows it. @param {Sim} sim @param {string} wu */
const reviewPassed = (sim, wu) => JSON.parse(sim.read(['checklist', 'show', 'finish', wu])).items.find((/** @type {{key: string}} */ { key }) => key === 'review-passed').state;

describe('pipeline simulation: the review of a unit the migration cut', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(world);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('21.8.8: a feature cut mid-build — its review\'s change what landed since the migration, the tasks landed before it read as landed by the brief, the round, the board and the fix phase; round 1 failing, its fix task landed on top, round 2 passing, finish\'s review passed (14.1.1, 14.S14)', () => {
    const { move, fixPhase: phase } = reviewNext(sim, QUILL);
    assert.deepStrictEqual([move, phase], ['round', 3]);
    const brief = areaBrief(sim, QUILL, 1);
    const commits = brief.slice(brief.indexOf('# The change\'s commits'), brief.indexOf('# Laying out your scratch worktree'));
    assert.match(commits, /### Landed: `[0-9a-f]{12}` /, 'the landing since the migration drawn');
    assert.ok(!commits.includes('Not landed yet') && !brief.includes('was built before the migration'), 'nothing waits to land, and the area was built since');
    landed(placeIn(sim, sim.run(['brief', 'review-area', QUILL, '--area', '1', '--base', 'main', '--letter', 'b']), 'Where your report goes'), PASSED_REPORT);
    landed(placeIn(sim, sim.run(['brief', 'review-area', QUILL, '--area', '1', '--base', 'main', '--letter', 'a']), 'Where your report goes'), UNDONE);
    testsRead(sim, QUILL);
    const { view } = sim.board();
    assert.deepStrictEqual([view.kind, view.areas.map(({ area, before, state }) => [area, before, state]), view.not_proven.map(({ scenario }) => scenario)], ['review', [['1', false, 'read'], ['tests', false, 'read']], ['1.S1']],
      'the board draws round 1 read, its checks judged at the change\'s tips');

    writePhaseTasks(sim, QUILL, phase, 'The review\'s fixes', [{ title: 'Undo every edit', type: 'fix', scenarios: ['two edits undone'], reference: '§1' }]);
    const failed = sim.run(['review', 'round', QUILL, '--file', sim.write(`.leeway/.cache/${QUILL}/review/round.json`, {
      can_now: ['Undo an edit.'],
      findings: [{ area: `1-${QUILL}`, scope: 'in', call: 'bug', text: 'An undo past the first edit loses the note.', from: [`1-${QUILL}-a#1`], fix: `${phase}.1` }],
    })]);
    assert.strictEqual(failed.ends, false);

    assert.strictEqual(reviewNext(sim, QUILL).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, QUILL, `${phase}.1`, tree, { 'src/undo.js': 'export const undo = 2;\n' }, false, { gated: true });
    builders.remove(sim, tree);
    assert.strictEqual(reviewNext(sim, QUILL).move, 'merge');
    sim.render(['phase-merge-gate', QUILL, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);

    assert.strictEqual(reviewNext(sim, QUILL).move, 'reads');
    sim.run(['review', 'reads', QUILL, `1-${QUILL}`]);
    areaRead(sim, QUILL);
    assert.strictEqual(sim.run(['review', 'round', QUILL, '--file', sim.write(`.leeway/.cache/${QUILL}/review/round.json`, { can_now: ['Undo every edit.'], findings: [] })]).ends, true);

    assert.strictEqual(reviewNext(sim, QUILL).move, 'closing');
    assert.strictEqual(reviewPassed(sim, QUILL), 'done');
    assert.deepStrictEqual(finished(sim, QUILL).landed, [], 'every phase merged at its gate, the fix phase among them');
  });

  it('21.8.8: an epic whose every phase was built before the migration — its change empty, at the default branch, never refused; each area briefed and drawn as built before, read as the default branch holds it; a finding on one fixed on top, that area read again with the fix its change, built before no longer; and finish', () => {
    const { move, fixPhase: phase } = reviewNext(sim, ATLAS);
    assert.deepStrictEqual([move, phase], ['round', 3]);
    for (const area of [1, 2]) {
      const brief = areaBrief(sim, ATLAS, area);
      assert.ok(brief.includes(`§${area} was built before the migration cut the unit: its tasks landed on the default branch before Leeway, and the change since holds none of it.`), `§${area} briefed as built before`);
      assert.ok(brief.includes('Nothing has landed here since the migration cut the unit, and nothing waits to land: the change is the product as `main` holds it.'), 'the change empty, at the default branch');
    }
    assert.deepStrictEqual(sim.board().view.areas.map(({ area, before }) => [area, before]), [['1', true], ['2', true], ['tests', false]], 'the board draws each area built before');

    areaRead(sim, ATLAS, PASSED_REPORT, 1);
    areaRead(sim, ATLAS, UNPINNED, 2);
    testsRead(sim, ATLAS);
    writePhaseTasks(sim, ATLAS, phase, 'The review\'s fixes', [{ title: 'Keep a pin', type: 'fix', scenarios: ['a pin kept'], reference: '§2' }]);
    assert.strictEqual(sim.run(['review', 'round', ATLAS, '--file', sim.write(`.leeway/.cache/${ATLAS}/review/round.json`, {
      can_now: ['Draw a map.'],
      findings: [{ area: '2-pins', scope: 'in', call: 'bug', text: 'A pin dropped is gone on reload.', from: ['2-pins-a#1'], fix: `${phase}.1` }],
    })]).ends, false);

    assert.strictEqual(reviewNext(sim, ATLAS).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, ATLAS, `${phase}.1`, tree, { 'src/pin.js': 'export const pin = 1;\n' }, false, { gated: true });
    builders.remove(sim, tree);
    sim.render(['phase-merge-gate', ATLAS, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
    assert.strictEqual(reviewNext(sim, ATLAS).move, 'reads');
    sim.run(['review', 'reads', ATLAS, '2-pins']);
    const again = areaBrief(sim, ATLAS, 2);
    assert.ok(!again.includes('was built before the migration') && /### Landed: `[0-9a-f]{12}` /.test(again), 'the area its fix landed on read with the fix its change');
    assert.deepStrictEqual(sim.board().view.areas.map(({ area, before }) => [area, before]), [['1', true], ['2', false], ['tests', false]], 'the board draws it built before no longer');
    areaRead(sim, ATLAS, PASSED_REPORT, 2);
    assert.strictEqual(sim.run(['review', 'round', ATLAS, '--file', sim.write(`.leeway/.cache/${ATLAS}/review/round.json`, { can_now: ['Draw a map and keep a place marked.'], findings: [] })]).ends, true);
    assert.strictEqual(reviewNext(sim, ATLAS).move, 'closing');
    assert.strictEqual(reviewPassed(sim, ATLAS), 'done');
    assert.deepStrictEqual(finished(sim, ATLAS).landed, []);
  });
});
