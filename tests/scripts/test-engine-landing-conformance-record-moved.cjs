'use strict';

// ---------------------------------------------------------------------------
// A recorded task whose branch moved after its landing with no change of
// its own (landing-record.cjs, 7.2.22, R29), through the `land` verbs,
// against each shipped driver in turn: its last commit reworded, its branch
// rebased with no change, the default branch merged back into it once that
// moved on, then its branch rebased onto it — it stays landed after each,
// read at the default branch's tip and at its landing, the record's own
// commit, and `land phase` merges nothing. A change of its own past its
// landing, which lands again, is test-engine-landing-conformance-record.cjs's.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git, tip, fixtureFrom, cleanupFixture, readManifest } = harness;
const { UNIT, TASKS, openArgs, commitFiles, buildLanding, mergeBack } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');
const { unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const { workMessage } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { card, rounding } = TASKS;
const CARD = { unit: UNIT, phase: 1, n: 1 };

for (const { name } of listDrivers('landing')) {
  /** @type {{env: Record<string, string|undefined>, prepare: (dir: string) => void, byHand: Record<string, (dir: string, branch: string) => void>}} */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const world = fixtureFrom(`engine-landing-record-moved-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** Card's branch rebased onto `onto` by git itself, every commit made again, the checkout put back. @param {string} at @param {string} onto */
  const rebased = (at, onto) => {
    const back = git(at, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(at, ['rebase', '-q', '--force-rebase', onto, card.branch]);
    git(at, ['switch', '-q', back]);
  };

  describe(`the ${name} landing driver's recorded task, its branch moved with no change of its own (7.2.22, R29)`, () => {
    it('reworded, rebased with no change, the default branch merged back once it moved on, then rebased onto it: landed after each, at the default branch\'s tip and at its landing, and land phase merges nothing', () => {
      const at = (dir = world());
      ok(at, openArgs(card));
      ok(at, openArgs(rounding));
      ok(at, ['land', 'phase', UNIT, '1']);
      const { commit } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
      const [repo] = projectRepos(at);
      /** Whether card reads landed at the default branch's tip and at its landing. */
      const landed = () => {
        const read = unitLanded(at, UNIT, [repo], null);
        return [tip(at, 'main'), commit].map((rev) => read.on(repo, rev).task(CARD).landed);
      };
      const reads = [];

      commitFiles(at, card.branch, `${card.branch}^`, card.files, { message: workMessage('Add the card, worded better', CARD) });
      reads.push(landed());
      rebased(at, `${card.branch}^`);
      reads.push(landed());
      Object.values(side.byHand)[0](at, rounding.branch);
      mergeBack(at, card.branch, 'main');
      reads.push(landed());
      rebased(at, 'main');
      reads.push(landed());
      const main = tip(at, 'main');
      const again = ok(at, ['land', 'phase', UNIT, '1']);

      assert.deepStrictEqual([reads, again.already, tip(at, 'main')], [Array(4).fill([true, true]), true, main]);
    });
  });
}
