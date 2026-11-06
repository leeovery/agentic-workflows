'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's set (leeway-engine/scripts/
// domain/finish.cjs, over drivers/landing/github/), past what every driver
// gives (the landing conformance suite's quick-fix): the set's stack merged
// by hand on GitHub one pull request at a time, squashed or by a merge
// commit — each fix's landing read alone (R11), so a fix opened over one
// merged is done, and the yes is refused while the stack is merged in part,
// in the driver's words naming the rest; then merged whole, which the
// driver reads as merged there while the default branch here lacks it —
// the close refused, naming the landing of the fixes' phase, the driver's
// own way to bring the default branch here to a merge (R5); and, once
// landed so, the close drawn, its yes saying the fixes have landed, and
// made, completing the unit (19.5.15); and a fix's pull request closed by
// hand there, its done and its close refused in the landing's words, each
// opening on its own verb. The close itself is
// test-engine-quick-fix-close.cjs's.
// Git layer: quick-fix-world.cjs's two fixes built on a fake GitHub
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, CHAIN, RECORDS, recordFile, fixChanged, twoFixesBuilt, checklistClosed } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, mergeByHand, closeByHand } = require('./world.cjs');

const { ok, git, refuses, output, sectionOf, readManifest, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-config-');

let dir = ''; // the project

/** A short record, for a fix past the two `RECORDS` holds. */
const RECORD = Object.freeze({ changed: 'The docs name --colour.', why: 'They matched the old flag.', leaves: 'Nothing.' });

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

describe('a quick-fix\'s close on GitHub (R5, R11)', () => {
  for (const method of /** @type {const} */ (['squash', 'merge'])) {
    it(`its fixes merged by hand there one at a time, by ${method}: a fix opened over the first done meanwhile; the yes refused while the stack is merged in part, naming the rest; once all are, refused naming the landing of their phase, which brings the default branch here to them — and the close then drawn, its yes saying they have landed, and made`, () => {
      dir = world();
      fixChanged(dir, 3, CHAIN[2].title, CHAIN[2].file, CHAIN[2].text, as());
      ok(dir, ['land', 'open', UNIT, '1.3'], as());
      mergeByHand(dir, 1, 'main', method);
      ok(dir, ['task', 'done', UNIT, '1.3'], as());
      for (const n of [1, 2, 3]) ok(dir, ['quick-fix', 'record', UNIT, `1.${n}`, '--file', recordFile(dir, n, RECORDS[n] ?? RECORD)], as());
      checklistClosed(dir, as());
      const partly = refuses(dir, ['finish', 'yes', UNIT], as()).error;
      for (const n of [2, 3]) mergeByHand(dir, n, 'main', method);
      const refusal = refuses(dir, ['render', 'finish', UNIT], as()).error;
      ok(dir, ['land', 'phase', UNIT, '1'], as());
      const menu = sectionOf(output(dir, ['render', 'finish', UNIT], as()), 'MENU: finish');
      ok(dir, ['finish', 'yes', UNIT], as());

      assert.deepStrictEqual([partly, refusal], [
        'finish yes: land: phase 1\'s stack was merged in part by hand on GitHub — #1 (task 1.1) is merged, and #2 (task 1.2), #3 (task 1.3) are not; merge the rest there too, and the phase is landed',
        `render finish: ${UNIT}'s fixes are merged where they land, and main here lacks them — land phase ${UNIT} 1 brings main to them`,
      ]);
      assert.match(menu, /\*\*`y\/yes`\*\* {4}→ Close it — its fixes have landed, so mark it complete\n/);
      assert.deepStrictEqual([readManifest(dir, UNIT).status, git(dir, ['ls-tree', '-r', '--name-only', 'main', 'src/', 'docs/']).trim().split('\n')], [
        'completed', [CHAIN[2].file, CHAIN[0].file, CHAIN[1].file],
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
