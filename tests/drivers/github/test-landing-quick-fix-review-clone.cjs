'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's review asked for in a clone
// holding no commit of its fixes (leeway-engine/scripts/domain/
// review-change.cjs, over drivers/landing/github/): its pull request
// squashed on GitHub and pulled, its branch then deleted there and here and
// every reflog expired, as a second clone has it — the change read by the
// landing's read by content (7.2.22), the squash GitHub made, which names
// each fix by its `Task:` line, read as their landing. Each other way of a
// merge by hand is the conformance suites'
// (test-engine-landing-conformance-quick-fix-review-by-hand*.cjs). Git
// layer: quick-fix-world.cjs's quick-fix on a fake GitHub (world.cjs,
// `quickFixConformance`), built once and copied for the test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, okSections, git } = require('../../scripts/engine-harness.cjs');
const { UNIT, BRANCH, SET, quickFixConformance, checklistClosed } = require('../../scripts/quick-fix-world.cjs');
const { changeRead } = require('../../scripts/quick-fix-review-by-hand.cjs');

const conf = quickFixConformance('github', 'github-landing-quick-fix-review-clone-');
const { side, as } = conf;

describe('GitHub\'s landing driver and a quick-fix\'s review asked for in a clone holding no commit of its fixes (7.2.22, 19.5.14)', () => {
  it('reads the squash GitHub made as the fixes\' landing, by the `Task:` lines naming them', () => {
    const at = conf.project();
    conf.built(at, 1);
    conf.built(at, 2);
    conf.record(at, 1);
    conf.record(at, 2);
    side.mergedOnGithub(at, BRANCH, 'squash', true);
    checklistClosed(at, as());
    side.deleted(at, BRANCH);
    git(at, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
    git(at, ['reflog', 'expire', '--expire=now', '--all']);
    ok(at, ['review', 'ask', UNIT], as());
    okSections(at, ['enter', 'review', UNIT], as());

    assert.deepStrictEqual(changeRead(conf, at), { landed: [SET[0].file, SET[1].file].sort(), notLanded: [] });
  });
});
