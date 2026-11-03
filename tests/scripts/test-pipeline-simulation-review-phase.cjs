'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's review-phase scenario: a unit whose build has
// closed every phase of its cut, reviewed whole — the review phase entered;
// each area's pair and the test reader briefed, their reports written as
// the agents write them, a `.txt` beside the file their brief names,
// renamed to it; a finding out of scope filed to the inbox by Claude's call
// at the review; the failing round recorded with its fix task, written as a
// phase past the cut and built through the task loop with no phase review
// over it; the next round reading only the area the fix changed, passing,
// and closing the review; then its report and the calls decided for the
// person drawn.
//
// Layer: simulation. World: this file's own, built once from the project
// every scenario starts from (pipeline-world.cjs) — a feature through its
// spec to ready to build's pick, its cut one phase, built and closed — a
// copy per scenario, which replays the engine calls the review phase makes,
// in order, the oracle (pipeline-oracle.cjs) auditing the whole state after
// every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git } = require('./engine-harness.cjs');
const {
  Sim, startUnit, discussed, specToBuild, buildEntry, startPhase, writePhaseTasks, worldFrom, placeIn, landed,
} = require('./pipeline-world.cjs');

const WU = 'ledger';
const PASSED = '## Findings\n\nNone.\n\nVerdict: pass\n';
const UNCHECKED = '## Findings\n\n- bug: the ledger never checks its hash on read\n  Scenario: an entry read back\n\nVerdict: fail\n';

/** The verify setup the first task's builder builds: its files, by path. */
const VERIFY_FILES = Object.freeze({
  'verify/features.md': '# Features\n',
  'verify/drive.sh': '#!/bin/sh\nprintf "pass\\n" > "$LEEWAY_RUN/verdict"\n',
});

/**
 * A task built as the loop builds it in the worktree at `tree`: started,
 * its files committed there, the verify setup recorded and its scenario run
 * where `setup` says so, its pair passing it, its account taken, chained into
 * its phase's stack and done.
 * @param {Sim} sim @param {string} task @param {string} tree @param {Record<string, string>} files @param {boolean} setup
 */
function taskBuilt(sim, task, tree, files, setup) {
  sim.run(['task', 'start', WU, task]);
  const builder = sim.run(['brief', 'builder', WU, task]);
  git(sim.dir, ['worktree', 'add', '-q', '-b', `worktree-agent-${task}`, tree]);
  sim.runIn(tree, ['task', 'worktree', WU, task]);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    fs.writeFileSync(path.join(tree, file), text, { mode: 0o755 });
  }
  sim.runIn(tree, ['commit', '--paths', ...Object.keys(files), '--task', WU, task, '-m', `feat(${WU}): task ${task}`]);
  if (setup) {
    const at = placeIn(sim, builder, 'Where the verify setup goes');
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, JSON.stringify({
      place: 'verify', feature_map: 'verify/features.md', launch: 'true', health: 'true', drive: 'verify/drive.sh', evidence: 'true', cleanup: 'true',
      mutation: 'echo "[]" > "$LEEWAY_RUN/survivors.json"',
    }));
    sim.runIn(tree, ['verify', 'setup', WU, '--file', at, '--scenario', '1.S1']);
    sim.runIn(tree, ['verify', 'run', WU, '1.S1']);
  }
  for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'reviewer', WU, task, '--base', 'main', '--letter', letter]), 'Where your report goes'), PASSED);
  landed(placeIn(sim, builder, 'Where your account goes'), [
    '## What was done', 'Built.', '## Where in the code', ...Object.keys(files).map((file) => `- ${file}`), '## What the tests prove', '- 1.S1, run through verify.',
    '## Differs from the task', 'None.', '## Reviews', '### Round 1', 'Passed.',
  ].join('\n\n'));
  sim.run(['task', 'account', WU, task]);
  sim.run(['land', 'open', WU, task]);
  sim.run(['land', 'chain', WU, task]);
  sim.run(['task', 'done', WU, task]);
}

/** A worktree a builder's isolation makes, under a folder of its own; and that folder removed. */
const builders = {
  /** @param {string} name */
  make: (name) => path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-review-builders-'))), name),
  /** @param {Sim} sim @param {string} tree */
  remove: (sim, tree) => {
    git(sim.dir, ['worktree', 'remove', '--force', tree]);
    fs.rmSync(path.dirname(tree), { recursive: true, force: true });
  },
};

/** A feature through its spec to ready to build's pick, its cut's one phase built, reviewed, merged and closed. */
const reviewWorld = worldFrom('pipeline-review-phase-', (sim) => {
  startUnit(sim, 'feature', WU, 'A ledger');
  discussed(sim, WU, WU);
  specToBuild(sim, WU, [WU], 'a');
  buildEntry(sim, WU);
  writePhaseTasks(sim, WU, 1, 'The work', [{ title: 'Write the ledger', scenarios: ['1.S1'] }]);
  startPhase(sim, WU, 1);
  const tree = builders.make('agent-1');
  taskBuilt(sim, '1.1', tree, { ...VERIFY_FILES, 'src/ledger.js': 'export const ledger = 1;\n' }, true);
  sim.runIn(tree, ['verify', 'mutants', WU, '1']);
  builders.remove(sim, tree);
  for (const letter of ['a', 'b']) landed(placeIn(sim, sim.run(['brief', 'phase-review', WU, '1', '--base', 'main', '--letter', letter]), 'Where your report goes'), PASSED);
  sim.run(['land', 'phase', WU, '1']);
  sim.run(['checklist', 'close', 'phase-close', WU, '1']);
});

describe('pipeline simulation: the review phase', () => {
  let sim;
  beforeEach(() => {
    sim = new Sim(reviewWorld);
  });
  afterEach(() => {
    sim.destroy();
  });

  it('the review phase entered; the area\'s pair and the test reader briefed and reporting; a finding out of scope filed; the failing round\'s fix task built as a phase past the cut; the next round reading the area it changed, passing and closing the review; its report and the calls drawn', () => {
    sim.run(['enter', 'review', WU]);
    assert.ok(sim.sections.includes('reads: 1-the-work, the test surface (tests)\n'), sim.sections);

    // Round 1: the area's pair, one failing it, and the test reader.
    for (const letter of ['a', 'b']) {
      landed(placeIn(sim, sim.run(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', letter]), 'Where your report goes'), letter === 'a' ? UNCHECKED : PASSED);
    }
    landed(placeIn(sim, sim.run(['brief', 'test-surface', WU, '--base', 'main']), 'Where your report goes'), PASSED);

    // Out of scope: Claude's call to file it, then the item filed.
    const question = sim.run(['ledger', 'ask', `${WU}.review`], null, JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Is the export finding filed or dropped?' })).id;
    const call = sim.run(['ledger', 'decide', `${WU}.review`, '--answers', question], null, JSON.stringify({
      by: 'claude', who_moved_whom: 'none', text: 'Filed: the ledger has no export.', why: 'It is beside the change.',
    })).id;
    const item = sim.run(['inbox', 'file', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/item.json`, { kind: 'idea', text: '# Ledger export\n\nThe ledger has no export.', call })]);

    // The fix written as a phase past the cut, and the round recorded.
    writePhaseTasks(sim, WU, 2, 'Review fixes', [{ title: 'Check the hash' }]);
    const round = sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, {
      can_now: ['Keep a ledger.'],
      findings: [
        { area: '1-the-work', scope: 'in', call: 'bug', text: 'The ledger never checks its hash on read.', fix: '2.1' },
        { area: 'tests', scope: 'out', call: 'nit', text: 'The ledger has no export.', inbox: item.filed, ledger: call },
      ],
    })]);
    assert.deepStrictEqual([round.fix_phase, round.next_reads], [2, ['1-the-work']]);

    // The fix built through the task loop, with no phase review over it.
    const tree = builders.make('agent-2');
    taskBuilt(sim, '2.1', tree, { 'src/hash.js': 'export const hash = 1;\n' }, false);
    builders.remove(sim, tree);

    // Round 2 reads the area the fix changed, passes, and closes the review.
    sim.run(['enter', 'review', WU]);
    for (const letter of ['a', 'b']) {
      landed(placeIn(sim, sim.run(['brief', 'review-area', WU, '--area', '1', '--base', 'main', '--letter', letter]), 'Where your report goes'), PASSED);
    }
    landed(placeIn(sim, sim.run(['brief', 'test-surface', WU, '--base', 'main']), 'Where your report goes'), PASSED);
    assert.strictEqual(sim.run(['review', 'round', WU, '--file', sim.write(`.leeway/.cache/${WU}/review/round.json`, { can_now: ['Keep a ledger whose entries are checked.'], findings: [] })]).over, true);

    sim.render(['review-report', WU], { expect: 'content' });
    sim.render(['review-calls', WU], { expect: 'content' });
  });
});
