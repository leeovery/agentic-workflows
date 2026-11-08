'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's set merged by hand on GitHub's
// site (leeway-engine/scripts/domain/landing.cjs, finish.cjs, over
// drivers/landing/github/), past test-landing-quick-fix.cjs: the stack
// collapsed top down, each pull request into its own base as the site's
// button merges it — each into the branch below, then the lowest onto
// main, each branch deleted as it merges — each fix then read as landed by
// its change on main there, whatever its commit names, a fix not yet done
// then done with its branch gone, its own work read where its pull request
// recorded it and its commits where the deleted branch leaves them, and
// the close made (`top-down`, `branch-gone`, R12 (a), (b)); and the stack
// merged one at a time, the site deleting each merged branch, so GitHub
// retargets the next onto main, merged whole there while main here lacks
// it — the close refused, naming the landing of the fixes' phase, the
// driver's own way to bring main here to a merge (R5) — and, once landed
// so, the close drawn, its yes saying the fixes have landed, and made
// (19.5.15, `follow-retarget`). A fix laid on fixes merged there, merged
// back through the door, is test-landing-quick-fix-merge-back.cjs's.
// Git layer: quick-fix-world.cjs's two fixes built on a fake GitHub
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, CHAIN, fixChanged, twoFixesBuilt, fixesRecorded, closeYes } = require('../../scripts/quick-fix-world.cjs');
const { taskBranch } = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const side = require('./landing.cjs');
const { GH_ENV, mergeByHand, headDeleted, pulls } = require('./world.cjs');

const { ok, git, refuses, readManifest, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-site-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-site-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 made and opened over 1.2. */
function thirdOpened() {
  dir = world();
  fixChanged(dir, 3, CHAIN[2].title, CHAIN[2].file, CHAIN[2].text, as());
  ok(dir, ['land', 'open', UNIT, '1.3'], as());
}

describe('a quick-fix\'s set merged by hand on GitHub\'s site (R5, R12)', () => {
  for (const method of /** @type {const} */ (['squash', 'merge'])) {
    it(`collapsed top down by ${method}, each branch deleted as it merges — 1.3's pull request into 1.2's branch, 1.2's into 1.1's, then 1.1's onto main: each read as landed by its change on main, 1.3 done with its branch gone, and the close made`, () => {
      thirdOpened();
      for (const n of [3, 2, 1]) {
        mergeByHand(dir, n, undefined, method);
        side.deleted(dir, taskBranch({ unit: UNIT, phase: 1, n }, 'fix', CHAIN[n - 1].title));
      }
      git(dir, ['pull', '-q', '--ff-only', 'origin', 'main']);
      ok(dir, ['task', 'done', UNIT, '1.3'], as());
      fixesRecorded(dir, 3, as());
      const yes = closeYes(dir, as());
      ok(dir, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([yes, readManifest(dir, UNIT).status, pulls(dir).length], ['Close it — its fixes have landed, so mark it complete', 'completed', 3]);
    });
  }

  it('merged one at a time, the site deleting each merged branch, so GitHub retargets the next onto main: the close refused, once all are, naming the landing of their phase, which brings the default branch here to them — and then drawn, its yes saying they have landed, and made', () => {
    thirdOpened();
    for (const n of [1, 2, 3]) {
      mergeByHand(dir, n);
      headDeleted(dir, n);
    }
    ok(dir, ['task', 'done', UNIT, '1.3'], as());
    fixesRecorded(dir, 3, as());
    const refusal = refuses(dir, ['render', 'finish', UNIT], as()).error;
    ok(dir, ['land', 'phase', UNIT, '1'], as());
    const yes = closeYes(dir, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.deepStrictEqual([refusal, yes], [
      `render finish: ${UNIT}'s fixes are merged where they land, and main here lacks them — land phase ${UNIT} 1 brings main to them`,
      'Close it — its fixes have landed, so mark it complete',
    ]);
    assert.deepStrictEqual([readManifest(dir, UNIT).status, git(dir, ['ls-tree', '-r', '--name-only', 'main', 'src/', 'docs/']).trim().split('\n')], [
      'completed', [CHAIN[2].file, CHAIN[0].file, CHAIN[1].file],
    ]);
  });
});
