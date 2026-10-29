'use strict';

// ---------------------------------------------------------------------------
// The main checkout under the `land` verbs (workflow-engine/scripts/domain/
// landing-git.cjs, through the local driver's merges): it never moves but by
// a fast-forward of the default branch it has out, made through the
// person's own git and hooks, with its tracked files clean where the merge
// changes them — changes to any other carried across — nothing at a path
// the move adds, or in its way, but what it tracks, ignored or not —
// git's own refusal its last guard — and no operation in progress, a pick
// or revert sequence among them; changes not committed there are kept by
// detaching the checkout, never set aside; a rebase stopped there holds the
// branch it rebases and those it updates, though it leaves the checkout
// detached. Each refusal's remedy is followed as written, and the merge
// then goes through. Linked worktrees and the replay's put-back are
// test-engine-land-worktrees.cjs's. Git layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ok, git, tip } = require('./engine-harness.cjs');
const { datedAt } = require('./discovery-test-utils.cjs');
const {
  TASKS, openArgs, own, cutTask, commitFiles, useLandingWorld, refusedMoving, followRemedy, short, checkoutOf: checkout, heldRefusal: held, rebasingRefusal: rebasing, stops,
  stoppedRebase,
} = require('./landing-world.cjs');
const { checkoutBlock } = require('../../skills/workflow-engine/scripts/domain/landing-git.cjs');

const { card, rounding } = TASKS;

/** Whether the volume tests run on tells names apart by their case alone. */
const CASE_SENSITIVE = (() => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-land-case-'));
  try {
    fs.writeFileSync(path.join(probe, 'Case'), '');
    return !fs.existsSync(path.join(probe, 'case'));
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
})();
const project = useLandingWorld('engine-land-checkout-');
const MERGE_ONE = ['land', 'phase', 'pay', '1'];

/** An ignore rule the repository keeps for this checkout alone. @param {string} dir @param {string} rule */
function exclude(dir, rule) {
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `${rule}\n`);
}

describe('land phase: the main checkout', () => {
  it('fast-forwards the default branch where the main checkout has it out, clean, through the person\'s own hooks, to the commit the phase was opened at', () => {
    const dir = project();
    const hook = path.join(dir, '.git', 'hooks', 'post-merge');
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, '#!/bin/sh\ntouch "$(git rev-parse --git-dir)/post-merge-ran"\n', { mode: 0o755 });
    // Opened in the past, so a replay now could not make the same commit.
    datedAt('2001-01-01T00:00:00Z', () => ok(dir, openArgs(card)));
    const opened = tip(dir, 'feat/pay-phase-1');
    const merged = own(ok(dir, MERGE_ONE));
    assert.deepStrictEqual(
      { main: tip(dir, 'main'), checkout: checkout(dir), card: fs.readFileSync(path.join(dir, 'card.txt'), 'utf8'), hook: fs.existsSync(path.join(dir, '.git', 'post-merge-ran')) },
      { main: opened, checkout: { head: 'main', status: '' }, card: 'card\n', hook: true },
    );
    assert.strictEqual(merged.commit, opened);
  });

  it('stops where the default branch is out with changes not committed to files the merge changes, naming those alone, and goes through once the checkout is detached, which keeps them where they were', () => {
    const dir = project();
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Edit the app', 'main', { 'app.txt': 'app edited\n' })));
    const was = tip(dir, 'main');
    fs.writeFileSync(path.join(dir, 'app.txt'), 'edited\n');
    fs.writeFileSync(path.join(dir, 'note`s.txt'), 'notes\n');
    git(dir, ['add', 'note`s.txt']);
    const dirty = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(dirty, held(
      'main', dir, ', with changes not committed: app.txt',
      `commit them, or detach your checkout from main with \`git switch --detach\`, which leaves it at ${short(was)} with its edits, and land again; `
        + 'switching your checkout back to main is yours, when you\'re ready',
    ));
    followRemedy(dir, dirty);
    const merged = own(ok(dir, MERGE_ONE));
    assert.deepStrictEqual(
      { main: tip(dir, 'main'), head: tip(dir, 'HEAD'), status: git(dir, ['status', '--porcelain', '--branch']), app: fs.readFileSync(path.join(dir, 'app.txt'), 'utf8') },
      { main: merged.commit, head: was, status: '## HEAD (no branch)\n M app.txt\nA  note`s.txt\n', app: 'edited\n' },
    );
  });

  it('carries changes not committed to files the merge does not change across the fast-forward, staged or not', () => {
    const dir = project();
    ok(dir, openArgs(card));
    fs.writeFileSync(path.join(dir, 'app.txt'), 'edited\n');
    fs.writeFileSync(path.join(dir, 'note`s.txt'), 'notes\n');
    git(dir, ['add', 'note`s.txt']);
    const merged = own(ok(dir, MERGE_ONE));
    assert.deepStrictEqual(
      { main: tip(dir, 'main'), checkout: checkout(dir), card: fs.readFileSync(path.join(dir, 'card.txt'), 'utf8') },
      { main: merged.commit, checkout: { head: 'main', status: ' M app.txt\nA  note`s.txt\n' }, card: 'card\n' },
    );
  });

  it('stops where the default branch is out mid-merge, mid-am, mid-sequence of picks or reverts with a stop committed by hand, or being rebased by either backend — a branch the rebase updates held too — and goes through once each remedy is followed', () => {
    const dir = project();
    ok(dir, openArgs(card));
    commitFiles(dir, 'theirs', 'main', { 'app.txt': 'theirs\n' });
    fs.writeFileSync(path.join(dir, 'app.txt'), 'ours\n');
    git(dir, ['commit', '-q', '-am', 'ours']);
    stops(dir, ['merge', 'theirs']);
    const merging = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(merging, held('main', dir, ', where a merge is in progress', 'finish it, or end it with `git merge --abort`, and land again'));
    followRemedy(dir, merging);

    commitFiles(dir, 'patched', 'main', { 'app.txt': 'patched\n' }, { message: 'patch the app' });
    fs.writeFileSync(path.join(dir, 'app.txt'), 'mine again\n');
    git(dir, ['commit', '-q', '-am', 'mine again']);
    const patch = path.join(dir, '.git', 'patched.patch');
    fs.writeFileSync(patch, git(dir, ['format-patch', '-1', '--stdout', 'patched']));
    stops(dir, ['am', '-q', patch]);
    const applying = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(applying, held('main', dir, ', where git am is in progress', 'finish it, or end it with `git am --abort`, and land again'));
    followRemedy(dir, applying);

    const edits = ['one', 'two', 'three', 'four'].map((n) => {
      fs.writeFileSync(path.join(dir, 'app.txt'), `mine, ${n}\n`);
      git(dir, ['commit', '-q', '-am', `mine, ${n}`]);
      return tip(dir, 'main');
    });
    commitFiles(dir, 'picks', edits[0], { 'app.txt': 'pick one\n' }, { message: 'pick one' });
    commitFiles(dir, 'picks', 'picks', { 'app.txt': 'pick two\n' }, { message: 'pick two' });
    for (const [verb, commits] of [['cherry-pick', [`${edits[0]}..picks`]], ['revert', [edits[1], edits[2]]]]) {
      stops(dir, [verb, '--no-edit', ...commits]);
      fs.writeFileSync(path.join(dir, 'app.txt'), `the ${verb} settled by hand\n`);
      git(dir, ['commit', '-q', '-a', '--no-edit']);
      const sequence = refusedMoving(dir, MERGE_ONE);
      assert.strictEqual(sequence, held('main', dir, `, where a ${verb} is in progress`, `finish it, or end it with \`git ${verb} --quit\`, and land again`));
      followRemedy(dir, sequence);
    }

    stoppedRebase(dir, dir);
    const rebased = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(rebased, rebasing('main', dir, 'git'));
    assert.strictEqual(checkoutBlock(dir, 'held'), rebasing('held', dir, 'git').slice('land: '.length));
    followRemedy(dir, rebased);
    stops(dir, ['rebase', '--apply', 'side']);
    const applied = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(applied, rebasing('main', dir, 'git'));
    followRemedy(dir, applied);
    ok(dir, MERGE_ONE);
    assert.strictEqual(git(dir, ['show', 'main:card.txt']), 'card\n');
  });

  it('moves the default branch by its ref alone where the main checkout is on a branch of its own, its edits untouched', () => {
    const dir = project();
    git(dir, ['checkout', '-q', '-b', 'wip']);
    fs.writeFileSync(path.join(dir, 'app.txt'), 'edited\n');
    ok(dir, openArgs(card));
    const merged = own(ok(dir, MERGE_ONE));
    assert.deepStrictEqual(
      { main: tip(dir, 'main'), checkout: checkout(dir), app: fs.readFileSync(path.join(dir, 'app.txt'), 'utf8'), card: fs.existsSync(path.join(dir, 'card.txt')) },
      { main: merged.commit, checkout: { head: 'wip', status: ' M app.txt\n' }, app: 'edited\n', card: false },
    );
  });

  it('fast-forwards over a file renamed in its case alone, where the volume folds case', { skip: CASE_SENSITIVE && 'the volume is case-sensitive, where a rename in case alone is two paths and nothing is in the way' }, () => {
    const dir = project();
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Capitalise', 'main', { 'App.txt': 'app\n' }, { removed: ['app.txt'] })));
    ok(dir, MERGE_ONE);
    assert.deepStrictEqual([git(dir, ['ls-files', 'App.txt', 'app.txt']), checkout(dir)], ['App.txt\n', { head: 'main', status: '' }]);
  });

  it('fast-forwards over what it tracks: a directory become a file, and a link become a directory, though the link leads to a file of the name the move adds', () => {
    const dir = project();
    fs.mkdirSync(path.join(dir, 'conf'));
    fs.writeFileSync(path.join(dir, 'conf', 'a.txt'), 'a\n');
    fs.mkdirSync(path.join(dir, 'vendor', 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'vendor', 'docs', 'guide.md'), 'the shared guide\n');
    fs.symlinkSync(path.join('vendor', 'docs'), path.join(dir, 'docs'));
    git(dir, ['add', 'conf', 'vendor', 'docs']);
    git(dir, ['commit', '-q', '-m', 'conf, and the docs by a link']);
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Flatten', 'main', { conf: 'flat\n', 'docs/guide.md': 'our guide\n' }, { removed: ['conf/a.txt', 'docs'] })));
    ok(dir, MERGE_ONE);
    assert.deepStrictEqual(
      [fs.readFileSync(path.join(dir, 'conf'), 'utf8'), fs.lstatSync(path.join(dir, 'docs')).isDirectory(), fs.readFileSync(path.join(dir, 'vendor', 'docs', 'guide.md'), 'utf8'), checkout(dir)],
      ['flat\n', true, 'the shared guide\n', { head: 'main', status: '' }],
    );
  });

  it('stops, moving nothing and the files untouched, where a path the move adds holds an ignored file — one the task stops ignoring, one info/exclude names — fast-forwarded or replayed, and goes through once they are moved aside', () => {
    const dir = project();
    fs.appendFileSync(path.join(dir, '.gitignore'), 'settings.local\n');
    git(dir, ['commit', '-q', '-am', 'ignore local settings']);
    exclude(dir, 'secret.env');
    exclude(dir, 'a[b].txt');
    exclude(dir, 'note`s.txt');
    commitFiles(dir, 'main', 'main', { 'ab.txt': 'tracked\n' });
    git(dir, ['reset', '-q', '--hard']);
    const mine = { 'settings.local': 'my settings\n', 'secret.env': 'my secret\n', 'a[b].txt': 'mine\n', 'note`s.txt': 'my notes\n' };
    for (const [file, text] of Object.entries(mine)) fs.writeFileSync(path.join(dir, file), text);
    const ignored = git(dir, ['show', 'main:.gitignore']).replace('settings.local\n', '');
    const shared = { '.gitignore': ignored, 'settings.local': 'shared\n', 'secret.env': 'EXAMPLE=1\n', 'a[b].txt': 'shared\n', 'note`s.txt': 'shared notes\n' };
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Share settings', 'main', shared)));
    const refusal = held('main', dir, ', where files not tracked are in the way: a[b].txt, note\'s.txt, secret.env, settings.local', 'move them out of the way and land again');
    assert.strictEqual(refusedMoving(dir, MERGE_ONE), refusal);
    commitFiles(dir, rounding.branch, 'main', rounding.files);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.strictEqual(refusedMoving(dir, MERGE_ONE), refusal);
    assert.deepStrictEqual(Object.fromEntries(Object.keys(mine).map((file) => [file, fs.readFileSync(path.join(dir, file), 'utf8')])), mine);
    for (const file of Object.keys(mine)) fs.renameSync(path.join(dir, file), path.join(dir, '.git', file));
    ok(dir, MERGE_ONE);
  });

  it('stops, moving nothing and keeping them, where a path the move adds goes under an ignored file or an ignored symlink — fast-forwarded or replayed', () => {
    const dir = project();
    exclude(dir, 'build');
    exclude(dir, 'docs');
    fs.writeFileSync(path.join(dir, 'build'), 'my build\n');
    const outside = path.join(dir, '.git', 'outside');
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(dir, 'docs'));
    const kept = () => ({ build: fs.readFileSync(path.join(dir, 'build'), 'utf8'), docs: fs.lstatSync(path.join(dir, 'docs')).isSymbolicLink() });
    for (const [n, file] of [[4, 'build/out.txt'], [5, 'docs/guide.md']]) {
      ok(dir, openArgs(cutTask(dir, `1.${n}`, 'feat', `Add ${n}`, n === 4 ? 'main' : 'feat/pay-1.4-add-4', { [file]: 'made\n' })));
    }
    const refusal = held('main', dir, ', where files not tracked are in the way: build, docs', 'move them out of the way and land again');
    assert.strictEqual(refusedMoving(dir, MERGE_ONE), refusal);
    assert.deepStrictEqual(kept(), { build: 'my build\n', docs: true });
    commitFiles(dir, rounding.branch, 'main', rounding.files);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.strictEqual(refusedMoving(dir, MERGE_ONE), refusal);
    assert.deepStrictEqual(kept(), { build: 'my build\n', docs: true });
  });

  it('stops, moving nothing and keeping it, where a directory the move makes a file holds an ignored file — git\'s own refusal, fast-forwarded or replayed', () => {
    const dir = project();
    fs.mkdirSync(path.join(dir, 'conf'));
    fs.writeFileSync(path.join(dir, 'conf', 'a.txt'), 'a\n');
    git(dir, ['add', 'conf']);
    git(dir, ['commit', '-q', '-m', 'conf']);
    exclude(dir, 'conf/local.cfg');
    fs.writeFileSync(path.join(dir, 'conf', 'local.cfg'), 'my config\n');
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Flatten', 'main', { conf: 'flat\n' }, { removed: ['conf/a.txt'] })));
    const local = () => fs.readFileSync(path.join(dir, 'conf', 'local.cfg'), 'utf8');
    assert.match(refusedMoving(dir, MERGE_ONE), /^land: main could not move \(git merge failed: .*\), so nothing moved — clear what git names and land again$/s);
    assert.strictEqual(local(), 'my config\n');
    commitFiles(dir, rounding.branch, 'main', rounding.files);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.match(refusedMoving(dir, MERGE_ONE), /^land: main could not move \(git merge failed: .*\), so feat\/pay-phase-1 is put back and nothing moved — clear what git names and land again$/s);
    assert.strictEqual(local(), 'my config\n');
  });
});
