'use strict';

// ---------------------------------------------------------------------------
// A catch-up killed between its steps
// (workflow-engine/scripts/domain/state-merge-landing.cjs): the landing
// finished by the next state commit or catch-up, losing nothing — a task
// verb's setting up among them.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine", each with
// its state worktree made through the machinery (state-merge-world.cjs).
// The kill is a `git` wrapper first on PATH, in a process of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { ok, git, tip, remoteTip, layout, commitOnState } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { catchUpState } = require(MERGE);

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const {
  useWorld, blobId, parents, status, pushFailing, commitUnpushed, machinesSharing, ledger, json, projectManifest, mergeLeftovers, killedAfter,
} = require('./state-merge-world.cjs');

const [TRACKER] = listDrivers('task').filter((driver) => driver.isDefault);

useWorld();

describe('a catch-up killed between its steps', () => {
  const LOG = 'unit/topics/a/log.md';
  const CHART = 'unit/assets/chart.png';

  // The landing's git steps, each named by what its arguments hold: the
  // merge's commit, the files staged, the worktree's index, the branch, the
  // push.
  // After the kill the remote moves on, changing one manifest field and
  // removing another the killed landing had written: the next catch-up
  // reads nothing that landing wrote as this machine's change.
  for (const marker of ['commit-tree', '--prefix=', 'reset --quiet', 'update-ref -m', '--force-with-lease']) {
    it(`loses nothing, and reads nothing it wrote as this machine's, when killed after ${marker} with the remote moving on`, () => {
      const { here, there, bare } = machinesSharing({
        [layout.ledger]: ledger('base'), [CHART]: 'png\0base', [LOG]: '# a\n', [layout.projectManifest]: projectManifest('now'),
      });
      commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1'), [CHART]: 'png\0here' });
      createFile(here.root, LOG, '# a\n\n## here, uncommitted\n');
      commitOnState(there.root, {
        [layout.ledger]: ledger('base', 'b1'), [CHART]: 'png\0there', [LOG]: '# a\n\n## elsewhere\n', [layout.projectManifest]: projectManifest('someday', { extra: 1 }),
      });
      const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;

      killedAfter(here.root, 'merge.catchUpState(root)', marker);
      assert.notStrictEqual(catchUpState(there.root).action, 'stopped');
      const onward = commitOnState(there.root, { [layout.projectManifest]: projectManifest('later') }).commit;
      const out = catchUpState(here.root);

      const landed = tip(here.main, STATE_BRANCH);
      assert.ok(['merged', 'fast-forwarded'].includes(out.action), `the catch-up ${out.action}: ${JSON.stringify(out.conflicts)}`);
      assert.strictEqual(remoteTip(bare), landed);
      assert.ok(landed === onward || parents(here.main, landed)[0] === onward, 'the landing is not on the remote\'s new tip');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), projectManifest('later'));
      assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('later'), 'a field the killed landing wrote came back');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.ledger}`]), ledger('base', 'b1', 'a1'));
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${CHART}`]), 'png\0there');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), 'png\0here');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${LOG}`]), '# a\n\n## elsewhere\n');
      assert.strictEqual(readFile(here.root, LOG), '# a\n\n## elsewhere\n## here, uncommitted\n');
      assert.strictEqual(readFile(here.root, beside), 'png\0here');
      assert.strictEqual(status(here.root), ` M ${LOG}\n`);
      assert.deepStrictEqual(mergeLeftovers(here.root), []);
    });
  }

  it('is finished by a state commit before it moves the branch, its notes first, so the next catch-up reads nothing it wrote as this machine\'s', () => {
    const { here, there } = machinesSharing({ [layout.ledger]: ledger('base'), [layout.projectManifest]: projectManifest('now'), [CHART]: 'png\0base' });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1'), [CHART]: 'png\0here' });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday'), [CHART]: 'png\0there' });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');

    const live = pushFailing(here, () => commitOnState(here.root, { [layout.ledger]: ledger('base', 'a1', 'a2') }));
    assert.notStrictEqual(catchUpState(there.root).action, 'stopped');
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('later') });
    const out = catchUpState(here.root);

    const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;
    assert.strictEqual(live.warnings.length, 2, live.warnings.join('\n'));
    assert.strictEqual(live.warnings[0], `${CHART} was changed on both machines and is not merged line by line: the remote's copy stays at ${CHART}, and this machine's is kept beside it as ${beside}`);
    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]), projectManifest('later'));
    assert.strictEqual(readFile(here.root, layout.projectManifest), projectManifest('later'), 'a field the killed landing wrote came back');
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${layout.ledger}`]), ledger('base', 'a1', 'a2'));
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), 'png\0here');
    assert.strictEqual(status(here.root), '');
    assert.deepStrictEqual(mergeLeftovers(here.root), []);
  });

  it('is finished by a task verb\'s setting up, its setting put onto the manifest the landing brought, so the remote\'s change is kept and goes on to the other machine', () => {
    const { here, there } = machinesSharing({
      [layout.projectManifest]: projectManifest('now'), [layout.manifest('pay')]: json({ name: 'pay', work_type: 'feature', status: 'in-progress', description: 'x', phases: {} }),
    });
    commitUnpushed(here, { 'unit/notes.md': 'here\n' });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday') });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');

    ok(here.main, ['task', 'ready', 'pay']);

    const held = JSON.parse(git(here.main, ['show', `${STATE_BRANCH}:${layout.projectManifest}`]));
    assert.deepStrictEqual([held.roadmap.items['a-lifetime-tier'].horizon, held.drivers.task], ['someday', TRACKER.name]);
    assert.strictEqual(status(here.root), '');
    assert.strictEqual(catchUpState(there.root).action, 'fast-forwarded');
    assert.strictEqual(JSON.parse(readFile(there.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'someday');
  });

  it('says, finishing the landing, that a file a session changed since may already hold the merged copy it sets beside', () => {
    const DATA = 'unit/data.json';
    const { here, there } = machinesSharing({ [DATA]: '{"a":1}\n' });
    commitUnpushed(here, { [DATA]: '{"a":2}\n' });
    commitOnState(there.root, { [DATA]: '{"a":3}\n' });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');
    createFile(here.root, DATA, '{"a":3,"b":1}\n');

    const out = catchUpState(here.root);

    const beside = `unit/data.${blobId('{"a":3}\n').slice(0, 8)}.json`;
    assert.strictEqual(readFile(here.root, DATA), '{"a":3,"b":1}\n');
    assert.strictEqual(readFile(here.root, beside), '{"a":3}\n');
    assert.ok(out.warnings.includes(
      `${DATA} changed after a catch-up was cut short and was left as it stands, with the merged copy beside it as ${beside}: `
      + `unless ${DATA} was changed from the merged copy, committing ${DATA} as it stands leaves the remote's change only in ${beside}`,
    ), out.warnings.join('\n'));
  });
});
