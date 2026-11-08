'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's fix laid on fixes merged by
// hand on GitHub's site, merged back through the door
// (leeway-engine/scripts/domain/landing.cjs, over drivers/landing/github/;
// commit-task.cjs): a fix in flight when the fixes below it land, main here
// not pulled, refused its opening, naming the merge back of main there,
// fetched, through the door under the fix — merged back so, it opens alone
// onto main there, its pull request holding its own change alone
// (`inflight-nopull`, R12 (d)); and a fix opened over the fixes below,
// those merged by squash, main here not pulled, the fix changing the line
// the lowest changed, its merge at the close conflicting on GitHub —
// refused, naming the merge back of main there through the door under the
// fix, which takes it done with main here behind, and landed once that is
// pushed (`conflict-way-on`, R12 (d)). The set collapsed on the site is
// test-landing-quick-fix-site.cjs's; a fix laid on one landed, on every
// driver, quick-fix-laid-on.cjs's.
// Git layer: quick-fix-world.cjs's two fixes built on a fake GitHub
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, CHAIN, fixChanged, twoFixesBuilt, fixesRecorded, mergedBack, guardedGit } = require('../../scripts/quick-fix-world.cjs');
const { taskBranch } = require('../../../skills/leeway-engine/scripts/domain/landing-names.cjs');
const side = require('./landing.cjs');
const { GH_ENV, mergeByHand, headDeleted, bareOf } = require('./world.cjs');

const { ok, git, refuses, readManifest, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-merge-back-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-merge-back-config-');

let dir = ''; // the project

/** Fix 1.3 changing the line fix 1.1 changed. */
const SAME = Object.freeze({ title: 'Spell the flag in full', file: CHAIN[0].file, text: 'const flag = \'colour\'; // the British spelling\n' });

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** What a pull request on GitHub holds against main there: the files its head changes past where it leaves main. @param {string} branch */
const pullHolds = (branch) => {
  const bare = bareOf(dir);
  return git(bare, ['diff', '--name-only', git(bare, ['merge-base', 'main', branch]).trim(), branch]).trim().split('\n');
};

/** The fixes below 1.3 merged by squash on the site, 1.1's branch deleted, so GitHub retargets 1.2's onto main. */
function belowMerged() {
  mergeByHand(dir, 1);
  headDeleted(dir, 1);
  mergeByHand(dir, 2);
}

describe('a quick-fix\'s fix laid on fixes merged by hand on GitHub\'s site, merged back through the door (R12 (d))', () => {
  it('in flight when the fixes below it land, main here not pulled: refused its opening, naming the merge back of main on GitHub through the door; merged back, it opens alone onto main there, holding its own change alone, and lands', () => {
    dir = world();
    fixChanged(dir, 3, CHAIN[2].title, CHAIN[2].file, CHAIN[2].text, as());
    belowMerged();
    const refusal = refuses(dir, ['land', 'open', UNIT, '1.3'], as()).error;
    mergedBack(dir, 'origin/main', 3, as(), { [CHAIN[2].file]: CHAIN[2].text });
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    const branch = taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', CHAIN[2].title);
    const holds = pullHolds(branch);
    ok(dir, ['task', 'done', UNIT, '1.3'], as());
    fixesRecorded(dir, 3, as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.match(refusal, new RegExp(`^land: task 1\\.3's branch ${branch} does not descend from the chain's tip, origin/main \\([0-9a-f]{7}\\) — merge origin/main back into ${branch} through the door, under the fix — `));
    assert.deepStrictEqual([holds, readManifest(dir, UNIT).status, side.holds(dir).includes(CHAIN[2].file)], [[CHAIN[2].file], 'completed', true]);
  });

  it('opened over them and done before they land, main here not pulled, changing 1.1\'s line: its merge at the close refused for the conflict on GitHub, naming the merge back of main there through the door under the fix, which takes it done with main here behind; pushed, the close lands it', () => {
    dir = world();
    fixChanged(dir, 3, SAME.title, SAME.file, SAME.text, as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    ok(dir, ['task', 'done', UNIT, '1.3'], as());
    belowMerged();
    fixesRecorded(dir, 3, as());
    const refusal = refuses(dir, ['finish', 'yes', UNIT], as()).error;
    const branch = taskBranch({ unit: UNIT, phase: 1, n: 3 }, 'fix', SAME.title);
    guardedGit(dir, ['fetch', 'origin', 'main'], as());
    const behind = git(dir, ['rev-parse', 'main']).trim() !== git(dir, ['rev-parse', 'origin/main']).trim();
    mergedBack(dir, 'origin/main', 3, as(), { [SAME.file]: SAME.text });
    guardedGit(dir, ['push', 'origin', branch], as());
    ok(dir, ['finish', 'yes', UNIT], as());

    assert.strictEqual(refusal, `finish yes: land: task 1.3's pull request #3 conflicts with main on GitHub, so phase 1's stack was not merged — merge origin/main back into ${branch} through the door, under the fix — `
      + `with it out, \`git merge --no-ff --no-commit origin/main\`, settling any conflict, then \`engine commit --paths <file>… --task ${UNIT} 1.3 -m "<message>"\`, push it, and land again`);
    assert.deepStrictEqual([behind, readManifest(dir, UNIT).status, git(bareOf(dir), ['show', `main:${SAME.file}`]), side.holds(dir).includes(CHAIN[1].file)], [true, 'completed', SAME.text, true]);
  });
});
