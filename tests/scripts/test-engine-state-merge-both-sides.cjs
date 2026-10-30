'use strict';

// ---------------------------------------------------------------------------
// The merge where both sides moved (workflow-engine/scripts/domain/state-merge.cjs):
// committed state merged onto the remote's tip in one commit and pushed with
// a lease, the ledgers unioned past any read budget, histories with no
// common ancestor, a file only one side changed taken whole; and the remote
// moving under the merge, retried within a bound.
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
const { execFileSync, spawnSync } = require('child_process');
const { git, tip, remoteTip, layout, commitOnState, traced } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const MERGE = path.join(SCRIPTS, 'domain/state-merge.cjs');
const { STATE_BRANCH, withStateLock, commitState } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { catchUpState, pickStateMerge } = require(MERGE);
const { READ_BUDGET_BYTES } = require(path.join(SCRIPTS, 'kernel/git.cjs'));

const { createFile, readFile } = require('./discovery-test-utils.cjs');
const { useWorld, machinesSharing, blobId, parents, status, pushFailing, commitUnpushed, entry, ledger, projectManifest, appendOnly, keptStopFile, shownChoice, gitWrapper, withPath } = require('./state-merge-world.cjs');

/** @typedef {import('./state-merge-world.cjs').Machine} Machine */

const world = useWorld();

/** The merge drivers a clone's config names. @param {string} dir */
function mergeDrivers(dir) {
  return spawnSync('git', ['config', '--get-regexp', '^merge\\.'], { cwd: dir, encoding: 'utf8' }).stdout;
}

describe('the merge, both sides moved (4.S14)', () => {
  it('unions the ledgers, the remote\'s lines first, in one commit on the remote\'s tip, pushed with a lease', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    const mine = [commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') }), commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1', 'a2') })];
    const theirs = commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') }).commit;
    const remoteLedger = ledger('base', 'b1');

    const { result: out, commands } = traced(() => catchUpState(here.root));

    const merged = tip(here.main, STATE_BRANCH);
    assert.deepStrictEqual([out.action, out.pushed, out.warnings, out.commit], ['merged', true, [], merged]);
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1', 'a1', 'a2'));
    assert.ok(readFile(here.root, layout.ledger).startsWith(remoteLedger));
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

    const thereBefore = git(there.root, ['show', `${STATE_BRANCH}:${layout.ledger}`]);
    assert.strictEqual(catchUpState(there.root).action, 'fast-forwarded');
    assert.ok(readFile(there.root, layout.ledger).startsWith(thereBefore));
    assert.ok(appendOnly(here.root), 'the append-only check fails here');
    assert.ok(appendOnly(there.root), 'the append-only check fails on the other machine');
    assert.deepStrictEqual([mergeDrivers(here.main), mergeDrivers(there.main)], ['', '']);
    assert.ok(!git(here.main, ['ls-tree', '--name-only', STATE_BRANCH]).includes('.gitattributes'));
  });

  it('merges a ledger past spawnSync\'s 1 MiB default, both clones appending', () => {
    const long = Array.from({ length: 4000 }, (_, i) => entry({ v: 1, id: `e${i}`, event: 'decided', text: 'y'.repeat(300) })).join('');
    assert.ok(Buffer.byteLength(long) > 1024 * 1024);
    const { here, there } = machinesSharing({ [layout.ledger]: long });
    commitUnpushed(here, { [layout.ledger]: long + ledger('a1') });
    commitOnState(there.root, { [layout.ledger]: long + ledger('b1') });

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed], ['merged', true]);
    assert.ok(readFile(here.root, layout.ledger) === long + ledger('b1', 'a1'), 'the merged ledger is not the remote\'s then this clone\'s');
  });

  it('merges a text file whose merged copy is past what git\'s answer is read to, each side within the budget', () => {
    const SPEC = 'unit/spec.md';
    const lines = (/** @type {string} */ tag, /** @type {number} */ mib) => Array.from({ length: mib * 1024 }, (_, i) => `${tag} ${i} ${'x'.repeat(1000)}\n`).join('');
    const base = lines('base', 61);
    const { here, there } = machinesSharing({ [SPEC]: base });
    commitUnpushed(here, { [SPEC]: lines('here', 2) + base });
    commitOnState(there.root, { [SPEC]: base + lines('there', 2) });
    assert.ok(Buffer.byteLength(readFile(here.root, SPEC)) <= READ_BUDGET_BYTES);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    const merged = lines('here', 2) + base + lines('there', 2);
    assert.ok(Buffer.byteLength(merged) > READ_BUDGET_BYTES);
    assert.ok(readFile(here.root, SPEC) === merged, 'the merged copy is not both sides\' lines');
  });

  it('keeps the remote\'s ledger byte for byte, adding a last newline it lacks only before lines it adds', () => {
    const { here, there } = machinesSharing({ [layout.ledger]: ledger('base') });
    const held = `${ledger('base', 'b1')}{"id":"both", "spaced": true}`;
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'both') });
    commitOnState(there.root, { [layout.ledger]: held });

    assert.strictEqual(catchUpState(here.root).action, 'fast-forwarded');
    assert.strictEqual(readFile(here.root, layout.ledger), held);

    commitUnpushed(here, { [layout.ledger]: `${held}\n${ledger('a1')}` });
    commitOnState(there.root, { [layout.ledger]: `${held}\n{"id":"b2"}` });
    catchUpState(here.root);

    assert.strictEqual(readFile(here.root, layout.ledger), `${held}\n{"id":"b2"}\n${ledger('a1')}`);
  });

  it('merges over the read budget a ledger a line at a time and a manifest field by field, stopping on its conflict, and keeps any other file whole, never read', () => {
    const budget = 16 * 1024;
    const long = Array.from({ length: 200 }, (_, i) => entry({ v: 1, id: `e${i}`, event: 'decided', text: 'y'.repeat(100) })).join('');
    const notes = Array.from({ length: 2000 }, (_, i) => `line ${i}\n`).join('');
    const unit = (/** @type {string} */ horizon, /** @type {object} */ extra) => projectManifest(horizon, { padding: 'p'.repeat(budget), ...extra });
    assert.ok([long, notes, unit('now', {})].every((text) => Buffer.byteLength(text) > budget));
    const { here, there } = machinesSharing({ [layout.ledger]: long, 'unit/assets/notes.md': notes, [layout.manifest('unit')]: unit('now', {}) });
    commitUnpushed(here, { [layout.ledger]: long + ledger('a1'), 'unit/assets/notes.md': `${notes}here\n`, [layout.manifest('unit')]: unit('next', { here: 1 }) });
    commitOnState(there.root, { [layout.ledger]: long + ledger('b1'), 'unit/assets/notes.md': `there\n${notes}`, [layout.manifest('unit')]: unit('someday', { there: 1 }) });

    const stopped = catchUpState(here.root, { readBudgetBytes: budget });

    assert.strictEqual(stopped.action, 'stopped');
    assert.deepStrictEqual(stopped.conflicts.map((c) => [c.manifest, c.field.join('.'), c.local, c.remote]), [
      [layout.manifest('unit'), 'roadmap.items.a-lifetime-tier.horizon', { set: true, value: 'next' }, { set: true, value: 'someday' }],
    ]);

    const out = pickStateMerge(here.root, '1', shownChoice(here), { readBudgetBytes: budget });

    const notesBeside = `unit/assets/notes.${blobId(`${notes}here\n`).slice(0, 8)}.md`;
    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.ok(readFile(here.root, layout.ledger) === long + ledger('b1', 'a1'), 'the merged ledger is not the remote\'s then this clone\'s');
    assert.strictEqual(readFile(here.root, 'unit/assets/notes.md'), `there\n${notes}`);
    assert.strictEqual(readFile(here.root, notesBeside), `${notes}here\n`);
    assert.strictEqual(readFile(here.root, layout.manifest('unit')), unit('next', { there: 1, here: 1 }));
    assert.deepStrictEqual(out.warnings.map((w) => w.split(' was ')[0]), ['unit/assets/notes.md']);
  });

  it('carries a line across the chunks the ledger is read in whole, a character split between them included', () => {
    const CHUNK = 64 * 1024;
    const added = entry({ v: 1, id: 'a1', event: 'decided', text: '€'.repeat(100) });
    const lead = Buffer.byteLength('{"v":1,"id":"a1","event":"decided","text":"');
    const head = Buffer.byteLength(entry({ v: 1, id: 'base', event: 'decided', text: '' }));
    const base = entry({ v: 1, id: 'base', event: 'decided', text: 'x'.repeat(CHUNK - lead - 1 - head) });
    assert.strictEqual(Buffer.from(base + added)[CHUNK] & 0xc0, 0x80, 'no character straddles the first chunk\'s end');
    const { here, there } = machinesSharing({ [layout.ledger]: base });
    commitUnpushed(here, { [layout.ledger]: base + added });
    commitOnState(there.root, { [layout.ledger]: base + ledger('b1') });

    catchUpState(here.root);

    assert.ok(git(here.main, ['show', `${STATE_BRANCH}:${layout.ledger}`]) === base + ledger('b1') + added, 'the line read across the chunks came out changed');
  });

  it('merges a ledger and a text file holding CRLF byte for byte, whatever line-ending filters the repository names', () => {
    const crlf = (/** @type {string} */ text) => text.replace(/\n/g, '\r\n');
    const { here, there } = machinesSharing({ [layout.ledger]: crlf(ledger('base')), 'unit/spec.md': crlf('one\n\ntwo\n') });
    commitUnpushed(here, { [layout.ledger]: crlf(ledger('base', 'a1')), 'unit/spec.md': crlf('ONE\n\ntwo\n') });
    commitOnState(there.root, { [layout.ledger]: crlf(ledger('base', 'b1')), 'unit/spec.md': crlf('one\n\nTWO\n') });
    git(here.main, ['config', 'core.autocrlf', 'true']);
    createFile(path.join(here.main, '.git/info'), 'attributes', '* text eol=crlf\n');

    assert.strictEqual(catchUpState(here.root).action, 'merged');

    assert.ok(git(here.main, ['show', `${STATE_BRANCH}:${layout.ledger}`]) === crlf(ledger('base', 'b1', 'a1')), 'the merged ledger lost its CRLF');
    assert.strictEqual(git(here.main, ['show', `${STATE_BRANCH}:unit/spec.md`]), crlf('ONE\n\nTWO\n'));
  });

  it('merges histories with no common ancestor as if each side added every file', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base'), [layout.projectManifest]: projectManifest('now') });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    const plumb = (args, input) => execFileSync('git', args, { cwd: there.root, encoding: 'utf8', input }).trim();
    const blob = (text) => plumb(['hash-object', '-w', '--stdin'], text);
    const tree = plumb(['mktree'], `100644 blob ${blob(ledger('fresh'))}\t${layout.ledger}\n100644 blob ${blob(projectManifest('now', { started: 'again' }))}\t${layout.projectManifest}\n`);
    const fresh = plumb(['commit-tree', tree, '-m', 'state: begin again']);
    git(there.main, ['push', '-q', '--force', 'origin', `${fresh}:refs/heads/${STATE_BRANCH}`]);

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.pushed, out.conflicts], ['merged', true, []]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [fresh]);
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('fresh', 'base', 'a1'));
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).started, 'again');
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
  });

  it('takes a file only one side changed whole, adds and deletions too', () => {
    const { here, there } = machinesSharing({ 'unit/topics/a/log.md': '# a\n', 'unit/topics/b/log.md': '# b\n', 'unit/assets/gone-here.md': 'g\n', 'unit/assets/gone-there.md': 'g\n' });
    createFile(here.root, 'unit/topics/a/log.md', '# a, here\n');
    fs.rmSync(path.join(here.root, 'unit/assets/gone-here.md'));
    commitUnpushed(here, { 'unit/topics/a/log.md': '# a, here\n', 'unit/assets/new-here.md': 'n\n', 'unit/assets/gone-here.md': '' });
    fs.rmSync(path.join(here.root, 'unit/assets/gone-here.md'));
    pushFailing(here, () => withStateLock(here.root, () => commitState(here.root, ['unit/assets/gone-here.md'], 'state: drop')));
    fs.rmSync(path.join(there.root, 'unit/assets/gone-there.md'));
    commitOnState(there.root, { 'unit/topics/b/log.md': '# b, there\n', 'unit/assets/new-there.md': 'n\n' });
    withStateLock(there.root, () => commitState(there.root, ['unit/assets/gone-there.md'], 'state: drop'));

    const out = catchUpState(here.root);

    assert.deepStrictEqual([out.action, out.warnings], ['merged', []]);
    assert.strictEqual(git(here.main, ['ls-tree', '-r', '--name-only', STATE_BRANCH, 'unit']),
      'unit/assets/new-here.md\nunit/assets/new-there.md\nunit/topics/a/log.md\nunit/topics/b/log.md\n');
    assert.strictEqual(readFile(here.root, 'unit/topics/a/log.md'), '# a, here\n');
    assert.strictEqual(readFile(here.root, 'unit/topics/b/log.md'), '# b, there\n');
    assert.ok(!fs.existsSync(path.join(here.root, 'unit/assets/gone-there.md')));
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
    const list = path.join(world(), 'waiting-commits');
    fs.writeFileSync(list, commits.map((sha) => `${sha}\n`).join(''));
    const push = `"$real" -C "${there.main}" push -q origin "$next:refs/heads/${STATE_BRANCH}" >/dev/null 2>&1`;
    return withPath(gitWrapper('commit-tree', `next=$(sed -n "\${n}p" "${list}"); if [ -n "$next" ]; then ${push}; fi`), fn);
  }

  it('fetches and merges again when the lease fails, and lands on the remote\'s new tip', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    const first = commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') }).commit;
    const second = commitUnpushed(there, { [layout.ledger]: ledger('base', 'b1', 'b2') });

    const { result: out, commands } = withMovingRemote(there, [second], () => traced(() => catchUpState(here.root)));

    const landed = tip(here.main, STATE_BRANCH);
    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['merged', true, []]);
    assert.strictEqual(remoteTip(bare), landed);
    assert.deepStrictEqual(parents(here.main, landed), [second]);
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1', 'b2', 'a1'));
    const leases = commands.filter((c) => c.startsWith('push ') && c.includes('--force-with-lease'));
    assert.deepStrictEqual(leases.map((c) => /--force-with-lease=\S+:([0-9a-f]+)/.exec(c)?.[1]), [first, second]);
    assert.ok(appendOnly(here.root));
  });

  it('finishes a picked merge through a lease that fails, the answered stop gone', () => {
    const { here, there, bare } = machinesSharing({ [layout.projectManifest]: projectManifest('now'), [layout.ledger]: ledger('base') });
    commitUnpushed(here, { [layout.projectManifest]: projectManifest('next'), [layout.ledger]: ledger('base', 'a1') });
    commitOnState(there.root, { [layout.projectManifest]: projectManifest('someday'), [layout.ledger]: ledger('base', 'b1') });
    const second = commitUnpushed(there, { [layout.ledger]: ledger('base', 'b1', 'b2') });
    assert.strictEqual(catchUpState(here.root).action, 'stopped');

    const shown = shownChoice(here);
    const out = withMovingRemote(there, [second], () => pickStateMerge(here.root, '1', shown));

    assert.deepStrictEqual([out.action, out.pushed, out.warnings], ['merged', true, []]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [second]);
    assert.strictEqual(remoteTip(bare), tip(here.main, STATE_BRANCH));
    assert.strictEqual(JSON.parse(readFile(here.root, layout.projectManifest)).roadmap.items['a-lifetime-tier'].horizon, 'next');
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1', 'b2', 'a1'));
    assert.ok(!fs.existsSync(keptStopFile(here.root)));
  });

  it('stops retrying after a bounded number of attempts, keeping the merge here for the next catch-up', () => {
    const { here, there, bare } = machinesSharing({ [layout.ledger]: ledger('base') });
    commitUnpushed(here, { [layout.ledger]: ledger('base', 'a1') });
    commitOnState(there.root, { [layout.ledger]: ledger('base', 'b1') });
    const waiting = ['b2', 'b3', 'b4'].map((_, i, ids) => commitUnpushed(there, { [layout.ledger]: ledger('base', 'b1', ...ids.slice(0, i + 1)) }));

    const out = withMovingRemote(there, waiting, () => catchUpState(here.root));

    assert.deepStrictEqual([out.action, out.pushed], ['merged', false]);
    assert.match(out.warnings[out.warnings.length - 1], /^the remote kept moving: leeway-state is not pushed after 3 attempts, and the next catch-up carries on$/);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [waiting[1]]);
    assert.strictEqual(remoteTip(bare), waiting[2]);

    const next = catchUpState(here.root);

    assert.deepStrictEqual([next.action, next.pushed], ['merged', true]);
    assert.deepStrictEqual(parents(here.main, STATE_BRANCH), [waiting[2]]);
    assert.strictEqual(readFile(here.root, layout.ledger), ledger('base', 'b1', 'b2', 'b3', 'b4', 'a1'));
  });
});
