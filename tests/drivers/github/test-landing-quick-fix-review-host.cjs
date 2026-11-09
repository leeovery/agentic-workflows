'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's review laid out at the host's
// landing (leeway-engine/scripts/domain/review-change.cjs, over
// drivers/landing/github/, 7.2.22, 19.5.14): its pull request merged on
// GitHub and never pulled, by a merge commit or a squash — the reviewer's
// scratch worktree laid out at the host's landing, the code its fixes made,
// never the branch here without them. The board's read of it and a clone
// holding no commit of its fixes are test-landing-quick-fix-review-host-
// reads.cjs's; each other way of a merge by hand is the conformance suites'
// (test-engine-landing-conformance-quick-fix-review-by-hand*.cjs). Git
// layer: quick-fix-review-host.cjs's world, built once and copied for each
// test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, git } = require('../../scripts/engine-harness.cjs');
const { UNIT } = require('../../scripts/quick-fix-world.cjs');
const { briefPath } = require('../../../skills/leeway-engine/scripts/domain/brief-names.cjs');
const { reviewHost } = require('./quick-fix-review-host.cjs');

const { side, as, mergedOnHost, reviewing } = reviewHost('github-landing-quick-fix-review-host-');

/** Where the area reader's brief lays the project out: the line naming it and the commit its call lays. @param {string} at */
function laidOut(at) {
  const { id } = ok(at, ['brief', 'review-area', UNIT, '--area', '1', '--base', 'main', '--letter', 'a'], as());
  const brief = fs.readFileSync(path.join(as().env.LEEWAY_CONFIG_DIR ?? '', 'conversations', 'sess-1', 'briefs', path.basename(briefPath('sess-1', id))), 'utf8');
  return { line: brief.split('\n').find((line) => line.startsWith('- the project\'s repository: ')), commit: /scratch lay \S+ ([0-9a-f]{40})/.exec(brief)?.[1] };
}

describe('GitHub\'s landing driver and a quick-fix\'s review after its pull request was merged on GitHub and never pulled (7.2.22, 19.5.14)', () => {
  for (const method of /** @type {const} */ (['merge', 'squash'])) {
    it(`lays the reviewer's scratch worktree out at the host's landing by a ${method}, never at the branch here without the fixes`, () => {
      const at = mergedOnHost(method, false);
      reviewing(at);
      const landing = side.defaultTip(at);

      assert.notStrictEqual(git(at, ['rev-parse', 'main']).trim(), landing);
      assert.deepStrictEqual(laidOut(at), {
        line: `- the project's repository: \`${landing.slice(0, 12)}\` — the change's tip there, main as its host has it, not yet pulled here`,
        commit: landing,
      });
    });
  }
});
