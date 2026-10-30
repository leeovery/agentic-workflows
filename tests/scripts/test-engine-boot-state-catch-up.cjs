'use strict';

// ---------------------------------------------------------------------------
// The catch-up at boot (leeway-engine/scripts/domain/boot.cjs with
// domain/state-merge.cjs): run before the migrations, a merge stop ending
// boot there, what a failed push left behind pushed, the ledger's entries
// a killed write left uncommitted committed first, so the catch-up carries
// them to the other clone, and the first clone's project_id kept where two
// set the state up before either pushed.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { git, tip, remoteTip, commitOnState, statePath, readState, layout } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { record } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { evidenceOf } = require(path.join(SCRIPTS, 'domain/trust-evidence.cjs'));

const { readFile, createFile } = require('./discovery-test-utils.cjs');
const { useWorld, STUB_ENGINE, engine, remoteProject, cloneInWorld, boot, setUp } = require('./boot-state-world.cjs');
const { SESSION, MADE, NOTE } = require('./ledger-world.cjs');

const world = useWorld();

const NOTES = layout.assets('unit', 'notes.md');

// --- the catch-up at boot ------------------------------------------------------------

/** Two clones of one project's state: `there` set up and pushed, `here` a clone of it. */
function twoClones() {
  const { bare, ...there } = setUp({ name: 'there', remote: true });
  commitOnState(there.root, { [layout.projectManifest]: JSON.stringify({ defaults: { plan_format: 'local' } }, null, 2) + '\n' });
  const main = cloneInWorld(/** @type {string} */ (bare), 'here');
  boot(main);
  return { bare: /** @type {string} */ (bare), there, here: { main, root: statePath(main) } };
}

describe('the catch-up at boot (4.7.8)', () => {
  it('fast-forwards a branch only the remote moved before the migrations run (4.S36)', () => {
    const { there, here } = twoClones();
    const moved = commitOnState(there.root, { [NOTES]: 'from there\n' }).commit;
    const mark = path.join(world(), 'migrated');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(here.main, STATE_BRANCH), moved);
    assert.strictEqual(readFile(here.root, NOTES), 'from there\n');
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), moved, 'the migrations ran over the state already caught up');
  });

  it('a merge stopped by a field both clones changed ends boot there, with no migrations run; the screen and the pick answer it, and the next boot carries on', () => {
    const { bare, there, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
    commitOnState(here.root, { [layout.projectManifest]: JSON.stringify({ defaults: { plan_format: 'tick' } }, null, 2) + '\n' });
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    commitOnState(there.root, { [layout.projectManifest]: JSON.stringify({ defaults: { plan_format: 'linear' } }, null, 2) + '\n' });
    const mark = path.join(world(), 'migrated');

    assert.deepStrictEqual(boot(here.main, { STUB_MIGRATE_MARK: mark }), { ok: true, state: 'merge', warnings: [] });
    assert.ok(!fs.existsSync(mark), 'the migrations ran past the stop');

    const screen = engine.output(here.main, ['render', 'state-merge-gate']);
    assert.match(screen, /⚑ The state merge stopped: one field changed on both machines/);
    const choice = /^choice: (\S+)$/m.exec(screen);
    assert.ok(choice !== null);
    const picked = engine.ok(here.main, ['state-merge', 'pick', '1', choice[1]]);
    assert.strictEqual(picked.action, 'merged');

    const res = boot(here.main, { STUB_MIGRATE_MARK: mark });
    assert.strictEqual(res.state, 'ready');
    assert.strictEqual(JSON.parse(readState(here.main, layout.projectManifest)).defaults.plan_format, 'tick');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(fs.readFileSync(mark, 'utf8').trim(), tip(here.main, STATE_BRANCH));
  });

  it('pushes what a failed push left behind, the remote not moved since', () => {
    const { bare, here } = twoClones();
    git(here.main, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
    const unpushed = commitOnState(here.root, { [NOTES]: 'unpushed\n' }).commit;
    git(here.main, ['config', '--unset', 'remote.origin.pushurl']);
    assert.notStrictEqual(remoteTip(bare), unpushed);

    assert.strictEqual(boot(here.main).state, 'ready');

    assert.strictEqual(remoteTip(bare), unpushed);
  });

  it('commits the entries a write killed before its commit left in the ledger, warning of them, before the catch-up merges them onto what the other clone pushed meanwhile', () => {
    const { bare, there, here } = twoClones();
    commitOnState(there.root, { [layout.manifest('fumi')]: JSON.stringify({ name: 'fumi', work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { 'note-window': { status: 'in-progress' } } } } }) });
    const ask = (/** @type {string} */ dir, /** @type {string} */ text) => engine.ok(dir, ['ledger', 'ask', NOTE], { env: SESSION, stdin: JSON.stringify({ ...MADE, text }) });
    ask(there.main, 'Asked first?');
    boot(here.main);
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
    createFile(wrapper, 'git', `#!/bin/sh\ncase "$*" in *commit-tree*) kill -9 "$PPID"; exit 1 ;; esac\nexec "${real}" "$@"\n`);
    fs.chmodSync(path.join(wrapper, 'git'), 0o755);
    const committed = tip(here.main, STATE_BRANCH);

    const killed = spawnSync('node', [STUB_ENGINE, 'ledger', 'ask', NOTE], {
      cwd: here.main, encoding: 'utf8', timeout: 20000, input: JSON.stringify({ ...MADE, text: 'Stranded here?' }), env: { ...process.env, ...SESSION, PATH: `${wrapper}:${process.env.PATH}` },
    });
    assert.strictEqual(killed.signal, 'SIGKILL', killed.stderr);
    assert.strictEqual(git(here.root, ['status', '--porcelain', '--', layout.ledger]), ` M ${layout.ledger}\n`);
    assert.strictEqual(tip(here.main, STATE_BRANCH), committed);
    ask(there.main, 'Written there?');

    const res = boot(here.main);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', ['committed 1 ledger entry a write left uncommitted']]);
    assert.strictEqual(git(here.root, ['status', '--porcelain', '--', layout.ledger]), '');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    boot(there.main);
    for (const clone of [here, there]) {
      assert.deepStrictEqual(readState(clone.main, layout.ledger).trim().split('\n').map((line) => JSON.parse(line).text), ['Asked first?', 'Written there?', 'Stranded here?']);
    }
  });

  it('commits and pushes nothing of a line appended outside the engine, warning of the line every read stops on', () => {
    const { main, root, bare } = setUp({ remote: true });
    commitOnState(root, { [layout.manifest('fumi')]: JSON.stringify({ name: 'fumi', work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { 'note-window': { status: 'in-progress' } } } } }) });
    engine.ok(main, ['ledger', 'ask', NOTE], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Asked?' }) });
    fs.appendFileSync(statePath(main, layout.ledger), 'not an entry\n');
    const committed = tip(main, STATE_BRANCH);

    const res = boot(main);

    assert.ok(res.warnings.includes('the ledger\'s uncommitted entries were not committed: line 2 of the ledger is not JSON: not an entry'), res.warnings.join('\n'));
    assert.deepStrictEqual([tip(main, STATE_BRANCH), remoteTip(bare)], [committed, committed]);
    assert.strictEqual(git(root, ['status', '--porcelain', '--', layout.ledger]), ` M ${layout.ledger}\n`);
  });

  it('keeps the first clone\'s project_id where two clones set the state up before either pushed, never stopping on it; what the second logged under its own id is another project\'s (4.S39)', () => {
    const { main: first, bare } = remoteProject();
    const second = cloneInWorld(bare, 'second');
    git(second, ['config', 'remote.origin.pushurl', path.join(world(), 'nowhere.git')]);
    boot(second);
    git(second, ['config', '--unset', 'remote.origin.pushurl']);
    boot(first);
    const projectIdOf = (/** @type {string} */ main) => JSON.parse(readState(main, layout.projectManifest)).project_id;
    const firstId = projectIdOf(first);
    assert.notStrictEqual(projectIdOf(second), firstId);
    const pinned = process.env.LEEWAY_CONFIG_DIR;
    process.env.LEEWAY_CONFIG_DIR = path.join(world(), 'config');
    try {
      const verdictFrom = (/** @type {string} */ cwd) => record('verdict', { entry: newId(), verdict: 'fix', point: 'decided' }, { cwd, warnings: [] }).entry;
      const onFirst = verdictFrom(first);
      verdictFrom(second);

      assert.strictEqual(boot(second).state, 'ready');

      assert.strictEqual(projectIdOf(second), firstId);
      assert.deepStrictEqual([...evidenceOf(statePath(second)).judged], [onFirst]);
    } finally {
      process.env.LEEWAY_CONFIG_DIR = pinned;
    }
  });
});
