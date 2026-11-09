'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's one pull request (leeway-engine/
// scripts/domain/landing.cjs, finish.cjs, over drivers/landing/github/),
// past what every driver gives (the landing conformance suites'
// quick-fix): its title and body kept its landing's as a fix joins it,
// retitled feat once a feat joins (19.S32); a copy of a fix's commit put on
// main there by hand, the close squashing what is left alone; and the pull
// request closed by hand there, a fix's done and close refused in the
// landing's words, each opening on its own verb, and by a move, unmerged, a
// second close closing nothing. Merged by hand there is
// test-landing-quick-fix.cjs's. Git layer: quick-fix-world.cjs's two fixes
// built on a fake GitHub (world.cjs), their pull request #1, built once and
// copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, fixChanged, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, github, bareOf, closeByHand, pulls, tipOnGithub } = require('./world.cjs');

const { ok, refuses, git, withEnv, fixtureFrom, cleanupFixture } = harness;
const { quickFixClose } = require('../../../skills/leeway-engine/scripts/domain/landing.cjs');

const world = fixtureFrom('github-landing-quick-fix-pull-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-pull-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** Fix 1.3 made through the door, as `fixChanged` makes it. */
const third = () => fixChanged(dir, 3, SET[2].title, SET[2].file, SET[2].text, as());

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
