'use strict';

// ---------------------------------------------------------------------------
// The tracker's store in a second clone's merge
// (leeway-engine/scripts/domain/state-merge-paths.cjs and state-merge.cjs,
// the store merged by its task driver; 4.7, 7.5, 29.14.9): each side's
// tasks merged by the tracker's records, a field both machines set
// differently asked at the merge's stop and the pick written, and a name
// both machines made keeping both copies whole, naming what to make again.
// What the driver merges is the task conformance suite's.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine"
// (state-merge-world.cjs), the store built through the default task
// driver in folders of its own, once for the base, and committed as text.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, commitOnState } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, stateMergeGateSurface } = require(path.join(SCRIPTS, 'domain/state-merge.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { taskName, phaseName } = require(path.join(SCRIPTS, 'domain/task-id.cjs'));

const { templateFolder } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, blobId, status, commitUnpushed, pickShown } = require('./state-merge-world.cjs');

/** @typedef {import('./state-merge-world.cjs').Machine} Machine */

const world = useWorld();
const DRIVER = /** @type {import('../../skills/leeway-engine/scripts/domain/drivers.cjs').TaskDriver} */ (listDrivers('task').find((driver) => driver.isDefault));
const [STORE] = DRIVER.storeFiles();
const UNIT = 'pay';

/** @param {number} phase @param {number} n */
const ref = (phase, n) => ({ unit: UNIT, phase, n });
/** @param {string} title */
const task = (title) => ({ title, type: 'feat', text: `# ${title}` });

/** @type {string} */
let template;

before(() => {
  template = templateFolder('state-merge-tracker-');
  DRIVER.ensureStore(template);
  DRIVER.createUnit(template, UNIT);
  DRIVER.createPhase(template, UNIT, 1, 'The ledger');
  DRIVER.createTask(template, ref(1, 1), task('Write the ledger'));
  DRIVER.createTask(template, ref(1, 2), task('Read the ledger'));
  DRIVER.createPhase(template, UNIT, 2, 'The screen');
  DRIVER.createTask(template, ref(2, 1), task('Show the ledger'));
});

/** The base store in a folder of its own, changed there by `change`. @param {(dir: string) => void} [change] */
function storeFolder(change = () => {}) {
  const dir = fs.mkdtempSync(path.join(world(), 'store-'));
  fs.cpSync(template, dir, { recursive: true });
  change(dir);
  return dir;
}

/** The base store changed by `change`, as the file the state branch carries. @param {(dir: string) => void} [change] */
function storeAfter(change) {
  return { [STORE]: fs.readFileSync(path.join(storeFolder(change), STORE), 'utf8') };
}

/** The store a machine's branch holds at `file`, in a folder the driver reads. @param {Machine} machine @param {string} [file] */
function branchStore(machine, file = STORE) {
  const dir = storeFolder();
  fs.writeFileSync(path.join(dir, STORE), git(machine.main, ['show', `${STATE_BRANCH}:${file}`]));
  return dir;
}

/** Two machines sharing the base store, each having changed it its own way, this one's push failing. @param {(dir: string) => void} here @param {(dir: string) => void} there */
function bothChanged(here, there) {
  const machines = machinesSharing(storeAfter());
  const mine = storeAfter(here);
  const theirs = storeAfter(there);
  commitUnpushed(machines.here, mine);
  commitOnState(machines.there.root, theirs);
  return { ...machines, mine: mine[STORE], theirs: theirs[STORE] };
}

describe('the tracker\'s store, both machines having changed it', () => {
  it('merges it by the tracker\'s records: each side\'s tasks kept, each change taken from the side that made it, nothing kept beside and nothing to say', () => {
    const { here } = bothChanged(
      (dir) => {
        DRIVER.done(dir, ref(1, 1));
        DRIVER.createTask(dir, ref(1, 3), task('Fold the ledger'));
      },
      (dir) => {
        DRIVER.start(dir, ref(1, 2));
        DRIVER.createTask(dir, ref(2, 2), task('Page the ledger'));
      },
    );

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['merged', true, []]);
    const merged = branchStore(here);
    assert.deepStrictEqual(DRIVER.list(merged, UNIT, 1)?.map((row) => [row.title, row.status]), [['Write the ledger', 'done'], ['Read the ledger', 'in-progress'], ['Fold the ledger', 'open']]);
    assert.deepStrictEqual(DRIVER.list(merged, UNIT, 2)?.map((row) => row.title), ['Show the ledger', 'Page the ledger']);
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, path.dirname(STORE)]), `${STORE}\n`);
    assert.strictEqual(status(here.root), '');
  });

  it('stops on a field both set differently, its screen naming the tracker\'s store, the task and the field; the pick is written into the store and the merge finishes', () => {
    const { here } = bothChanged((dir) => DRIVER.done(dir, ref(1, 1)), (dir) => DRIVER.close(dir, ref(1, 1), 'Not needed.'));

    const stopped = catchUpState(here.root);

    assert.deepStrictEqual([stopped.action, stopped.conflicts.map((c) => [c.file, c.label.owner, c.label.subject, c.label.field, c.local, c.remote])], ['stopped', [
      [STORE, 'the tracker\'s store', taskName(ref(1, 1)), 'status', { set: true, value: 'done' }, { set: true, value: 'closed' }],
    ]]);
    assert.match(stateMergeGateSurface(here.main, {}), new RegExp(`^> In the tracker's store, the status of ${taskName(ref(1, 1))} changed on each machine since they last agreed:$`, 'm'));

    const out = pickShown(here, '1');

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(DRIVER.show(branchStore(here), ref(1, 1))?.status, 'done');
  });

  it('keeps both copies whole where both made a phase or task under one name: the remote\'s at the path, this machine\'s beside it, the note naming the names and what to make again', () => {
    const { here, mine, theirs } = bothChanged(
      (dir) => {
        DRIVER.createTask(dir, ref(2, 2), task('Page the ledger'));
        DRIVER.createPhase(dir, UNIT, 3, 'The export');
      },
      (dir) => {
        DRIVER.createTask(dir, ref(2, 2), task('Print the ledger'));
        DRIVER.createPhase(dir, UNIT, 3, 'The archive');
      },
    );

    const out = catchUpState(here.root);

    const ext = path.extname(STORE);
    const beside = `${STORE.slice(0, -ext.length)}.${blobId(mine).slice(0, 8)}${ext}`;
    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.deepStrictEqual([STORE, beside].map((file) => git(here.main, ['show', `${STATE_BRANCH}:${file}`])), [theirs, mine]);
    assert.deepStrictEqual(out.warnings, [
      `${taskName(ref(2, 2))} and ${phaseName(UNIT, 3)} were made on both machines, so the tracker's store is not merged: the remote's copy stays at ${STORE}, and this machine's is kept beside it as ${beside}; make again in the tracker what only this machine made: ${taskName(ref(2, 2))} and ${phaseName(UNIT, 3)}`,
    ]);
  });
});
