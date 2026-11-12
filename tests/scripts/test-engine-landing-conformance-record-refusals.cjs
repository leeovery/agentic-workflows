'use strict';

// ---------------------------------------------------------------------------
// The landing record where a `land` verb refuses or its record fails
// (landing-record.cjs, 7.2.22), against each shipped driver in turn. A
// refusal records nothing where nothing moved, as every refusal leaves the
// state as it found it; one after a merge records what that merge landed,
// by the engine, and nothing its read found landed by hand. A task no
// driver took, squashed by hand, whose branch is rewritten past the default
// branch before any verb read it is refused by `land open`, `land phase`
// and `land finish` alike, before anything moves, naming the commit that
// landed and the way on, while another phase lands; its way on followed,
// squashed or merged by a merge commit, the rewrite lands, its branch
// losing none of it, the landing by hand never recorded, its record's
// first landing the engine's (F1). One the driver
// took, squashed by hand, its branch then rebased onto the default branch
// and given a fix, changed after its landing, lands the fix, its first
// landing the squash (N1). One no driver took, rewritten before it landed,
// then given a commit and the default branch merged back, was never
// rewritten past its landing: it opens, and lands that commit. A record not
// written after a merge leaves the verb's answer standing, a warning beside
// it, and the next verb acting on the landing records the task by its read.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, withEnv, fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, BASE, TASKS, openArgs, own, cutTask, commitFiles, mergeBack, buildLanding, finishReady, followRemedy, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { workMessage } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');
const { parseShownTask } = require('../../skills/leeway-engine/scripts/domain/task-id.cjs');

const { card, rounding } = TASKS;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[],
   *   byHand: Record<string, (dir: string, branch: string) => void>, squashedHere: (dir: string, branch: string) => void,
   *   mergedHere: (dir: string, branch: string) => void,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const refused = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, as).error;
  const world = fixtureFrom(`engine-landing-record-refusals-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** The unit's landing records in the project's repository, each task's as `by`. @param {string} at */
  const recordedBy = (at) => Object.fromEntries(Object.entries(readManifest(at, UNIT).landings ?? {}).map(([id, byRepo]) => [id, /** @type {any} */ (byRepo)['.'].by]));
  /** The state branch's newest commit's subject. @param {string} at */
  const lastState = (at) => stateGit(at, ['log', '-1', '--format=%s']).trim();
  /** F1's refusal of 1.1, whose commit `landed` landed at `landing`. @param {string} landing @param {string} landed */
  const rewrittenRefusal = (landing, landed) => `land: task 1.1's branch ${card.branch} was rewritten after its work landed on main (${short(landing)}): its commit ${short(landed)} landed, and the branch no longer holds it — `
    + `on ${card.branch}, merge that commit in keeping the branch's work, as \`git merge -s ours ${short(landed)}\` does, then merge main into it, as \`git merge main\` does, settling any conflict the branch's way, `
    + `and open the task with \`land open ${UNIT} 1.1\``;
  /**
   * F1's way on, as `refusal` names it, followed as the person would: on
   * 1.1's branch, out at the project's checkout, each conflict of its merge
   * settled the branch's way — the checkout put back after.
   * @param {string} at @param {string} refusal
   */
  const wayOn = (at, refusal) => {
    const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(at, ['switch', '-q', card.branch]);
    withEnv(side.env, () => followRemedy(at, refusal, (there) => {
      git(there, ['checkout', '--ours', '--', '.']);
      git(there, ['add', '-u']);
      git(there, ['commit', '-q', '--no-edit']);
    }));
    git(at, ['switch', '-q', back]);
  };
  /**
   * Whether 1.1's branch holds its commit `rewrite` still, the card on that
   * branch and on the default branch, and 1.1's record: who landed it, its
   * first landing and its commit.
   * @param {string} at @param {string} rewrite
   */
  const rewriteLanded = (at, rewrite) => {
    const { by, first, commit } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
    return [git(at, ['rev-list', card.branch]).split('\n').includes(rewrite), ...[card.branch, 'main'].map((rev) => git(at, ['show', `${rev}:card.txt`])), [by, first, commit]];
  };
  /** `rewriteLanded`'s answer where the engine landed the rewrite at the default branch's tip, its first landing that one. @param {string} at */
  const landedByEngine = (at) => [true, 'card, rewritten\n', 'card, rewritten\n', ['engine', tip(at, 'main'), tip(at, 'main')]];

  describe(`the ${name} landing driver's landing record where a verb refuses or its record fails (7.2.22)`, () => {
    it('a refusal records nothing where nothing moved: the state branch as it was', () => {
      const at = (dir = world());
      const before = lastState(at);
      refused(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([readManifest(at, UNIT).landings, lastState(at)], [undefined, before]);
    });

    it('a refusal after a merge records what that merge landed and nothing else: land finish merges phase 1, then refuses on phase 4\'s conflict with it, 1.1 recorded by the engine, 2.1 landed by hand after the last verb unrecorded', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      ok(at, openArgs(cutTask(at, '4.1', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' })));
      Object.values(side.byHand)[0](at, rounding.branch);
      finishReady(at);
      refused(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([recordedBy(at), lastState(at)], [{ [`${UNIT}-1-1`]: 'engine' }, `land(${UNIT}): record 1.1 landed`]);
    });

    it('a task no driver took, squashed by hand, then its branch rewritten past the default branch before any verb read it: land open, land phase and land finish each refuse before anything moves, naming the commit that landed and the way on, and land phase lands another phase all the same; the way on followed, land finish lands the rewrite, the branch losing none of it, the landing by hand unrecorded (F1)', () => {
      const at = (dir = world());
      ok(at, openArgs(rounding));
      const landed = tip(at, card.branch);
      side.squashedHere(at, card.branch);
      const landing = tip(at, 'main');
      const rewrite = commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusals = [openArgs(card), ['land', 'phase', UNIT, '1']].map((args) => refused(at, args));
      const stood = [tip(at, 'main')];
      const other = own(ok(at, ['land', 'phase', UNIT, '2'])).merged;
      const otherLanded = tip(at, 'main');
      finishReady(at);
      refusals.push(refused(at, ['land', 'finish', UNIT]));
      stood.push(tip(at, 'main'));
      wayOn(at, refusals[2]);
      ok(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([refusals, stood, other, rewriteLanded(at, rewrite)], [Array(3).fill(rewrittenRefusal(landing, landed)), [landing, otherLanded], ['2.1'], landedByEngine(at)]);
    });

    it('a task no driver took, merged by hand by a merge commit, then its branch rewritten past the default branch before any verb read it: land open refuses, naming the commit that landed and the way on; followed, land phase lands the rewrite, the branch losing none of it, the landing by hand unrecorded (F1)', () => {
      const at = (dir = world());
      const landed = tip(at, card.branch);
      side.mergedHere(at, card.branch);
      const landing = tip(at, 'main');
      const rewrite = commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusal = refused(at, openArgs(card));
      wayOn(at, refusal);
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([refusal, merged, rewriteLanded(at, rewrite)], [rewrittenRefusal(landing, landed), ['1.1'], landedByEngine(at)]);
    });

    it('a task the driver took, squashed by hand, its branch then rebased onto the default branch — its commit dropped there as applied — and given a fix: changed after its landing, never rewritten past it, land phase lands the fix, its first landing the squash (N1)', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      Object.values(side.byHand)[0](at, card.branch);
      const landing = tip(at, 'main');
      const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
      git(at, ['rebase', '-q', 'main', card.branch]);
      git(at, ['switch', '-q', back]);
      commitFiles(at, card.branch, card.branch, { 'card-fix.txt': 'fixed\n' });
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;
      const { first, tip: recorded } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];

      assert.deepStrictEqual([merged, side.holds(at).includes('card-fix.txt'), first, recorded], [['1.1'], true, landing, tip(at, card.branch)]);
    });

    it('a task no driver took, rewritten before it landed by hand — its commit reworded — then given a commit and the default branch merged back: no rewrite past its landing, land open opens it and land phase lands that commit (F1)', () => {
      const at = (dir = world());
      commitFiles(at, card.branch, `${card.branch}^`, card.files, { message: workMessage('Add the card, reworded', parseShownTask(UNIT, '1.1')) });
      side.squashedHere(at, card.branch);
      commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      mergeBack(at, card.branch, 'main');
      ok(at, openArgs(card));

      assert.deepStrictEqual([own(ok(at, ['land', 'phase', UNIT, '1'])).merged, side.holds(at).includes('card-more.txt')], [['1.1'], true]);
    });

    it('a record not written after a merge leaves the verb\'s answer standing, a warning beside it, and the next verb acting on the landing records the task by its read', (t) => {
      const at = (dir = world());
      ok(at, openArgs(card));
      const write = fs.writeFileSync;
      t.mock.method(fs, 'writeFileSync', (/** @type {fs.PathOrFileDescriptor} */ file, /** @type {string} */ text, /** @type {fs.WriteFileOptions} */ options) => {
        if (String(file).endsWith('.tmp') && String(text).includes('"landings"')) throw new Error('the disk is full');
        return write(file, text, options);
      });
      const merged = ok(at, ['land', 'phase', UNIT, '1']);
      t.mock.restoreAll();
      const unrecorded = readManifest(at, UNIT).landings;
      const again = ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([own(merged).merged, merged.warnings.filter((/** @type {string} */ said) => said.startsWith('the landing record')), unrecorded, again.already, recordedBy(at)], [
        ['1.1'], ['the landing record was not written (the disk is full) — the next verb acting on the landing records it'], undefined, true, { [`${UNIT}-1-1`]: 'read' },
      ]);
    });
  });
}
