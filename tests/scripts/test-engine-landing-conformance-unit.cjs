'use strict';

// ---------------------------------------------------------------------------
// The landing conformance suite for the phases of a unit with a branch of
// its own (7.3.4; leeway-engine/scripts/domain/landing.cjs, `repoContext`):
// each phase's tasks land on `feat/{unit}`, the default branch untouched —
// a phase landed there taking a new task, opened onto it and landed there
// by the phase's next land phase (7.2.30); one of its tasks merged onto it
// by hand, on the host's site where the driver lands through one, read
// landed there, the phase's merge landing the rest (7.2.37, 7.S32); and a
// task's branch merged into past its landing refused, its way on making it
// again on the unit's branch as the driver lands it with its own commits
// since, which followed lands them there, the default branch's own change
// left out; and a later phase's start bringing the default branch into the
// unit's branch under the phase's open stack, which still merges onto it
// (7.2.36, 7.S42). The
// branch decided and made is test-engine-unit-branch.cjs's; the branch
// landed at finish, test-engine-landing-conformance-unit-finish.cjs's.
// Conformance layer: the landing world (landing-world.cjs,
// `unitBranchLanded`), its unit's build begun through a cut of five phases
// and its first phase's start closed, `feat/pay` made, phase 1's task 1.1
// landed on it, built once per driver and copied for each test. This file
// names no driver and no tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, createFile, commitCode, fixtureFrom, cleanupFixture } = harness;
const { UNIT, BASE, TASKS, openArgs, own, cutTask, unitBranchLanded, startClosed, mergeBack, commitFiles, followedOn, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card, total } = TASKS;
const BRANCH = `feat/${UNIT}`;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, on: (dir: string) => string, pushed: (dir: string, into?: string) => void,
   *   landed: (dir: string, into?: string) => {subject: string, task: string|null}[], squashedHere: (dir: string, branch: string, into?: string) => void,
   *   mergedOnHost: ((dir: string, branch: string, method: 'merge'|'squash'|'rebase', pulled: boolean, into?: string) => boolean)|null,
   *   holds: (dir: string, into?: string) => string[], pushedOver: (dir: string, branch: string) => string|null,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const refuses = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, { env: side.env });
  const world = fixtureFrom(`engine-landing-unit-${name}-`, (dir) => unitBranchLanded(dir, side));

  describe(`the phases of a unit with its own branch, through the ${name} landing driver (7.2.30, 7.2.37)`, () => {
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

    /** feat/pay as the driver lands it, as this clone reads it. @param {string} at */
    const unitRef = (at) => (side.on(at) === at ? BRANCH : `origin/${BRANCH}`);

    it('a phase landed on feat/pay takes a new task, opened onto feat/pay and landed there with the phase\'s next land phase, the default branch untouched (7.2.30)', () => {
      const at = project();
      const main = tip(side.on(at), 'main');
      commitFiles(at, total.branch, unitRef(at), total.files);
      const opened = own(ok(at, openArgs(total))).base;
      ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([opened, side.landed(at, BRANCH).map(({ subject }) => subject), tip(side.on(at), 'main')], [BRANCH, ['feat(pay): Add card', 'feat(pay): Show total'], main]);
    });

    it('phase 2\'s start bringing the default branch into feat/pay while phase 1\'s stack is open leaves the stack merging onto feat/pay after the bring-up, the default branch untouched by it (7.S42)', () => {
      const at = project();
      commitFiles(at, total.branch, unitRef(at), total.files);
      ok(at, openArgs(total));
      createFile(at, 'other.txt', 'other\n');
      commitCode(at, 'Another change');
      side.pushed(at);
      const main = tip(side.on(at), 'main');
      startClosed(at, 2, side.env);
      ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([git(side.on(at), ['log', '--reverse', '--first-parent', '--format=%s', `${BASE}..${BRANCH}`]).trim().split('\n').map((subject) => subject.replace(/ \(#\d+\)$/, '')), side.holds(at, BRANCH).includes('other.txt'), tip(side.on(at), 'main')], [
        ['feat(pay): Add card', `Merge main into ${BRANCH}`, 'feat(pay): Show total'], true, main,
      ]);
    });

    it('a task of a phase merged onto feat/pay by hand — squashed on the host\'s site where its pull request is open there, else here — reads landed there, the phase\'s merge landing the rest on feat/pay, the default branch untouched (7.S32)', () => {
      const at = project();
      const main = tip(side.on(at), 'main');
      commitFiles(at, total.branch, unitRef(at), total.files);
      const tax = cutTask(at, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
      ok(at, openArgs(total));
      ok(at, openArgs(tax));
      if (side.mergedOnHost === null) side.squashedHere(at, total.branch, BRANCH);
      else side.mergedOnHost(at, total.branch, 'squash', false, BRANCH);
      ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([side.landed(at, BRANCH).map(({ subject }) => subject), tip(side.on(at), 'main')], [
        ['feat(pay): Add card', side.mergedOnHost === null ? 'Spell it the British way' : 'feat(pay): Show total', 'feat(pay): Add tax'], main,
      ]);
    });

    it('a task\'s branch merged into past its landing on feat/pay is refused, its way on making it again on feat/pay as the driver lands it with its own commits since; followed, the phase lands them on feat/pay, the default branch\'s own change left out of it', () => {
      const at = project();
      createFile(at, 'other.txt', 'other\n');
      commitCode(at, 'Another change');
      side.pushed(at);
      const main = tip(side.on(at), 'main');
      const landed = tip(at, card.branch);
      const landing = tip(side.on(at), BRANCH);
      mergeBack(at, card.branch, 'main');
      const merge = tip(at, card.branch);
      const more = commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      const theirs = unitRef(at);
      const push = side.pushedOver(at, card.branch);
      const refusal = refuses(at, openArgs(card)).error;
      followedOn(at, card.branch, refusal, side.env);
      ok(at, openArgs(card));
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([refusal, merged, ['card-more.txt', 'other.txt'].map((file) => side.holds(at, BRANCH).includes(file)), tip(side.on(at), 'main')], [
        `land: task 1.1's branch ${card.branch} merged ${short(merge)} past its work's landing on ${BRANCH} (${short(landing)}), at its commit ${short(landed)}, and nothing is read past a merge — `
          + `make ${card.branch} again on ${theirs} with its own commits since that one, leaving out the merge and what it brought in, with \`git switch --no-track -C ${card.branch} ${theirs}\` then \`git cherry-pick ${short(more)}\``
          + `${push === null ? '' : `, push it with \`${push}\``}, and open the task with \`land open ${UNIT} 1.1\``,
        ['1.1'], [true, false], main,
      ]);
    });
  });
}
