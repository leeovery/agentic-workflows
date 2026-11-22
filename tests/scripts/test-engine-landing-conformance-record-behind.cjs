'use strict';

// ---------------------------------------------------------------------------
// A recorded task's branch behind its landing (task-landed.cjs, `apart`),
// against each shipped driver in turn. Landed by the engine,
// its branch then made again at the commit below its recorded tip, never
// having stood there, as a second clone's leaves it: its landing's tip
// holds it, so it has nothing new — `land phase` answers already and `land
// finish` lands nothing, the default branch keeping all it landed. Landed
// by the engine with a commit of the person's own on its branch, its
// branch then made again below that commit with new work: `land open`
// refuses before anything moves, naming the commit that landed and the way
// on — its own work laid on that commit, pushed over its copy on the host
// where the host holds one; followed, `land phase` lands the new work, the
// default branch keeping the person's commit. One stale behind commits of
// the task's own is test-engine-landing-conformance-record-stale.cjs's.
// Conformance layer: the landing world (landing-world.cjs), built once per
// driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, TASKS, openArgs, own, commitFiles, buildLanding, followedOn, finishReady, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/ledger-engine/scripts/domain/drivers.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

for (const { name } of listDrivers('landing')) {
  /**
   * @type {{
   *   env: Record<string, string|undefined>, prepare: (dir: string) => void, holds: (dir: string) => string[], defaultTip: (dir: string) => string,
   *   pulled: (dir: string) => void, pushedOver: (dir: string, branch: string) => string|null,
   * }}
   */
  const side = require(path.join(__dirname, '..', 'drivers', name, 'landing.cjs'));
  const as = { env: side.env };
  const ok = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.ok(at, args, as);
  const refused = (/** @type {string} */ at, /** @type {string[]} */ args) => harness.refuses(at, args, as).error;
  const world = fixtureFrom(`engine-landing-record-behind-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });
  /** 1.1's record. @param {string} at */
  const recordOf = (at) => readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
  /** 1.1's branch made again at `commit`, writing no reflog, as a clone that never held its tip makes it. @param {string} at @param {string} commit */
  const madeAgainAt = (at, commit) => {
    git(at, ['branch', '-q', '-D', card.branch]);
    git(at, ['-c', 'core.logAllRefUpdates=false', 'branch', '-q', card.branch, commit]);
  };

  describe(`the ${name} landing driver's landing record of a task whose branch is behind its landing`, () => {
    it('landed by the engine, its branch then made again at the commit below its recorded tip, never having stood there: it has nothing new — land phase answers already and land finish lands nothing, the default branch keeping all it landed, its record as it was', () => {
      const at = (dir = world());
      commitFiles(at, card.branch, card.branch, { 'extra.txt': 'extra\n' });
      ok(at, openArgs(card));
      ok(at, PHASE);
      const landed = [side.defaultTip(at), recordOf(at)];
      madeAgainAt(at, tip(at, `${card.branch}~1`));
      const again = ok(at, PHASE).already;
      finishReady(at);
      ok(at, ['land', 'finish', UNIT]);

      assert.deepStrictEqual([again, [side.defaultTip(at), recordOf(at)], ['card.txt', 'extra.txt'].map((file) => side.holds(at).includes(file))], [true, landed, [true, true]]);
    });

    it('landed by the engine with a commit of the person\'s own on its branch, its branch then made again below that commit with new work: land open refuses before anything moves, naming the commit that landed and the way on — its own work laid on that commit, pushed over its copy on the host where the host holds one; followed, land phase lands the new work, the default branch keeping the person\'s commit', () => {
      const at = (dir = world());
      const mine = commitFiles(at, card.branch, card.branch, { 'own.txt': 'own\n' }, { message: 'my own on it' });
      ok(at, openArgs(card));
      ok(at, PHASE);
      side.pulled(at);
      const { commit: landing } = recordOf(at);
      madeAgainAt(at, `${mine}^`);
      commitFiles(at, card.branch, card.branch, { 'more.txt': 'more\n' });
      const push = side.pushedOver(at, card.branch);
      const state = () => [side.defaultTip(at), recordOf(at), stateGit(at, ['rev-parse', 'HEAD']).trim()];
      const before = state();
      const refusal = refused(at, openArgs(card));
      const stood = state();
      followedOn(at, card.branch, refusal, side.env);
      const merged = own(ok(at, PHASE)).merged;

      assert.deepStrictEqual([refusal, stood, merged, ['card.txt', 'own.txt', 'more.txt'].map((file) => side.holds(at).includes(file))], [
        `land: task 1.1's branch ${card.branch} has moved apart from where its work landed on main (${short(landing)}): its commit ${short(mine)} landed, which the branch lacks — `
          + `lay ${card.branch}'s own work on that commit with \`git rebase ${short(mine)} ${card.branch}\`${push === null ? '' : `, push it with \`${push}\``}, and open the task with \`land open ${UNIT} 1.1\``,
        before, ['1.1'], [true, true, true],
      ]);
    });
  });
}
