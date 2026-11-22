'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite for a unit's own branch landed at finish
// (7.3.4; ledger-engine/scripts/domain/landing.cjs, `finishMerge`): finish's
// yes lands the phases still standing onto `feat/{unit}`, then the branch
// on the default branch by one merge commit, `Merge feat/{unit}` described
// by the phases merged into it — the default branch's history holding each
// task's squash, its first-parent line one commit for the unit — and
// completes the unit (7.2.38, 7.S33); a branch landed by hand, by a squash
// or a merge commit, read landed whatever the default branch changed
// since, nothing more landed (7.2.39, 7.S34); a host allowing no merge
// commits refused before anything lands (7.S38), but not where the branch
// landed by hand; a conflict the default branch brought into the branch
// cannot settle refused after the phases, naming them, the merge begun in a
// worktree it names, which once settled there finish's yes again takes onto
// the branch and lands (7.S43); and a
// yes killed after the unit landed finishing on its next run, landing
// nothing twice. The phases landing on the branch are
// test-engine-landing-conformance-unit.cjs's.
// Conformance layer: the landing world (landing-world.cjs,
// `unitBranchLanded`), its unit's build begun through a cut of five phases
// and its first phase's start closed, `feat/pay` made, phase 1's task 1.1
// landed on it, built once per driver and copied for each test. This file
// names no driver and no tool. Budget: 38 s — each test walks finish's yes
// whole on each driver, from the phases still standing to the unit's
// landing, the conflict's and the kill's twice (29 s probed, 35 to 38 s in
// loaded gate runs); each is a way the unit's branch lands, or is read
// landed, that no other suite takes.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, readManifest, createFile, commitCode, fixtureFrom, cleanupFixture, killedAt } = harness;
const { UNIT, BASE, TASKS, openArgs, unitBranchLanded, finishReady, commitFiles } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { rounding, currency } = TASKS;
const BRANCH = `feat/${UNIT}`;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, on: (dir: string) => string, pushed: (dir: string, into?: string) => void,
   *   landed: (dir: string, into?: string) => {subject: string, task: string|null}[], squashedHere: (dir: string, branch: string, into?: string) => void,
   *   mergedHere: (dir: string, branch: string, into?: string) => void, noMergeCommits: ((dir: string) => void)|null,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const refuses = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, { env: side.env });
  const world = fixtureFrom(`landing-unit-landed-${name}-`, (dir) => unitBranchLanded(dir, side));

  describe(`a unit's own branch landed at finish through the ${name} landing driver (7.2.38, 7.2.39)`, () => {
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

    /** The default branch's first-parent line past the base where the driver lands it, oldest first, each commit's message, GitHub's " (#N)" aside. @param {string} at */
    const unitLine = (at) => git(side.on(at), ['log', '--reverse', '--first-parent', '--format=%B%x1e', `${BASE}..main`]).split('\x1e').map((message) => message.trim().replace(/ \(#\d+\)$/m, '')).filter(Boolean);

    /** The tasks the default branch's history holds a squash of, where the driver lands it. @param {string} at */
    const squashes = (at) => side.landed(at).filter(({ task }) => task !== null).map(({ subject }) => subject);

    /** feat/pay as the driver lands it, as this clone reads it. @param {string} at */
    const unitRef = (at) => (side.on(at) === at ? BRANCH : `origin/${BRANCH}`);

    /** Phase 2, and phase 3 unless `alone`, cut from feat/pay as phase 1 left it where the driver lands it, as Claude cuts them then, and opened, the unit readied for finish. @param {string} at @param {boolean} [alone] */
    const twoMore = (at, alone = false) => {
      commitFiles(at, rounding.branch, unitRef(at), rounding.files);
      ok(at, openArgs(rounding));
      if (!alone) {
        commitFiles(at, currency.branch, rounding.branch, currency.files);
        ok(at, openArgs(currency));
      }
      finishReady(at);
    };

    /** A change made on the default branch here and pushed where the driver lands it: card.txt written otherwise. @param {string} at */
    const mainRewrites = (at) => {
      createFile(at, 'card.txt', 'a card, rewritten\n');
      commitCode(at, 'Rewrite the card');
      side.pushed(at);
    };

    it('finish\'s yes lands the phases still standing onto feat/pay, then feat/pay on the default branch by one merge commit described by its phases, and completes the unit (7.S33)', () => {
      const at = project();
      twoMore(at);
      const { landed } = ok(at, ['finish', 'yes', UNIT]);

      assert.deepStrictEqual({
        landed: landed.map((/** @type {any} */ { repo, into, phases, landed: unit }) => ({ repo, into, ...(phases === undefined ? { landed: unit } : { phases: phases.map((/** @type {{phase: number}} */ each) => each.phase) }) })),
        line: unitLine(at),
        squashes: squashes(at),
        status: readManifest(at, UNIT).status,
      }, {
        landed: [{ repo: '.', into: BRANCH, phases: [2, 3] }, { repo: '.', into: 'main', landed: BRANCH }],
        line: [`Merge ${BRANCH}\n\nPhase 1: Phase 1\nPhase 2: Phase 2\nPhase 3: Phase 3`],
        squashes: ['feat(pay): Add card', 'fix(pay): Round totals', 'fix(pay): Name the currency'],
        status: 'completed',
      });
    });

    it('feat/pay landed by hand, squashed or by a merge commit, reads landed whatever the default branch changed since, a host allowing no merge commits refusing nothing: nothing more lands, and the unit completes (7.S34)', () => {
      const ways = /** @type {const} */ (['squashedHere', 'mergedHere']).map((way) => {
        const at = project();
        finishReady(at);
        side.noMergeCommits?.(at);
        side[way](at, BRANCH, 'main');
        side.pushed(at);
        mainRewrites(at);
        const before = tip(side.on(at), 'main');
        const done = ok(at, ['finish', 'yes', UNIT]);
        const read = [done.landed, tip(side.on(at), 'main') === before, readManifest(at, UNIT).status];
        cleanupFixture(at);
        dir = null;
        return read;
      });

      assert.deepStrictEqual(ways, [[[], true, 'completed'], [[], true, 'completed']]);
    });

    if (side.noMergeCommits !== null) {
      const noMerges = side.noMergeCommits;
      it('a host allowing no merge commits refuses finish before anything lands, naming the settings and both ways to make them, by hand or through the verb that allows them (7.S38)', () => {
        const at = project();
        twoMore(at, true);
        noMerges(at);
        const before = [tip(side.on(at), BRANCH), tip(side.on(at), 'main')];
        const { error } = refuses(at, ['finish', 'yes', UNIT]);

        assert.deepStrictEqual([error, [tip(side.on(at), BRANCH), tip(side.on(at), 'main')]], [
          `finish yes: land: acme/portal does not allow merge commits, and ${BRANCH} lands on main by one, so it did not land — on each repository the project lands in on GitHub, make "Pull request title and description" squash merging's default commit message and tick "Allow merge commits" — by hand under Settings → General → Pull Requests, or through Ledger, as \`engine github-squash yes\` does, and say yes at finish again`,
          before,
        ]);
      });
    }

    it('a conflict with the default branch refuses the unit\'s landing after the phases, naming them and the worktree holding the merge begun, its way on finish\'s yes again; once settled there, the yes again takes it onto feat/pay and lands it (7.S43)', () => {
      const at = project();
      twoMore(at);
      mainRewrites(at);
      const theirs = side.on(at) === at ? 'main' : 'origin/main';
      const tree = path.join(fs.realpathSync(at), '.git', 'ledger', 'feat-pay.merging');
      const { error } = refuses(at, ['finish', 'yes', UNIT]);
      const held = side.landed(at, BRANCH).map(({ subject }) => subject);
      git(tree, ['checkout', '-q', '--ours', 'card.txt']);
      git(tree, ['add', 'card.txt']);
      git(tree, ['-c', 'core.editor=true', 'merge', '--continue']);
      const settlement = tip(tree, 'HEAD');
      ok(at, ['finish', 'yes', UNIT]);

      assert.deepStrictEqual([error, held, unitLine(at).map((message) => message.split('\n')[0]), git(side.on(at), ['rev-parse', 'main^2']).trim(), fs.existsSync(tree), readManifest(at, UNIT).status], [
        `finish yes: land: ${theirs} conflicts with ${BRANCH} at card.txt, so ${theirs} was not brought into ${BRANCH} and ${UNIT} did not land on main — the merge is begun at ${tree}, a worktree of its own: `
          + `settle each conflict there and finish the merge, as \`git -C ${tree} -c core.editor=true merge --continue\` does once they are, then say yes at finish again, which takes it onto ${BRANCH}; every land verb in the repository waits on it until then, a quick-fix's among them (phase 2, 3 merged in the project before it)`,
        ['feat(pay): Add card', 'fix(pay): Round totals', 'fix(pay): Name the currency'],
        ['Rewrite the card', `Merge ${BRANCH}`],
        settlement,
        false,
        'completed',
      ]);
    });

    it('a yes killed after the unit landed finishes on its next run, landing nothing twice (kill safety)', () => {
      const at = project();
      twoMore(at);
      killedAt({ method: 'renameSync', file: path.join(UNIT, 'manifest.json'), when: 'before' }, at, ['finish', 'yes', UNIT], { env: side.env });
      const killed = [unitLine(at).length, readManifest(at, UNIT).status];
      ok(at, ['finish', 'yes', UNIT]);

      assert.deepStrictEqual([killed, unitLine(at).length, readManifest(at, UNIT).status], [[1, 'in-progress'], 1, 'completed']);
    });
  });
}
