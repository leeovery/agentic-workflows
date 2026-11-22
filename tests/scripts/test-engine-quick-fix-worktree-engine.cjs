'use strict';

// ---------------------------------------------------------------------------
// A verb that takes a quick-fix's worktree apart, run from inside it by the
// worktree's own copy of the engine — the copy the skills' command, a path
// from the shell's folder, runs there, the project committing its installed
// copy (kernel/call.cjs, `handedToCheckout`; engine.cjs): handed at the
// shell door to the project's own checkout's copy, it runs whole — the
// close landing and completing the unit, a cancel, from a folder only the
// worktree holds, cancelling it, a move's yes moving it — the worktree
// taken apart under the call, its exit 0 and the state committed. The
// folder a call from inside a layout stands for is
// test-engine-code-root.cjs's; the same verbs run in process from the
// worktree, test-engine-quick-fix-windows.cjs's.
//
// Layer: process. World: quick-fix-world.cjs's quick-fix, the repo's skills
// committed in the project as installed, made through `workunit create` —
// built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { ENGINE, ok, stateGit, writeState, readManifest, layout, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SET, quickFix, fixTree, fixChanged, fixBuilt, fixesRecorded, entered } = require('./quick-fix-world.cjs');

/** Where a project installs the skills. */
const SKILLS = path.join('.claude', 'skills');
const [FLAG] = SET;
/** A file fix 1.1 adds in a folder the project's checkout lacks. */
const ADDED = Object.freeze({ folder: path.join('pkg', 'new'), file: 'pkg/new/thing.js', text: 'module.exports = 1;\n' });
/** How long a spawned engine may run. */
const ENGINE_TIMEOUT_MS = 120_000;

const world = fixtureFrom('quick-fix-worktree-engine-', (dir) => {
  fs.cpSync(path.resolve(ENGINE, '..', '..', '..'), path.join(dir, SKILLS), { recursive: true });
  quickFix(dir);
});

let dir = ''; // the project
const config = useTempFolder('quick-fix-worktree-engine-config-');

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options. */
const as = () => ({ env: { LEDGER_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/**
 * The worktree's copy of the engine run on `args` in a process of its own,
 * from `folder`, in this test's conversation: its exit code, and the
 * response line parsed where it answered one.
 * @param {string} folder @param {string[]} args
 */
function byWorktreeCopy(folder, args) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(as().env)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const ran = spawnSync(process.execPath, [path.join(fixTree(dir), SKILLS, 'ledger-engine', 'scripts', 'engine.cjs'), ...args], { cwd: folder, env, encoding: 'utf8', timeout: ENGINE_TIMEOUT_MS });
  const [line] = ran.stdout.split('\n');
  return { code: ran.status, res: line.startsWith('{') ? JSON.parse(line) : null, stderr: ran.stderr };
}

/** What a run left: the unit's status and type, whether the worktree is there, and what the state worktree holds uncommitted. */
const left = () => [readManifest(dir, UNIT).status, readManifest(dir, UNIT).work_type, fs.existsSync(fixTree(dir)), stateGit(dir, ['status', '--porcelain'])];

describe('a verb taking a quick-fix\'s worktree apart, run from inside it by the worktree\'s own copy of the engine', () => {
  it('the close lands and completes the unit, the worktree taken apart under it and the state committed', () => {
    dir = world();
    entered(dir, as());
    fixBuilt(dir, 1, FLAG.title, FLAG.file, FLAG.text, as());
    fixesRecorded(dir, 1, as());
    const { code, res, stderr } = byWorktreeCopy(fixTree(dir), ['finish', 'yes', UNIT]);

    assert.deepStrictEqual([code, stderr, res.unit, typeof res.committed, res.warnings], [0, '', UNIT, 'string', undefined]);
    assert.deepStrictEqual(left(), ['completed', 'quick-fix', false, '']);
  });

  it('a cancel, made from a folder the worktree holds and the project\'s checkout lacks, cancels the unit, the worktree taken apart and the state committed', () => {
    dir = world();
    entered(dir, as());
    fixChanged(dir, 1, FLAG.title, ADDED.file, ADDED.text, as());
    const { code, stderr } = byWorktreeCopy(path.join(fixTree(dir), ADDED.folder), ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual([code, stderr], [0, '']);
    assert.deepStrictEqual(left(), ['cancelled', 'quick-fix', false, '']);
  });

  it('a move\'s yes moves the unit to a feature, the worktree taken apart and the state committed', () => {
    dir = world();
    entered(dir, as());
    fixChanged(dir, 1, FLAG.title, FLAG.file, FLAG.text, as());
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    const payload = writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
    ok(dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], as());
    const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], as());
    const { code, stderr } = byWorktreeCopy(fixTree(dir), next.argv);

    assert.deepStrictEqual([code, stderr], [0, '']);
    assert.deepStrictEqual(left(), ['in-progress', 'feature', false, '']);
  });
});
