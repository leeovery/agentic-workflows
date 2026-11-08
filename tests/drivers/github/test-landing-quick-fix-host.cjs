'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's branch as GitHub has it, the
// truth for what its pull request holds (R15; leeway-engine/scripts/domain/
// fix-branch.cjs, landing.cjs, over drivers/landing/github/), past what
// every driver gives (the landing conformance suites' quick-fix): a review's
// suggestion committed on the pull request's page, and the site's update of
// the branch — though it holds no change the branch here lacks — each kept
// by the next push and landing with the squash; a
// second clone, which never had the branch, taking GitHub's at its first
// start, so no fix in the pull request is dropped; and the opening's push
// leased against the head it read, so one moved on GitHub after the read is
// refused, nothing pushed over it. Git layer: quick-fix-world.cjs's two
// fixes built on a fake GitHub (world.cjs), their pull request #1 open,
// built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, SET, fixChanged, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, bareOf, tipOnGithub } = require('./world.cjs');
const lg = require('../../../skills/leeway-engine/scripts/domain/landing-git.cjs');
const { landOpen } = require('../../../skills/leeway-engine/scripts/domain/landing.cjs');

const { ok, git, createFile, withEnv, fixtureFrom, cleanupFixture } = harness;

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
 * A commit made on GitHub on `branch`, as the site makes one, `files`
 * written in it: its sha.
 * @param {string} branch @param {Record<string, string>} files @param {string} subject
 */
function madeOnGithub(branch, files, subject) {
  const bare = bareOf(dir);
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'github-site-'));
  git(bare, ['worktree', 'add', '-q', tree, branch]);
  for (const [file, text] of Object.entries(files)) {
    createFile(tree, file, text);
    git(tree, ['add', file]);
  }
  git(tree, ['commit', '-q', '-m', subject]);
  git(bare, ['worktree', 'remove', '--force', tree]);
  return tipOnGithub(dir, branch);
}

/**
 * The third fix opened, what `opened` reads then, then done, every fix
 * recorded and the close made: what `opened` read.
 * @template T @param {() => T} [opened] @returns {T|undefined}
 */
function closedWithThird(opened) {
  ok(dir, ['land', 'open', UNIT, '1.3'], as());
  const read = opened?.();
  ok(dir, ['task', 'done', UNIT, '1.3'], as());
  fixesRecorded(dir, 3, as());
  ok(dir, ['finish', 'yes', UNIT], as());
  return read;
}

describe('a quick-fix\'s branch as GitHub has it, the truth for what its pull request holds (R15)', () => {
  it('a review\'s suggestion committed on the pull request\'s page is kept by the next fix\'s push, and lands with the squash', () => {
    dir = world();
    const suggestion = madeOnGithub(BRANCH, { [SET[0].file]: SUGGESTED }, `Update ${SET[0].file}`);
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

  it('a second clone, which never had the branch, takes GitHub\'s as it stands at its first start, main there moved on since, so the close lands every fix in the pull request', () => {
    dir = world();
    madeOnGithub('main', { 'src/other.js': 'const other = 1;\n' }, 'Another change');
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
      if (branch === BRANCH && moved === '') moved = madeOnGithub(BRANCH, { 'src/elsewhere.js': 'pushed from elsewhere\n' }, 'Pushed from elsewhere');
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
