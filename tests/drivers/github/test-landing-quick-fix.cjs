'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's one pull request merged by hand
// on the site (leeway-engine/scripts/domain/landing.cjs, finish.cjs,
// fix-branch.cjs, over drivers/landing/github/), past what every driver
// gives (the landing conformance suites' quick-fix): by each method the
// conformance suite's side does not, pulled or not — each fix read as
// landed, its opening refused as done, and the close landing nothing more,
// main here brought to main there (R12, R14); and a fix started after a
// squash there, main here behind, its branch cut again from main as GitHub
// has it — the merged branch kept there, the opening pushing over GitHub's
// copy, a pull request of its own; deleted, cut afresh; and gone here and
// there, the reflog expired, the fix read as landed by the squash naming
// it. Its title and body, a copy put on main there, and its closing are
// test-landing-quick-fix-pull.cjs's; the close itself,
// test-engine-quick-fix-close.cjs's. Git layer: quick-fix-world.cjs's two
// fixes built on a fake GitHub (world.cjs), their pull request #1, built
// once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, SET, fixChanged, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, pulls, tipOnGithub } = require('./world.cjs');

const { ok, refuses, git, readManifest, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 made through the door, as `fixChanged` makes it. */
const third = () => fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());

/** Whether main as GitHub has it is under the quick-fix's branch here. */
const cutFromGithub = () => git(dir, ['merge-base', tipOnGithub(dir, 'main'), BRANCH]).trim() === tipOnGithub(dir, 'main');

describe('a quick-fix\'s pull request merged by hand on GitHub (R12, R14)', () => {
  for (const [method, pulled] of /** @type {const} */ ([['squash', false], ['merge', true], ['rebase', false]])) {
    it(`by ${method}, ${pulled ? 'pulled' : 'not pulled'}: each fix read as landed, its opening refused as done, and the close landing nothing more, main here brought to main there`, () => {
      dir = world();
      side.mergedOnGithub(dir, BRANCH, method, pulled);
      const opening = refuses(dir, ['land', 'open', UNIT, '1.2'], as()).error;
      fixesRecorded(dir, 2, as());
      ok(dir, ['finish', 'yes', UNIT], as());

      assert.strictEqual(opening, `land: task 1.2 of ${UNIT} has landed, and is done — nothing of it is left to open`);
      assert.deepStrictEqual([readManifest(dir, UNIT).status, git(dir, ['rev-parse', 'main']).trim(), pulls(dir)], [
        'completed', tipOnGithub(dir, 'main'), [{ number: 1, state: 'MERGED', base: 'main' }],
      ]);
    });
  }
});

describe('a quick-fix\'s one pull request on GitHub, squashed by hand there (R14)', () => {
  it('squashed by hand there, its branch kept, main here behind: a fix started after it has the branch cut again from main as GitHub has it, and its opening pushes it over GitHub\'s copy, a pull request of its own', () => {
    dir = world();
    side.mergedOnGithub(dir, BRANCH, 'squash', false);
    third();
    ok(dir, ['land', 'open', UNIT, '1.3'], as());

    assert.deepStrictEqual([cutFromGithub(), git(dir, ['rev-list', '--count', `${tipOnGithub(dir, 'main')}..${BRANCH}`]).trim(), tipOnGithub(dir, BRANCH), pulls(dir)], [
      true, '1', git(dir, ['rev-parse', BRANCH]).trim(), [{ number: 1, state: 'MERGED', base: 'main' }, { number: 2, state: 'OPEN', base: 'main' }],
    ]);
    assert.notStrictEqual(git(dir, ['rev-parse', 'main']).trim(), tipOnGithub(dir, 'main'), 'main here is left behind');
  });

  it('squashed by hand there and its branch deleted, main here behind: a fix started after it has its branch cut afresh from main as GitHub has it', () => {
    dir = world();
    side.mergedOnGithub(dir, BRANCH, 'squash', false);
    side.deleted(dir, BRANCH);
    third();

    assert.deepStrictEqual([cutFromGithub(), git(dir, ['rev-list', '--count', `${tipOnGithub(dir, 'main')}..${BRANCH}`]).trim()], [true, '1']);
  });

  it('squashed by hand there, read where the repository holds none of a fix\'s own commits — its branch gone here and there, the reflog expired: a fix in flight read as landed by the squash naming it, its close refused naming its done, and done', () => {
    dir = world();
    third();
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    side.mergedOnGithub(dir, BRANCH, 'squash', true);
    side.deleted(dir, BRANCH);
    git(dir, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
    git(dir, ['reflog', 'expire', '--expire=now', '--all']);
    git(dir, ['gc', '-q', '--prune=now']);
    const closing = refuses(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Not wanted.'], as()).error;
    ok(dir, ['task', 'done', UNIT, '1.3'], as());

    assert.strictEqual(closing, `task close: task 1.3 of ${UNIT} holds work of its own — it has landed, so it is done, and its change is given up as a landed change is, by a fix of its own whose commit through the door reverts it: task create ${UNIT} 1 --file <task.md>`);
  });
});
