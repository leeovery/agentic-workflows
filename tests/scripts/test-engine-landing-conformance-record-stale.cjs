'use strict';

// ---------------------------------------------------------------------------
// A recorded task's branch stale behind commits of the task's own that
// landed (task-landed.cjs, `apart`), against each shipped driver in turn:
// the engine lands 1.1 with one commit, or two, made after its first, then
// its branch is made again below them, as a second clone fetched before
// them leaves it, and given new work — a commit stamped with the task, or
// the person's own. Its landing's tip holds commits stamped with the task
// that the branch lacks, as a rewrite dropping them would leave it, so the
// two are never told apart: `land open` refuses before anything moves,
// naming the commit that landed and the way on — the branch's work laid on
// that commit, pushed over its copy on the host where the host holds one —
// and followed, `land phase` lands the new work, the default branch keeping
// every commit that landed. Conformance layer: the landing world
// (landing-world.cjs), built once per driver and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { tip, git, fixtureFrom, cleanupFixture, readManifest, stateGit } = harness;
const { UNIT, TASKS, openArgs, own, commitFiles, buildLanding, followedOn, short } = require('./landing-world.cjs');
const { listDrivers } = require('../../skills/leeway-engine/scripts/domain/drivers.cjs');

const { card } = TASKS;
const PHASE = ['land', 'phase', UNIT, '1'];

/** The commits 1.1 lands after its first, each its file: one, or two. */
const LATER = { 'one commit': ['extra.txt'], 'two commits': ['extra.txt', 'extra2.txt'] };

/** The new work on the stale branch: a commit stamped with the task, or the person's own. @type {Record<string, {message?: string}>} */
const NEW_WORK = { 'stamped with the task': {}, 'of the person\'s own': { message: 'more by hand' } };

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
  const world = fixtureFrom(`engine-landing-record-stale-${name}-`, (dir) => {
    buildLanding(dir);
    side.prepare(dir);
  });
  /** @type {string|null} */
  let dir = null;
  afterEach(() => {
    if (dir !== null) cleanupFixture(dir);
    dir = null;
  });

  describe(`the ${name} landing driver's landing record of a task whose branch is stale behind commits of its own that landed`, () => {
    for (const [later, files] of Object.entries(LATER)) {
      for (const [work, opts] of Object.entries(NEW_WORK)) {
        it(`landed by the engine with ${later} after its first, its branch then made again below them, given new work ${work}: land open refuses before anything moves, naming the commit that landed and the way on — its work laid on that commit; followed, land phase lands the new work, the default branch keeping all that landed`, () => {
          const at = (dir = world());
          for (const file of files) commitFiles(at, card.branch, card.branch, { [file]: `${file}\n` });
          ok(at, openArgs(card));
          ok(at, PHASE);
          side.pulled(at);
          const { commit: landing, tip: landed } = readManifest(at, UNIT).landings[`${UNIT}-1-1`]['.'];
          const stale = tip(at, `${card.branch}~${files.length}`);
          git(at, ['branch', '-q', '-D', card.branch]);
          git(at, ['-c', 'core.logAllRefUpdates=false', 'branch', '-q', card.branch, stale]);
          commitFiles(at, card.branch, card.branch, { 'more.txt': 'more\n' }, opts);
          const push = side.pushedOver(at, card.branch);
          const state = () => [side.defaultTip(at), stateGit(at, ['rev-parse', 'HEAD']).trim()];
          const before = state();
          const refusal = refused(at, openArgs(card));
          const stood = state();
          followedOn(at, card.branch, refusal, side.env);
          const merged = own(ok(at, PHASE)).merged;

          assert.deepStrictEqual([refusal, stood, merged, ['card.txt', ...files, 'more.txt'].map((file) => side.holds(at).includes(file))], [
            `land: task 1.1's branch ${card.branch} has moved apart from where its work landed on main (${short(landing)}): its commit ${short(landed)} landed, which the branch lacks — `
              + `lay ${card.branch}'s own work on that commit with \`git rebase ${short(landed)} ${card.branch}\`${push === null ? '' : `, push it with \`${push}\``}, and open the task with \`land open ${UNIT} 1.1\``,
            before, ['1.1'], Array(files.length + 2).fill(true),
          ]);
        });
      }
    }
  });
}
