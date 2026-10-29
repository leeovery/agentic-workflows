'use strict';

// ---------------------------------------------------------------------------
// Linked worktrees under the `land` verbs (workflow-engine/scripts/domain/
// landing-git.cjs, through the local driver's merges): a branch a linked
// worktree has out moves only as the main checkout's would, a rebase stopped
// there holding the branches it rewrites, and a worktree deleted but not
// pruned holding its branch too; a replayed phase moves nothing until both
// branches can, and is put back where the default branch then fails to
// move. Each refusal's remedy is followed as written, and the merge then
// goes through, every linked worktree at a path with a space, which each
// command quotes. The main checkout is test-engine-land-checkout.cjs's. Git
// layer: the landing world (landing-world.cjs), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, commitFiles, useLandingWorld, refusedMoving, followRemedy, shellWord, checkoutOf: checkout, heldRefusal: held, rebasingRefusal: rebasing, stops, stoppedRebase,
} = require('./landing-world.cjs');

const { card, rounding } = TASKS;
const project = useLandingWorld('engine-land-worktrees-');
const MERGE_ONE = ['land', 'phase', 'pay', '1'];

describe('land phase: a linked worktree', () => {
  it('holds the default branch it has out as the main checkout would — changes not committed there, a rebase stopped there — and goes through once each remedy is followed', () => {
    const dir = project();
    ok(dir, openArgs(card));
    git(dir, ['checkout', '-q', '-b', 'wip']);
    const linked = path.join(dir, '.git', 'linked main');
    git(dir, ['worktree', 'add', '-q', linked, 'main']);
    fs.writeFileSync(path.join(linked, 'app.txt'), 'edited\n');
    const dirty = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(dirty, held('main', linked, ', with changes not committed: app.txt', `commit them, or set them aside with \`git -C ${shellWord(linked)} stash\`, and land again`));
    followRemedy(dir, dirty);
    stoppedRebase(dir, linked);
    const rebased = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(rebased, rebasing('main', linked, `git -C ${shellWord(linked)}`));
    followRemedy(dir, rebased);
    ok(dir, MERGE_ONE);
  });

  it('holds a phase\'s branch a rebase stopped there is rewriting, though the phase would merge by a fast-forward', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const linked = path.join(dir, '.git', 'linked phase');
    git(dir, ['worktree', 'add', '-q', linked, 'feat/pay-phase-1']);
    commitFiles(dir, 'side', 'landing-base', { 'card.txt': 'side card\n' });
    stops(linked, ['rebase', 'side']);
    const rebased = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(rebased, rebasing('feat/pay-phase-1', linked, `git -C ${shellWord(linked)}`));
    followRemedy(dir, rebased);
    ok(dir, MERGE_ONE);
  });

  it('holds the default branch a worktree deleted but not pruned has out, a detached one deleted beside it, and goes through once pruned', () => {
    const dir = project();
    ok(dir, openArgs(card));
    git(dir, ['checkout', '-q', '-b', 'wip']);
    const detached = path.join(dir, '.git', 'linked detached');
    const gone = path.join(dir, '.git', 'linked main');
    git(dir, ['worktree', 'add', '-q', '--detach', detached, 'main']);
    git(dir, ['worktree', 'add', '-q', gone, 'main']);
    for (const tree of [detached, gone]) fs.rmSync(tree, { recursive: true, force: true });
    const refusal = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(refusal, held('main', gone, ', a worktree since deleted', 'clear it with `git worktree prune` and land again'));
    followRemedy(dir, refusal);
    ok(dir, MERGE_ONE);
  });
});

describe('land phase: a phase replayed onto a default branch that moved on', () => {
  it('moves nothing until both branches can move — a file not tracked in the way, its phase branch out elsewhere — and puts the phase back where the default branch then fails; each remedy followed, it goes through', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);

    fs.writeFileSync(path.join(dir, 'card.txt'), 'my own card\n');
    assert.strictEqual(refusedMoving(dir, MERGE_ONE), held('main', dir, ', where files not tracked are in the way: card.txt', 'move them out of the way and land again'));
    fs.renameSync(path.join(dir, 'card.txt'), path.join(dir, '.git', 'my-card.txt'));

    const linked = path.join(dir, '.git', 'linked phase');
    git(dir, ['worktree', 'add', '-q', linked, 'feat/pay-phase-1']);
    const away = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(away, held(
      'feat/pay-phase-1', linked, ', and the landing would move it to a commit it does not lead to',
      `check out another branch there, as \`git -C ${shellWord(linked)} switch --detach\` does, and land again`,
    ));
    followRemedy(dir, away);

    const lock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(lock, '');
    assert.match(refusedMoving(dir, MERGE_ONE), /^land: main could not move \(.*index\.lock.*\), so feat\/pay-phase-1 is put back and nothing moved — clear what git names and land again$/s);
    fs.rmSync(lock);

    fs.writeFileSync(path.join(dir, 'scratch.txt'), 'mine\n');
    ok(dir, MERGE_ONE);
    assert.deepStrictEqual([tip(dir, 'main'), checkout(dir)], [tip(dir, 'feat/pay-phase-1'), { head: 'main', status: '?? scratch.txt\n' }]);
  });

  it('says which branch moved and how to put it back where putting it back fails too, and that puts it back', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    git(dir, ['checkout', '-q', '-b', 'wip']);
    const opened = tip(dir, 'feat/pay-phase-1');
    const hook = path.join(dir, '.git', 'hooks', 'reference-transaction');
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, [
      '#!/bin/sh',
      '[ "$1" = prepared ] || exit 0',
      'while read old new ref; do',
      `  case "$ref $new" in refs/heads/main\\ *|"refs/heads/feat/pay-phase-1 ${opened}") echo refused >&2; exit 1;; esac`,
      'done',
    ].join('\n'), { mode: 0o755 });
    const { error } = refuses(dir, MERGE_ONE);
    const replayed = tip(dir, 'feat/pay-phase-1');
    assert.match(error, new RegExp(
      `^land: main could not move \\(.*refused.*\\), nor could feat/pay-phase-1 be put back \\(.*refused.*\\) — feat/pay-phase-1 stands at the replay, ${replayed.slice(0, 7)}; `
      + `\`git update-ref refs/heads/feat/pay-phase-1 ${opened}\` puts it back$`, 's',
    ));
    assert.deepStrictEqual([tip(dir, 'main'), replayed === opened], [tip(dir, 'feat/pay-phase-2'), false]);
    fs.rmSync(hook);
    followRemedy(dir, error);
    assert.strictEqual(tip(dir, 'feat/pay-phase-1'), opened);
  });
});
