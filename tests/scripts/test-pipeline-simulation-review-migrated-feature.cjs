'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review of a feature the migration cut
// mid-build, as the review phase's skill runs it (21.8.8, 14.1.1): its first
// phase built before the migration, its last built since by today's build.
// The tasks that landed before read as landed by every reader, the review's
// change what landed since: its section, partly built before, briefed with the
// landings since and told the work landed before stands at the change's
// tips, as the test surface's reader is of its tests; the board drawing the
// round and the section partly built before; round 1 failing, its one fix task
// landed on top through its gate and its phase's, the section read again still
// partly built before; round 2 passing, and finish's review passed. An epic
// built whole before the migration is
// test-pipeline-simulation-review-migrated-epic.cjs's; the build of a cut
// unit test-pipeline-simulation-build-migrated.cjs's.
//
// Layer: simulation. World: this file's own — a project in the layout from
// before Ledger, the old plan in the project's tracker, moved by the real
// move (078), cut by `cut --migrating` and the migration's commit made
// (migrated-world.cjs), the last phase then built and closed through the
// verbs — built once and copied per scenario, which replays the engine
// calls the review phase's prose makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
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
  sectionRead, reviewNext, finished, PASSED_REPORT, VERIFY_FILES,
} = require('./pipeline-world.cjs');
const {
  oldTask, oldSpecPath, buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted,
} = require('./migrated-world.cjs');

const WU = 'quill';

const UNDONE = '## Findings\n\n- bug: an undo past the first edit loses the note\n  Scenario: two edits undone\n\nVerdict: fail\n';

/** What the section's brief says of the work of it landed before the migration. */
const PARTLY = 'Some of §1 was built before the migration cut the unit: that work landed before Ledger, so no commit of the change carries it, and the rest is the change\'s. Hold the product at the change\'s tips against the section';

/** The project from before Ledger, the feature moved and cut, the migration's commit made: built once. */
function buildMigrated(/** @type {string} */ dir) {
  const plans = movedProject(dir, oldFiles([
    { manifest: buildingUnit(WU, 'feature', [WU], 'in-progress'), specs: { [WU]: '# Specification: Quill\n\n## Notes\n\nA note holds its words.\n' } },
  ]), {
    [WU]: [
      { title: 'Notes', tasks: ['Keep a note', 'Show a note'] },
      { title: 'Editing', tasks: ['Edit a note', { title: 'Undo an edit', text: oldTask('An edit is lost for good.', oldSpecPath(WU, WU)) }] },
    ],
  }, [['done', 'Keep a note'], ['done', 'Show a note'], ['done', 'Edit a note'], ['start', 'Undo an edit']]);
  migratedCut(dir, WU, {
    phases: [
      { name: 'Notes', goal: 'A note is kept.', sections: ['1'], built: true, tracker: plans[WU].phases[0] },
      { name: 'Editing', goal: 'A note is edited.', scenarios: ['1.S1'], sections: ['1'], relies_on: [1], tracker: plans[WU].phases[1] },
    ],
    scenarios: { 1: ['Given a note edited, when the edit is undone, then the note holds its words again.'] },
  });
  migrationCommitted(dir);
  readyForSim(dir);
}

/** @type {string|null} */
let template = null;

/** The project moved and cut, at a fresh folder. */
function migrated() {
  if (template === null) {
    template = path.join(templateFolder('pipeline-review-migrated-feature-moved-'), 'project');
    buildMigrated(template);
  }
  return copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-review-migrated-feature-moved-')), 'project'));
}

/** The feature's last phase built since the migration, through its gates, and closed: its review next. */
const world = worldFrom('pipeline-review-migrated-feature-', (sim) => {
  const loop = buildLoop(sim, WU);
  sim.run(['enter', 'implementation', WU]);
  startPhase(sim, WU, 2);
  const builder = loop.brief(['builder', WU, '2.2']);
  const tree = loop.isolated('2.2');
  loop.committed(tree, '2.2', { ...VERIFY_FILES, 'src/undo.js': 'export const undo = 1;\n' });
  loop.setUp(tree, builder, '1.S1');
  loop.pairRound('2.2');
  loop.accounted('2.2', ['Passed.']);
  sim.render(['task-landed', WU, '2.2'], { expect: 'content' });
  sim.render(['step-gate', WU, '2.2'], { expect: 'content' });
  answerGate(sim, 'step gate', '--pick', 'y');
  loop.landedTask('2.2');
  for (const letter of ['a', 'b']) landed(placeIn(sim, loop.brief(['phase-review', WU, '2', '--letter', letter]), 'Where your report goes'), PASSED_REPORT);
  sim.render(['phase-merge-gate', WU, '2'], { expect: 'content' });
  sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
  sim.run(['checklist', 'close', 'phase-close', WU, '2']);
  loop.cleared();
}, migrated);

/** The section reader's brief of the section in the round under review, by `letter`: its id. @param {Sim} sim @param {string} letter */
const sectionBrief = (sim, letter) => sim.run(['brief', 'review-section', WU, '--section', '1', '--base', 'main', '--letter', letter]);

describe('pipeline simulation: the review of a feature the migration cut mid-build', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(world);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('21.8.8: its review\'s change what landed since the migration, the tasks landed before it read as landed by the briefs, the round, the board and the fix phase, its section partly built before in every round; round 1 failing, its fix task landed on top, round 2 passing, finish\'s review passed (14.1.1, 14.S14)', () => {
    const { move, fixPhase: phase } = reviewNext(sim, WU);
    assert.deepStrictEqual([move, phase], ['round', 3]);
    const second = sectionBrief(sim, 'b');
    const first = sectionBrief(sim, 'a');
    const brief = briefOf(sim, first);
    const commits = brief.slice(brief.indexOf('# The change\'s commits'), brief.indexOf('# Laying out your scratch worktree'));
    assert.match(commits, /### Landed: `[0-9a-f]{12}` /, 'the landing since the migration drawn');
    assert.ok(!commits.includes('Not landed yet'), 'nothing waits to land');
    assert.ok(brief.includes(PARTLY), 'the section, its first phase built before the migration and its second since, partly built before');
    landed(placeIn(sim, second, 'Where your report goes'), PASSED_REPORT);
    landed(placeIn(sim, first, 'Where your report goes'), UNDONE);
    const tests = sim.run(['brief', 'test-surface', WU, '--base', 'main']);
    assert.ok(briefOf(sim, tests).includes('Work of the unit landed before the migration cut it, and its tests with it: they stand in the product at the change\'s tips'), 'the test surface read at the tips, the tests landed before among them');
    landed(placeIn(sim, tests, 'Where your report goes'), PASSED_REPORT);
    const { view } = sim.board();
    assert.deepStrictEqual([view.kind, view.sections.map(({ section, before, state }) => [section, before, state]), view.not_proven.map(({ scenario }) => scenario)], ['review', [['1', 'partly', 'read'], ['tests', null, 'read']], ['1.S1']],
      'the board draws round 1 read, the section partly built before, its checks judged at the change\'s tips');

    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Undo every edit', type: 'fix', scenarios: ['two edits undone'], reference: '§1' }]);
    const failed = sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, {
      can_now: ['Undo an edit.'],
      findings: [{ section: `1-${WU}`, scope: 'in', call: 'bug', text: 'An undo past the first edit loses the note.', from: [`1-${WU}-a#1`], fix: `${phase}.1` }],
    })]);
    assert.strictEqual(failed.ends, false);

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, WU, `${phase}.1`, tree, { 'src/undo.js': 'export const undo = 2;\n' }, false, { gated: true });
    builders.remove(sim, tree);
    assert.strictEqual(reviewNext(sim, WU).move, 'merge');
    sim.render(['phase-merge-gate', WU, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);

    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
    sim.run(['review', 'reads', WU, `1-${WU}`]);
    assert.ok(briefOf(sim, sectionBrief(sim, 'a')).includes(PARTLY), 'the section read again after its fix still partly built before');
    assert.deepStrictEqual(sim.board().view.sections.map(({ section, before }) => [section, before]), [['1', 'partly'], ['tests', null]]);
    sectionRead(sim, WU);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, { can_now: ['Undo every edit.'], findings: [] })]).ends, true);

    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    assert.strictEqual(JSON.parse(sim.read(['checklist', 'show', 'finish', WU])).items.find((/** @type {{key: string}} */ { key }) => key === 'review-passed').state, 'done');
    assert.deepStrictEqual(finished(sim, WU).landed, [], 'every phase merged at its gate, the fix phase among them');
  });
});
