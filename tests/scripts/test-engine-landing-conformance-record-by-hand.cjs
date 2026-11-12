'use strict';

// ---------------------------------------------------------------------------
// The landing record of a task landed by hand (landing-record.cjs, 7.2.22,
// R30), through the `land` verbs, against each shipped driver in turn. A
// task landed by hand — on the host, where the driver has one, the default
// branch here not brought to it — then given a commit of its own past it,
// is the read's: a verb landing another phase, which brings the default
// branch here up to that landing, records it by its read at the commit that
// landed, never at its branch's tip, and the next verb landing its phase
// lands that commit; its branch rewritten instead, that verb records it so
// from the commit its driver took; landed so under its default message,
// which names it, `land phase` brings that landing here and lands the
// commit, the record at the engine's merge, the newest commit naming it.
// A phase squashed by hand under the person's own message, its task then
// changed, lands that change by the engine with its first landing kept the
// person's squash, the review's change drawing the task's part from before
// it. Conformance layer: the landing world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, withEnv, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, BASE, TASKS, openArgs, own, commitFiles, buildLanding } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { changeOf } = require('../../skills/leeway-engine/scripts/domain/review-change.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { card, rounding } = TASKS;

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[],
   *   byHandUnpulled: (dir: string, branch: string) => void, phaseByHand: Record<string, (dir: string, phase: number) => void>,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-by-hand-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** Card's landing record. @param {string} at */
  const cardRecord = (at) => readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
  /** A commit's subject, a host's pull request's number aside. @param {string} at @param {string} sha */
  const subject = (at, sha) => git(at, ['log', '-1', '--format=%s', sha]).trim().replace(/ \(#\d+\)$/, '');

  describe(`the ${name} landing driver's record of a task landed by hand (7.2.22, R30)`, () => {
    it('a task landed by hand, the default branch here not brought to it, then a commit of its own past it: a verb landing another phase records it by its read at the commit that landed, and the next landing its phase lands that commit', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      const landed = tip(at, card.branch);
      side.byHandUnpulled(at, card.branch);
      commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      ok(at, ['land', 'phase', UNIT, '2']);
      const { by, tip: recorded } = cardRecord(at);
      const merged = own(ok(at, ['land', 'phase', UNIT, '1'])).merged;

      assert.deepStrictEqual([by, recorded, merged, side.holds(at).includes('card-more.txt')], ['read', landed, ['1.1'], true]);
    });

    it('a task landed by hand, the default branch here not brought to it, then its branch rewritten: a verb landing another phase records it by its read at the commit that landed, from the commit its driver took', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      const landed = tip(at, card.branch);
      side.byHandUnpulled(at, card.branch);
      commitFiles(at, card.branch, BASE, { 'card.txt': 'card, rewritten\n' });
      ok(at, ['land', 'phase', UNIT, '2']);
      const { by, tip: recorded } = cardRecord(at);

      assert.deepStrictEqual([by, recorded], ['read', landed]);
    });

    it('a task landed by hand under its default message, which names it, the default branch here not brought to it, then a commit of its own past it: land phase brings that landing here and lands the commit, the record at the engine\'s merge, the newest commit naming it', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      side.byHandUnpulled(at, card.branch);
      commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      ok(at, ['land', 'phase', UNIT, '1']);
      const { by, commit } = cardRecord(at);

      assert.deepStrictEqual([by, commit], ['engine', tip(at, 'main')]);
    });

    it('a phase squashed by hand under the person\'s own message, its task then changed: land phase lands the change by the engine, its first landing kept the person\'s squash, and the review\'s change draws its part from before that squash', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      side.phaseByHand['a squash under the person\'s own message'](at, 1);
      commitFiles(at, card.branch, card.branch, { 'card-more.txt': 'more\n' });
      ok(at, ['land', 'phase', UNIT, '1']);
      const { by, first, commit } = cardRecord(at);
      const drawn = withEnv(side.env, () => changeOf(at, UNIT, 1, null, projectRepos(at), [])).holding.flatMap(({ parts }) => parts.map(({ from, to }) => [from, to]));

      assert.deepStrictEqual([by, subject(at, first), commit === first, drawn], ['engine', 'In my own words', false, [[tip(at, `${first}^`), commit]]]);
    });
  });
}
