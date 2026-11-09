'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch as GitHub has it, the
// truth for what its pull request holds (R15; leeway-engine/scripts/domain/
// fix-branch.cjs, landing.cjs, over drivers/landing/github/), where this
// checkout lacks it or GitHub's moves after the read: a second clone, which
// never had the branch, taking GitHub's at its first start, so no fix in
// the pull request is dropped; and the opening's push leased against the
// head it read, so one moved on GitHub after the read is refused, nothing
// pushed over it. The commits GitHub's copy holds brought in are
// test-landing-quick-fix-host.cjs's. Git layer: quick-fix-world.cjs's two
// fixes built on a fake GitHub (world.cjs), their pull request #1 open,
// built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, SET, fixChanged, fixDone, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, tipOnGithub, madeOnGithub } = require('./world.cjs');
const lg = require('../../../skills/leeway-engine/scripts/domain/landing-git.cjs');
const { landOpen } = require('../../../skills/leeway-engine/scripts/domain/landing.cjs');

const { ok, git, withEnv, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-host-clone-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-host-clone-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 made through the door, as `fixChanged` makes it. */
const third = () => fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());

/** The third fix opened and done, every fix recorded and the close made. */
function closedWithThird() {
  ok(dir, ['land', 'open', UNIT, '1.3'], as());
  fixDone(dir, '1.3', as());
  fixesRecorded(dir, 3, as());
  ok(dir, ['finish', 'yes', UNIT], as());
}

describe('a quick-fix\'s branch as GitHub has it, where this checkout lacks it or it moves after the read (R15)', () => {
  it('a second clone, which never had the branch, takes GitHub\'s as it stands at its first start, main there moved on since, so the close lands every fix in the pull request', () => {
    dir = world();
    madeOnGithub(dir, 'main', { 'src/other.js': 'const other = 1;\n' }, 'Another change');
    git(dir, ['switch', '-q', 'main']);
    git(dir, ['branch', '-q', '-D', BRANCH]);
    git(dir, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
    const host = tipOnGithub(dir, BRANCH);
    third();
    const taken = git(dir, ['rev-parse', `${BRANCH}~1`]).trim();
    closedWithThird();

    assert.deepStrictEqual([taken, git(bareOf(dir), ['log', '-1', '--format=%B', 'main']).match(/^Task: .*$/gm)], [host, [`Task: ${UNIT}-1-1`, `Task: ${UNIT}-1-2`, `Task: ${UNIT}-1-3`]]);
  });

  it('the opening\'s push is leased against the head it read: one moved on GitHub after the read is refused, nothing pushed over it', () => {
    dir = world();
    third();
    const fetchBranch = lg.fetchBranch;
    let moved = '';
    lg.fetchBranch = (root, remote, branch) => {
      const fetched = fetchBranch(root, remote, branch);
      if (branch === BRANCH && moved === '') moved = madeOnGithub(dir, BRANCH, { 'src/elsewhere.js': 'pushed from elsewhere\n' }, 'Pushed from elsewhere');
      return fetched;
    };
    try {
      assert.throws(() => withEnv(as().env, () => landOpen(dir, UNIT, '1.3')), (/** @type {Error} */ err) => {
        assert.match(err.message, new RegExp(`^land: ${BRANCH} could not be pushed to origin \\(.+\\), so ${UNIT}'s pull request was not opened — clear what git names, and open it again$`, 's'));
        return true;
      });
    } finally {
      lg.fetchBranch = fetchBranch;
    }

    assert.strictEqual(tipOnGithub(dir, BRANCH), moved);
  });
});
