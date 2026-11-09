'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch as GitHub has it, the
// truth for what its pull request holds (R15; leeway-engine/scripts/domain/
// fix-branch.cjs, landing.cjs, over drivers/landing/github/), past what
// every driver gives (the landing conformance suites' quick-fix): the
// commits GitHub's copy holds brought in — a review's suggestion committed
// on the pull request's page, and the site's update of the branch, though
// it holds no change the branch here lacks, each kept by the next push and
// landing with the squash. A suggestion conflicting with a commit here is
// test-landing-quick-fix-host-conflict.cjs's; a second clone, and a push
// leased against the head it read, -host-clone's. Git layer:
// quick-fix-world.cjs's two fixes built on a fake GitHub (world.cjs), their
// pull request #1 open, built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, SET, fixChanged, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, madeOnGithub } = require('./world.cjs');
const lg = require('../../../skills/leeway-engine/scripts/domain/landing-git.cjs');

const { ok, git, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-host-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-host-config-');
const SUGGESTED = 'const flag = \'colour\'; // suggested\n';

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 made through the door, as `fixChanged` makes it. */
const third = () => fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());

/** Whether GitHub's copy of a branch holds `commit`. @param {string} commit @param {string} branch */
const holdsOnGithub = (commit, branch) => lg.isAncestor(bareOf(dir), commit, branch);

/**
 * The third fix opened, what `opened` reads then, then done, every fix
 * recorded and the close made: what `opened` read.
 * @template T @param {() => T} opened @returns {T}
 */
function closedWithThird(opened) {
  ok(dir, ['land', 'open', UNIT, '1.3'], as());
  const read = opened();
  ok(dir, ['task', 'done', UNIT, '1.3'], as());
  fixesRecorded(dir, 3, as());
  ok(dir, ['finish', 'yes', UNIT], as());
  return read;
}

describe('a quick-fix\'s branch as GitHub has it, the truth for what its pull request holds (R15)', () => {
  it('a review\'s suggestion committed on the pull request\'s page is kept by the next fix\'s push, and lands with the squash', () => {
    dir = world();
    const suggestion = madeOnGithub(dir, BRANCH, { [SET[0].file]: SUGGESTED }, `Update ${SET[0].file}`);
    third();
    const held = closedWithThird(() => holdsOnGithub(suggestion, BRANCH));

    assert.deepStrictEqual([held, git(bareOf(dir), ['show', `main:${SET[0].file}`])], [true, SUGGESTED]);
  });

  it('the site\'s update of the branch, merging main into it where main moved by nothing the branch lacks, is kept by the next fix\'s push, and the close lands the fixes over main as it moved', () => {
    dir = world();
    const bare = bareOf(dir);
    const moved = git(bare, ['commit-tree', 'main^{tree}', '-p', 'main', '-m', 'Another change']).trim();
    git(bare, ['update-ref', 'refs/heads/main', moved]);
    const tree = lg.mergeTree(bare, git(bare, ['merge-base', BRANCH, 'main']).trim(), BRANCH, 'main');
    const update = git(bare, ['commit-tree', /** @type {{tree: string}} */ (tree).tree, '-p', BRANCH, '-p', 'main', '-m', `Merge branch 'main' into ${BRANCH}`]).trim();
    git(bare, ['update-ref', `refs/heads/${BRANCH}`, update]);
    third();
    const held = closedWithThird(() => holdsOnGithub(update, BRANCH));

    assert.deepStrictEqual([held, git(bare, ['log', '-1', '--format=%P', 'main']).trim(), git(bare, ['diff', '--name-only', moved, 'main']).trim().split('\n')], [true, moved, SET.map(({ file }) => file).sort()]);
  });
});
