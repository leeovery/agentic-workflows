'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's set (leeway-engine/scripts/
// domain/finish.cjs, over drivers/landing/github/), past what every driver
// gives (the landing conformance suite's quick-fix): the set's stack merged
// by hand on GitHub's site one pull request at a time, squashed or by a
// merge commit, each into its own base as the site's button merges it — each
// fix's landing read by its change on main there (R12), so a fix opened over
// one merged is done, and a pull request merged into the branch of the one
// below, never reaching main, is no landing: the close counts it still to
// land, and its yes opens it again onto main from its branch there and
// merges it — what was merged into that branch since landing with it —
// completing the unit (`follow-base`, `follow-site`). A fix's pull request
// closed by hand there, its done and its close refused in the landing's
// words, each opening on its own verb. The stack collapsed by hand, and the
// site deleting each merged branch, are test-landing-quick-fix-site.cjs's; a
// fix in flight when its stack lands, and a conflict on GitHub's merge,
// test-landing-quick-fix-merge-back.cjs's; the close itself,
// test-engine-quick-fix-close.cjs's. Git layer: quick-fix-world.cjs's two
// fixes built on a fake GitHub (world.cjs), built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, CHAIN, fixChanged, twoFixesBuilt, fixesRecorded, closeYes } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, mergeByHand, closeByHand, pulls } = require('./world.cjs');

const { ok, refuses, readManifest, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 opened over 1.2, #1 merged by hand by `method` on the site meanwhile, then done, and the three recorded with finish's checklist closed. @param {'squash'|'merge'} method */
function thirdOverFirstMerged(method) {
  dir = world();
  fixChanged(dir, 3, CHAIN[2].title, CHAIN[2].file, CHAIN[2].text, as());
  ok(dir, ['land', 'open', UNIT, '1.3'], as());
  mergeByHand(dir, 1, undefined, method);
  ok(dir, ['task', 'done', UNIT, '1.3'], as());
  fixesRecorded(dir, 3, as());
}

/** The fixes' files main on GitHub holds. */
const onMain = () => side.holds(dir).filter((file) => CHAIN.some((fix) => fix.file === file)).sort();

describe('a quick-fix\'s close on GitHub (R12)', () => {
  for (const method of /** @type {const} */ (['squash', 'merge'])) {
    it(`its fixes merged by hand there one at a time, by ${method}, each into its own base as the site's button merges it: a fix opened over the first done meanwhile; the close counting the two merged into the branch below still to land, its yes opening 1.2's again onto main from its branch there and merging it, 1.3's merged into that branch landing with it`, () => {
      thirdOverFirstMerged(method);
      for (const n of [2, 3]) mergeByHand(dir, n, undefined, method);
      const yes = closeYes(dir, as());
      ok(dir, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([yes, readManifest(dir, UNIT).status, onMain(), pulls(dir).slice(3)], [
        'Close it — merge its pull requests and mark it complete', 'completed', [CHAIN[2].file, CHAIN[1].file, CHAIN[0].file].sort(),
        [{ number: 4, state: 'MERGED', base: 'main' }],
      ]);
    });
  }
});

describe('a quick-fix\'s fix on GitHub', () => {
  it('its pull request closed by hand there: its done and its close refused in the landing\'s words, each opening on its own verb', () => {
    dir = world();
    fixChanged(dir, 3, 'Spell the docs --colour', 'docs/flags.md', '--colour\n', as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    closeByHand(dir, 3);
    const words = 'task 1.3\'s pull request #3 was closed on GitHub without being merged — reopen it there, as `gh pr reopen 3` does, and land again';

    assert.deepStrictEqual([refuses(dir, ['task', 'done', UNIT, '1.3'], as()).error, refuses(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Not wanted.'], as()).error], [
      `task done: ${words}`, `task close: ${words}`,
    ]);
  });
});
