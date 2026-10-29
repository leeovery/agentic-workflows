'use strict';

// ---------------------------------------------------------------------------
// A remedy of the local landing driver (workflow-engine/scripts/domain/
// landing-git.cjs, `remedy`) taken again after it was cut short, or met with
// what an earlier one left: the branch's keep reused where it is kept
// already, and made under a fresh name where its name holds another commit;
// a worktree a remedy made and left removed before anything else — unlocked
// first where locked, detached or its folder deleted alike — and never
// taken for the person's; a folder no worktree holds at its path cleared
// before one is made there; and a rebase stopped there stopping every verb
// until it is settled or ended there and the worktree removed. Git layer:
// the landing world (landing-world.cjs) with tasks 1.1 and 2.1 opened,
// built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, git, tip } = require('./engine-harness.cjs');
const {
  TASKS, openArgs, commitFiles, mergeBack, useLandingWorld, refusedMoving, commandsOf, followRemedy, short, shellWord, scratchOf, way, moveStep, rebaseSteps,
  strayRefusal: stray,
} = require('./landing-world.cjs');

const { card, total, rounding } = TASKS;
const project = useLandingWorld('engine-land-remedies-interrupted-', (dir) => {
  ok(dir, openArgs(card));
  ok(dir, openArgs(rounding));
});

const PHASE_ONE = 'feat/pay-phase-1';
const CHAIN_ONE = ['land', 'chain', 'pay', '1.1'];
const CARD_LANDING = 'feat(pay): Add card\n\nTask: pay-1-1\n';

/** The first `count` commands a refusal names, run as the person would, a command that stops left stopped. @param {string} dir @param {string} refusal @param {number} count */
const cutShort = (dir, refusal, count) => followRemedy(dir, commandsOf(refusal).slice(0, count).map((command) => `\`${command}\``).join(' '), () => {});

/** Phase 1's branch with a commit below task 1.1's landing, the commit returned. @param {string} dir @param {Record<string, string>} files */
function strayBelow(dir, files) {
  const below = commitFiles(dir, PHASE_ONE, 'main', files, { message: 'my tidy' });
  commitFiles(dir, PHASE_ONE, below, card.files, { message: CARD_LANDING });
  return below;
}

/** The way on for a commit below phase 1's top, its branch kept already on `kept`. @param {string} dir @param {string} below @param {string} kept @param {string[]} [first] */
const rebaseKept = (dir, below, kept, first = []) => [
  ...first, `${PHASE_ONE} as it stands is kept on ${kept} already`, ...rebaseSteps(dir, PHASE_ONE, `--onto ${short(below)}^ ${short(below)}`, `take ${short(below)} off ${PHASE_ONE}`),
].join(', then ');

describe('land: a remedy taken again, or meeting what an earlier one left', () => {
  it('keeps the branch on the `.kept-` branch an earlier try made, and under a fresh name where that name holds another commit', () => {
    const dir = project();
    const top = commitFiles(dir, PHASE_ONE, PHASE_ONE, { 'tidy.txt': 'tidy\n' }, { message: 'my tidy' });
    const taken = `${PHASE_ONE}.kept-${short(top)}`;
    git(dir, ['branch', taken, 'main']);
    const [off] = moveStep(PHASE_ONE, `${short(top)}^`, `take ${short(top)} off ${PHASE_ONE}`);
    const fresh = refusedMoving(dir, CHAIN_ONE);
    assert.strictEqual(fresh, stray(PHASE_ONE, 1, top, 'my tidy', `keep ${PHASE_ONE} as it stands with \`git branch ${taken}-2 ${short(top)}\`, then ${off}, and land again`));
    cutShort(dir, fresh, 1);
    const again = refusedMoving(dir, CHAIN_ONE);
    assert.strictEqual(again, stray(PHASE_ONE, 1, top, 'my tidy', `${PHASE_ONE} as it stands is kept on ${taken}-2 already, then ${off}, and land again`));
    followRemedy(dir, again);
    ok(dir, CHAIN_ONE);
    assert.deepStrictEqual([taken, `${taken}-2`, PHASE_ONE].map((branch) => tip(dir, branch)), [tip(dir, 'main'), top, tip(dir, `${top}^`)]);
  });

  it('removes a worktree an earlier remedy made and left, cut short once it was made, before anything else — never taking it for the person\'s', () => {
    const dir = project();
    const below = strayBelow(dir, { 'tidy.txt': 'tidy\n' });
    const kept = `${PHASE_ONE}.kept-${short(tip(dir, PHASE_ONE))}`;
    cutShort(dir, refusedMoving(dir, CHAIN_ONE), 2);
    const left = refusedMoving(dir, CHAIN_ONE);
    const remove = `remove the worktree an earlier remedy left with \`git worktree remove ${shellWord(scratchOf(dir, PHASE_ONE))}\``;
    assert.strictEqual(left, stray(PHASE_ONE, 1, below, 'my tidy', `${rebaseKept(dir, below, kept, [remove])}, and land again`));
    followRemedy(dir, left);
    ok(dir, CHAIN_ONE);
  });

  it('clears what an earlier remedy left at its worktree\'s path however it was left — locked, detached, its folder deleted, a folder no worktree holds — before it makes its own', () => {
    const remove = (/** @type {string} */ at) => `\`git worktree remove ${shellWord(at)}\``;
    for (const [leave, cleared] of /** @type {[(dir: string, at: string) => void, (at: string) => string][]} */ ([
      [(dir, at) => git(dir, ['worktree', 'add', '-q', '--lock', at, PHASE_ONE]),
        (at) => `unlock the worktree an earlier remedy left with \`git worktree unlock ${shellWord(at)}\`, then remove it with ${remove(at)}, then `],
      [(dir, at) => git(dir, ['worktree', 'add', '-q', '--detach', at, 'main']), (at) => `remove the worktree an earlier remedy left with ${remove(at)}, then `],
      [(dir, at) => {
        git(dir, ['worktree', 'add', '-q', at, PHASE_ONE]);
        fs.rmSync(at, { recursive: true });
      }, (at) => `remove the worktree an earlier remedy left with ${remove(at)}, then `],
      [(dir, at) => {
        fs.mkdirSync(at, { recursive: true });
        fs.writeFileSync(path.join(at, 'left.txt'), 'left\n');
      }, () => ''],
    ])) {
      const dir = project();
      const below = strayBelow(dir, { 'tidy.txt': 'tidy\n' });
      const scratch = scratchOf(dir, PHASE_ONE);
      leave(dir, scratch);
      const folder = cleared(scratch) === '' ? [`clear the folder left at ${scratch}, which no worktree holds, with \`rm -rf ${shellWord(scratch)}\``] : [];
      const off = rebaseSteps(dir, PHASE_ONE, `--onto ${short(below)}^ ${short(below)}`, `take ${short(below)} off ${PHASE_ONE}`);
      const left = refusedMoving(dir, CHAIN_ONE);
      assert.strictEqual(left, stray(PHASE_ONE, 1, below, 'my tidy', `${cleared(scratch)}${way(dir, null, PHASE_ONE, [...folder, ...off])}`));
      followRemedy(dir, left);
      ok(dir, CHAIN_ONE);
    }
  });

  it('refuses to move a branch a worktree an earlier remedy made has out, its rebase through, until that worktree is removed', () => {
    const dir = project();
    strayBelow(dir, { 'tidy.txt': 'tidy\n' });
    cutShort(dir, refusedMoving(dir, CHAIN_ONE), 3);
    mergeBack(dir, total.branch, card.branch);
    const scratch = scratchOf(dir, PHASE_ONE);
    const left = refusedMoving(dir, openArgs(total));
    assert.strictEqual(left, `land: ${PHASE_ONE} is checked out at ${scratch}, so nothing moved — remove the worktree an earlier remedy left with \`git worktree remove ${shellWord(scratch)}\` and land again`);
    followRemedy(dir, left);
    assert.strictEqual(ok(dir, openArgs(total)).base, card.branch);
  });

  it('stops every verb while a rebase a remedy began is stopped in the worktree it made, until it is ended there or settled, and the worktree removed', () => {
    const dir = project();
    const below = strayBelow(dir, { 'card.txt': 'tidy card\n' });
    const kept = `${PHASE_ONE}.kept-${short(tip(dir, PHASE_ONE))}`;
    const scratch = scratchOf(dir, PHASE_ONE);
    const there = `git -C ${shellWord(scratch)}`;
    const stopped = `land: ${PHASE_ONE} is being rebased at ${scratch}, a worktree a remedy made, so nothing moved — `
      + `settle each conflict there and go on with \`${there} rebase --continue\`, or end it with \`${there} rebase --abort\`, `
      + `then remove it with \`git worktree remove ${shellWord(scratch)}\`, and land again`;
    const verbs = [openArgs(total), CHAIN_ONE, ['land', 'phase', 'pay', '1'], ['land', 'finish', 'pay']];
    cutShort(dir, refusedMoving(dir, CHAIN_ONE), 3);
    assert.deepStrictEqual(verbs.map((args) => refusedMoving(dir, args)), verbs.map(() => stopped));
    const [goOn, end, remove] = commandsOf(stopped);
    followRemedy(dir, `\`${end}\` \`${remove}\``);
    const again = refusedMoving(dir, CHAIN_ONE);
    assert.strictEqual(again, stray(PHASE_ONE, 1, below, 'my tidy', `${rebaseKept(dir, below, kept)}, and land again`));
    cutShort(dir, again, 2);
    fs.writeFileSync(path.join(scratch, 'card.txt'), 'card\n');
    git(scratch, ['add', 'card.txt']);
    followRemedy(dir, `\`${goOn}\` \`${remove}\``);
    ok(dir, CHAIN_ONE);
    assert.strictEqual(git(dir, ['show', `${PHASE_ONE}:card.txt`]), 'card\n');
  });
});
