'use strict';

// ---------------------------------------------------------------------------
// The tracker's store in a second clone's merge
// (leeway-engine/scripts/domain/state-merge-paths.cjs and state-merge.cjs,
// the store merged by its task driver; 4.7, 7.5, 29.14.9): each side's
// tasks merged by the tracker's records, a field both machines set
// differently asked at the merge's stop and the pick written, and a name
// both machines made stopping the merge (7.S22), its screen naming the task
// to make again, carrying on keeping this machine's whole copy beside. What
// the driver merges is the task conformance suite's.
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
const { STATE_DIR_NAME } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { catchUpState, stateMergeGateSurface } = require(path.join(SCRIPTS, 'domain/state-merge.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { taskName } = require(path.join(SCRIPTS, 'domain/task-id.cjs'));

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

  it('stops where both made a task under one number, its screen naming it and the task to make again; carrying on keeps this machine\'s other progress, the remote\'s task under the number, and this machine\'s whole copy beside', () => {
    const { here, mine } = bothChanged(
      (dir) => {
        DRIVER.done(dir, ref(1, 1));
        DRIVER.createTask(dir, ref(2, 2), task('Page the ledger'));
      },
      (dir) => DRIVER.createTask(dir, ref(2, 2), task('Print the ledger')),
    );
    const ext = path.extname(STORE);
    const beside = `${STORE.slice(0, -ext.length)}.${blobId(mine).slice(0, 8)}${ext}`;

    const stopped = catchUpState(here.root);

    assert.deepStrictEqual([stopped.action, stopped.conflicts], ['stopped', [
      { file: STORE, madeTwice: [{ kind: 'task', said: taskName(ref(2, 2)) }], again: [{ phase: 'The screen', kept: 2, tasks: ['Page the ledger'] }], beside, pick: null, uncommitted: false },
    ]]);
    const screen = stateMergeGateSurface(here.main, {});
    assert.match(screen, new RegExp(`^⚑ The state merge stopped: ${taskName(ref(2, 2))} made on both machines$`, 'm'));
    assert.ok(screen.includes(['> - in phase 2, "The screen":', '>   - "Page the ledger"'].join('\n')));
    assert.ok(screen.includes(`as \`${STATE_DIR_NAME}/${beside}\`.`));
    assert.throws(() => pickShown(here, '2'), /pick 1, got "2"/);

    const out = pickShown(here, '1');

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    const merged = branchStore(here);
    assert.deepStrictEqual([DRIVER.show(merged, ref(1, 1))?.status, DRIVER.show(merged, ref(2, 2))?.title], ['done', 'Print the ledger']);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), mine);
  });

  it('refuses a copy the driver cannot read, naming the store from the project root and the driver\'s side and line', () => {
    const side = require(path.join(__dirname, '../drivers', DRIVER.name, 'task.cjs'));
    let line = 0;
    const { here } = bothChanged(
      (dir) => {
        line = side.garbleStore(dir);
      },
      (dir) => DRIVER.start(dir, ref(1, 1)),
    );

    assert.throws(() => catchUpState(here.root), (err) => err instanceof Error
      && err.message.startsWith(`cannot merge ${STATE_DIR_NAME}/${STORE}: line ${line} of this machine's`));
  });
});
