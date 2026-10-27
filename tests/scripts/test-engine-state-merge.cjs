'use strict';

// ---------------------------------------------------------------------------
// The state's catch-up and the merge between two clones
// (workflow-engine/scripts/domain/state-merge.cjs), each path's merge
// (domain/state-merge-paths.cjs), the blobs it reads
// (domain/state-merge-blobs.cjs) and the rules it merges by
// (domain/state-merge-rules.cjs), the working tree brought to the merge
// (domain/state-merge-worktree.cjs), its landing
// (domain/state-merge-landing.cjs) and the stop's screen
// (domain/projections/state-merge.cjs): fast-forward, push what a failed
// push left behind, or merge committed state onto the remote's tip and push
// with a lease, retrying while the remote moves; the working tree's
// uncommitted files merged in place and never committed; a field both sides
// changed stopping the merge with nothing written, kept for the person's
// picks; the git calls a merge makes, and the files it reads past the read
// budget; a catch-up killed between its steps, or raced by another
// session's write, losing nothing; the state byte for byte whatever line
// endings the person's git config names; and the pick and the screen
// through the engine's CLI, the screen answering while a peer holds the
// writer lock.
//
// Real repositories in temp folders: a bare remote, and two clones of the
// state, each with its state worktree made through the machinery. A `git`
// wrapper first on PATH stands in for the other session's write, a remote
// moving, or a kill.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');
const it = require('./shards.cjs').shardedIt(__filename);

const {
  ENGINE, git, initRepo, testIdentity, ok, output, refuses,
} = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { openGate } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const {
  STATE_BRANCH, createState, createStateBranchFromRemote, addStateWorktree, withStateLock, commitState, askStateRemote, openWorktree,
} = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { checkLedger, readLedger, appendEntry, ledgerChange, ledgerStopSurface } = require(path.join(SCRIPTS, 'domain/ledger.cjs'));
const { validEvent } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { LedgerChanged, checkLedgerCommit } = require(path.join(SCRIPTS, 'domain/ledger-check.cjs'));
const { stateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { catchUpState, pendingStateMerge, pickStateMerge, stateMergeGateSurface, stateMergeCommand } = require(MERGE);
const {
  linesToAdd, entryId, migrationId, mergeManifest, choiceId, conflictLabel, ruleOf,
} = require(path.join(SCRIPTS, 'domain/state-merge-rules.cjs'));
const { stateMergeGate } = require(path.join(SCRIPTS, 'domain/projections/state-merge.cjs'));
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));
const { processStartTime } = require(path.join(SCRIPTS, 'kernel/process.cjs'));
const { isolatedGit } = require(path.join(SCRIPTS, 'kernel/isolated-git.cjs'));

/** @type {string} */
let world;

beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-merge-')));
});

afterEach(() => {
  fs.rmSync(world, { recursive: true, force: true });
});

/** @typedef {{main: string, root: string}} Machine */

/** @param {string} dir @param {string} rel @param {string} content */
function write(dir, rel, content) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
}

/** @param {string} dir @param {string} rel */
function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

/** @param {string} dir @param {string} ref @returns {string} */
function tip(dir, ref) {
  return git(dir, ['rev-parse', ref]).trim();
}

/** The remote's `leeway-state`, or '' where it holds none. @param {string} bare */
function remoteTip(bare) {
  return git(bare, ['for-each-ref', '--format=%(objectname)', `refs/heads/${STATE_BRANCH}`]).trim();
}

/** The id git names a blob of `text` by. @param {string} text */
function blobId(text) {
  return execFileSync('git', ['hash-object', '--stdin'], { encoding: 'utf8', input: text }).trim();
}

/** The id of a tree of files, written in the repository at `dir`. @param {string} dir @param {Record<string, string>} files */
function treeId(dir, files) {
  const listing = Object.entries(files).map(([name, text]) => `100644 blob ${blobId(text)}\t${name}\n`).join('');
  return execFileSync('git', ['mktree', '--missing'], { cwd: dir, encoding: 'utf8', input: listing }).trim();
}

/** A commit's parents. @param {string} dir @param {string} rev */
function parents(dir, rev) {
  return git(dir, ['rev-list', '--parents', '-n', '1', rev]).trim().split(' ').slice(1);
}

/** @param {string} dir */
function status(dir) {
  return git(dir, ['status', '--porcelain', '--untracked-files=all']);
}

/** Write `files` in the machine's state worktree and commit them there, pushing. @param {Machine} machine @param {Record<string, string>} files */
function commitOn(machine, files, message = 'state: a change') {
  for (const [rel, content] of Object.entries(files)) write(machine.root, rel, content);
  return withStateLock(machine.root, () => commitState(machine.root, Object.keys(files), message));
}

/** Run `fn` with the machine's pushes going nowhere, as a failed push leaves the state. @template T @param {Machine} machine @param {() => T} fn @returns {T} */
function pushFailing(machine, fn) {
  git(machine.main, ['config', 'remote.origin.pushurl', path.join(world, 'nowhere.git')]);
  try {
    return fn();
  } finally {
    git(machine.main, ['config', '--unset', 'remote.origin.pushurl']);
  }
}

/** A commit made here whose push fails. @param {Machine} machine @param {Record<string, string>} files */
function commitUnpushed(machine, files, message = 'state: unpushed') {
  const out = pushFailing(machine, () => commitOn(machine, files, message));
  assert.strictEqual(out.pushed, false, 'the push was meant to fail');
  return out.commit;
}

/**
 * A project named Fumi with its state on a bare remote, `base` committed and
 * pushed there; and a second clone of it on "another machine", its state
 * worktree made from the remote's branch.
 * @param {Record<string, string>} [base]
 * @returns {{here: Machine, there: Machine, bare: string}}
 */
function twoMachines(base = {}) {
  const main = initRepo(path.join(world, 'fumi'));
  write(main, 'README.md', '# Fumi\n');
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  const bare = path.join(world, 'fumi-remote.git');
  git(world, ['init', '-q', '--bare', bare]);
  git(main, ['remote', 'add', 'origin', bare]);
  git(main, ['push', '-q', 'origin', 'main']);
  const here = { main, root: path.join(main, '.leeway') };
  createState(here.root);
  if (Object.keys(base).length > 0) commitOn(here, base, 'state: base');

  const other = path.join(world, 'other-machine');
  git(world, ['clone', '-q', bare, other]);
  testIdentity(other);
  const there = { main: other, root: stateRoot(other) };
  createStateBranchFromRemote(there.root);
  addStateWorktree(there.root);
  return { here, there, bare };
}

/** @param {Record<string, unknown>} fields */
function entry(fields) {
  return `${JSON.stringify(fields)}\n`;
}

/** A ledger of entries, one line each. @param {...string} ids */
function ledger(...ids) {
  return ids.map((id) => entry({ v: 1, id, event: 'decided' })).join('');
}

/** @param {unknown} value */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** The project manifest with one roadmap item on `horizon`, and `extra` merged in. @param {string} horizon @param {object} [extra] */
function projectManifest(horizon, extra = {}) {
  return json({ defaults: { plan_format: 'local' }, roadmap: { horizons: ['now', 'next', 'someday'], items: { 'a-lifetime-tier': { horizon, summary: 'Pay once' } } }, ...extra });
}

/**
 * Whether the engine's append-only check passes in the state worktree: the
 * ledger on disk starts byte for byte with the one the branch last committed
 * (5.4.3), and that one with its parent's (5.4.5).
 * @param {string} root
 */
function appendOnly(root) {
  try {
    checkLedger(root, []);
    checkLedgerCommit(/** @type {import('../../skills/workflow-engine/scripts/domain/state-worktree.cjs').OpenWorktree} */ (openWorktree(root)), `${STATE_BRANCH}^`, STATE_BRANCH);
    return true;
  } catch (err) {
    if (err instanceof LedgerChanged) return false;
    throw err;
  }
}

/** The merge drivers a clone's config names. @param {string} dir */
function mergeDrivers(dir) {
  return spawnSync('git', ['config', '--get-regexp', '^merge\\.'], { cwd: dir, encoding: 'utf8' }).stdout;
}

/**
 * Run `fn` with git tracing into a file, answering the git commands traced.
 * @template T @param {() => T} fn @returns {{result: T, traced: string[]}}
 */
function traced(fn) {
  const file = path.join(world, 'git-trace.log');
  fs.rmSync(file, { force: true });
  process.env.GIT_TRACE = file;
  try {
    const result = fn();
    const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { result, traced: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
  } finally {
    delete process.env.GIT_TRACE;
  }
}

/** Where the merge keeps its stop: the state worktree's git dir. @param {string} root */
function keptStopFile(root) {
  return path.resolve(root, git(root, ['rev-parse', '--git-path', 'leeway-merge.json']).trim());
}

/** The identity of the choice the stop's screen shows, from its DATA section. @param {Machine} machine */
function shownChoice(machine) {
  const shown = /^choice: (\S+)$/m.exec(stateMergeGateSurface(machine.main, {}));
  assert.ok(shown !== null, 'the screen carries no choice');
  return shown[1];
}

/** Pick `key` at the stop's screen, as the person does: for the choice it shows. @param {Machine} machine @param {string} key */
function pickShown(machine, key) {
  return pickStateMerge(machine.root, key, shownChoice(machine));
}

/** The merge's own files left in the state worktree's git dir. @param {string} root */
function mergeLeftovers(root) {
  return fs.readdirSync(path.dirname(keptStopFile(root))).filter((name) => name.startsWith('leeway-merge'));
}

/**
 * A folder holding a `git` that runs the real one, then, after each call
 * whose arguments hold `marker`, runs the shell line `after`, with `$n` the
 * count of such calls so far and `$real` the real git.
 * @param {string} marker @param {string} after @returns {string}
 */
function gitWrapper(marker, after) {
  const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(world, 'git-'));
  fs.writeFileSync(path.join(dir, 'git'), [
    '#!/bin/sh',
    `real="${real}"`,
    '"$real" "$@"',
    'status=$?',
    'case "$*" in',
    `  *"${marker}"*)`,
    `    n=$(( $(cat "${dir}/count" 2>/dev/null || echo 0) + 1 )); echo "$n" > "${dir}/count"`,
    `    ${after}`,
    '    ;;',
    'esac',
    'exit $status',
    '',
  ].join('\n'), { mode: 0o755 });
  return dir;
}

/** Run `fn` with `dir` first on PATH. @template T @param {string} dir @param {() => T} fn @returns {T} */
function withPath(dir, fn) {
  const was = process.env.PATH;
  process.env.PATH = `${dir}:${was}`;
  try {
    return fn();
  } finally {
    process.env.PATH = was;
  }
}

/**
 * Run `call` on the merge module in a process of its own, killed just after
 * its first git call whose arguments hold `marker`.
 * @param {string} root @param {string} call  a call on `merge`, given `root` @param {string} marker
 */
function killedAfter(root, call, marker) {
  const res = spawnSync('node', ['-e', `const merge = require(process.argv[1]); const root = process.argv[2]; ${call};`, MERGE, root], {
    encoding: 'utf8', env: { ...process.env, PATH: `${gitWrapper(marker, 'kill -9 "$PPID"')}:${process.env.PATH}` },
  });
  assert.strictEqual(res.signal, 'SIGKILL', `it was not killed after ${marker}: ${res.stderr}`);
}

describe('catching up when one side moved (4.S36)', () => {
  it('fast-forwards the branch and the worktree to the remote\'s tip, with no merge commit, where only the remote moved', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base'), 'unit/topics/a/log.md': '# a\n', 'unit/old.md': 'old\n' });
    write(there.root, 'unit/topics/a/log.md', '# a\n\n## a session elsewhere\n');
    fs.rmSync(path.join(there.root, 'unit/old.md'));
    const theirs = commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), 'unit/topics/a/log.md': read(there.root, 'unit/topics/a/log.md'), 'unit/old.md': '' }).commit;
    git(there.root, ['rm', '-q', 'unit/old.md']);
    const removed = withStateLock(there.root, () => commitState(there.root, ['unit/old.md'], 'state: drop old')).commit;
    const before = tip(here.main, STATE_BRANCH);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['fast-forwarded', false, []]);
    assert.strictEqual(remoteTip(bare), removed);
    assert.strictEqual(tip(here.main, STATE_BRANCH), removed);
    assert.strictEqual(out.commit, removed);
    assert.deepStrictEqual(parents(here.main, removed), [theirs]);
    assert.strictEqual(git(here.main, ['rev-list', '--count', `${before}..${STATE_BRANCH}`]).trim(), '2');
    assert.strictEqual(git(here.main, ['rev-list', '--merges', STATE_BRANCH]), '');
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1'));
    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a\n\n## a session elsewhere\n');
    assert.ok(!fs.existsSync(path.join(here.root, 'unit/old.md')));
    assert.strictEqual(status(here.root), '');
  });

  it('pushes what a failed push left behind where only this clone moved', () => {
    const { here, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    const left = commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1', 'a2') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.warnings, out.commit], ['pushed', true, [], left]);
    assert.strictEqual(remoteTip(bare), left);
  });

  it('answers a push that fails again as a warning, keeping what this clone holds', () => {
    const { here, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const before = remoteTip(bare);
    const left = commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['pushed', false, left]);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /not pushed to origin — the commit stands, and the next boot pushes it: .*no pushes today/s);
    assert.strictEqual(commands.filter((c) => c.startsWith('push ')).length, 1, 'a remote that did not move is not pushed to again');
    assert.strictEqual(remoteTip(bare), before);
  });

  it('does nothing where both sides are at one tip, asking the remote once and fetching nothing', () => {
    const { here } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const before = tip(here.main, STATE_BRANCH);

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.reason, out.commit, out.warnings], ['nothing', 'current', before, []]);
    assert.deepStrictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).map((c) => c.split(' ')[0]), ['ls-remote']);
  });

  it('starts from the remote\'s answer boot gives it, asking the remote nothing again', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const theirs = commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') }).commit;
    const listing = askStateRemote(here.root);

    const { result: out, traced: commands } = traced(() => catchUpState(here.root, { listing }));

    assert.deepStrictEqual([out.action, out.commit], ['fast-forwarded', theirs]);
    assert.ok(!commands.some((c) => c.startsWith('ls-remote ')), 'the remote was asked again');
  });

  it('takes an answer saying the remote was out of reach as its warning, asking nothing', () => {
    const { here } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const before = tip(here.main, STATE_BRANCH);
    const listing = { remote: 'origin', remotes: ['origin'], unreachable: 'git ls-remote failed: no route' };

    const { result: out, traced: commands } = traced(() => catchUpState(here.root, { listing }));

    assert.deepStrictEqual([out.action, out.commit, out.warnings], ['unreachable', before, ['leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: no route']]);
    assert.ok(!commands.some((c) => /^(ls-remote|fetch|push) /.test(c)), `the network was reached: ${commands}`);
  });

  it('does nothing, fetching nothing, where the project has no remote', () => {
    const main = initRepo(path.join(world, 'alone'));
    write(main, 'README.md', '# Alone\n');
    git(main, ['add', 'README.md']);
    git(main, ['commit', '-q', '-m', 'code']);
    const root = path.join(main, '.leeway');
    createState(root);

    const { result: out, traced: commands } = traced(() => catchUpState(root));

    assert.deepStrictEqual([out.action, out.reason, out.remote, out.warnings], ['nothing', 'no-remote', null, []]);
    assert.ok(commands.length > 0, 'the trace caught nothing');
    assert.ok(!commands.some((c) => /^(fetch|ls-remote|push) /.test(c)), `the network was reached: ${commands}`);
  });

  it('does nothing where the remote holds no state branch, and leaves pushing it back to boot', () => {
    const main = initRepo(path.join(world, 'fresh'));
    write(main, 'README.md', '# Fresh\n');
    git(main, ['add', 'README.md']);
    git(main, ['commit', '-q', '-m', 'code']);
    const root = path.join(main, '.leeway');
    createState(root);
    const bare = path.join(world, 'fresh-remote.git');
    git(world, ['init', '-q', '--bare', bare]);
    git(main, ['remote', 'add', 'origin', bare]);
    git(main, ['update-ref', `refs/remotes/origin/${STATE_BRANCH}`, STATE_BRANCH]);

    const { result: out, traced: commands } = traced(() => catchUpState(root));

    assert.deepStrictEqual([out.action, out.reason, out.pushed, out.warnings], ['nothing', 'no-remote-branch', false, []]);
    assert.strictEqual(remoteTip(bare), '');
    assert.strictEqual(git(main, ['for-each-ref', `refs/remotes/origin/${STATE_BRANCH}`]), '', 'the stale remote-tracking branch is gone');
    assert.ok(!commands.some((c) => c.startsWith('fetch ')), 'a branch the remote does not hold was fetched');
  });

  it('answers a remote it cannot reach with a warning, asking it once, and leaves the state as it was', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const before = tip(here.main, STATE_BRANCH);
    fs.renameSync(path.join(world, 'fumi-remote.git'), path.join(world, 'moved-away.git'));

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.commit, out.pushed], ['unreachable', before, false]);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: /);
    assert.strictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).length, 1, 'the remote was asked again after it failed');
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base'));
    assert.strictEqual(status(here.root), '');
  });

  it('gives up on a remote that never answers within one timeout, as a warning', () => {
    const { here } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const silent = path.join(world, 'silent-ssh');
    fs.writeFileSync(silent, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
    git(here.main, ['remote', 'set-url', 'origin', 'ssh://state.invalid/fumi.git']);
    git(here.main, ['config', 'core.sshCommand', silent]);

    const started = Date.now();
    const { result: out, traced: commands } = traced(() => catchUpState(here.root, { fetchTimeoutMs: 500 }));

    assert.ok(Date.now() - started < 4000, `the fetch held boot for ${Date.now() - started}ms`);
    assert.strictEqual(out.action, 'unreachable');
    assert.match(out.warnings[0], /git ls-remote timed out after 0\.5s/);
    assert.strictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).length, 1, 'the timeout ran twice');
  });

  it('refuses a state worktree with another branch checked out, moving nothing', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    git(here.root, ['checkout', '-q', '-b', 'elsewhere']);

    assert.throws(() => catchUpState(here.root), /is not checked out on leeway-state/);
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base'));
  });
});

describe('the worktree\'s uncommitted state through a catch-up', () => {
  it('leaves an uncommitted file the update does not touch exactly as it was, uncommitted, through a fast-forward', () => {
    const { here, there, bare } = twoMachines({ 'unit/topics/a/log.md': '# a\n', 'unit/topics/c/log.md': '# c\n' });
    write(here.root, 'unit/topics/a/log.md', '# a\n\n## a session not yet committed\n');
    write(here.root, 'unit/topics/b/log.md', '# b, new and uncommitted\n');
    const theirs = commitOn(there, { 'unit/topics/c/log.md': '# c\n\n## elsewhere\n' }).commit;

    const out = catchUpState(here.root);

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), theirs);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.deepStrictEqual(out.uncommitted, { kept: ['unit/topics/a/log.md', 'unit/topics/b/log.md'], merged: [] });
    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a\n\n## a session not yet committed\n');
    assert.strictEqual(read(here.root, 'unit/topics/b/log.md'), '# b, new and uncommitted\n');
    assert.strictEqual(read(here.root, 'unit/topics/c/log.md'), '# c\n\n## elsewhere\n');
    assert.strictEqual(status(here.root), ' M unit/topics/a/log.md\n?? unit/topics/b/log.md\n');
  });

  it('fast-forwards with no new commit where only the remote moved, merging an uncommitted file it changed in place, still uncommitted', () => {
    const { here, there, bare } = twoMachines({ 'unit/topics/a/log.md': '# a\n\n## first\n' });
    write(here.root, 'unit/topics/a/log.md', '# a\n\n## first\n\n## here, uncommitted\n');
    const theirsText = '# a\n\n## first\n\n## elsewhere\n';
    const theirs = commitOn(there, { 'unit/topics/a/log.md': theirsText }).commit;

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, theirs]);
    assert.deepStrictEqual(out.uncommitted, { kept: [], merged: ['unit/topics/a/log.md'] });
    assert.strictEqual(tip(here.main, STATE_BRANCH), theirs);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(git(bare, ['show', `${STATE_BRANCH}:unit/topics/a/log.md`]), theirsText);
    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a\n\n## first\n\n## elsewhere\n## here, uncommitted\n');
    assert.strictEqual(status(here.root), ' M unit/topics/a/log.md\n');
    assert.match(out.warnings.join('\n'), /unit\/topics\/a\/log\.md was changed in the same place on both machines/);
  });

  it('merges committed state alone into the merge commit where both moved, the uncommitted bytes merged into the working tree', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base'), 'unit/topics/a/log.md': '# a\n' });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    write(here.root, '.ledger.jsonl', ledger('base', 'a1', 'u1'));
    write(here.root, 'unit/topics/a/log.md', '# a\n\n## here, uncommitted\n');
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), 'unit/topics/a/log.md': '# a\n\n## elsewhere\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]), ledger('base', 'b1', 'a1'));
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:unit/topics/a/log.md`]), '# a\n\n## elsewhere\n');
    assert.strictEqual(spawnSync('git', ['grep', '-l', '-e', 'u1', '-e', 'uncommitted', STATE_BRANCH], { cwd: here.main, encoding: 'utf8' }).stdout, '',
      'uncommitted bytes reached the commit');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'a1', 'u1'));
    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a\n\n## elsewhere\n## here, uncommitted\n');
    assert.strictEqual(status(here.root), ' M .ledger.jsonl\n M unit/topics/a/log.md\n');
    assert.ok(appendOnly(here.root), 'the uncommitted ledger no longer starts with the committed one');
  });

  it('stops on a field the uncommitted copy and the update changed differently, its pick written into the working copy, never a commit', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    write(here.root, 'manifest.json', projectManifest('next'));
    const theirs = commitOn(there, { 'manifest.json': projectManifest('someday') }).commit;
    const before = tip(here.main, STATE_BRANCH);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.commit], ['stopped', before]);
    assert.deepStrictEqual(out.conflicts.map((c) => [c.uncommitted, c.local, c.remote]), [[true, { set: true, value: 'next' }, { set: true, value: 'someday' }]]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next'));

    const picked = pickShown(here, '1');

    assert.deepStrictEqual([picked.action, picked.commit], ['fast-forwarded', theirs]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`]), projectManifest('someday'));
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.strictEqual(status(here.root), ' M manifest.json\n');
  });

  /** A stop on the horizon both sides committed, with the working tree's copy changing it again. */
  function stoppedWithWork() {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    write(here.root, 'manifest.json', projectManifest('never'));
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    const out = catchUpState(here.root);
    assert.deepStrictEqual(out.conflicts.map((c) => [c.uncommitted, c.local.set && c.local.value]), [[false, 'next']]);
    return here;
  }

  /** The horizon committed, and the working tree's. @param {Machine} here */
  function horizons(here) {
    return [
      JSON.parse(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`])).roadmap.items['a-lifetime-tier'].horizon,
      JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon,
    ];
  }

  it('asks nothing of a field the working tree changed where the pick on the branch settles it', () => {
    const here = stoppedWithWork();

    assert.strictEqual(pickShown(here, '1').action, 'merged');
    assert.deepStrictEqual(horizons(here), ['next', 'never']);
  });

  it('asks a field the working tree changed once the branch\'s fields are picked, where their pick leaves it standing', () => {
    const here = stoppedWithWork();

    const next = pickShown(here, '2');

    assert.deepStrictEqual(next.conflicts.map((c) => [c.uncommitted, c.local.set && c.local.value, c.pick]), [[false, 'next', 'remote'], [true, 'never', null]]);
    const screen = stateMergeGateSurface(here.main, {});
    assert.match(screen, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed one field differently$/m);
    assert.match(screen, /^> In .*\n>\n> - this machine's uncommitted copy: never\n> - the update from the remote: someday$/m);
    assert.strictEqual(pickShown(here, '1').action, 'fast-forwarded');
    assert.deepStrictEqual(horizons(here), ['someday', 'never']);
  });

  it('sets an uncommitted folder beside where the update writes a file at its path', () => {
    const { here, there } = twoMachines({ 'unit/x': 'x was a file\n' });
    fs.rmSync(path.join(here.root, 'unit/x'));
    write(here.root, 'unit/x/new.md', 'uncommitted, where x was\n');
    const theirs = commitOn(there, { 'unit/x': 'x changed elsewhere\n' }).commit;

    const out = catchUpState(here.root);

    const beside = `unit/x.${treeId(here.root, { 'new.md': 'uncommitted, where x was\n' }).slice(0, 8)}`;
    assert.deepStrictEqual([out.action, out.commit], ['fast-forwarded', theirs]);
    assert.strictEqual(read(here.root, 'unit/x'), 'x changed elsewhere\n');
    assert.strictEqual(read(here.root, `${beside}/new.md`), 'uncommitted, where x was\n');
    assert.deepStrictEqual(out.warnings, [
      'unit/x was deleted on one machine and changed on the other: the changed copy is kept',
      `unit/x is a file on the remote and a folder on this machine: the remote's file stays at unit/x, and this machine's folder is kept beside it as ${beside}`,
    ]);
    assert.deepStrictEqual(out.uncommitted, { kept: [], merged: ['unit/x', 'unit/x/new.md'] });
    assert.strictEqual(status(here.root), `?? ${beside}/new.md\n`);
  });

  it('sets an uncommitted file beside where the update writes a folder at its path', () => {
    const { here, there } = twoMachines({ 'unit/a.md': 'a\n' });
    write(here.root, 'unit/y', 'an uncommitted file\n');
    commitOn(there, { 'unit/y/b.md': 'b, there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/y.${blobId('an uncommitted file\n').slice(0, 8)}`;
    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(read(here.root, 'unit/y/b.md'), 'b, there\n');
    assert.strictEqual(read(here.root, beside), 'an uncommitted file\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/y is a folder on the remote and a file on this machine: the remote's folder stays at unit/y, and this machine's file is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), `?? ${beside}\n`);
  });
});

describe('another session writing while the catch-up runs', () => {
  const LOG = 'unit/topics/a/log.md';

  /** An uncommitted change here and a remote change to the same file. */
  function racing() {
    const machines = twoMachines({ [LOG]: '# a\n\n## first\n' });
    write(machines.here.root, LOG, '# a\n\n## first\n\n## here\n');
    commitOn(machines.there, { [LOG]: '# a\n\n## first\n\n## elsewhere\n' });
    return machines;
  }

  /** A `git` that, after the nth time the catch-up stages its files, appends `lines[n - 1]` to the file, as another session writing it. @param {string} root @param {string[]} lines */
  function writerAfterStaging(root, lines) {
    const list = path.join(world, 'lines');
    fs.writeFileSync(list, lines.map((line) => `${line}\n`).join(''));
    return gitWrapper('--prefix=', `line=$(sed -n "\${n}p" "${list}"); if [ -n "$line" ]; then echo "$line" >> "${path.join(root, LOG)}"; fi`);
  }

  it('merges the update again into what the other session wrote, never writing over it', () => {
    const { here } = racing();

    const out = withPath(writerAfterStaging(here.root, ['## another session']), () => catchUpState(here.root));

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(read(here.root, LOG), '# a\n\n## first\n\n## elsewhere\n## here\n## another session\n');
  });

  it('keeps a file the update removes where the other session wrote it meanwhile', () => {
    const { here, there } = twoMachines({ 'unit/gone.md': 'gone\n', 'unit/a.md': 'a\n' });
    fs.rmSync(path.join(there.root, 'unit/gone.md'));
    withStateLock(there.root, () => commitState(there.root, ['unit/gone.md'], 'state: drop'));
    const writer = gitWrapper('write-tree', `echo "written meanwhile" >> "${path.join(here.root, 'unit/gone.md')}"`);

    const out = withPath(writer, () => catchUpState(here.root));

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(read(here.root, 'unit/gone.md'), 'gone\nwritten meanwhile\n');
    assert.deepStrictEqual(out.warnings, ['unit/gone.md was deleted on one machine and changed on the other: the changed copy is kept']);
  });

  it('leaves a file that moves again as it stands, and names it', () => {
    const { here, there } = racing();

    const out = withPath(writerAfterStaging(here.root, ['## another session', '## and again']), () => catchUpState(here.root));

    const mergedCopy = '# a\n\n## first\n\n## elsewhere\n## here\n## another session\n';
    const beside = `unit/topics/a/log.${blobId(mergedCopy).slice(0, 8)}.md`;
    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), tip(there.main, STATE_BRANCH));
    assert.strictEqual(read(here.root, LOG), '# a\n\n## first\n\n## here\n## another session\n## and again\n');
    assert.strictEqual(read(here.root, beside), mergedCopy);
    assert.ok(out.warnings.includes(
      `${LOG} changed while the state caught up and was left as it stands, with the merged copy beside it as ${beside}: `
      + `committing ${LOG} as it stands leaves the remote's change only in ${beside}`,
    ), out.warnings.join('\n'));
    assert.strictEqual(status(here.root), ` M ${LOG}\n?? ${beside}\n`);
  });
});

describe('the merge, both sides moved (4.S14)', () => {
  it('unions the ledgers, the remote\'s lines first, in one commit on the remote\'s tip, pushed with a lease', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const mine = [commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') }), commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1', 'a2') })];
    const theirs = commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') }).commit;
    const remoteLedger = ledger('base', 'b1');

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    const merged = tip(here.main, STATE_BRANCH);
    assert.deepStrictEqual([out.action, out.pushed, out.warnings, out.commit], ['merged', true, [], merged]);
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'a1', 'a2'));
    assert.ok(read(here.root, '.ledger.jsonl').startsWith(remoteLedger));
    assert.deepStrictEqual(parents(here.main, merged), [theirs]);
    assert.strictEqual(remoteTip(bare), merged);
    for (const sha of mine) {
      assert.notStrictEqual(spawnSync('git', ['merge-base', '--is-ancestor', sha, merged], { cwd: here.main }).status, 0, 'an unpushed commit survived the merge');
    }
    const pushes = commands.filter((c) => c.startsWith('push '));
    assert.deepStrictEqual(pushes.map((c) => c.includes(`--force-with-lease=refs/heads/${STATE_BRANCH}:${theirs}`)), [true]);
    assert.strictEqual(git(here.main, ['rev-list', '--merges', STATE_BRANCH]), '');
    assert.ok(!commands.some((c) => /^merge /.test(c)), 'git merge ran');
    assert.strictEqual(status(here.root), '');

    const thereBefore = git(there.root, ['show', `${STATE_BRANCH}:.ledger.jsonl`]);
    assert.strictEqual(catchUpState(there.root).action, 'fast-forwarded');
    assert.ok(read(there.root, '.ledger.jsonl').startsWith(thereBefore));
    assert.ok(appendOnly(here.root), 'the append-only check fails here');
    assert.ok(appendOnly(there.root), 'the append-only check fails on the other machine');
    assert.deepStrictEqual([mergeDrivers(here.main), mergeDrivers(there.main)], ['', '']);
    assert.ok(!git(here.main, ['ls-tree', '--name-only', STATE_BRANCH]).includes('.gitattributes'));
  });

  it('merges a ledger past spawnSync\'s 1 MiB default, both clones appending', () => {
    const long = Array.from({ length: 4000 }, (_, i) => entry({ v: 1, id: `e${i}`, event: 'decided', text: 'y'.repeat(300) })).join('');
    assert.ok(Buffer.byteLength(long) > 1024 * 1024);
    const { here, there } = twoMachines({ '.ledger.jsonl': long });
    commitUnpushed(here, { '.ledger.jsonl': long + ledger('a1') });
    commitOn(there, { '.ledger.jsonl': long + ledger('b1') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.ok(read(here.root, '.ledger.jsonl') === long + ledger('b1', 'a1'), 'the merged ledger is not the remote\'s then this clone\'s');
  });

  it('merges a text file whose merged copy is past what git\'s answer is read to, each side within the budget', () => {
    const SPEC = 'unit/spec.md';
    const lines = (/** @type {string} */ tag, /** @type {number} */ mib) => Array.from({ length: mib * 1024 }, (_, i) => `${tag} ${i} ${'x'.repeat(1000)}\n`).join('');
    const base = lines('base', 61);
    const { here, there } = twoMachines({ [SPEC]: base });
    commitUnpushed(here, { [SPEC]: lines('here', 2) + base });
    commitOn(there, { [SPEC]: base + lines('there', 2) });
    assert.ok(Buffer.byteLength(read(here.root, SPEC)) <= READ_BUDGET_BYTES);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    const merged = lines('here', 2) + base + lines('there', 2);
    assert.ok(Buffer.byteLength(merged) > READ_BUDGET_BYTES);
    assert.ok(read(here.root, SPEC) === merged, 'the merged copy is not both sides\' lines');
  });

  it('keeps a line both sides hold by id once', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'both', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1', 'both') });

    catchUpState(here.root);

    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'both', 'a1'));
  });

  it('keeps the remote\'s ledger byte for byte, adding a last newline it lacks only before lines it adds', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    const held = `${ledger('base', 'b1')}{"id":"both", "spaced": true}`;
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'both') });
    commitOn(there, { '.ledger.jsonl': held });

    assert.strictEqual(catchUpState(here.root).action, 'fast-forwarded');
    assert.strictEqual(read(here.root, '.ledger.jsonl'), held);

    commitUnpushed(here, { '.ledger.jsonl': `${held}\n${ledger('a1')}` });
    commitOn(there, { '.ledger.jsonl': `${held}\n{"id":"b2"}` });
    catchUpState(here.root);

    assert.strictEqual(read(here.root, '.ledger.jsonl'), `${held}\n{"id":"b2"}\n${ledger('a1')}`);
  });

  it('merges over the read budget a ledger a line at a time and a manifest field by field, stopping on its conflict, and keeps any other file whole, never read', () => {
    const budget = 16 * 1024;
    const long = Array.from({ length: 200 }, (_, i) => entry({ v: 1, id: `e${i}`, event: 'decided', text: 'y'.repeat(100) })).join('');
    const notes = Array.from({ length: 2000 }, (_, i) => `line ${i}\n`).join('');
    const unit = (/** @type {string} */ horizon, /** @type {object} */ extra) => projectManifest(horizon, { padding: 'p'.repeat(budget), ...extra });
    assert.ok([long, notes, unit('now', {})].every((text) => Buffer.byteLength(text) > budget));
    const { here, there } = twoMachines({ '.ledger.jsonl': long, 'unit/notes.md': notes, 'unit/manifest.json': unit('now', {}) });
    commitUnpushed(here, { '.ledger.jsonl': long + ledger('a1'), 'unit/notes.md': `${notes}here\n`, 'unit/manifest.json': unit('next', { here: 1 }) });
    commitOn(there, { '.ledger.jsonl': long + ledger('b1'), 'unit/notes.md': `there\n${notes}`, 'unit/manifest.json': unit('someday', { there: 1 }) });

    const stopped = catchUpState(here.root, { readBudgetBytes: budget });

    assert.strictEqual(stopped.action, 'stopped');
    assert.deepStrictEqual(stopped.conflicts.map((c) => [c.manifest, c.field.join('.'), c.local, c.remote]), [
      ['unit/manifest.json', 'roadmap.items.a-lifetime-tier.horizon', { set: true, value: 'next' }, { set: true, value: 'someday' }],
    ]);

    const out = pickStateMerge(here.root, '1', shownChoice(here), { readBudgetBytes: budget });

    const notesBeside = `unit/notes.${blobId(`${notes}here\n`).slice(0, 8)}.md`;
    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.ok(read(here.root, '.ledger.jsonl') === long + ledger('b1', 'a1'), 'the merged ledger is not the remote\'s then this clone\'s');
    assert.strictEqual(read(here.root, 'unit/notes.md'), `there\n${notes}`);
    assert.strictEqual(read(here.root, notesBeside), `${notes}here\n`);
    assert.strictEqual(read(here.root, 'unit/manifest.json'), unit('next', { there: 1, here: 1 }));
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/notes.md']);
  });

  it('carries a line across the chunks the ledger is read in whole, a character split between them included', () => {
    const CHUNK = 64 * 1024;
    const added = entry({ v: 1, id: 'a1', event: 'decided', text: '€'.repeat(100) });
    const lead = Buffer.byteLength('{"v":1,"id":"a1","event":"decided","text":"');
    const head = Buffer.byteLength(entry({ v: 1, id: 'base', event: 'decided', text: '' }));
    const base = entry({ v: 1, id: 'base', event: 'decided', text: 'x'.repeat(CHUNK - lead - 1 - head) });
    assert.strictEqual(Buffer.from(base + added)[CHUNK] & 0xc0, 0x80, 'no character straddles the first chunk\'s end');
    const { here, there } = twoMachines({ '.ledger.jsonl': base });
    commitUnpushed(here, { '.ledger.jsonl': base + added });
    commitOn(there, { '.ledger.jsonl': base + ledger('b1') });

    catchUpState(here.root);

    assert.ok(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]) === base + ledger('b1') + added, 'the line read across the chunks came out changed');
  });

  it('merges a ledger and a text file holding CRLF byte for byte, whatever line-ending filters the repository names', () => {
    const crlf = (/** @type {string} */ text) => text.replace(/\n/g, '\r\n');
    const { here, there } = twoMachines({ '.ledger.jsonl': crlf(ledger('base')), 'unit/spec.md': crlf('one\n\ntwo\n') });
    commitUnpushed(here, { '.ledger.jsonl': crlf(ledger('base', 'a1')), 'unit/spec.md': crlf('ONE\n\ntwo\n') });
    commitOn(there, { '.ledger.jsonl': crlf(ledger('base', 'b1')), 'unit/spec.md': crlf('one\n\nTWO\n') });
    git(here.main, ['config', 'core.autocrlf', 'true']);
    write(path.join(here.main, '.git/info'), 'attributes', '* text eol=crlf\n');

    assert.strictEqual(catchUpState(here.root).action, 'merged');

    assert.ok(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]) === crlf(ledger('base', 'b1', 'a1')), 'the merged ledger lost its CRLF');
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:unit/spec.md`]), crlf('ONE\n\nTWO\n'));
  });

  it('merges histories with no common ancestor as if each side added every file', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base'), 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    const plumb = (args, input) => execFileSync('git', args, { cwd: there.root, encoding: 'utf8', input }).trim();
    const blob = (text) => plumb(['hash-object', '-w', '--stdin'], text);
    const tree = plumb(['mktree'], `100644 blob ${blob(ledger('fresh'))}\t.ledger.jsonl\n100644 blob ${blob(projectManifest('now', { started: 'again' }))}\tmanifest.json\n`);
    const fresh = plumb(['commit-tree', tree, '-m', 'state: begin again']);
    git(there.main, ['push', '-q', '--force', 'origin', `${fresh}:refs/heads/${STATE_BRANCH}`]);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [fresh]);
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('fresh', 'base', 'a1'));
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).started, 'again');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
  });

  it('takes a file only one side changed whole, adds and deletions too', () => {
    const { here, there } = twoMachines({ 'unit/topics/a/log.md': '# a\n', 'unit/topics/b/log.md': '# b\n', 'unit/gone-here.md': 'g\n', 'unit/gone-there.md': 'g\n' });
    write(here.root, 'unit/topics/a/log.md', '# a, here\n');
    fs.rmSync(path.join(here.root, 'unit/gone-here.md'));
    commitUnpushed(here, { 'unit/topics/a/log.md': '# a, here\n', 'unit/new-here.md': 'n\n', 'unit/gone-here.md': '' });
    fs.rmSync(path.join(here.root, 'unit/gone-here.md'));
    pushFailing(here, () => withStateLock(here.root, () => commitState(here.root, ['unit/gone-here.md'], 'state: drop')));
    fs.rmSync(path.join(there.root, 'unit/gone-there.md'));
    commitOn(there, { 'unit/topics/b/log.md': '# b, there\n', 'unit/new-there.md': 'n\n' });
    withStateLock(there.root, () => commitState(there.root, ['unit/gone-there.md'], 'state: drop'));

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']),
      'unit/new-here.md\nunit/new-there.md\nunit/topics/a/log.md\nunit/topics/b/log.md\n');
    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a, here\n');
    assert.strictEqual(read(here.root, 'unit/topics/b/log.md'), '# b, there\n');
    assert.ok(!fs.existsSync(path.join(here.root, 'unit/gone-there.md')));
    assert.strictEqual(status(here.root), '');
  });
});

describe('the remote moving under the merge (4.S15)', () => {
  /**
   * Run `fn` under a `git` that, after the nth `commit-tree` — a merge's
   * commit — pushes the other machine's nth waiting commit, while any wait:
   * the remote moves between the fetch and the push.
   * @template T @param {Machine} there @param {string[]} commits @param {() => T} fn @returns {T}
   */
  function withMovingRemote(there, commits, fn) {
    const list = path.join(world, 'waiting-commits');
    fs.writeFileSync(list, commits.map((sha) => `${sha}\n`).join(''));
    const push = `"$real" -C "${there.main}" push -q origin "$next:refs/heads/${STATE_BRANCH}" >/dev/null 2>&1`;
    return withPath(gitWrapper('commit-tree', `next=$(sed -n "\${n}p" "${list}"); if [ -n "$next" ]; then ${push}; fi`), fn);
  }

  it('fetches and merges again when the lease fails, and lands on the remote\'s new tip', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    const first = commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') }).commit;
    const second = commitUnpushed(there, { '.ledger.jsonl': ledger('base', 'b1', 'b2') });

    const { result: out, traced: commands } = withMovingRemote(there, [second], () => traced(() => catchUpState(here.root)));

    const landed = tip(here.main, STATE_BRANCH);
    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['merged', true, []]);
    assert.strictEqual(remoteTip(bare), landed);
    assert.deepStrictEqual(parents(here.main, landed), [second]);
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'b2', 'a1'));
    const leases = commands.filter((c) => c.startsWith('push ') && c.includes('--force-with-lease'));
    assert.deepStrictEqual(leases.map((c) => /--force-with-lease=\S+:([0-9a-f]+)/.exec(c)?.[1]), [first, second]);
    assert.ok(appendOnly(here.root));
  });

  it('finishes a picked merge through a lease that fails, the answered stop gone', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now'), '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next'), '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { 'manifest.json': projectManifest('someday'), '.ledger.jsonl': ledger('base', 'b1') });
    const second = commitUnpushed(there, { '.ledger.jsonl': ledger('base', 'b1', 'b2') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    const shown = shownChoice(here);
    const out = withMovingRemote(there, [second], () => pickStateMerge(here.root, '1', shown));

    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['merged', true, []]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [second]);
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'b2', 'a1'));
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
  });

  it('stops retrying after a bounded number of attempts, keeping the merge here for the next catch-up', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const waiting = ['b2', 'b3', 'b4'].map((_, i, ids) => commitUnpushed(there, { '.ledger.jsonl': ledger('base', 'b1', ...ids.slice(0, i + 1)) }));

    const out = withMovingRemote(there, waiting, () => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.pushed], ['merged', false]);
    assert.match(out.warnings[out.warnings.length - 1], /^the remote kept moving: leeway-state is not pushed after 3 attempts, and the next catch-up carries on$/);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [waiting[1]]);
    assert.strictEqual(remoteTip(bare), waiting[2]);

    const next = catchUpState(here.root);

    assert.deepStrictEqual([next.action, next.pushed], ['merged', true]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [waiting[2]]);
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'b2', 'b3', 'b4', 'a1'));
  });
});

describe('the migrations record (4.S16)', () => {
  it('keeps one line for a migration both clones applied', () => {
    const { here, there } = twoMachines({ '.state/migrations': '001\n002\n' });
    commitUnpushed(here, { '.state/migrations': '001\n002\n073\n075\n' });
    commitOn(there, { '.state/migrations': '001\n002\n073\n074\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(read(here.root, '.state/migrations'), '001\n002\n073\n074\n075\n');
  });
});

describe('the manifests (4.S17)', () => {
  it('keeps both changes where each side changed a different field', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('now', { defaults: { plan_format: 'tick' } }) });
    commitOn(there, { 'manifest.json': projectManifest('next') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.conflicts], ['merged', []]);
    const merged = JSON.parse(read(here.root, 'manifest.json'));
    assert.strictEqual(merged.defaults.plan_format, 'tick');
    assert.strictEqual(merged.roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('takes a field both sides set to the same value, and does not stop', () => {
    const unit = (fields) => json({ work_type: 'feature', status: 'in-progress', ...fields });
    const { here, there } = twoMachines({ 'auth-flow/manifest.json': unit({}) });
    commitUnpushed(here, { 'auth-flow/manifest.json': unit({ status: 'completed', closed_by: 'here' }) });
    commitOn(there, { 'auth-flow/manifest.json': unit({ status: 'completed' }) });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.deepStrictEqual(JSON.parse(read(here.root, 'auth-flow/manifest.json')), { work_type: 'feature', status: 'completed', closed_by: 'here' });
  });

  it('stops on a field both sides changed to different values, with both values and nothing written; the pick finishes the merge', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now'), '.ledger.jsonl': ledger('base') });
    const mine = commitUnpushed(here, { 'manifest.json': projectManifest('next'), '.ledger.jsonl': ledger('base', 'a1') });
    const theirs = commitOn(there, { 'manifest.json': projectManifest('someday'), '.ledger.jsonl': ledger('base', 'b1') }).commit;

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.commit, out.pushed], ['stopped', mine, false]);
    assert.deepStrictEqual(out.conflicts, [{
      manifest: 'manifest.json',
      uncommitted: false,
      field: ['roadmap', 'items', 'a-lifetime-tier', 'horizon'],
      local: { set: true, value: 'next' },
      remote: { set: true, value: 'someday' },
      pick: null,
      label: {
        owner: "Fumi's project manifest",
        subject: 'the roadmap item "A lifetime tier"',
        name: 'A lifetime tier',
        field: 'horizon',
        path: 'roadmap.items.a-lifetime-tier.horizon',
      },
    }]);
    assert.ok(!commands.some((c) => /^(commit-tree|update-ref|push|checkout-index) /.test(c)), `the stop wrote: ${commands.filter((c) => /^(commit-tree|update-ref|push|checkout-index) /.test(c))}`);
    assert.strictEqual(tip(here.main, STATE_BRANCH), mine);
    assert.strictEqual(remoteTip(bare), theirs);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next'));
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'a1'));
    assert.strictEqual(status(here.root), '');

    const picked = pickShown(here, '2');

    assert.deepStrictEqual([picked.action, picked.pushed], ['merged', true]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [theirs]);
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'someday');
    assert.strictEqual(read(here.root, '.ledger.jsonl'), ledger('base', 'b1', 'a1'));
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
    assert.strictEqual(pendingStateMerge(here.root), null);
  });

  it('writes this machine\'s value where the person picks it', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    const picked = pickShown(here, '1');

    assert.strictEqual(picked.action, 'merged');
    assert.strictEqual(JSON.parse(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`])).roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('asks each conflict in turn, and finishes once every one is picked', () => {
    const base = projectManifest('now');
    const { here, there } = twoMachines({ 'manifest.json': base });
    commitUnpushed(here, { 'manifest.json': projectManifest('next', { defaults: { plan_format: 'tick' } }) });
    commitOn(there, { 'manifest.json': projectManifest('someday', { defaults: { plan_format: 'linear' } }) });

    const stopped = catchUpState(here.root);
    assert.deepStrictEqual(stopped.conflicts.map((c) => c.label.path), ['defaults.plan_format', 'roadmap.items.a-lifetime-tier.horizon']);
    assert.match(stateMergeGateSurface(here.main, {}), /Field 1 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed/);

    const next = pickShown(here, '1');
    assert.deepStrictEqual([next.action, next.conflicts.map((c) => c.pick)], ['stopped', ['local', null]]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next', { defaults: { plan_format: 'tick' } }));
    assert.match(stateMergeGateSurface(here.main, {}), /Field 2 of 2\. In Fumi's project manifest, the horizon of the roadmap item "A lifetime tier" changed/);

    const done = pickShown(here, '2');
    assert.strictEqual(done.action, 'merged');
    const merged = JSON.parse(read(here.root, 'manifest.json'));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['tick', 'someday']);
  });

  it('refuses a pick that is neither side, and a pick with nothing waiting', () => {
    const { here } = twoMachines({ 'manifest.json': projectManifest('now') });

    assert.throws(() => pickStateMerge(here.root, '3', 'a1b2c3d4e5f6'), /a state merge pick is 1 \(this machine's value\) or 2 \(the remote's\), got "3"/);
    assert.throws(() => pickStateMerge(here.root, '1', 'a1b2c3d4e5f6'), /^Error: no state merge is waiting on a pick$/);
  });
});

describe('a kept stop', () => {
  /** Two machines stopped on the roadmap item's horizon. */
  function stopped() {
    const machines = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(machines.here, { 'manifest.json': projectManifest('next') });
    commitOn(machines.there, { 'manifest.json': projectManifest('someday') });
    assert.strictEqual(catchUpState(machines.here.root).action, 'stopped');
    return machines;
  }

  it('is kept in the state worktree\'s git dir, never on the branch or in the worktree', () => {
    const { here } = stopped();

    const file = keptStopFile(here.root);
    assert.ok(fs.existsSync(file));
    assert.ok(file.startsWith(path.join(here.main, '.git') + path.sep), file);
    assert.strictEqual(status(here.root), '');
    assert.ok(!git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH]).includes('leeway-merge'));
    const gitDir = path.dirname(file);
    assert.deepStrictEqual(fs.readdirSync(gitDir).filter((name) => name.startsWith('leeway-')), ['leeway-merge.json']);
  });

  it('is still answerable from a new session', () => {
    const { here, bare } = stopped();
    const session = [
      'const [mod, main, root] = process.argv.slice(1);',
      'const merge = require(mod);',
      "const before = merge.pendingStateMerge(root).conflicts.map((c) => c.label.path);",
      "const out = merge.pickStateMerge(root, '1', /^choice: (\\S+)$/m.exec(merge.stateMergeGateSurface(main, {}))[1]);",
      'process.stdout.write(JSON.stringify({ before, action: out.action, pushed: out.pushed }));',
    ].join('\n');

    const res = spawnSync('node', ['-e', session, MERGE, here.main, here.root], { encoding: 'utf8' });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), { before: ['roadmap.items.a-lifetime-tier.horizon'], action: 'merged', pushed: true });
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'next');
  });

  it('keeps the picks made so far through a catch-up that finds the same sides', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next', { defaults: { plan_format: 'tick' } }) });
    commitOn(there, { 'manifest.json': projectManifest('someday', { defaults: { plan_format: 'linear' } }) });
    catchUpState(here.root);
    pickShown(here, '2');

    const again = catchUpState(here.root);

    assert.deepStrictEqual([again.action, again.conflicts.map((c) => c.pick)], ['stopped', ['remote', null]]);
    assert.strictEqual(pickShown(here, '1').action, 'merged');
    const merged = JSON.parse(read(here.root, 'manifest.json'));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['linear', 'next']);
  });

  it('asks the new choice once the remote moves under a pick, the old pick not taken for it', () => {
    const { here, there, bare } = stopped();
    const moved = commitOn(there, { 'manifest.json': projectManifest('later') }).commit;

    const out = pickShown(here, '1');

    assert.strictEqual(out.action, 'stopped');
    assert.deepStrictEqual([out.conflicts[0].remote, out.conflicts[0].pick], [{ set: true, value: 'later' }, null]);
    assert.match(out.warnings.join('\n'), /sides moved since it stopped/);
    assert.strictEqual(remoteTip(bare), moved);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => [c.remote.value, c.pick]), [['later', null]]);
  });

  it('takes a pick shown before this clone moved where the merge still asks the same choice', () => {
    const { here } = stopped();
    const shown = shownChoice(here);

    commitUnpushed(here, { 'manifest.json': projectManifest('next', { defaults: { plan_format: 'tick' } }) });

    assert.strictEqual(shownChoice(here), shown);
    assert.strictEqual(pickStateMerge(here.root, '1', shown).action, 'merged');
    const merged = JSON.parse(read(here.root, 'manifest.json'));
    assert.deepStrictEqual([merged.defaults.plan_format, merged.roadmap.items['a-lifetime-tier'].horizon], ['tick', 'next']);
  });

  it('refuses a pick for a choice the merge no longer asks, the stop rewritten by another catch-up between its screen and the pick', () => {
    const { here, there } = stopped();
    const shown = shownChoice(here);
    commitOn(there, { 'manifest.json': projectManifest('later') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    const refused = pickStateMerge(here.root, '1', shown);

    assert.deepStrictEqual([refused.action, refused.conflicts.map((c) => [c.remote, c.pick])], ['stopped', [[{ set: true, value: 'later' }, null]]]);
    assert.deepStrictEqual(refused.warnings, ['the pick answered a question the state merge no longer asks, so it was not taken']);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next'));
    assert.notStrictEqual(shownChoice(here), shown);

    assert.strictEqual(pickShown(here, '2').action, 'fast-forwarded');
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('later'));
  });

  it('asks afresh as this clone moves, showing this machine\'s value as it now stands', () => {
    const { here } = stopped();
    const shown = shownChoice(here);

    commitUnpushed(here, { 'manifest.json': projectManifest('never') });

    assert.match(stateMergeGateSurface(here.main, {}), /^> - this machine: never$/m);
    assert.strictEqual(pickStateMerge(here.root, '1', shown).action, 'stopped');
    assert.strictEqual(pickShown(here, '1').action, 'merged');
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'never');
  });

  it('asks with the uncommitted value as the working tree now holds it', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    write(here.root, 'manifest.json', projectManifest('next'));
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    write(here.root, 'manifest.json', projectManifest('never'));

    assert.deepStrictEqual(pendingStateMerge(here.root)?.conflicts.map((c) => c.local), [{ set: true, value: 'never' }]);
  });

  it('with every field picked offline, is not asked again, and the next catch-up finishes it', () => {
    const { here, bare } = stopped();
    const away = path.join(world, 'moved-away.git');
    fs.renameSync(bare, away);

    const offline = pickShown(here, '1');

    assert.strictEqual(offline.action, 'unreachable');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => c.pick), ['local']);
    assert.strictEqual(pendingStateMerge(here.root), null);
    assert.throws(() => stateMergeGateSurface(here.main, {}), /^Error: render state-merge-gate: no state merge is waiting on a pick$/);

    fs.renameSync(away, bare);
    const online = catchUpState(here.root);

    assert.deepStrictEqual([online.action, online.pushed], ['merged', true]);
    assert.strictEqual(JSON.parse(read(here.root, 'manifest.json')).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
  });

  it('asks nothing while a landing a kill cut short stands, and the next catch-up finishes it with no question', () => {
    const { here, there } = stopped();
    killedAfter(here.root, `merge.pickStateMerge(root, '2', '${shownChoice(here)}')`, 'reset --quiet');
    commitOn(there, { 'manifest.json': projectManifest('later') });
    git(here.main, ['fetch', '-q', 'origin']);

    assert.strictEqual(pendingStateMerge(here.root), null);
    assert.throws(() => pickStateMerge(here.root, '1', 'a1b2c3d4e5f6'), /^Error: no state merge is waiting on a pick$/);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.conflicts], ['fast-forwarded', []]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('later'));
    assert.deepStrictEqual(mergeLeftovers(here.root), []);
  });

  it('with every field picked and the pick killed before it finished, is finished by the next catch-up', () => {
    const { here, bare } = stopped();

    killedAfter(here.root, `merge.pickStateMerge(root, '2', '${shownChoice(here)}')`, 'ls-remote');

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(keptStopFile(here.root), 'utf8')).conflicts.map((c) => c.pick), ['remote']);
    assert.strictEqual(pendingStateMerge(here.root), null);

    const out = catchUpState(here.root);

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), remoteTip(bare));
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });
});

describe('any other file both sides changed', () => {
  it('merges changes to different places in a text file, with no warning', () => {
    const { here, there } = twoMachines({ 'unit/spec.md': '# Spec\n\none\n\ntwo\n\nthree\n' });
    commitUnpushed(here, { 'unit/spec.md': '# Spec\n\nONE\n\ntwo\n\nthree\n' });
    commitOn(there, { 'unit/spec.md': '# Spec\n\none\n\ntwo\n\nTHREE\n' });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    assert.strictEqual(read(here.root, 'unit/spec.md'), '# Spec\n\nONE\n\ntwo\n\nTHREE\n');
  });

  it('keeps both sides\' lines where both changed the same place, the remote\'s first, and says so', () => {
    const { here, there } = twoMachines({ 'unit/topics/a/log.md': '# a\n' });
    commitUnpushed(here, { 'unit/topics/a/log.md': '# a\n\n## here\n' });
    commitOn(there, { 'unit/topics/a/log.md': '# a\n\n## there\n' });

    const out = catchUpState(here.root);

    assert.strictEqual(read(here.root, 'unit/topics/a/log.md'), '# a\n\n## there\n## here\n');
    assert.deepStrictEqual(out.warnings, [
      'unit/topics/a/log.md was changed in the same place on both machines: both machines\' lines are kept there, the remote\'s first — read it through',
    ]);
  });

  it('keeps the remote\'s copy of a file that is not text at its path, and this machine\'s beside it', () => {
    const { here, there } = twoMachines({ 'unit/assets/chart.png': 'png\0base' });
    commitUnpushed(here, { 'unit/assets/chart.png': 'png\0here' });
    commitOn(there, { 'unit/assets/chart.png': 'png\0there' });
    const mine = git(here.main, ['rev-parse', `${STATE_BRANCH}:unit/assets/chart.png`]).trim();

    const out = catchUpState(here.root);

    const beside = `unit/assets/chart.${mine.slice(0, 8)}.png`;
    assert.strictEqual(read(here.root, 'unit/assets/chart.png'), 'png\0there');
    assert.strictEqual(read(here.root, beside), 'png\0here');
    assert.deepStrictEqual(out.warnings, [
      `unit/assets/chart.png was changed on both machines and is not merged line by line: the remote's copy stays at unit/assets/chart.png, and this machine's is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('reads in one batch an empty file and a file of any bytes, LFs and lines like the batch\'s own headers in it, beside text files', () => {
    const header = `${'e'.repeat(40)} 7\n`;
    const binary = (/** @type {string} */ side) => Buffer.from(`\0\n${header}${side}\n\n${header}`);
    const { here, there } = twoMachines({ 'unit/empty.md': '', 'unit/blob.bin': binary('base'), 'unit/spec.md': 'one\n\ntwo\n' });
    commitUnpushed(here, { 'unit/empty.md': 'here\n', 'unit/blob.bin': binary('here'), 'unit/spec.md': 'ONE\n\ntwo\n' });
    commitOn(there, { 'unit/empty.md': 'there\n', 'unit/blob.bin': binary('there'), 'unit/spec.md': 'one\n\nTWO\n' });

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    const beside = `unit/blob.${blobId(binary('here')).slice(0, 8)}.bin`;
    assert.deepStrictEqual([out.action, commands.filter((c) => c.startsWith("cat-file '--batch=")).length], ['merged', 1]);
    assert.strictEqual(read(here.root, 'unit/empty.md'), 'there\nhere\n');
    assert.strictEqual(read(here.root, 'unit/spec.md'), 'ONE\n\nTWO\n');
    assert.ok(fs.readFileSync(path.join(here.root, 'unit/blob.bin')).equals(binary('there')), 'the remote\'s bytes are not at the path');
    assert.ok(fs.readFileSync(path.join(here.root, beside)).equals(binary('here')), 'this machine\'s bytes are not beside it');
  });

  it('keeps whole a file whose bytes are not UTF-8, though it holds no NUL', () => {
    const latin = (/** @type {string} */ text) => Buffer.from(text, 'latin1');
    const { here, there } = twoMachines({ 'unit/notes.txt': latin('café\n\none\n\ntwo\n') });
    commitUnpushed(here, { 'unit/notes.txt': latin('café\n\nONE\n\ntwo\n') });
    commitOn(there, { 'unit/notes.txt': latin('café\n\none\n\nTWO\n') });

    const out = catchUpState(here.root);

    const beside = `unit/notes.${blobId(latin('café\n\nONE\n\ntwo\n')).slice(0, 8)}.txt`;
    assert.ok(fs.readFileSync(path.join(here.root, 'unit/notes.txt')).equals(latin('café\n\none\n\nTWO\n')), 'the remote\'s bytes are not at the path');
    assert.ok(fs.readFileSync(path.join(here.root, beside)).equals(latin('café\n\nONE\n\ntwo\n')), 'this machine\'s bytes are not beside it');
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/notes.txt']);
  });

  it('keeps a JSON file both sides changed whole, the remote\'s at its path and this machine\'s beside it, never merged line by line', () => {
    const { here, there } = twoMachines({ 'unit/data.json': '{\n  "a": 1,\n  "b": 1\n}\n', 'unit/events.jsonl': '{"n":1}\n' });
    commitUnpushed(here, { 'unit/data.json': '{\n  "a": 2,\n  "b": 1\n}\n', 'unit/events.jsonl': '{"n":1}\n{"n":2}\n' });
    commitOn(there, { 'unit/data.json': '{\n  "a": 1,\n  "b": 3\n}\n', 'unit/events.jsonl': '{"n":1}\n{"n":3}\n' });

    const out = catchUpState(here.root);

    const data = `unit/data.${blobId('{\n  "a": 2,\n  "b": 1\n}\n').slice(0, 8)}.json`;
    const events = `unit/events.${blobId('{"n":1}\n{"n":2}\n').slice(0, 8)}.jsonl`;
    assert.strictEqual(out.action, 'merged');
    assert.strictEqual(read(here.root, 'unit/data.json'), '{\n  "a": 1,\n  "b": 3\n}\n');
    assert.strictEqual(read(here.root, data), '{\n  "a": 2,\n  "b": 1\n}\n');
    assert.strictEqual(read(here.root, 'unit/events.jsonl'), '{"n":1}\n{"n":3}\n');
    assert.strictEqual(read(here.root, events), '{"n":1}\n{"n":2}\n');
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/data.json', 'unit/events.jsonl']);
  });

  it('keeps a file on the remote and a folder here apart, the remote\'s file at the path and this machine\'s folder beside it', () => {
    const { here, there } = twoMachines({ 'unit/a.md': 'a\n' });
    commitUnpushed(here, { 'unit/z/inside.md': 'inside, here\n' });
    commitOn(there, { 'unit/z': 'z, a file there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/z.${treeId(here.root, { 'inside.md': 'inside, here\n' }).slice(0, 8)}`;
    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']), `unit/a.md\nunit/z\n${beside}/inside.md\n`);
    assert.strictEqual(read(here.root, 'unit/z'), 'z, a file there\n');
    assert.strictEqual(read(here.root, `${beside}/inside.md`), 'inside, here\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/z is a file on the remote and a folder on this machine: the remote's file stays at unit/z, and this machine's folder is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('keeps a folder on the remote and a file here apart, the remote\'s folder at the path and this machine\'s file beside it', () => {
    const { here, there } = twoMachines({ 'unit/a.md': 'a\n' });
    commitUnpushed(here, { 'unit/w': 'w, a file here\n' });
    commitOn(there, { 'unit/w/inside.md': 'inside, there\n' });

    const out = catchUpState(here.root);

    const beside = `unit/w.${blobId('w, a file here\n').slice(0, 8)}`;
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']), `unit/a.md\n${beside}\nunit/w/inside.md\n`);
    assert.strictEqual(read(here.root, 'unit/w/inside.md'), 'inside, there\n');
    assert.strictEqual(read(here.root, beside), 'w, a file here\n');
    assert.deepStrictEqual(out.warnings, [
      `unit/w is a folder on the remote and a file on this machine: the remote's folder stays at unit/w, and this machine's file is kept beside it as ${beside}`,
    ]);
    assert.strictEqual(status(here.root), '');
  });

  it('keeps the changed copy of a file deleted on one side and changed on the other', () => {
    const { here, there } = twoMachines({ 'unit/notes.md': 'n\n', 'unit/brief.md': 'b\n' });
    fs.rmSync(path.join(here.root, 'unit/notes.md'));
    pushFailing(here, () => withStateLock(here.root, () => commitState(here.root, ['unit/notes.md'], 'state: drop')));
    commitUnpushed(here, { 'unit/brief.md': 'b, changed here\n' });
    fs.rmSync(path.join(there.root, 'unit/brief.md'));
    commitOn(there, { 'unit/notes.md': 'n, changed there\n' });
    withStateLock(there.root, () => commitState(there.root, ['unit/brief.md'], 'state: drop'));

    const out = catchUpState(here.root);

    assert.strictEqual(read(here.root, 'unit/notes.md'), 'n, changed there\n');
    assert.strictEqual(read(here.root, 'unit/brief.md'), 'b, changed here\n');
    assert.deepStrictEqual(out.warnings.sort(), [
      'unit/brief.md was deleted on one machine and changed on the other: the changed copy is kept',
      'unit/notes.md was deleted on one machine and changed on the other: the changed copy is kept',
    ]);
  });
});

describe('the person\'s line-ending config', () => {
  it('leaves the state byte for byte through a checkout, a state commit and a merge, its status clean, under a global config converting line endings and a global attributes file naming CRLF', () => {
    const SPEC = 'unit/spec.md';
    const IMPORT = 'unit/imports/notes.txt';
    const attributes = path.join(world, 'attributes');
    const config = path.join(world, 'gitconfig');
    fs.writeFileSync(attributes, '* text eol=crlf\n');
    fs.writeFileSync(config, `[core]\n\tautocrlf = true\n\tattributesFile = ${attributes}\n`);
    const pinned = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = config;
    try {
      const base = { '.ledger.jsonl': ledger('base'), [SPEC]: 'ONE\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\n' };
      const { here, there } = twoMachines(base);
      const exact = (/** @type {Machine} */ machine, /** @type {Record<string, string>} */ files) => {
        const isolated = isolatedGit(machine.root);
        assert.deepStrictEqual(Object.keys(files).map((file) => [read(machine.root, file), isolated.run(['cat-file', 'blob', `HEAD:${file}`])]), Object.values(files).map((text) => [text, text]));
        assert.strictEqual(isolated.run(['status', '--porcelain', '--untracked-files=all']), '');
      };
      exact(there, base);

      commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), [SPEC]: 'ONE\n\ntwo\n' });
      commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1'), [SPEC]: 'one\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
      exact(here, { '.ledger.jsonl': ledger('base', 'a1'), [SPEC]: 'one\n\nTWO\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
      const out = catchUpState(here.root);

      assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
      exact(here, { '.ledger.jsonl': ledger('base', 'b1', 'a1'), [SPEC]: 'one\n\ntwo\n', [IMPORT]: 'ONE\r\nTWO\r\nTHREE\r\n' });
    } finally {
      process.env.GIT_CONFIG_GLOBAL = pinned;
    }
  });
});

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
      const { here, there, bare } = twoMachines({
        '.ledger.jsonl': ledger('base'), [CHART]: 'png\0base', [LOG]: '# a\n', 'manifest.json': projectManifest('now'),
      });
      commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1'), [CHART]: 'png\0here' });
      write(here.root, LOG, '# a\n\n## here, uncommitted\n');
      commitOn(there, {
        '.ledger.jsonl': ledger('base', 'b1'), [CHART]: 'png\0there', [LOG]: '# a\n\n## elsewhere\n', 'manifest.json': projectManifest('someday', { extra: 1 }),
      });
      const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;

      killedAfter(here.root, 'merge.catchUpState(root)', marker);
      assert.notStrictEqual(catchUpState(there.root).action, 'stopped');
      const onward = commitOn(there, { 'manifest.json': projectManifest('later') }).commit;
      const out = catchUpState(here.root);

      const landed = tip(here.main, STATE_BRANCH);
      assert.ok(['merged', 'fast-forwarded'].includes(out.action), `the catch-up ${out.action}: ${JSON.stringify(out.conflicts)}`);
      assert.strictEqual(remoteTip(bare), landed);
      assert.ok(landed === onward || parents(here.main, landed)[0] === onward, 'the landing is not on the remote\'s new tip');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`]), projectManifest('later'));
      assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('later'), 'a field the killed landing wrote came back');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]), ledger('base', 'b1', 'a1'));
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${CHART}`]), 'png\0there');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), 'png\0here');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${LOG}`]), '# a\n\n## elsewhere\n');
      assert.strictEqual(read(here.root, LOG), '# a\n\n## elsewhere\n## here, uncommitted\n');
      assert.strictEqual(read(here.root, beside), 'png\0here');
      assert.strictEqual(status(here.root), ` M ${LOG}\n`);
      assert.deepStrictEqual(mergeLeftovers(here.root), []);
    });
  }

  it('is finished by a state commit before it moves the branch, its notes first, so the next catch-up reads nothing it wrote as this machine\'s', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base'), 'manifest.json': projectManifest('now'), [CHART]: 'png\0base' });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1'), [CHART]: 'png\0here' });
    commitOn(there, { 'manifest.json': projectManifest('someday'), [CHART]: 'png\0there' });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');

    const live = pushFailing(here, () => commitOn(here, { '.ledger.jsonl': ledger('base', 'a1', 'a2') }));
    assert.notStrictEqual(catchUpState(there.root).action, 'stopped');
    commitOn(there, { 'manifest.json': projectManifest('later') });
    const out = catchUpState(here.root);

    const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;
    assert.strictEqual(live.warnings.length, 2, live.warnings.join('\n'));
    assert.strictEqual(live.warnings[0], `${CHART} was changed on both machines and is not merged line by line: the remote's copy stays at ${CHART}, and this machine's is kept beside it as ${beside}`);
    assert.match(live.warnings[1], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: /);
    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:manifest.json`]), projectManifest('later'));
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('later'), 'a field the killed landing wrote came back');
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]), ledger('base', 'a1', 'a2'));
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:${beside}`]), 'png\0here');
    assert.strictEqual(status(here.root), '');
    assert.deepStrictEqual(mergeLeftovers(here.root), []);
  });

  it('says, finishing the landing, that a file a session changed since may already hold the merged copy it sets beside', () => {
    const DATA = 'unit/data.json';
    const { here, there } = twoMachines({ [DATA]: '{"a":1}\n' });
    commitUnpushed(here, { [DATA]: '{"a":2}\n' });
    commitOn(there, { [DATA]: '{"a":3}\n' });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');
    write(here.root, DATA, '{"a":3,"b":1}\n');

    const out = catchUpState(here.root);

    const beside = `unit/data.${blobId('{"a":3}\n').slice(0, 8)}.json`;
    assert.strictEqual(read(here.root, DATA), '{"a":3,"b":1}\n');
    assert.strictEqual(read(here.root, beside), '{"a":3}\n');
    assert.ok(out.warnings.includes(
      `${DATA} changed after a catch-up was cut short and was left as it stands, with the merged copy beside it as ${beside}: `
      + `unless ${DATA} was changed from the merged copy, committing ${DATA} as it stands leaves the remote's change only in ${beside}`,
    ), out.warnings.join('\n'));
  });
});

describe('the git calls a merge makes, all under the writer lock', () => {
  const FILES = ['unit/a.md', 'unit/b.md', 'unit/c.md'];

  /** @param {string} text */
  function each(text) {
    return Object.fromEntries(FILES.map((file) => [file, text]));
  }

  /** How many traced git calls start with `prefix`. @param {string[]} commands @param {string} prefix */
  function calls(commands, prefix) {
    return commands.filter((command) => command.startsWith(prefix)).length;
  }

  it('lists each tree and reads the working tree once, reads the blobs in two calls, and spends two more on each text file both sides changed', () => {
    const { here, there } = twoMachines(each('one\n\ntwo\n\nthree\n'));
    commitUnpushed(here, each('ONE\n\ntwo\n\nthree\n'));
    commitOn(there, each('one\n\ntwo\n\nTHREE\n'));

    const { result: out, traced: commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    for (const file of FILES) assert.strictEqual(read(here.root, file), 'ONE\n\ntwo\n\nTHREE\n');
    assert.deepStrictEqual(
      ['ls-tree ', 'read-tree ', "cat-file '--batch-check=", "cat-file '--batch=", 'cat-file blob ', 'merge-file ', 'hash-object ']
        .map((prefix) => calls(commands, prefix)),
      [3, 1, 1, 1, 0, FILES.length, FILES.length],
    );
  });

  it('works the whole merge out once, at the pick that finishes it, listing each tree once; the stop and its screen read the manifests alone', () => {
    const { here, there } = twoMachines({ ...each('one\n\ntwo\n\nthree\n'), 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { ...each('ONE\n\ntwo\n\nthree\n'), 'manifest.json': projectManifest('next') });
    commitOn(there, { ...each('one\n\ntwo\n\nTHREE\n'), 'manifest.json': projectManifest('someday') });

    const stop = traced(() => catchUpState(here.root));
    const screen = traced(() => shownChoice(here));
    const pick = traced(() => pickStateMerge(here.root, '2', screen.result));

    assert.deepStrictEqual([stop.result.action, pick.result.action], ['stopped', 'merged']);
    assert.deepStrictEqual([stop, screen, pick].map((run) => calls(run.traced, 'merge-file ')), [0, 0, FILES.length]);
    assert.deepStrictEqual(['ls-tree ', 'read-tree '].map((prefix) => calls(pick.traced, prefix)), [3, 1]);
  });

  it('reads no file in the working tree whole as it lands, the ledger included', () => {
    const LOG = 'unit/topics/a/log.md';
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base'), [LOG]: '# a\n' });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1'), [LOG]: '# a\n\n## there\n' });
    const readWhole = fs.readFileSync;
    /** @type {string[]} */
    const readInTree = [];
    // @ts-ignore a spy on every whole read
    fs.readFileSync = (/** @type {any} */ file, /** @type {any[]} */ ...rest) => {
      if (typeof file === 'string' && file.startsWith(`${here.root}${path.sep}`) && !path.basename(file).startsWith('.lock')) readInTree.push(path.relative(here.root, file));
      return readWhole(file, ...rest);
    };
    let out;
    try {
      out = catchUpState(here.root);
    } finally {
      fs.readFileSync = readWhole;
    }

    assert.deepStrictEqual([out.action, readInTree], ['merged', []]);
    assert.strictEqual(read(here.root, LOG), '# a\n\n## there\n');
  });

  it('leaves no file open where writing the ledger\'s union fails part-way', () => {
    const { here, there } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1', 'a2') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const writeSync = fs.writeSync;
    // @ts-ignore a disk that fills on the first line the union adds
    fs.writeSync = (/** @type {number} */ fd, /** @type {any} */ data, /** @type {any[]} */ ...rest) => {
      if (typeof data === 'string' && data.includes('"id":"a1"')) throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
      return writeSync(fd, data, ...rest);
    };
    const opened = () => fs.readdirSync('/dev/fd').length;
    const before = opened();
    try {
      assert.throws(() => catchUpState(here.root), /no space left on device/);
    } finally {
      fs.writeSync = writeSync;
    }

    assert.strictEqual(opened(), before);
  });
});

describe('the rules each file merges by', () => {
  it('reads the ledger, the migrations record, each manifest and any other JSON file by its path', () => {
    assert.deepStrictEqual(
      ['.ledger.jsonl', '.state/migrations', 'manifest.json', 'auth-flow/manifest.json', '.tick/manifest.json', 'unit/topics/a/manifest.json', 'unit/data.json', 'unit/events.jsonl', 'unit/topics/a/log.md'].map(ruleOf),
      ['ledger', 'migrations', 'manifest', 'manifest', 'whole', 'whole', 'whole', 'whole', 'file'],
    );
  });

  /** The lines a line rule adds after the remote's. @param {string} remote @param {string} local @param {any} keyOf */
  const added = (remote, local, keyOf) => [...linesToAdd(remote.split('\n'), local.split('\n'), keyOf)];

  it('adds this clone\'s ledger lines whose ids the remote\'s lack, once each, in this clone\'s order, blank lines neither', () => {
    const remote = '{"id":"base", "spaced": true}\n{"id":"b1"}\n{"id":"both"}\n';
    assert.deepStrictEqual(added(remote, '{"id":"base"}\n{"id":"a1"}\n\n{"id":"both","x":1}\n{"id":"a2"}\n{"id":"a1"}\n', entryId), ['{"id":"a1"}', '{"id":"a2"}']);
    assert.deepStrictEqual(added('', '{"id":"l"}\n', entryId), ['{"id":"l"}']);
    assert.deepStrictEqual(added(remote, '', entryId), []);
  });

  it('refuses a ledger line that is not an entry with a string id, counting the lines that are not blank', () => {
    assert.throws(() => added('{"id":"r"}\n', '{"id":"a"}\n\nnot json\n', entryId), /line 2 of this machine's is not an entry with an id: not json/);
    assert.throws(() => added('{"id":7}\n', '{"id":"a"}\n', entryId), /line 1 of the remote's is not an entry with an id/);
  });

  it('adds the migration ids the remote\'s record lacks', () => {
    assert.deepStrictEqual(added('001\n073\n', '001\n073\n075\n', migrationId), ['075']);
    assert.deepStrictEqual(added('001\n074\n', '073\n001\n', migrationId), ['073']);
  });

  /** @param {unknown} base @param {any} local @param {any} remote @param {any} [pickOf] */
  const merged = (base, local, remote, pickOf) => mergeManifest(base, local, remote, pickOf);

  it('recurses into nested objects, a field each side changed kept from that side', () => {
    const out = merged({ a: { x: 1, y: 1 }, b: 1 }, { a: { x: 2, y: 1 }, b: 1 }, { a: { x: 1, y: 3 }, b: 1 });
    assert.deepStrictEqual(out, { value: { a: { x: 2, y: 3 }, b: 1 }, conflicts: [] });
  });

  it('takes a field set alike on both sides, added or changed', () => {
    assert.deepStrictEqual(merged({ s: 'a' }, { s: 'b', n: { k: 1 } }, { s: 'b', n: { k: 1 } }), { value: { s: 'b', n: { k: 1 } }, conflicts: [] });
  });

  it('removes a key one side removed and the other left alone, and stops where the other changed it', () => {
    assert.deepStrictEqual(merged({ a: 1, b: 1 }, { a: 1 }, { a: 2, b: 1 }), { value: { a: 2 }, conflicts: [] });
    assert.deepStrictEqual(merged({ a: 1 }, {}, { a: 2 }).conflicts, [{ field: ['a'], local: { set: false }, remote: { set: true, value: 2 }, pick: null }]);
  });

  it('treats a list as one value, joining lists both sides only appended to the ancestor\'s, the remote\'s additions first', () => {
    assert.deepStrictEqual(merged({ l: [1] }, { l: [1, 2, 4] }, { l: [1, 3, 4] }).value, { l: [1, 3, 4, 2] });
    assert.deepStrictEqual(merged({ l: [1] }, { l: [1, 1] }, { l: [1, 2] }).value, { l: [1, 2, 1] }, 'an appended element equal to one the ancestor held was dropped');
    assert.deepStrictEqual(merged({ l: [] }, { l: ['x', 'x'] }, { l: ['x'] }).value, { l: ['x', 'x'] }, 'one element the remote appended took both of this clone\'s');
    assert.deepStrictEqual(merged({ l: [] }, { l: ['x', 'y', 'x'] }, { l: ['x', 'x'] }).value, { l: ['x', 'x', 'y'] });
    assert.deepStrictEqual(merged({ l: [1, 2] }, { l: [1] }, { l: [1, 2, 3] }).conflicts.map((c) => c.field), [['l']]);
    assert.deepStrictEqual(merged({ l: [1, 2] }, { l: [2, 1] }, { l: [1, 2, 3] }).conflicts.map((c) => c.field), [['l']]);
  });

  it('stops on lists both sides created differently, the ancestor holding none', () => {
    assert.deepStrictEqual(merged({}, { l: ['a'] }, { l: ['b'] }).conflicts,
      [{ field: ['l'], local: { set: true, value: ['a'] }, remote: { set: true, value: ['b'] }, pick: null }]);
    assert.deepStrictEqual(merged({ l: 'flat' }, { l: ['a'] }, { l: ['b'] }).conflicts.map((c) => c.field), [['l']]);
  });

  it('stops on a field both sides changed to different values, a change of type included', () => {
    assert.deepStrictEqual(merged({ a: { x: 1 } }, { a: { x: 2 } }, { a: 'flat' }).conflicts,
      [{ field: ['a'], local: { set: true, value: { x: 2 } }, remote: { set: true, value: 'flat' }, pick: null }]);
  });

  it('takes the picked side where a pick is given for the choice', () => {
    const pickOf = (choice) => (choice.field.join('.') === 'a' && choice.remote.set && choice.remote.value === 3 ? 'local' : null);
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 3 }, pickOf), { value: { a: 2 }, conflicts: [{ field: ['a'], local: { set: true, value: 2 }, remote: { set: true, value: 3 }, pick: 'local' }] });
    assert.deepStrictEqual(merged({ a: 1 }, {}, { a: 3 }, pickOf).value, {});
    assert.deepStrictEqual(merged({ a: 1 }, { a: 2 }, { a: 4 }, pickOf).conflicts.map((c) => c.pick), [null]);
  });

  it('names a choice by its manifest, its step, its field and both values, whatever the pick or the values\' key order', () => {
    const choice = { manifest: 'manifest.json', uncommitted: false, field: ['a', 'b'], local: { set: true, value: { x: [1], y: 2 } }, remote: { set: false } };
    const id = choiceId(choice);
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.strictEqual(choiceId({ ...choice, local: { set: true, value: { y: 2, x: [1] } }, pick: 'local' }), id);
    for (const other of [
      { manifest: 'auth-flow/manifest.json' }, { uncommitted: true }, { field: ['a', 'c'] },
      { local: { set: true, value: { x: [2], y: 2 } } }, { remote: { set: true, value: null } },
    ]) {
      assert.notStrictEqual(choiceId({ ...choice, ...other }), id, JSON.stringify(other));
    }
  });

  it('orders the merged keys as the remote has them, this clone\'s new ones after', () => {
    assert.deepStrictEqual(Object.keys(merged({}, { b: 1, a: 1, z: 1 }, { a: 1, c: 1, b: 1 }).value), ['a', 'c', 'b', 'z']);
  });

  it('writes a key named like a prototype property as data', () => {
    const out = merged(JSON.parse('{}'), JSON.parse('{"__proto__": {"x": 1}, "constructor": 2}'), JSON.parse('{"other": 1}'));
    assert.strictEqual(JSON.stringify(out.value), '{"other":1,"__proto__":{"x":1},"constructor":2}');
  });

  it('labels a field by the entry it belongs to and its meaning, else by its path', () => {
    assert.deepStrictEqual(conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: 'horizon', path: 'roadmap.items.a-lifetime-tier.horizon',
    });
    assert.deepStrictEqual(conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier'], 'Fumi'), {
      owner: "Fumi's project manifest", subject: 'the roadmap item "A lifetime tier"', name: 'A lifetime tier', field: null, path: 'roadmap.items.a-lifetime-tier',
    });
    assert.deepStrictEqual(conflictLabel('auth-flow/manifest.json', ['build', 'plan_format'], 'Fumi'), {
      owner: "Auth Flow's manifest", subject: null, name: null, field: 'plan format', path: 'build.plan_format',
    });
  });
});

describe('the stop\'s screen (4.7.6)', () => {
  /** A stop as the merge keeps it. @param {object[]} conflicts */
  function stopOf(...conflicts) {
    return {
      conflicts: conflicts.map((c) => ({
        manifest: 'manifest.json',
        uncommitted: false,
        field: ['roadmap', 'items', 'a-lifetime-tier', 'horizon'],
        local: { set: true, value: 'next' },
        remote: { set: true, value: 'someday' },
        pick: null,
        label: conflictLabel('manifest.json', ['roadmap', 'items', 'a-lifetime-tier', 'horizon'], 'Fumi'),
        ...c,
      })),
    };
  }

  it('draws the shown choice\'s identity, the title, the account with both values, the question and one numbered row per side', () => {
    const stop = stopOf({});
    const out = stateMergeGate(stop);

    assert.strictEqual(out, [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      `choice: ${choiceId(stop.conflicts[0])}`,
      '',
      '=== DISPLAY: state merge stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ The state merge stopped: one field changed on both machines',
      '',
      '=== DISPLAY: state merge account (emit verbatim as markdown (not a code block)) ===',
      '> In Fumi\'s project manifest, the horizon of the roadmap item "A lifetime tier" changed on each machine since they last agreed:',
      '>',
      '> - this machine: next',
      '> - the remote: someday',
      '>',
      '> The engine takes a field from one side only where the other left it alone or set it the same, so it stops here for you to pick.',
      '',
      '=== MENU: state merge gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Which horizon does "A lifetime tier" keep?`**',
      '',
      '**`1`** → next — *this machine\'s*',
      '**`2`** → someday — *the remote\'s*',
      '',
    ].join('\n'));
    auditMarkers(out, 'state merge gate');
  });

  it('states the gate for the gate surface, its rows the two sides', () => {
    const gate = announced(() => {
      openGate();
      return auditGate(stateMergeGate(stopOf({})), 'state merge gate');
    });

    assert.strictEqual(gate.gate, 'state merge gate');
    assert.strictEqual(gate.question, 'Which horizon does "A lifetime tier" keep?');
    assert.deepStrictEqual(gate.options.map((o) => [o.key, o.head, o.tail]), [['1', 'next', "this machine's"], ['2', 'someday', "the remote's"]]);
  });

  it('shows the first conflict still open, counted among them all', () => {
    const stop = stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), local: { set: false }, remote: { set: true, value: { nested: ['a*b'] } } });
    const out = stateMergeGate(stop);

    assert.match(out, new RegExp(`^choice: ${choiceId(stop.conflicts[1])}$`, 'm'));
    assert.match(out, /^⚑ The state merge stopped: 2 fields changed on both machines$/m);
    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed on each machine since they last agreed:$/m);
    assert.match(out, /^> - this machine: removed$/m);
    assert.match(out, /^> - the remote: \{"nested":\\\["a\\\*b"\\\]\}$/m);
    assert.match(out, /^\*\*`◆ Which plan format does Fumi's project manifest keep\?`\*\*$/m);
  });

  it('asks the working tree\'s fields as a step of their own, naming the uncommitted copy and the update', () => {
    const planFormat = { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), local: { set: true, value: 'tick' }, remote: { set: true, value: 'linear' } };
    const out = stateMergeGate(stopOf({ pick: 'remote' }, { uncommitted: true, local: { set: true, value: 'never' } }, { ...planFormat, uncommitted: true }));

    assert.match(out, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed 2 fields differently$/m);
    assert.match(out, /^> Field 1 of 2\. In Fumi's project manifest, the horizon of the roadmap item "A lifetime tier" changed in this machine's uncommitted copy, and differently in the update from the remote:$/m);
    assert.match(out, /^> - this machine's uncommitted copy: never$/m);
    assert.match(out, /^> - the update from the remote: someday$/m);
    assert.match(out, /^\*\*`1`\*\* → never — \*this machine's uncommitted copy\*$/m);
    assert.match(out, /^\*\*`2`\*\* → someday — \*the remote's\*$/m);
    assert.doesNotMatch(out, /since they last agreed/);

    const single = stateMergeGate(stopOf({ pick: 'remote' }, { uncommitted: true }));
    assert.match(single, /^⚑ The state merge stopped: this machine's uncommitted copy and the update changed one field differently$/m);
    assert.match(single, /^> In Fumi's project manifest, the horizon/m);
  });

  it('shows the last conflict of a stop with every one picked, never failing on it', () => {
    const out = stateMergeGate(stopOf({ pick: 'local' }, { field: ['defaults', 'plan_format'], label: conflictLabel('manifest.json', ['defaults', 'plan_format'], 'Fumi'), pick: 'remote' }));

    assert.match(out, /^> Field 2 of 2\. In Fumi's project manifest, the plan format \(`defaults\.plan_format`\) changed/m);
    auditMarkers(out, 'state merge gate');
  });

  it('asks a shorter question where the specific one would not fit the menu\'s glyph', () => {
    const name = 'an-item-whose-name-runs-long-enough-to-crowd-the-question';
    const field = ['roadmap', 'items', name, 'horizon'];
    const out = stateMergeGate(stopOf({ field, label: conflictLabel('manifest.json', field, 'Fumi') }));

    assert.match(out, /^\*\*`◆ Which horizon stays\?`\*\*$/m);
    assert.match(out, /the horizon of the roadmap item "An item whose name runs long enough to crowd the question" changed/);
  });

  it('clips a long value in its row, and shows it whole in the account', () => {
    const long = 'x'.repeat(60);
    const out = stateMergeGate(stopOf({ local: { set: true, value: long } }));

    assert.match(out, new RegExp(`^> - this machine: ${long}$`, 'm'));
    assert.match(out, new RegExp(`^\\*\\*\`1\`\\*\\* → ${'x'.repeat(39)}… — \\*this machine's\\*$`, 'm'));
  });

  it('renders through its surface, and refuses where no stop waits', () => {
    const { here, there } = twoMachines({ 'manifest.json': projectManifest('now') });
    assert.throws(() => stateMergeGateSurface(here.main, {}), /render state-merge-gate: no state merge is waiting on a pick/);
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(stateMergeGateSurface(here.main, {}), stateMergeGate(stopOf({})));
  });
});

describe('the pick\'s command', () => {
  it('takes `pick <1|2> <choice>`; a pick leaving nothing of this clone\'s lands on the remote\'s tip with no commit', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    for (const argv of [['pick'], ['pick', '2'], ['choose', '1', shownChoice(here)], ['pick', '2', shownChoice(here), 'more']]) {
      assert.throws(() => stateMergeCommand(here.main, argv), /^Error: Usage: engine state-merge pick <1\|2> <choice>$/, argv.join(' '));
    }
    const out = stateMergeCommand(here.main, ['pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });

  it('answers `engine state-merge pick` and `engine render state-merge-gate`, refusing where no stop waits and a pick that is none', () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    assert.match(refuses(here.main, ['render', 'state-merge-gate']).error, /no state merge is waiting on a pick/);
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick', '1', 'a-choice']).error, 'no state merge is waiting on a pick');
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);

    assert.strictEqual(output(here.main, ['render', 'state-merge-gate']), stateMergeGateSurface(here.main, {}));
    assert.strictEqual(refuses(here.main, ['state-merge', 'pick']).error, 'Usage: engine state-merge pick <1|2> <choice>');
    assert.match(refuses(here.main, ['state-merge', 'pick', '3', shownChoice(here)]).error, /is 1 \(this machine's value\) or 2 \(the remote's\), got "3"/);
    const out = ok(here.main, ['state-merge', 'pick', '2', shownChoice(here)]);

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['fast-forwarded', false, remoteTip(bare)]);
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });

  it('renders the stop\'s screen at once while a peer holds the writer lock, never touching the peer\'s merge files; the pick waits for the peer, then lands', async () => {
    const { here, there, bare } = twoMachines({ 'manifest.json': projectManifest('now') });
    commitUnpushed(here, { 'manifest.json': projectManifest('next') });
    commitOn(there, { 'manifest.json': projectManifest('someday') });
    catchUpState(here.root);
    const screen = stateMergeGateSurface(here.main, {});
    const choice = shownChoice(here);
    const lock = path.join(here.root, '.lock');
    const live = JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) });
    fs.writeFileSync(lock, live);
    const gitDir = path.dirname(keptStopFile(here.root));
    const peers = [path.join(gitDir, 'leeway-merge-files', 'blobs'), path.join(gitDir, 'leeway-merge.index')];
    fs.mkdirSync(path.dirname(peers[0]));
    for (const file of peers) fs.writeFileSync(file, 'the peer\'s merge');

    const shown = spawnSync('node', [ENGINE, 'render', 'state-merge-gate'], { cwd: here.main, encoding: 'utf8', timeout: 10000 });
    assert.deepStrictEqual([shown.signal, shown.status, shown.stdout], [null, 0, screen], shown.stderr);
    assert.deepStrictEqual(peers.map((file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8')), ['the peer\'s merge', 'the peer\'s merge']);
    const picking = spawn('node', [ENGINE, 'state-merge', 'pick', '2', choice], { cwd: here.main });
    let answer = '';
    picking.stdout.on('data', (chunk) => { answer += chunk; });
    const exit = new Promise((resolve) => picking.on('close', resolve));
    const raced = await Promise.race([exit.then(() => 'exited'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 1500))]);
    assert.strictEqual(raced, 'waiting', 'the pick did not wait on the peer');
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('next'));
    fs.unlinkSync(lock);

    assert.strictEqual(await exit, 0);
    assert.deepStrictEqual(JSON.parse(answer), { ...JSON.parse(answer), ok: true, action: 'fast-forwarded', commit: remoteTip(bare) });
    assert.strictEqual(read(here.root, 'manifest.json'), projectManifest('someday'));
  });
});

describe('the ledger through a catch-up', () => {
  const ASKED = { event: 'asked', unit: 'fumi', topic: 'a', phase: 'discussion', session: 's1', by: 'claude', who_moved_whom: 'none', part_of: null, relies_on: [] };

  /** A ledger line of a question asked. @param {string} text */
  function askedLine(text) {
    return entry(validEvent({ ...ASKED, v: 1, id: newId(), at: '2026-10-27T09:00:00Z', text }));
  }

  const CHART = 'unit/assets/chart.png';
  const UNIT = { 'fumi/manifest.json': json({ name: 'fumi', work_type: 'epic', status: 'in-progress', phases: { discussion: { items: { a: { status: 'in-progress' } } } } }) };
  const ASKING = JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Asked after the kill?' });
  const DECIDING = JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Decided after the kill.', why: 'A reason.' });
  const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 's1' });

  /** What the landing says of the chart both machines changed. */
  function chartNote() {
    const beside = `unit/assets/chart.${blobId('png\0here').slice(0, 8)}.png`;
    return `${CHART} was changed on both machines and is not merged line by line: the remote's copy stays at ${CHART}, and this machine's is kept beside it as ${beside}`;
  }

  /**
   * A landing a kill cut short here, after it moved the files and before it
   * moved the branch: the chart changed on both machines, and the ledger too
   * where `ledgers` gives each machine's own line.
   * @param {{here: string, there: string}|null} ledgers
   */
  function killedLanding(ledgers) {
    const base = askedLine('Base?');
    const { here, there } = twoMachines({ '.ledger.jsonl': base, ...UNIT, [CHART]: 'png\0base' });
    commitUnpushed(here, { [CHART]: 'png\0here', ...(ledgers && { '.ledger.jsonl': `${base}${ledgers.here}` }) });
    commitOn(there, { [CHART]: 'png\0there', ...(ledgers && { '.ledger.jsonl': `${base}${ledgers.there}` }) });
    killedAfter(here.root, 'merge.catchUpState(root)', 'reset --quiet');
    return { here, base };
  }

  for (const [what, act] of /** @type {[string, (root: string, notes: string[]) => unknown][]} */ ([
    ['a read', (root, notes) => [...readLedger(root, notes)]],
    ['an append', (root, notes) => appendEntry(root, { ...ASKED, text: 'Asked after the kill?' }, notes)],
    ['a ledger write, among its warnings', (root, notes) => notes.push(...ok(path.dirname(root), ['ledger', 'ask', 'fumi.discussion.a'], { env: SESSION, stdin: ASKING }).warnings)],
    ['a ledger write the fold under the lock then refuses, among its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'decide', 'fumi.discussion.a', '--answers', 'Zz9Zz9'], { env: SESSION, stdin: DECIDING });
      assert.strictEqual(res.error, 'ledger decide --answers: no ledger entry\'s id begins "Zz9Zz9"');
      notes.push(...res.warnings);
    }],
    ['a replacement the fold before the lock then refuses, among its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'replace', 'fumi.discussion.a', '--replaces', 'Zz9Zz9', '--reason', 'changed-mind'], { env: SESSION, stdin: DECIDING });
      assert.strictEqual(res.error, 'ledger replace --replaces: no ledger entry\'s id begins "Zz9Zz9"');
      notes.push(...res.warnings);
    }],
  ])) {
    it(`finishes a landing a kill cut short at ${what}, under the writer lock, so nothing the landing wrote reads as this machine's change, and hands on what the landing said`, () => {
      const [a1, b1] = ['Here?', 'There?'].map(askedLine);
      const { here, base } = killedLanding({ here: a1, there: b1 });
      assert.strictEqual(read(here.root, '.ledger.jsonl'), `${base}${b1}${a1}`, 'the kill left no merged ledger on disk');
      assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]), `${base}${a1}`, 'the kill left the branch moved');
      /** @type {string[]} */
      const notes = [];

      act(here.root, notes);

      assert.ok(git(here.main, ['show', `${STATE_BRANCH}:.ledger.jsonl`]).startsWith(`${base}${b1}${a1}`));
      assert.ok(read(here.root, '.ledger.jsonl').startsWith(`${base}${b1}${a1}`));
      assert.deepStrictEqual(mergeLeftovers(here.root), []);
      assert.deepStrictEqual(notes, [chartNote()]);
    });
  }

  for (const [what, act] of /** @type {[string, (root: string, notes: string[]) => void][]} */ ([
    ['a read', (root, notes) => assert.throws(() => [...readLedger(root, notes)], LedgerChanged)],
    ['an append', (root, notes) => assert.throws(() => appendEntry(root, { ...ASKED, text: 'Asked after the kill?' }, notes), LedgerChanged)],
    ['a ledger write, in its refusal\'s warnings', (root, notes) => {
      const res = refuses(path.dirname(root), ['ledger', 'ask', 'fumi.discussion.a'], { env: SESSION, stdin: ASKING });
      assert.deepStrictEqual([res.stop, res.error], ['ledger', '.ledger.jsonl changed outside the engine: line 1 is not the line committed there — the engine stops here']);
      notes.push(...res.warnings);
    }],
  ])) {
    it(`hands on what a landing it finished at ${what} said, though the engine then stops on a ledger changed outside it`, () => {
      const { here } = killedLanding(null);
      write(here.root, '.ledger.jsonl', askedLine('Changed by hand?'));
      /** @type {string[]} */
      const notes = [];

      act(here.root, notes);

      assert.deepStrictEqual(mergeLeftovers(here.root), [], 'the landing was not finished');
      assert.deepStrictEqual(notes, [chartNote()]);
    });
  }

  it('checks the merge\'s own commit against the remote\'s ledger: one that fails lands nothing, pushes nothing, and the stop shows the line the check found', () => {
    const { here, there, bare } = twoMachines({ '.ledger.jsonl': ledger('base') });
    commitUnpushed(here, { '.ledger.jsonl': ledger('base', 'a1') });
    commitOn(there, { '.ledger.jsonl': ledger('base', 'b1') });
    const before = { tip: tip(here.main, STATE_BRANCH), remote: remoteTip(bare), disk: read(here.root, '.ledger.jsonl') };
    const tampered = JSON.stringify({ v: 1, id: 'tampered', event: 'decided' });
    const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const wrapper = fs.mkdtempSync(path.join(world, 'git-'));
    fs.writeFileSync(path.join(wrapper, 'git'), [
      '#!/bin/sh',
      'case "$*" in',
      `  *hash-object*union) for a; do f="$a"; done; printf '%s\\n' '${tampered}' > "$f" ;;`,
      'esac',
      `exec "${real}" "$@"`,
      '',
    ].join('\n'), { mode: 0o755 });

    assert.throws(() => withPath(wrapper, () => catchUpState(here.root)),
      (err) => err instanceof LedgerChanged && JSON.stringify(err.change) === JSON.stringify({ line: 1, found: tampered }) && /— nothing committed$/.test(err.message));

    assert.deepStrictEqual({ tip: tip(here.main, STATE_BRANCH), remote: remoteTip(bare), disk: read(here.root, '.ledger.jsonl') }, before);
    assert.strictEqual(ledgerChange(here.root), null, 'the disk is not as the branch committed it');
    assert.match(ledgerStopSurface(here.main, {}), /line 1 isn't the line the state branch last committed there\. The line it found:\n>   \{"v":1,"id":"tampered","event":"decided"\}\n/);
  });
});
