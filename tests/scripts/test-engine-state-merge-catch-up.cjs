'use strict';

// ---------------------------------------------------------------------------
// The state's catch-up where one side moved
// (workflow-engine/scripts/domain/state-merge.cjs, `catchUpState`):
// fast-forward where only the remote moved, push what a failed push left
// behind where only this clone did, nothing where neither did or there is no
// remote to ask, and a warning where the remote is out of reach; and another
// session writing while it runs, losing nothing.
//
// Layer: git. World: real repositories in a temp folder per test, a project
// on a bare remote and a second clone of it on "another machine", each with
// its state worktree made through the machinery (state-merge-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { git, bareRepo, tip, remoteTip, layout, commitOnState, traced, codeProject } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const {
  STATE_BRANCH, withStateLock, commitState, askStateRemote,
} = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState } = require(MERGE);

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, blobId, parents, status, commitUnpushed, ledger, gitWrapper, withPath } = require('./state-merge-world.cjs');

const world = useWorld();

describe('catching up when one side moved (4.S36)', () => {
  it('fast-forwards the branch and the worktree to the remote\'s tip, with no merge commit, where only the remote moved', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base'), 'unit/topics/a/log.md': '# a\n', 'unit/old.md': 'old\n' });
    createFile(there.root, 'unit/topics/a/log.md', '# a\n\n## a session elsewhere\n');
    fs.rmSync(path.join(there.root, 'unit/old.md'));
    const theirs = commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1'), 'unit/topics/a/log.md': readFile(there.root, 'unit/topics/a/log.md'), 'unit/old.md': '' }).commit;
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
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1'));
    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a\n\n## a session elsewhere\n');
    assert.ok(!fs.existsSync(path.join(here.root, 'unit/old.md')));
    assert.strictEqual(status(here.root), '');
  });

  it('pushes what a failed push left behind where only this clone moved', () => {
    const { here, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    const left = commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1', 'a2') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.warnings, out.commit], ['pushed', true, [], left]);
    assert.strictEqual(remoteTip(bare), left);
  });

  it('answers a push that fails again as a warning, keeping what this clone holds', () => {
    const { here, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    const before = remoteTip(bare);
    const left = commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });

    const { result: out, commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.pushed, out.commit], ['pushed', false, left]);
    assert.strictEqual(out.warnings.length, 1);
    assert.strictEqual(commands.filter((c) => c.startsWith('push ')).length, 1, 'a remote that did not move is not pushed to again');
    assert.strictEqual(remoteTip(bare), before);
  });

  it('does nothing where both sides are at one tip, asking the remote once and fetching nothing', () => {
    const { here } = machinesSharing({ [layout.ledger]: ledger('base') });
    const before = tip(here.main, STATE_BRANCH);

    const { result: out, commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.reason, out.commit, out.warnings], ['nothing', 'current', before, []]);
    assert.deepStrictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).map((c) => c.split(' ')[0]), ['ls-remote']);
  });

  it('starts from the remote\'s answer boot gives it, asking the remote nothing again', () => {
    const { here, there } = machinesSharing({ [layout.ledger]: ledger('base') });
    const theirs = commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') }).commit;
    const listing = askStateRemote(here.root);

    const { result: out, commands } = traced(() => catchUpState(here.root, { listing }));

    assert.deepStrictEqual([out.action, out.commit], ['fast-forwarded', theirs]);
    assert.ok(!commands.some((c) => c.startsWith('ls-remote ')), 'the remote was asked again');
  });

  it('takes an answer saying the remote was out of reach as its warning, asking nothing', () => {
    const { here } = machinesSharing({ [layout.ledger]: ledger('base') });
    const before = tip(here.main, STATE_BRANCH);
    const listing = { remote: 'origin', remotes: ['origin'], unreachable: 'git ls-remote failed: no route' };

    const { result: out, commands } = traced(() => catchUpState(here.root, { listing }));

    assert.deepStrictEqual([out.action, out.commit, out.warnings], ['unreachable', before, ['leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: no route']]);
    assert.ok(!commands.some((c) => /^(ls-remote|fetch|push) /.test(c)), `the network was reached: ${commands}`);
  });

  it('does nothing, fetching nothing, where the project has no remote', () => {
    const { root } = codeProject(world(), { name: 'alone', state: true });

    const { result: out, commands } = traced(() => catchUpState(root));

    assert.deepStrictEqual([out.action, out.reason, out.remote, out.warnings], ['nothing', 'no-remote', null, []]);
    assert.ok(commands.length > 0, 'the trace caught nothing');
    assert.ok(!commands.some((c) => /^(fetch|ls-remote|push) /.test(c)), `the network was reached: ${commands}`);
  });

  it('does nothing where the remote holds no state branch, and leaves pushing it back to boot', () => {
    const { main, root } = codeProject(world(), { name: 'fresh', state: true });
    const bare = bareRepo(path.join(world(), 'fresh-remote.git'));
    git(main, ['remote', 'add', 'origin', bare]);
    git(main, ['update-ref', `refs/remotes/origin/${STATE_BRANCH}`, STATE_BRANCH]);

    const { result: out, commands } = traced(() => catchUpState(root));

    assert.deepStrictEqual([out.action, out.reason, out.pushed, out.warnings], ['nothing', 'no-remote-branch', false, []]);
    assert.strictEqual(remoteTip(bare), '');
    assert.strictEqual(git(main, ['for-each-ref', `refs/remotes/origin/${STATE_BRANCH}`]), '', 'the stale remote-tracking branch is gone');
    assert.ok(!commands.some((c) => c.startsWith('fetch ')), 'a branch the remote does not hold was fetched');
  });

  it('answers a remote it cannot reach with a warning, asking it once, and leaves the state as it was', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') });
    const before = tip(here.main, STATE_BRANCH);
    fs.renameSync(bare, path.join(world(), 'moved-away.git'));

    const { result: out, commands } = traced(() => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.commit, out.pushed], ['unreachable', before, false]);
    assert.strictEqual(out.warnings.length, 1);
    assert.match(out.warnings[0], /^leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: /);
    assert.strictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).length, 1, 'the remote was asked again after it failed');
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base'));
    assert.strictEqual(status(here.root), '');
  });

  it('gives up on a remote that never answers within one timeout, as a warning', () => {
    const { here } = machinesSharing({ [layout.ledger]: ledger('base') });
    const silent = path.join(world(), 'silent-ssh');
    fs.writeFileSync(silent, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
    git(here.main, ['remote', 'set-url', 'origin', 'ssh://state.invalid/fumi.git']);
    git(here.main, ['config', 'core.sshCommand', silent]);

    const started = Date.now();
    const { result: out, commands } = traced(() => catchUpState(here.root, { fetchTimeoutMs: 500 }));

    assert.ok(Date.now() - started < 4000, `the fetch held boot for ${Date.now() - started}ms`);
    assert.strictEqual(out.action, 'unreachable');
    assert.match(out.warnings[0], /git ls-remote timed out after 0\.5s/);
    assert.strictEqual(commands.filter((c) => /^(ls-remote|fetch) /.test(c)).length, 1, 'the timeout ran twice');
  });

  it('refuses a state worktree with another branch checked out, moving nothing', () => {
    const { here, there } = machinesSharing({ [layout.ledger]: ledger('base') });
    commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') });
    git(here.root, ['checkout', '-q', '-b', 'elsewhere']);

    assert.throws(() => catchUpState(here.root), /is not checked out on leeway-state/);
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base'));
  });
});

describe('another session writing while the catch-up runs', () => {
  const LOG = 'unit/topics/a/log.md';

  /** An uncommitted change here and a remote change to the same file. */
  function racing() {
    const machines = machinesSharing({ [LOG]: '# a\n\n## first\n' });
    createFile(machines.here.root, LOG, '# a\n\n## first\n\n## here\n');
    commitOnState(machines.there.root, { [LOG]: '# a\n\n## first\n\n## elsewhere\n' });
    return machines;
  }

  /** A `git` that, after the nth time the catch-up stages its files, appends `lines[n - 1]` to the file, as another session writing it. @param {string} root @param {string[]} lines */
  function writerAfterStaging(root, lines) {
    const list = path.join(world(), 'lines');
    fs.writeFileSync(list, lines.map((line) => `${line}\n`).join(''));
    return gitWrapper('--prefix=', `line=$(sed -n "\${n}p" "${list}"); if [ -n "$line" ]; then echo "$line" >> "${path.join(root, LOG)}"; fi`);
  }

  it('merges the update again into what the other session wrote, never writing over it', () => {
    const { here } = racing();

    const out = withPath(writerAfterStaging(here.root, ['## another session']), () => catchUpState(here.root));

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(readFile(here.root, LOG), '# a\n\n## first\n\n## elsewhere\n## here\n## another session\n');
  });

  it('keeps a file the update removes where the other session wrote it meanwhile', () => {
    const { here, there } = machinesSharing({ 'unit/gone.md': 'gone\n', 'unit/a.md': 'a\n' });
    fs.rmSync(path.join(there.root, 'unit/gone.md'));
    withStateLock(there.root, () => commitState(there.root, ['unit/gone.md'], 'state: drop'));
    const writer = gitWrapper('write-tree', `echo "written meanwhile" >> "${path.join(here.root, 'unit/gone.md')}"`);

    const out = withPath(writer, () => catchUpState(here.root));

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(readFile(here.root, 'unit/gone.md'), 'gone\nwritten meanwhile\n');
    assert.deepStrictEqual(out.warnings, ['unit/gone.md was deleted on one machine and changed on the other: the changed copy is kept']);
  });

  it('leaves a file that moves again as it stands, and names it', () => {
    const { here, there } = racing();

    const out = withPath(writerAfterStaging(here.root, ['## another session', '## and again']), () => catchUpState(here.root));

    const mergedCopy = '# a\n\n## first\n\n## elsewhere\n## here\n## another session\n';
    const beside = `unit/topics/a/log.${blobId(mergedCopy).slice(0, 8)}.md`;
    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.main, STATE_BRANCH), tip(there.main, STATE_BRANCH));
    assert.strictEqual(readFile(here.root, LOG), '# a\n\n## first\n\n## here\n## another session\n## and again\n');
    assert.strictEqual(readFile(here.root, beside), mergedCopy);
    assert.ok(out.warnings.includes(
      `${LOG} changed while the state caught up and was left as it stands, with the merged copy beside it as ${beside}: `
      + `committing ${LOG} as it stands leaves the remote's change only in ${beside}`,
    ), out.warnings.join('\n'));
    assert.strictEqual(status(here.root), ` M ${LOG}\n?? ${beside}\n`);
  });
});
