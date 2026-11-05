'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review phase reading an area in a reader's own
// scratch worktree, as its skill and the reader's brief run it (13.2.2,
// 14.2.2): a feature whose build has closed its cut, its product's drive
// needing an ignored `.env` the checkout's `.worktreeinclude` names and a
// `node_modules` the settings link. Round 1's area reader lays its scratch
// worktree out by the first call its brief names, prepared as the
// project's checkout is, proves the area's scenario there through the
// engine its brief names by its absolute path, and takes the worktree apart
// by the second once its report is written; the round passes, and its
// report reads the scenario proven by running it. A reader that dies
// leaves its layout, which the project here does not ignore: the round,
// its tree check passing over each, takes its readers' apart, and finish
// any of the unit's still left.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase, built and closed, then
// its drive needing what only a prepared checkout holds — a copy per
// scenario, which replays the engine calls the review phase's skill and its
// readers make, in order, the oracle (pipeline-oracle.cjs) auditing the
// whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, worldFrom, cutClosed, testsRead, reviewNext, briefOf, scratchCalls, deadReader, placeIn, landed, finished, PASSED_REPORT,
} = require('./pipeline-world.cjs');

const WU = 'ledger';

// The drive passes only where the checkout holds the ignored `.env` and the
// linked `node_modules`, as the project's own checkout does.
const DRIVE = [
  '#!/bin/sh',
  'if [ "$(cat .env 2>/dev/null)" = "KEY=1" ] && [ -f node_modules/dep/index.js ]; then echo pass; else echo fail; fi > "$LEEWAY_RUN/verdict"',
  '',
].join('\n');

/** A feature through its spec to ready to build's pick, its cut's one phase built, reviewed, merged and closed; then its drive needing an ignored file and a linked folder. */
const scratchWorld = worldFrom('pipeline-review-scratch-', (sim) => {
  cutClosed(sim, WU);
  fs.appendFileSync(path.join(sim.dir, '.git/info/exclude'), '.env\nnode_modules/\n.worktreeinclude\n.claude/settings.local.json\n');
  const files = {
    '.env': 'KEY=1\n', 'node_modules/dep/index.js': 'module.exports = 1;\n', '.worktreeinclude': '.env\n',
    '.claude/settings.local.json': JSON.stringify({ worktree: { symlinkDirectories: ['node_modules'] } }),
  };
  for (const [file, text] of Object.entries(files)) sim.write(file, text);
  fs.writeFileSync(path.join(sim.dir, 'verify/drive.sh'), DRIVE, { mode: 0o755 });
  git(sim.dir, ['add', 'verify/drive.sh']);
  git(sim.dir, ['commit', '-q', '-m', 'chore: the drive reads the environment']);
});

describe('pipeline simulation: an area read in its reader\'s scratch worktree', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(scratchWorld);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('13.2.2, 14.2.2: an area\'s reader lays out its scratch worktree by its brief\'s calls, prepared as the project\'s checkout is, proves the area\'s scenario there and takes it apart; the round passes, its report reading the scenario proven by running it', () => {
    assert.strictEqual(reviewNext(sim, WU).move, 'round');
    const reader = sim.run(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', 'a']);
    const [lay, remove] = scratchCalls(briefOf(sim, reader));
    const { path: project } = sim.run(lay);
    const prepared = [fs.readFileSync(path.join(project, '.env'), 'utf8'), fs.lstatSync(path.join(project, 'node_modules')).isSymbolicLink()];
    const run = sim.runIn(project, ['verify', 'run', WU, '1.S1']);
    landed(placeIn(sim, reader, 'Where your report goes'), PASSED_REPORT);
    sim.run(remove);

    assert.deepStrictEqual(prepared, ['KEY=1\n', true], 'the ignored file copied and the folder linked');
    assert.deepStrictEqual([run.verdict, run.standing], ['pass', 'proven'], 'the drive passes in the scratch worktree, at the change\'s tip');
    assert.strictEqual(fs.existsSync(project), false, 'taken apart once the report is written');
    landed(placeIn(sim, sim.run(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', 'b']), 'Where your report goes'), PASSED_REPORT);
    testsRead(sim, WU);
    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger.'], findings: [] })]);
    assert.match(sim.render(['review-report', WU], { expect: 'content' }), /PROVEN BY RUNNING IT \(1 of 1\)\n\s*└─ 1\.S1 /, 'the round\'s report reads the scenario proven');
  });

  it('14.2.2: a dead reader\'s layout is never the person\'s change — the round, its tree check passing over each, takes its readers\' apart, and finish any of the unit\'s still left', () => {
    reviewNext(sim, WU);
    /** A reader's brief whose reader lays out its scratch worktree, lands its report and dies. @param {string[]} argv */
    const dies = (argv) => {
      const reader = sim.run(argv);
      const project = deadReader(sim, reader);
      landed(placeIn(sim, reader, 'Where your report goes'), PASSED_REPORT);
      return { project, lay: scratchCalls(briefOf(sim, reader))[0] };
    };
    const readers = [
      dies(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', 'a']),
      dies(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', 'b']),
      dies(['brief', 'test-surface', WU, '--base', 'main']),
    ];
    const { path: leftover } = sim.run(['scratch', 'lay', `${WU}-phase-1-a`, ...readers[0].lay.slice(3)]);
    assert.match(git(sim.dir, ['status', '--porcelain', '--untracked-files=all']), /^\?\? \.claude\/worktrees\/leeway-scratch-ledger-tests\/$/m, 'the project does not ignore the layouts');

    sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger.'], findings: [] })]);
    assert.deepStrictEqual([...readers.map(({ project }) => project), leftover].map((top) => fs.existsSync(top)), [false, false, false, true], 'the round\'s readers\' taken apart, no other');
    finished(sim, WU);
    assert.strictEqual(fs.existsSync(leftover), false, 'finish takes apart the unit\'s left');
  });
});
