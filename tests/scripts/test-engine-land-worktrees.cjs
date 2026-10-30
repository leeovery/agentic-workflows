'use strict';

// ---------------------------------------------------------------------------
// Linked worktrees under the `land` verbs (leeway-engine/scripts/domain/
// landing-git.cjs, through the local driver's merges): a branch a linked
// worktree has out moves only as the main checkout's would, a rebase stopped
// there holding the branches it rewrites, and a worktree whose folder is
// missing holding its branch too; a remedy freeing such a branch removes
// that worktree alone — another whose folder is missing kept, with what it
// holds — and waits on a merge stopped there, or a rebase of the branch,
// ended first and alone; a replayed phase moves
// nothing until both branches can, and is put back where the default
// branch then fails to move. Each refusal's remedy is followed as written,
// and the verb then goes through, every linked worktree at a path with a
// space, which each command quotes. The main checkout is
// test-engine-land-checkout.cjs's. Git layer: the landing world
// (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, cutTask, commitFiles, useLandingWorld, refusedMoving, followRemedy, short, shellWord, checkoutOf: checkout, heldRefusal: held, rebasingRefusal: rebasing, stops,
  stoppedRebase, way, moveStep, rebaseSteps, strayRefusal: stray,
} = require('./landing-world.cjs');

const { card, rounding } = TASKS;
const project = useLandingWorld('engine-land-worktrees-');
const MERGE_ONE = ['land', 'phase', 'pay', '1'];
const CHAIN_ONE = ['land', 'chain', 'pay', '1.1'];
const PHASE_ONE = 'feat/pay-phase-1';
const PHASE_FOUR = 'feat/pay-phase-4';
/** The step removing the worktree that has a branch out, its folder missing. @param {string} gone */
const removeGone = (gone) => `remove the worktree that has it out, whose folder ${gone} is missing, with \`git worktree remove ${shellWord(gone)}\``;

/**
 * A worktree at `tree`, detached at `from` with a commit of its own on no
 * branch and an edit staged, its folder then moved away, as an unmounted
 * drive leaves it — the commit returned.
 * @param {string} dir @param {string} tree @param {string} from
 */
function unmounted(dir, tree, from) {
  git(dir, ['worktree', 'add', '-q', '--detach', tree, from]);
  fs.writeFileSync(path.join(tree, 'wip.txt'), 'work in progress\n');
  git(tree, ['add', 'wip.txt']);
  git(tree, ['commit', '-q', '-m', 'detached work']);
  const work = tip(tree, 'HEAD');
  fs.writeFileSync(path.join(tree, 'staged.txt'), 'staged\n');
  git(tree, ['add', 'staged.txt']);
  fs.renameSync(tree, `${tree} unmounted`);
  return work;
}

/** Whether a worktree moved away by `unmounted`, mounted again, is as it was left. @param {string} tree @param {string} work */
function remounted(tree, work) {
  fs.renameSync(`${tree} unmounted`, tree);
  assert.deepStrictEqual([tip(tree, 'HEAD'), git(tree, ['status', '--porcelain'])], [work, 'A  staged.txt\n']);
}

describe('land phase: a linked worktree', () => {
  it('holds the default branch it has out as the main checkout would — changes not committed there, kept by detaching it; a rebase stopped there — and goes through once each remedy is followed', () => {
    const dir = project();
    ok(dir, openArgs(cutTask(dir, '1.4', 'feat', 'Edit the app', 'main', { 'app.txt': 'app edited\n' })));
    ok(dir, openArgs(rounding));
    git(dir, ['checkout', '-q', '-b', 'wip']);
    const linked = path.join(dir, '.git', 'linked main');
    git(dir, ['worktree', 'add', '-q', linked, 'main']);
    const was = short(tip(dir, 'main'));
    fs.writeFileSync(path.join(linked, 'app.txt'), 'edited\n');
    const dirty = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(dirty, held(
      'main', linked, ', with changes not committed: app.txt',
      `commit them, or detach the worktree at ${linked} from main with \`git -C ${shellWord(linked)} switch --detach\`, which leaves it at ${was} with its edits, `
        + `and land again; switching the worktree at ${linked} back to main is yours, when you're ready`,
    ));
    followRemedy(dir, dirty);
    ok(dir, MERGE_ONE);
    assert.deepStrictEqual([short(tip(linked, 'HEAD')), git(linked, ['status', '--porcelain', '--branch'])], [was, '## HEAD (no branch)\n M app.txt\n']);
    git(linked, ['checkout', '-q', '-f', 'main']);
    stoppedRebase(dir, linked);
    const rebased = refusedMoving(dir, ['land', 'phase', 'pay', '2']);
    assert.strictEqual(rebased, rebasing('main', linked, `git -C ${shellWord(linked)}`));
    followRemedy(dir, rebased);
    ok(dir, ['land', 'phase', 'pay', '2']);
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

  it('holds the default branch a worktree whose folder is missing has out, and goes through once that worktree alone is removed — another missing beside it kept, with its own commit and its staged edit', () => {
    const dir = project();
    ok(dir, openArgs(card));
    git(dir, ['checkout', '-q', '-b', 'wip']);
    const detached = path.join(dir, '.git', 'linked detached');
    const gone = path.join(dir, '.git', 'linked main');
    const work = unmounted(dir, detached, 'main');
    git(dir, ['worktree', 'add', '-q', gone, 'main']);
    fs.rmSync(gone, { recursive: true, force: true });
    const refusal = refusedMoving(dir, MERGE_ONE);
    assert.strictEqual(refusal, held('main', gone, ', whose folder is missing', `remove that worktree with \`git worktree remove ${shellWord(gone)}\` and land again`));
    followRemedy(dir, refusal);
    ok(dir, MERGE_ONE);
    remounted(detached, work);
  });
});

describe('land: a remedy freeing a branch a linked worktree has out', () => {
  it('removes the worktree whose folder is missing that has the branch out, and it alone, before a move and before a rebase — another missing kept, with its own commit and its staged edit — and the verb goes through', () => {
    const dir = project();
    ok(dir, openArgs(card));
    const other = commitFiles(dir, PHASE_FOUR, 'main', { 'v2.txt': 'v2\n' }, { message: 'feat(pay-v2): Other\n\nTask: pay-v2-4-1\n' });
    commitFiles(dir, PHASE_FOUR, PHASE_FOUR, { 'four.txt': 'four\n' }, { message: 'fix(pay): Four\n\nTask: pay-4-1\n' });
    const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
    const detached = path.join(dir, '.git', 'linked detached');
    const work = unmounted(dir, detached, 'main');
    const gone = path.join(dir, '.git', 'linked phase');
    const outAndGone = (/** @type {string} */ branch) => {
      git(dir, ['worktree', 'add', '-q', gone, branch]);
      fs.rmSync(gone, { recursive: true, force: true });
    };
    outAndGone(PHASE_ONE);
    const moving = refusedMoving(dir, CHAIN_ONE);
    assert.strictEqual(moving, stray(PHASE_ONE, 1, top, 'my tidy', way(dir, null, PHASE_ONE, [removeGone(gone), ...moveStep(PHASE_ONE, `${short(top)}^`, `take ${short(top)} off ${PHASE_ONE}`)])));
    followRemedy(dir, moving);
    ok(dir, CHAIN_ONE);
    outAndGone(PHASE_FOUR);
    const rebasing = refusedMoving(dir, ['land', 'chain', 'pay', '4.1']);
    assert.strictEqual(rebasing, stray(PHASE_FOUR, 4, other, 'feat(pay-v2): Other', way(dir, null, PHASE_FOUR, [
      removeGone(gone), ...rebaseSteps(dir, PHASE_FOUR, `--onto ${short(other)}^ ${short(other)}`, `take ${short(other)} off ${PHASE_FOUR}`),
    ])));
    followRemedy(dir, rebasing);
    ok(dir, ['land', 'chain', 'pay', '4.1']);
    remounted(detached, work);
  });

  it('waits on a merge stopped where the branch is out, or a rebase of it, ended first and alone, then frees it as it would any', () => {
    for (const [stop, first] of /** @type {const} */ ([
      [['merge', 'side'], (/** @type {string} */ at) => `first finish a merge at ${at}, where ${PHASE_ONE} is out, or end it with \`git -C ${shellWord(at)} merge --abort\``],
      [['rebase', 'side'], (/** @type {string} */ at) => `${PHASE_ONE} is being rebased at ${at}, so first finish that rebase, or end it with \`git -C ${shellWord(at)} rebase --abort\``],
    ])) {
      const dir = project();
      ok(dir, openArgs(card));
      const linked = path.join(dir, '.git', 'linked phase');
      git(dir, ['worktree', 'add', '-q', linked, PHASE_ONE]);
      fs.writeFileSync(path.join(linked, 'tidy.txt'), 'tidy\n');
      git(linked, ['add', 'tidy.txt']);
      git(linked, ['commit', '-q', '-m', 'my tidy']);
      const top = tip(dir, PHASE_ONE);
      commitFiles(dir, 'side', 'landing-base', { 'card.txt': 'side card\n' });
      stops(linked, stop);
      const waiting = refusedMoving(dir, CHAIN_ONE);
      assert.strictEqual(waiting, stray(PHASE_ONE, 1, top, 'my tidy', `${first(linked)}, and land again`));
      followRemedy(dir, waiting);
      const freeing = refusedMoving(dir, CHAIN_ONE);
      assert.strictEqual(freeing, stray(PHASE_ONE, 1, top, 'my tidy', way(dir, { path: linked, here: false }, PHASE_ONE, moveStep(PHASE_ONE, `${short(top)}^`, `take ${short(top)} off ${PHASE_ONE}`))));
      followRemedy(dir, freeing);
      ok(dir, CHAIN_ONE);
      assert.deepStrictEqual([tip(linked, 'HEAD'), git(linked, ['status', '--porcelain', '--branch'])], [top, '## HEAD (no branch)\n']);
    }
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
    assert.match(refusedMoving(dir, MERGE_ONE), /^land: main could not move \(git merge failed: .*index\.lock.*\), so feat\/pay-phase-1 is put back and nothing moved — clear what git names and land again$/s);
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
      `  case "$ref $new" in refs/heads/main\\ *|"refs/heads/feat/pay-phase-1 ${opened}") echo 'refused by \`policy\`' >&2; exit 1;; esac`,
      'done',
    ].join('\n'), { mode: 0o755 });
    const { error } = refuses(dir, MERGE_ONE);
    const replayed = tip(dir, 'feat/pay-phase-1');
    const said = "git update-ref failed: [^`]*refused by 'policy'[^`]*";
    assert.match(error, new RegExp(
      `^land: main could not move \\(${said}\\), nor could feat/pay-phase-1 be put back \\(${said}\\) — feat/pay-phase-1 stands at the replay, ${replayed.slice(0, 7)}; `
      + `\`git branch -f feat/pay-phase-1 ${opened.slice(0, 7)}\` puts it back$`, 's',
    ));
    assert.deepStrictEqual([tip(dir, 'main'), replayed === opened], [tip(dir, 'feat/pay-phase-2'), false]);
    fs.rmSync(hook);
    followRemedy(dir, error);
    assert.strictEqual(tip(dir, 'feat/pay-phase-1'), opened);
  });
});
