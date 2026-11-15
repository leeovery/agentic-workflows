'use strict';

// ---------------------------------------------------------------------------
// The landing record of a task whose branch was rewritten after its
// landing (task-landed.cjs, `apart`, 7.2.22), against each shipped driver
// in turn. A task no driver took, squashed by hand and read by a verb,
// whose branch is then rewritten past the default branch, no longer
// holding its landing point, is refused by `land open`, `land phase` and
// `land finish` alike, before anything moves, naming the commit that
// landed and the way on — its work laid on that commit — while another
// phase lands; its way on followed, its conflict settled the branch's way,
// squashed or merged by a merge commit, the rewrite lands, its branch
// holding that commit, its record's first landing the one by hand. One
// the driver took, squashed by hand, its branch then rebased onto the
// default branch and given a fix, changed after its landing, lands the
// fix, its first landing the squash (N1). A branch merged into past its
// landing is test-engine-landing-conformance-record-merged-past.cjs's; a
// verb that refuses, and a record that fails,
// test-engine-landing-conformance-record-refusals.cjs's. Conformance layer:
// the landing world (landing-world.cjs), built once per driver and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, BASE, TASKS, openArgs, own, commitFiles, buildLanding, followedOn, finishReady, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

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
  const world = fixtureFrom(`engine-landing-record-rewritten-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** The refusal of 1.1's branch apart from its landing, whose commit `landed` landed at `landing`. @param {string} landing @param {string} landed */
  const rewrittenRefusal = (landing, landed) => `land: task 1.1's branch ${card.branch} has moved apart from where its work landed on main (${short(landing)}): its commit ${short(landed)} landed, which the branch lacks — `
    + `lay ${card.branch}'s own work on that commit with \`git rebase ${short(landed)} ${card.branch}\`, and open the task with \`land open ${UNIT} 1.1\``;
  /**
   * Whether 1.1's branch holds its commit `landed`, the card on that branch
   * and on the default branch, and 1.1's record: who landed it, its first
   * landing and its commit.
   * @param {string} at @param {string} landed
   */
  const rewriteLanded = (at, landed) => {
    const { by, first, commit } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
    return [git(at, ['rev-list', card.branch]).split('\n').includes(landed), ...[card.branch, 'main'].map((rev) => git(at, ['show', `${rev}:card.txt`])), [by, first, commit]];
  };
  /** `rewriteLanded`'s answer where the engine landed the rewrite at the default branch's tip, its first landing `landing`, by hand. @param {string} at @param {string} landing */
  const landedOver = (at, landing) => [true, 'card, rewritten\n', 'card, rewritten\n', ['engine', landing, tip(at, 'main')]];

  describe(`the ${name} landing driver's landing record of a task whose branch was rewritten after its landing (7.2.22)`, () => {
    it('a task no driver took, squashed by hand and read by a verb, then its branch rewritten past the default branch: land open, land phase and land finish each refuse before anything moves, naming the commit that landed and the way on, and land phase lands another phase all the same; the way on followed, land finish lands the rewrite, the branch holding that commit, the landing by hand its record\'s first', () => {
      const at = (dir = world());
      ok(at, openArgs(rounding));
      const landed = tip(at, card.branch);
      side.squashedHere(at, card.branch);
      const landing = tip(at, 'main');
      ok(at, openArgs(card));
      commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusals = [openArgs(card), ['land', 'phase', UNIT, '1']].map((args) => refused(at, args));
      const stood = [tip(at, 'main')];
      const other = own(ok(at, ['land', 'phase', UNIT, '2'])).merged;
      const otherLanded = tip(at, 'main');
      finishReady(at);
      refusals.push(refused(at, ['land', 'finish', UNIT]));
      stood.push(tip(at, 'main'));
      followedOn(at, card.branch, refusals[2], side.env);
      ok(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([refusals, stood, other, rewriteLanded(at, landed)], [Array(3).fill(rewrittenRefusal(landing, landed)), [landing, otherLanded], ['2.1'], landedOver(at, landing)]);
    });

    it('a task no driver took, merged by hand by a merge commit and read by a verb, then its branch rewritten past the default branch: land open refuses, naming the commit that landed and the way on; followed, land phase lands the rewrite, the branch holding that commit, the landing by hand its record\'s first', () => {
      const at = (dir = world());
      const landed = tip(at, card.branch);
      side.mergedHere(at, card.branch);
      const landing = tip(at, 'main');
      ok(at, openArgs(card));
      commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      const refusal = refused(at, openArgs(card));
      followedOn(at, card.branch, refusal, side.env);
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([refusal, merged, rewriteLanded(at, landed)], [rewrittenRefusal(landing, landed), ['1.1'], landedOver(at, landing)]);
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
  });
}
