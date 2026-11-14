'use strict';

// ---------------------------------------------------------------------------
// A unit's own branch decided and made (7.2.34, 7.2.35; leeway-engine/
// scripts/domain/unit-branch.cjs, through checklist.cjs): the first close of
// a phase's start of the build, for an epic or a feature whose cut then
// holds two or more phases, makes `feat/{unit}` at the default branch's tip
// where the driver lands it, before it is made here, and records it as
// `build.branch` — its tasks then laid out from it and landing on it; a
// bugfix, a feature of one phase and one whose cut gains a phase later get
// none. A branch of that name holding a commit the default branch lacks is
// refused as another's, nothing made or recorded; one holding nothing it
// lacks is taken, as a close killed after its push leaves it. A second
// clone readies the branch from the host's copy. What lands on the branch,
// and the branch landed at finish, are
// test-engine-landing-conformance-unit.cjs's.
// Conformance layer: the landing world (landing-world.cjs), its unit's
// build begun through a cut of five phases, none started, built once per
// driver and copied for each test. This file names no driver and no tool.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, readManifest, createFile, commitCode, fixtureFrom, cleanupFixture, killedAt, refusedPristine } = harness;
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, TASKS, openArgs, own, buildLanding, buildBegun, startClosed, phaseReviewed, commitFiles, cutOf } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card } = TASKS;
const BRANCH = `feat/${UNIT}`;

/** A branch's tip in the repository at `dir`, '' where it has none. @param {string} dir @param {string} branch */
const tipIn = (dir, branch) => git(dir, ['for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`]).trim();

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, on: (dir: string) => string, pushed: (dir: string, into?: string) => void, landed: (dir: string, into?: string) => {subject: string}[]}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, { env: side.env });
  const world = fixtureFrom(`engine-unit-branch-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
    buildBegun(dir, 5);
  });

  describe(`a unit's own branch through the ${name} landing driver (7.2.34, 7.2.35)`, () => {
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

    /** Where `feat/{unit}` stands: here, where the driver lands it, and as the manifest records it. @param {string} at */
    const standing = (at) => ({ here: tipIn(at, BRANCH), there: tipIn(side.on(at), BRANCH), recorded: readManifest(at, UNIT).build.branch ?? null });

    it('a feature cut into two phases or more: its first phase start\'s close makes feat/pay at the default branch\'s tip where the driver lands it, records it, and its tasks open onto it and land there, the default branch untouched (7.S31, 7.S32)', () => {
      const at = project();
      const main = tip(at, 'main');
      const closed = startClosed(at, 1, side.env);
      const made = standing(at);
      const opened = own(ok(at, openArgs(card)));
      phaseReviewed(at, 1, 'auto');
      ok(at, ['land', 'phase', UNIT, '1']);

      const landing = tipIn(side.on(at), BRANCH);

      assert.deepStrictEqual({
        branch: closed.branch, made, base: opened.base, landed: side.landed(at, BRANCH).map(({ subject }) => subject), recorded: readManifest(at, UNIT).landings['pay-1-1']['.'].commit, main: tipIn(side.on(at), 'main'),
      }, {
        branch: BRANCH, made: { here: main, there: main, recorded: BRANCH }, base: BRANCH, landed: ['feat(pay): Add card'], recorded: landing, main,
      });
    });

    it('a bugfix, a feature of one phase, and one whose cut gains a phase after its first start: nothing made or recorded, its tasks landing on the default branch (7.S31, 7.S35)', () => {
      const at = project();
      buildBegun(at, 2, 'bugfix');
      const bugfix = [startClosed(at, 1, side.env).branch, standing(at)];
      buildBegun(at, 1);
      createManifest(at, UNIT, { ...readManifest(at, UNIT), checklists: {} });
      const single = [startClosed(at, 1, side.env).branch, standing(at)];
      createManifest(at, UNIT, { ...readManifest(at, UNIT), cut: cutOf(2) });
      const grown = [startClosed(at, 2, side.env).branch, standing(at)];
      const none = { here: '', there: '', recorded: null };

      assert.deepStrictEqual([bugfix, single, grown, own(ok(at, openArgs(card))).base], [[undefined, none], [undefined, none], [undefined, none], 'main']);
    });

    it('a branch of that name holding a commit the default branch lacks is another\'s: the close refused, naming it and where it is, nothing made or recorded — one holding nothing it lacks taken, brought to the default branch\'s tip (7.S36)', () => {
      const at = project();
      commitFiles(side.on(at), BRANCH, 'main', { 'theirs.txt': 'theirs\n' }, { message: 'Their own work' });
      const where = side.on(at) === at ? 'here' : 'on origin';
      ok(at, ['checklist', 'done', 'phase-start', UNIT, '1', 'design-settled']);
      const before = standing(at);
      const refused = refusedPristine(at, ['checklist', 'close', 'phase-start', UNIT, '1'], { env: side.env });
      const after = standing(at);
      git(side.on(at), ['update-ref', `refs/heads/${BRANCH}`, 'landing-base']);
      createFile(at, 'moved.txt', 'moved\n');
      commitCode(at, 'Main moves on');
      side.pushed(at);
      const main = tip(at, 'main');
      ok(at, ['checklist', 'close', 'phase-start', UNIT, '1']);

      assert.deepStrictEqual([refused.error, after, standing(at)], [
        `checklist close: ${BRANCH} ${where} holds commits main lacks, so it is no branch the unit made: nothing was made and nothing was recorded — delete or rename it ${where === 'here' ? 'here' : 'there'}, and close phase 1's start again`,
        before,
        { here: main, there: main, recorded: BRANCH },
      ]);
    });

    it('a close killed after the branch is made, before it records it, leaves a branch the next close takes and records, where the driver lands it as here (kill safety)', () => {
      const at = project();
      const main = tip(at, 'main');
      ok(at, ['checklist', 'done', 'phase-start', UNIT, '1', 'design-settled']);
      killedAt({ method: 'renameSync', file: path.join(UNIT, 'manifest.json'), when: 'before' }, at, ['checklist', 'close', 'phase-start', UNIT, '1'], { env: side.env });
      const killed = standing(at);
      if (side.on(at) !== at) git(at, ['branch', '-q', '-D', BRANCH]);
      ok(at, ['checklist', 'close', 'phase-start', UNIT, '1']);

      assert.deepStrictEqual([killed, standing(at)], [{ here: main, there: main, recorded: null }, { here: main, there: main, recorded: BRANCH }]);
    });

    it('a second clone lacking the branch, here and as last fetched, readies it from where the driver lands it at its next phase start, cutting none anew (7.S39)', () => {
      const at = project();
      startClosed(at, 1, side.env);
      ok(at, openArgs(card));
      phaseReviewed(at, 1, 'auto');
      ok(at, ['land', 'phase', UNIT, '1']);
      const landed = tipIn(side.on(at), BRANCH);
      if (side.on(at) !== at) {
        git(at, ['branch', '-q', '-D', BRANCH]);
        git(at, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
      }
      startClosed(at, 2, side.env);

      assert.deepStrictEqual(standing(at), { here: landed, there: landed, recorded: BRANCH });
    });
  });
}
