'use strict';

// ---------------------------------------------------------------------------
// A unit's own branch kept current (7.2.36; ledger-engine/scripts/domain/
// unit-branch.cjs, `bringUp`, through checklist.cjs and review-entry.cjs):
// each later phase start's close, once nothing else refuses it, brings the
// default branch, as the driver lands it — never a commit here the host
// lacks — into `feat/{unit}` by a merge commit whose first parent is the
// unit's branch as the driver lands it, a commit merged onto it on the
// host's site unfetched among it, pushed where the driver lands through a
// host, then moved here — nothing where the branch holds the default
// branch already, and a merge even where the default branch holds the
// branch's tip, as after a reopen (E7). A conflict refuses the close,
// nothing moved or recorded, the merge begun in a worktree it names, every
// land verb waiting on it, and begun again where its folder is gone; once
// settled and finished there the close takes it, bringing in on top what
// the default branch gained since — refusing it not finished, and where
// the branch moved past it since. A step killed after its bring-up, or
// after its settlement reached the branch, is finished by the next,
// nothing made twice; a checkout holding changes the move would touch
// refuses before anything is pushed. The
// review phase's first round brings the default branch in and opens the
// unit's own pull request where the driver lands through a host, a later
// entry bringing nothing in, and one killed before its snapshot finished
// by the next with no second pull request (14.S18). The branch
// made is test-engine-unit-branch.cjs's; the review's reading of the
// change, test-engine-brief-review.cjs's; a phase's stack still merging
// over a bring-up, test-engine-landing-conformance-unit.cjs's; finish's
// conflict, test-engine-landing-conformance-unit-finish.cjs's; nested
// repositories, test-engine-landing-conformance-nested.cjs's.
// Conformance layer: the landing world (landing-world.cjs,
// `unitBranchLanded`), its unit's build begun through a cut of five phases
// and its first phase's start closed, `feat/pay` made, phase 1's task 1.1
// landed on it, built once per driver and copied for each test. This file
// names no driver and no tool. Budget: 39 s — each test walks a phase
// start's close or the review's entry whole on each driver, a merge made,
// pushed and moved, or begun in its worktree, settled and taken, a kill
// finished by the next (30 s probed, 37 to 39 s in loaded gate runs); each
// is a way through the bring-up no other suite takes.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, readManifest, createFile, commitCode, fixtureFrom, cleanupFixture, killedAt, refusedPristine, sectionOf } = harness;
const { UNIT, TASKS, openArgs, unitBranchLanded, startClosed, reviewReady, commitFiles } = require('./landing-world.cjs');
const { statePath } = require('./discovery-test-utils.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { total } = TASKS;
const BRANCH = `feat/${UNIT}`;

/** Where a step's merge is begun in the repository at `dir`: the worktree made for it. @param {string} dir */
const mergeTree = (dir) => path.join(fs.realpathSync(dir), '.git', 'ledger', 'feat-pay.merging');

/** A commit's parents and subject, in the repository at `dir`. @param {string} dir @param {string} commit */
const madeOf = (dir, commit) => git(dir, ['log', '-1', '--format=%P%n%s', commit]).trim().split('\n');

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, on: (dir: string) => string, pushed: (dir: string, into?: string) => void, holds: (dir: string, into?: string) => string[],
   *   unitPullOpen: (dir: string) => {base: string, title: string, body: string}[]|null, squashedHere: (dir: string, branch: string, into?: string) => void,
   *   mergedOnHost: ((dir: string, branch: string, method: 'merge'|'squash'|'rebase', pulled: boolean, into?: string) => boolean)|null,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const refuses = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, { env: side.env });
  const world = fixtureFrom(`landing-unit-landed-${name}-`, (dir) => unitBranchLanded(dir, side));

  describe(`a unit's own branch kept current through the ${name} landing driver (7.2.36)`, () => {
    /** @type {string|null} */
    let dir = null;
    afterEach(() => {
      if (dir !== null) cleanupFixture(dir);
      dir = null;
    });

    /** A copy of the world. @returns {string} */
    const project = () => {
      dir = world();
      return dir;
    };

    /** The default branch as the driver lands it, as a refusal names it. @param {string} at */
    const theirs = (at) => (side.on(at) === at ? 'main' : 'origin/main');

    /** A commit on the default branch here, writing `file`, pushed where the driver lands it: the default branch's tip there. @param {string} at @param {string} file @param {string} text */
    const mainMoves = (at, file, text) => {
      createFile(at, file, text);
      commitCode(at, `Write ${file}`);
      side.pushed(at);
      return tip(side.on(at), 'main');
    };

    /** feat/pay here and where the driver lands it. @param {string} at */
    const standing = (at) => ({ here: tip(at, BRANCH), there: tip(side.on(at), BRANCH) });

    /** Phase `phase`'s start closed with its one item marked, the close refused: its error. @param {string} at @param {number} phase */
    const refusedClose = (at, phase) => {
      ok(at, ['checklist', 'done', 'phase-start', UNIT, String(phase), 'design-settled']);
      return refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, String(phase)], { env: side.env }).error;
    };

    /** The merge begun in its worktree settled there, phase 1's card kept, and finished as the refusal says. @param {string} at */
    const settled = (at) => {
      const tree = mergeTree(at);
      git(tree, ['checkout', '-q', '--ours', 'card.txt']);
      git(tree, ['add', 'card.txt']);
      git(tree, ['-c', 'core.editor=true', 'merge', '--continue']);
      return tip(tree, 'HEAD');
    };

    /** Task 1.2 cut from feat/pay and opened onto it. @param {string} at */
    const totalOpened = (at) => {
      commitFiles(at, total.branch, BRANCH, total.files);
      ok(at, openArgs(total));
    };

    /** Task 1.2 squashed onto feat/pay by hand — on the host's site where the driver lands through one, this clone not fetched since, else here: feat/pay's tip where the driver lands it. @param {string} at */
    const totalSquashed = (at) => {
      if (side.mergedOnHost === null) side.squashedHere(at, total.branch, BRANCH);
      else side.mergedOnHost(at, total.branch, 'squash', false, BRANCH);
      return tip(side.on(at), BRANCH);
    };

    /** The refusal of the default branch conflicting with feat/pay at card.txt, the merge begun, the way on `then`. @param {string} at @param {string} so @param {string} then */
    const conflict = (at, so, then) => `${theirs(at)} conflicts with ${BRANCH} at card.txt, so ${theirs(at)} was not brought into ${BRANCH} and ${so} — the merge is begun at ${mergeTree(at)}, a worktree of its own: `
      + `settle each conflict there and finish the merge, as \`git -C ${mergeTree(at)} -c core.editor=true merge --continue\` does once they are, then ${then}, which takes it onto ${BRANCH}; every land verb in the repository waits on it until then, a quick-fix's among them`;

    it('a later phase\'s start brings the default branch into feat/pay by a merge commit whose first parent is feat/pay, where the driver lands it and here, nothing moving where feat/pay holds it already, nor before the start\'s items are done; the default branch holds none of phase 1\'s work (7.S40)', () => {
      const at = project();
      const landed = tip(side.on(at), BRANCH);
      startClosed(at, 2, side.env);
      const still = standing(at);
      const main = mainMoves(at, 'other.txt', 'other\n');
      const early = [refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '3'], { env: side.env }).error, standing(at)];
      startClosed(at, 3, side.env);
      const merged = tip(side.on(at), BRANCH);

      assert.deepStrictEqual({ still, early, made: madeOf(side.on(at), merged), here: tip(at, BRANCH), card: side.holds(at).includes('card.txt') }, {
        still: { here: landed, there: landed }, early: ['checklist close: phase-3-start has items open: design-settled', still], made: [`${landed} ${main}`, `Merge main into ${BRANCH}`], here: merged, card: false,
      });
    });

    it('the default branch and feat/pay are read as the driver lands them: a commit here the host lacks is never brought into feat/pay where it lands through a host, and is where the repository lands in itself; a task merged onto feat/pay on the host\'s site, this clone not fetched since, is the merge\'s first parent (7.2.36)', () => {
      const at = project();
      totalOpened(at);
      const merged = totalSquashed(at);
      const main = mainMoves(at, 'other.txt', 'other\n');
      createFile(at, 'unpushed.txt', 'mine\n');
      commitCode(at, 'Write what I have not pushed');
      startClosed(at, 2, side.env);
      const itself = side.on(at) === at;

      assert.deepStrictEqual([madeOf(side.on(at), tip(side.on(at), BRANCH))[0], side.holds(at, BRANCH).includes('unpushed.txt')], [`${merged} ${itself ? tip(at, 'main') : main}`, itself]);
    });

    it('a conflict refuses the close, nothing moved or recorded, naming the path and the worktree holding the merge begun; every land verb waits on it, and closing again before it is settled is refused, naming what still conflicts (7.S41)', () => {
      const at = project();
      const before = standing(at);
      const main = mainMoves(at, 'card.txt', 'card, rewritten\n');
      const refused = refusedClose(at, 2);
      const after = standing(at);
      const held = { merging: git(mergeTree(at), ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).trim(), conflicted: git(mergeTree(at), ['diff', '--name-only', '--diff-filter=U']).trim() };
      commitFiles(at, total.branch, BRANCH, total.files);
      const waits = refuses(at, openArgs(total)).error;
      const again = refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '2'], { env: side.env }).error;
      git(mergeTree(at), ['checkout', '-q', '--ours', 'card.txt']);
      git(mergeTree(at), ['add', 'card.txt']);
      const unfinished = refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '2'], { env: side.env }).error;
      fs.rmSync(mergeTree(at), { recursive: true, force: true });
      const begun = refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '2'], { env: side.env }).error;

      assert.deepStrictEqual({ refused, after, held, waits, again, unfinished, begun }, {
        refused: `checklist close: ${conflict(at, 'nothing was recorded', 'close phase 2\'s start again')}`,
        after: before,
        held: { merging: main, conflicted: 'card.txt' },
        waits: `land: the merge of the default branch into ${BRANCH} is held at ${mergeTree(at)}, so nothing moved — `
          + `settle each conflict there and finish the merge, as \`git -C ${mergeTree(at)} -c core.editor=true merge --continue\` does once they are, then close phase 2's start again, which takes it onto ${BRANCH}, and land again`,
        again: `checklist close: the merge into ${BRANCH} begun at ${mergeTree(at)} still conflicts at card.txt, so nothing moved — settle each conflict there and finish the merge, as \`git -C ${mergeTree(at)} -c core.editor=true merge --continue\` does once they are, then close phase 2's start again`,
        unfinished: `checklist close: the merge into ${BRANCH} begun at ${mergeTree(at)} is not finished, so nothing moved — settle each conflict there and finish the merge, as \`git -C ${mergeTree(at)} -c core.editor=true merge --continue\` does once they are, then close phase 2's start again`,
        begun: refused,
      });
    });

    it('a merge settled in its worktree that feat/pay moved past since — a task merged onto it by hand — is refused by the close run again, nothing moved, naming how to take the worktree apart, the way on closing again, which begins the merge again (7.S41)', () => {
      const at = project();
      totalOpened(at);
      mainMoves(at, 'card.txt', 'card, rewritten\n');
      refusedClose(at, 2);
      const settlement = settled(at);
      const squashed = totalSquashed(at);
      const moved = standing(at);
      const refused = refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '2'], { env: side.env }).error;

      assert.deepStrictEqual([refused, standing(at)], [
        `checklist close: ${BRANCH} moved to ${squashed.slice(0, 7)} since the merge into it was begun at ${mergeTree(at)}, and the merge settled there, ${settlement.slice(0, 7)}, holds none of that, so nothing moved — `
          + `take that worktree apart with \`git worktree remove ${mergeTree(at)}\`, then close phase 2's start again, which begins the merge again`,
        moved,
      ]);
    });

    it('a merge settled in its worktree is taken onto feat/pay by the close run again, which brings in on top what the default branch gained since — pushed where the driver lands it, moved here, the worktree taken apart and the close recorded (7.S41)', () => {
      const at = project();
      const landed = tip(at, BRANCH);
      const first = mainMoves(at, 'card.txt', 'card, rewritten\n');
      refusedClose(at, 2);
      const settlement = settled(at);
      const since = mainMoves(at, 'other.txt', 'other\n');
      ok(at, ['checklist', 'close', 'phase-start', UNIT, '2']);
      const now = tip(side.on(at), BRANCH);

      assert.deepStrictEqual({
        now: madeOf(side.on(at), now), settlement: madeOf(at, settlement), here: tip(at, BRANCH), tree: fs.existsSync(mergeTree(at)), closed: typeof readManifest(at, UNIT).checklists['phase-2-start'].closed,
      }, {
        now: [`${settlement} ${since}`, `Merge main into ${BRANCH}`], settlement: [`${landed} ${first}`, `Merge main into ${BRANCH}`], here: now, tree: false, closed: 'string',
      });
    });

    it('a start after the default branch took feat/pay whole, as after a reopen, still makes a merge commit, never a fast-forward, so feat/pay\'s first-parent line is kept (E7)', () => {
      const at = project();
      const landed = tip(at, BRANCH);
      git(at, ['merge', '-q', '--no-ff', '-m', `Merge ${BRANCH}`, BRANCH]);
      side.pushed(at);
      const main = tip(side.on(at), 'main');
      startClosed(at, 2, side.env);

      assert.deepStrictEqual(madeOf(side.on(at), tip(side.on(at), BRANCH)), [`${landed} ${main}`, `Merge main into ${BRANCH}`]);
    });

    it('a close killed after its bring-up, before it records itself, is finished by the next, which brings nothing in twice (kill safety)', () => {
      const at = project();
      const landed = tip(at, BRANCH);
      const main = mainMoves(at, 'other.txt', 'other\n');
      ok(at, ['checklist', 'done', 'phase-start', UNIT, '2', 'design-settled']);
      killedAt({ method: 'renameSync', file: path.join(UNIT, 'manifest.json'), when: 'before' }, at, ['checklist', 'close', 'phase-start', UNIT, '2'], { env: side.env });
      const killed = { ...standing(at), recorded: readManifest(at, UNIT).checklists['phase-2-start']?.closed ?? null };
      ok(at, ['checklist', 'close', 'phase-start', UNIT, '2']);

      assert.deepStrictEqual([madeOf(side.on(at), killed.there), killed.here === killed.there, killed.recorded, standing(at)], [
        [`${landed} ${main}`, `Merge main into ${BRANCH}`], true, null, { here: killed.there, there: killed.there },
      ]);
    });

    it('a settlement that reached feat/pay where the driver lands it before its step was killed is taken by the next, the worktree taken apart, nothing merged twice (kill safety)', () => {
      const at = project();
      mainMoves(at, 'card.txt', 'card, rewritten\n');
      refusedClose(at, 2);
      const settlement = settled(at);
      if (side.on(at) === at) git(at, ['update-ref', `refs/heads/${BRANCH}`, settlement]);
      else git(at, ['push', '-q', 'origin', `${settlement}:refs/heads/${BRANCH}`]);
      ok(at, ['checklist', 'close', 'phase-start', UNIT, '2']);

      assert.deepStrictEqual([standing(at), fs.existsSync(mergeTree(at))], [{ here: settlement, there: settlement }, false]);
    });

    it('feat/pay checked out with changes the bring-up would touch refuses the close before anything is pushed, naming them, the way on closing the start again', () => {
      const at = project();
      const before = standing(at);
      mainMoves(at, 'app.txt', 'app, rewritten\n');
      git(at, ['switch', '-q', BRANCH]);
      fs.writeFileSync(path.join(at, 'app.txt'), 'my own edit\n');
      const refused = refusedClose(at, 2);

      assert.deepStrictEqual([refused, standing(at)], [
        `checklist close: ${BRANCH} is checked out at ${fs.realpathSync(at)}, with changes not committed: app.txt, so nothing moved — commit them, or detach your checkout from ${BRANCH} with \`git switch --detach\`, which leaves it at ${before.here.slice(0, 7)} with its edits, and close phase 2's start again; switching your checkout back to ${BRANCH} is yours, when you're ready`,
        before,
      ]);
    });

    it('the review phase\'s first round brings the default branch into feat/pay and opens the unit\'s own pull request where the driver lands through a host, its base the default branch; a later entry brings nothing in (14.S18)', () => {
      const at = project();
      const main = mainMoves(at, 'other.txt', 'other\n');
      reviewReady(at);
      const base = sectionOf(harness.okSections(at, ['enter', 'review', UNIT], { env: side.env }).sections, 'DATA').split('\n').find((line) => line.startsWith('base: '));
      const brought = tip(side.on(at), BRANCH);
      mainMoves(at, 'later.txt', 'later\n');
      const again = ok(at, ['enter', 'review', UNIT]).entered;

      assert.deepStrictEqual({ brought: madeOf(side.on(at), brought)[0].split(' ')[1], later: [again, tip(side.on(at), BRANCH)], base, pull: side.unitPullOpen(at)?.map(({ base: onto, body }) => ({ onto, body })) ?? null }, {
        brought: main, later: [true, brought], base: 'base: main — the default branch, which the change is read against, the --base of each reader\'s brief',
        pull: side.on(at) === at ? null : [{ onto: 'main', body: 'Phase 1: Phase 1' }],
      });
    });

    it('a conflict refuses the review\'s first entry, nothing snapshotted or opened, its way on entering again, which takes the settlement and opens the pull request', () => {
      const at = project();
      mainMoves(at, 'card.txt', 'card, rewritten\n');
      reviewReady(at);
      const refused = refuses(at, ['enter', 'review', UNIT]).error;
      const snapshot = fs.existsSync(statePath(at, '.cache', UNIT, 'review', 'tree.json'));
      const opened = side.unitPullOpen(at);
      const settlement = settled(at);
      ok(at, ['enter', 'review', UNIT]);

      assert.deepStrictEqual({ refused, snapshot, opened, now: standing(at), pulls: side.unitPullOpen(at)?.length ?? 0 }, {
        refused: conflict(at, 'the review phase was not entered', 'enter the review again'), snapshot: false, opened: null, now: { here: settlement, there: settlement }, pulls: side.on(at) === at ? 0 : 1,
      });
    });

    it('a first entry killed after its bring-up, before its snapshot, is finished by the next, which brings nothing in twice and opens no second pull request (kill safety)', () => {
      const at = project();
      mainMoves(at, 'other.txt', 'other\n');
      reviewReady(at);
      killedAt({ method: 'renameSync', file: 'tree.json', when: 'before' }, at, ['enter', 'review', UNIT], { env: side.env });
      const killed = standing(at);
      ok(at, ['enter', 'review', UNIT]);

      assert.deepStrictEqual({ killed: madeOf(side.on(at), killed.there)[1], now: standing(at), snapshot: fs.existsSync(statePath(at, '.cache', UNIT, 'review', 'tree.json')), pulls: side.unitPullOpen(at)?.length ?? 0 }, {
        killed: `Merge main into ${BRANCH}`, now: killed, snapshot: true, pulls: side.on(at) === at ? 0 : 1,
      });
    });
  });
}
