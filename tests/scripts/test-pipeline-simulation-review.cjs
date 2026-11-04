'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase, as its skill runs it, on an epic
// in auto: the build's last phase closed, the build runs straight into the
// review phase in the same conversation, each entry's DATA saying what
// comes next in the skill's order; round 1 reads both areas and the test
// surface, its findings out of scope filed to the inbox or dropped by
// Claude's calls, its fix written as the round's phase past the cut,
// the one the entry names, and built through the task loop; round 2 reads
// only the area the fix changed and passes; its report and the calls
// drawn; and finish, its gate's yes landing the fix phase and handing off
// to the epic's menu, the finished unit's folder holding what the layout
// lays out. The board draws each round recorded: the failing one with its
// finding, what went to the inbox and its fix task, and the last passed. In
// step, test-pipeline-simulation-review-step-finish.cjs; a
// review failing then passing with a fix each time, its builder's note
// answered before finish, -review-rounds.cjs; a stuck round settled,
// -review-settled.cjs.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — an epic of one topic
// through its spec of two areas to ready to build's pick in auto, its cut
// one phase, built and closed — a copy per scenario, which replays the
// engine calls the review phase's skill makes, in order, the oracle
// (pipeline-oracle.cjs) auditing the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { treeSnapshot } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, mappedEpic, discussed, specEntry, specReviewed, cutTheSpec, readyToBuild, answerGate, firstPhaseBuilt, carryOn, handoff,
  writePhaseTasks, builders, taskBuilt, areaRead, testsRead, reviewNext, reviewCall, finished,
} = require('./pipeline-world.cjs');

const WU = 'ledgerly';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';
const BESIDE = [
  '## Findings', '',
  '- bug: importing an old ledger drops its dates', '  Scenario: an old ledger imported',
  '- nit: a test of the import calls its ledger an export', '  Scenario: the import\'s tests read', '',
  'Verdict: fail', '',
].join('\n');

/** An epic of one topic through its spec of two areas — the second with no scenario of its own — to ready to build's pick in auto, its cut's one phase built and closed. */
const reviewWorld = worldFrom('pipeline-review-', (sim) => {
  mappedEpic(sim, WU, ['entries']);
  discussed(sim, WU, 'entries');
  specEntry(sim, WU, ['entries']);
  sim.run(['brief', 'spec-writer', WU]);
  const [decision] = JSON.parse(sim.read(['ledger', 'record', WU, 'entries'])).decisions;
  sim.write(`.leeway/${WU}/spec.md`, [
    '# Ledgerly', '', '## 1. Entries', '', '### 1.1 Kept', '', `1.1.1 An entry is kept as decided. [${decision.id}]`, '',
    '## 1-S. Scenarios for §1', '', '1.S1 Given a ledger, when an entry is kept, then it reads back. (1.1.1)', '',
    '## 2. Export', '', '### 2.1 Out', '', `2.1.1 The ledger exports as decided. [${decision.id}]`, '',
  ].join('\n'));
  sim.run(['spec', 'land', WU]);
  specReviewed(sim, WU);
  cutTheSpec(sim, WU, [{ name: 'The ledger', goal: 'Entries kept and exported.', scenarios: ['1.S1'], sections: ['1', '2'], relies_on: [] }]);
  readyToBuild(sim, WU);
  sim.run(answerGate(sim, 'ready to build', '--pick', 'a').next.argv);
  sim.handOver();
  firstPhaseBuilt(sim, WU, 'The ledger', 'Keep the ledger', 'src/ledger.js');
});

/** Every file under the unit's folder, from it. @param {Sim} sim */
function unitFiles(sim) {
  return Object.keys(treeSnapshot(sim.dir)).filter((file) => file.startsWith(`${WU}/`)).map((file) => file.slice(WU.length + 1)).sort();
}

// The places 4.11.5 lays out in a unit's folder, as this epic fills them.
const LAID_OUT = [
  /^manifest\.json$/, /^discovery\/session-\d{3}\.md$/, /^topics\/[a-z-]+\/(?:brief|log)\.md$/, /^spec\.md$/,
  /^build\/(?:log|notes)\.md$/, /^build\/tasks\/\d+\.\d+\.md$/, /^build\/tasks\/\d+\.\d+\/(?:round-\d+-[a-z]\.md|figures\.json)$/,
  /^build\/phases\/phase-\d+\/review-[a-z]\.md$/, /^build\/runs\/\d+\.S\d+\/run-\d{3}\.json$/,
  /^review\/round-\d+(?:\.md|\.json|-checks\.md|-reads\.json)$/, /^review\/round-\d+\/[a-z0-9-]+-[a-z]\.md$/,
];

describe('pipeline simulation: the review phase, as its skill runs it', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(reviewWorld);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('an epic in auto: the build runs straight into the review phase in one conversation; round 1 reads both areas and the tests, files one finding out of scope and drops another by Claude\'s calls, its fix phase the one the entry names, built; round 2 reads only the area it changed and passes; finish lands the fix phase and hands off to the epic\'s menu; the finished folder holds what the layout lays out (14.S1, 24.S7, 12.S43, 14.S3, 14.S5, 4.S21, 4.S22, 20.10.1, 20.10.2)', () => {
    const conversation = sim.env.CLAUDE_CODE_SESSION_ID;
    sim.run(['enter', 'implementation', WU]);
    const { move, data, fixPhase: phase } = reviewNext(sim, WU);
    const here = carryOn(sim);
    assert.deepStrictEqual([sim.env.CLAUDE_CODE_SESSION_ID, here.position], [conversation, { name: WU, phase: 'review', topic: WU }],
      'the build\'s own conversation carries on into the review phase, with no handoff and no menu between (14.S1, 24.S7)');
    assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills/leeway-review-process/SKILL.md'), 'a compaction there carries on in the review phase\'s skill');
    assert.deepStrictEqual([move, data.reads], ['round', ['1-entries, 2-export, the test surface (tests)']], 'round 1 reads every area, none merged, and the test surface');

    // Round 1: both pairs and the test reader; area 1 fails, the test
    // reader's findings are beside the change — one filed, one dropped.
    areaRead(sim, WU, UNCHECKED, 1);
    areaRead(sim, WU, undefined, 2);
    testsRead(sim, WU, BESIDE);
    const fileCall = reviewCall(sim, WU, 'Is the dropped import date filed or dropped?', 'Filed: an old ledger\'s import keeps its dates.', 'A real loss, beside the change.');
    const item = sim.run(['inbox', 'file', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/item.json`, {
      kind: 'bug', text: '# Old ledgers lose their dates on import\n\nImporting an old ledger drops each entry\'s date.', call: fileCall,
    })]);
    const dropCall = reviewCall(sim, WU, 'Is the import test\'s wording filed or dropped?', 'Dropped.', 'A word in a test beside the change is not worth an item.');
    writePhaseTasks(sim, WU, phase, 'The review\'s fixes', [{ title: 'Check the hash on read', type: 'fix', scenarios: ['an entry read back'], reference: '§1' }]);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger and export it.'],
      findings: [
        { area: '1-entries', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', from: ['1-entries-a#1'], fix: `${phase}.1` },
        { area: 'tests', scope: 'out', call: 'bug', text: 'Importing an old ledger drops its dates.', from: ['tests-a#1'], inbox: item.filed, ledger: fileCall },
        { area: 'tests', scope: 'out', call: 'nit', text: 'A test of the import calls its ledger an export.', from: ['tests-a#2'], drop: 'Not worth an item.', ledger: dropCall },
      ],
    })]);
    sim.render(['review-report', WU], { expect: 'content' });
    const board = () => JSON.parse(sim.read(['board', sim.env.CLAUDE_CODE_SESSION_ID]));
    const failed = board().view;
    assert.deepStrictEqual([failed.verdict, failed.found.length, failed.inbox, failed.fixes?.tasks.map(({ task }) => task)], ['failed', 1, ['Importing an old ledger drops its dates.'], [`${phase}.1`]],
      'the board draws the round failed, its finding in scope, what went to the inbox and its fix task (20.10.1)');

    // The fix built through the task loop; round 2 reads the area it changed.
    assert.strictEqual(reviewNext(sim, WU).move, 'fixes');
    const tree = builders.make(`agent-${phase}`);
    taskBuilt(sim, WU, `${phase}.1`, tree, { 'src/hash.js': 'export const hash = 1;\n' }, false);
    builders.remove(sim, tree);
    assert.strictEqual(reviewNext(sim, WU).move, 'reads');
    sim.run(['review', 'reads', WU, '1-entries']);
    assert.deepStrictEqual(reviewNext(sim, WU).data.reads, ['1-entries'], 'only the area the fix changed is read again (14.3.3)');
    areaRead(sim, WU, undefined, 1);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]);
    const passed = board();
    assert.deepStrictEqual([passed.view.round, passed.view.verdict, passed.view.areas.map(({ state }) => state), passed.banner.state], [2, 'passed', ['read', 'unchanged', 'unchanged'], 'done'],
      'the board draws round 2 passed, the area read and the rest unchanged, the banner done (20.10.2)');
    sim.render(['review-report', WU], { expect: 'content' });
    sim.render(['review-calls', WU], { expect: 'content' });

    // Finish, the build's log closed first.
    assert.strictEqual(reviewNext(sim, WU).move, 'closing');
    sim.write(`.leeway/${WU}/build/log.md`, '# The build\n\nPhase 1 built; the review fixed the hash on read in round 1 and passed in round 2. Nothing is in flight.\n');
    const { landed, next } = finished(sim, WU);
    assert.deepStrictEqual(landed, [[phase]], 'finish lands the fix phase, the cut\'s merged before it');
    handoff(sim, `/${next.skill} ${next.args.join(' ')}`);

    const files = unitFiles(sim);
    assert.deepStrictEqual(files.filter((file) => !LAID_OUT.some((place) => place.test(file))), [], 'every file is a place 4.11.5 lays out: no tracking or analysis files, no .state/ (4.S21, 4.S22)');
    for (const file of ['build/log.md', 'build/tasks/1.1.md', 'build/tasks/1.1/round-1-a.md', `build/tasks/${phase}.1.md`, 'review/round-2.md', 'review/round-1/2-export-b.md', 'review/round-1/tests-a.md']) {
      assert.ok(files.includes(file), `the finished unit keeps ${file}`);
    }
    assert.ok(!fs.existsSync(path.join(sim.dir, '.leeway', '.baseline')), '.leeway/ holds no .baseline/');
    assert.deepStrictEqual([1, phase].map((n) => JSON.parse(sim.read(['task', 'list', WU, String(n)])).tasks.map((/** @type {{status: string}} */ t) => t.status)), [['done'], ['done']],
      'its tasks are found in the tracker');
  });
});
