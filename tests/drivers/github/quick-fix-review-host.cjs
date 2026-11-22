'use strict';

// ---------------------------------------------------------------------------
// The world of GitHub's quick-fix review suites read from the host's landing
// (test-landing-quick-fix-review-host*.cjs): quick-fix-world.cjs's quick-fix
// on a fake GitHub (world.cjs, `quickFixConformance`), built once per suite
// and copied for each test — its fixes built and recorded, its pull request
// merged on GitHub, pulled or not, the close reached (`mergedOnHost`) — and
// its review asked for and entered (`reviewing`).
// ---------------------------------------------------------------------------

const { ok, okSections } = require('../../scripts/engine-harness.cjs');
const { UNIT, BRANCH, quickFixConformance, checklistClosed } = require('../../scripts/quick-fix-world.cjs');

/**
 * The world, its copies' temp directories named from `prefix`.
 * @param {string} prefix
 */
function reviewHost(prefix) {
  const conf = quickFixConformance('github', prefix);
  const { side, as } = conf;
  return {
    conf,
    side,
    as,
    /** A copy, its pull request merged on GitHub by `method`, pulled or not, the close reached. @param {'merge'|'squash'} method @param {boolean} pulled */
    mergedOnHost: (method, pulled) => {
      const at = conf.project();
      conf.built(at, 1);
      conf.built(at, 2);
      conf.record(at, 1);
      conf.record(at, 2);
      side.mergedOnGithub(at, BRANCH, method, pulled);
      checklistClosed(at, as());
      return at;
    },
    /** The review asked for and entered. @param {string} at */
    reviewing: (at) => {
      ok(at, ['review', 'ask', UNIT], as());
      okSections(at, ['enter', 'review', UNIT], as());
    },
  };
}

module.exports = { reviewHost };
