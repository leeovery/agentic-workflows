'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's one pull request (leeway-engine/
// scripts/domain/landing.cjs, finish.cjs, fix-branch.cjs, over
// drivers/landing/github/), past what every driver gives (the landing
// conformance suites' quick-fix): the pull request merged by hand on the
// site by each method the conformance suite's side does not, pulled or not —
// each fix read as landed, its opening refused as done, and the close
// landing nothing more, main here brought to main there (R12, R14); the
// pull request's title and body kept its landing's as a fix joins it,
// retitled feat once a feat joins (19.S32); a fix
// started after a squash on the site, main here behind, its branch cut
// again from main as GitHub has it — the merged branch kept there, the
// opening pushing over GitHub's copy, a pull request of its own; deleted,
// cut afresh — and the pull
// request closed by hand there, a fix's done and close refused in the
// landing's words, each opening on its own verb; and a move closing it
// unmerged, a second close closing nothing. The close itself is
// test-engine-quick-fix-close.cjs's. Git layer: quick-fix-world.cjs's two
// fixes built on a fake GitHub (world.cjs), their pull request #1, built
// once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, fixChanged, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, github, bareOf, closeByHand, pulls, tipOnGithub } = require('./world.cjs');

const { ok, refuses, git, readManifest, withEnv, fixtureFrom, cleanupFixture } = harness;
const { quickFixClose } = require('../../../skills/leeway-engine/scripts/domain/landing.cjs');

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

describe('a quick-fix\'s one pull request on GitHub (R14)', () => {
  it('19.S32: keeps its title and body its landing\'s as a fix joins it, the fix\'s commit pushed to it — retitled feat once a feat joins, each fix in the body under its own type', () => {
    dir = world();
    const [{ title: before }] = github(dir).pulls;
    third();
    ok(dir, ['task', 'type', UNIT, '1.3', 'feat'], as());
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    const [{ number, title, body }] = github(dir).pulls;

    assert.deepStrictEqual([number, before, title, tipOnGithub(dir, BRANCH)], [1, `fix(${UNIT}): ${DESCRIPTION}`, `feat(${UNIT}): ${DESCRIPTION}`, git(dir, ['rev-parse', BRANCH]).trim()]);
    assert.strictEqual(body, SET.map(({ title: fix }, at) => `${at === 2 ? 'feat' : 'fix'}(${UNIT}): ${fix}\n\nTask: ${UNIT}-1-${at + 1}`).join('\n\n'));
  });

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

  it('a copy of a fix\'s commit put on main there by hand after the last opening, the rest still to land: the close cuts the branch again and squashes the pull request naming what is left alone', () => {
    dir = world();
    const bare = bareOf(dir);
    const copy = git(bare, ['commit-tree', `${BRANCH}~1^{tree}`, '-p', 'main', '-m', 'Spell the flag the British way']).trim();
    git(bare, ['update-ref', 'refs/heads/main', copy]);
    fixesRecorded(dir, 2, as());
    ok(dir, ['finish', 'yes', UNIT], as());
    const squash = (/** @type {string} */ format) => git(bare, ['log', '-1', `--format=${format}`, 'main']).trim();

    assert.deepStrictEqual([squash('%P'), squash('%B').match(/^Task: .*$/gm), pulls(dir)], [copy, [`Task: ${UNIT}-1-2`], [{ number: 1, state: 'MERGED', base: 'main' }]]);
  });

  it('closed by a move: the one open closed unmerged, and closed again, as a yes run again closes it, closing nothing', () => {
    dir = world();
    const [first, again] = withEnv(as().env, () => [quickFixClose(dir, UNIT), quickFixClose(dir, UNIT)]);

    assert.deepStrictEqual([first, again, pulls(dir)], [{ closed: true }, { closed: false }, [{ number: 1, state: 'CLOSED', base: 'main' }]]);
  });

  it('closed by hand there: a fix\'s done and its close refused in the landing\'s words, each opening on its own verb', () => {
    dir = world();
    third();
    ok(dir, ['land', 'open', UNIT, '1.3'], as());
    closeByHand(dir, 1);
    const words = `${UNIT}'s pull request #1 was closed on GitHub without being merged — reopen it there, as \`gh pr reopen 1\` does, and land again`;

    assert.deepStrictEqual([refuses(dir, ['task', 'done', UNIT, '1.3'], as()).error, refuses(dir, ['task', 'close', UNIT, '1.3', '--reason', 'Not wanted.'], as()).error], [
      `task done: ${words}`, `task close: ${words}`,
    ]);
  });
});
