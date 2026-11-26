'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review of an epic the migration cut whole
// built, as the review phase's skill runs it (21.8.8, 14.1.1): every phase
// built before the migration, so its change empty, standing at the default
// branch, never refused; each section briefed and drawn on the board as built
// before, read at the change's tips; a finding on one fixed on top, that
// section read again in round 2 with the fix its change, still built before;
// and finish. A feature cut mid-build is
// test-pipeline-simulation-review-migrated-feature.cjs's.
//
// Layer: simulation. World: this file's own — a project in the layout from
// before Ledger, the old plans in the project's tracker, moved by the real
// move (078), cut by `cut --migrating` and the migration's commit made
// (migrated-world.cjs) — built once and copied per scenario, which replays
// the engine calls the review phase's prose makes, in order, the oracle
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
  Sim, readyForSim, briefOf, answerGate, builders, taskBuilt, writePhaseTasks, testsRead, sectionRead, reviewNext, finished, PASSED_REPORT,
} = require('./pipeline-world.cjs');
const { buildingUnit, oldFiles, movedProject, migratedCut, migrationCommitted } = require('./migrated-world.cjs');

const WU = 'atlas';

const UNPINNED = '## Findings\n\n- bug: a pin dropped is gone on reload\n  Scenario: a pin kept\n\nVerdict: fail\n';

/** What a section's brief says of a section built before the migration. @param {number} section */
const built = (section) => `§${section} was built before the migration cut the unit: its work landed before Ledger, so no commit of the change carries it. Hold the product at the change's tips against the section`;

/** The project from before Ledger, the epic moved and cut, the migration's commit made: built once. */
function buildMigrated(/** @type {string} */ dir) {
  const plans = movedProject(dir, oldFiles([
    { manifest: buildingUnit(WU, 'epic', ['maps', 'pins'], 'completed'), specs: { maps: '# Specification: Maps\n\n## Tiles\n\nA map is drawn from tiles.\n', pins: '# Specification: Pins\n\n## Dropping\n\nA pin marks a place.\n' } },
  ]), {
    maps: [{ title: 'Tiles', tasks: ['Draw a tile'] }],
    pins: [{ title: 'Pins', tasks: ['Drop a pin'] }],
  }, [['done', 'Draw a tile'], ['done', 'Drop a pin']]);
  migratedCut(dir, WU, {
    phases: [
      { name: 'Tiles', goal: 'A map is drawn.', sections: ['1'], built: true, tracker: plans.maps.phases[0] },
      { name: 'Pins', goal: 'A place is marked.', sections: ['2'], built: true, tracker: plans.pins.phases[0] },
    ],
  });
  migrationCommitted(dir);
  readyForSim(dir);
}

/** @type {string|null} */
let template = null;

/** The project moved and cut, at a fresh folder. */
function world() {
  if (template === null) {
    template = path.join(templateFolder('pipeline-review-migrated-epic-'), 'project');
    buildMigrated(template);
  }
  return copyWorld(template, path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-review-migrated-epic-')), 'project'));
}

/** The section reader's brief of `section` in the round under review, by its first reviewer: its text. @param {Sim} sim @param {number} section */
const sectionBrief = (sim, section) => briefOf(sim, sim.run(['brief', 'review-section', WU, '--section', String(section), '--base', 'main', '--letter', 'a']));

describe('pipeline simulation: the review of an epic the migration cut whole built', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(world);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('21.8.8: its change empty, at the default branch, never refused; each section briefed and drawn as built before, read at the change\'s tips; a finding on one fixed on top, that section read again with the fix its change, still built before; and finish', () => {
    const { move, fixPhase: phase } = reviewNext(sim, WU);
    assert.deepStrictEqual([move, phase], ['round', 3]);
    for (const section of [1, 2]) {
      const brief = sectionBrief(sim, section);
      assert.ok(brief.includes(built(section)), `§${section} briefed as built before`);
      assert.ok(brief.includes('Hold the product at the change\'s tips against this section of the spec, as one piece. Work of the unit that landed before the migration cut it stands in the product there with no commit of the change carrying it, and is met as the change\'s is.'), 'its authority the product at the tips');
      assert.ok(brief.includes('Nothing has landed here since the migration cut the unit, and nothing waits to land: the change is empty, its tip `main` itself.'), 'the change empty, at the default branch');
    }
    assert.deepStrictEqual(sim.board().view.sections.map(({ section, before }) => [section, before]), [['1', 'built'], ['2', 'built'], ['tests', null]], 'the board draws each section built before');

    sectionRead(sim, WU, PASSED_REPORT, 1);
    sectionRead(sim, WU, UNPINNED, 2);
    testsRead(sim, WU);
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Keep a pin', type: 'fix', scenarios: ['a pin kept'], reference: '§2' }]);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, {
      can_now: ['Draw a map.'],
      findings: [{ section: '2-pins', scope: 'in', call: 'bug', text: 'A pin dropped is gone on reload.', from: ['2-pins-a#1'], fix: `${phase}.1` }],
    })]).ends, false);

    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, WU, `${phase}.1`, tree, { 'src/pin.js': 'export const pin = 1;\n' }, false, { gated: true });
    builders.remove(sim, tree);
    sim.render(['phase-merge-gate', WU, String(phase)], { expect: 'content' });
    sim.run(answerGate(sim, 'phase merge', '--pick', 'y').next.argv);
    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
    sim.run(['review', 'reads', WU, '2-pins']);
    const again = sectionBrief(sim, 2);
    assert.ok(again.includes(built(2)) && /### Landed: `[0-9a-f]{12}` /.test(again), 'the section its fix landed on read with the fix its change, still built before');
    assert.deepStrictEqual(sim.board().view.sections.map(({ section, before }) => [section, before]), [['1', 'built'], ['2', 'built'], ['tests', null]], 'the board draws it built before still');
    sectionRead(sim, WU, PASSED_REPORT, 2);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.ledger/.cache/${WU}/review/round.json`, { can_now: ['Draw a map and keep a place marked.'], findings: [] })]).ends, true);
    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    assert.strictEqual(JSON.parse(sim.read(['checklist', 'show', 'finish', WU])).items.find((/** @type {{key: string}} */ { key }) => key === 'review-passed').state, 'done');
    assert.deepStrictEqual(finished(sim, WU).landed, []);
  });
});
