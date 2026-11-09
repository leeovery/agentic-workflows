'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's review read from the host's
// landing (leeway-engine/scripts/domain/review-change.cjs, over
// drivers/landing/github/, 7.2.22, 19.5.14): its pull request merged on
// GitHub and never pulled, by a merge commit or a squash — the reviewer's
// scratch worktree laid out at the host's landing, the code its fixes made,
// never the branch here without them, and the board reading it off git
// alone, GitHub never asked nor fetched; and squashed and pulled in a clone
// holding no commit of its fixes, its branch deleted there and here and
// every reflog expired — the squash GitHub made, naming each fix by its
// `Task:` line, read as their landing. Each other way of a merge by hand is
// the conformance suites' (test-engine-landing-conformance-quick-fix-
// review-by-hand*.cjs). Git layer: quick-fix-world.cjs's quick-fix on a
// fake GitHub (world.cjs, `quickFixConformance`), built once and copied for
// each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, okSections, git, writeState, layout, FROZEN_AT } = require('../../scripts/engine-harness.cjs');
const { calls, madeOnGithub } = require('./world.cjs');
const { UNIT, BRANCH, SET, quickFixConformance, checklistClosed } = require('../../scripts/quick-fix-world.cjs');
const { changeRead } = require('../../scripts/quick-fix-review-by-hand.cjs');
const { briefPath } = require('../../../skills/leeway-engine/scripts/domain/brief-names.cjs');

const conf = quickFixConformance('github', 'github-landing-quick-fix-review-host-');
const { side, as } = conf;

/** The quick-fix's fixes built and recorded, its pull request merged on GitHub by `method`, pulled or not, the close reached. @param {'merge'|'squash'} method @param {boolean} pulled */
function mergedOnHost(method, pulled) {
  const at = conf.project();
  conf.built(at, 1);
  conf.built(at, 2);
  conf.record(at, 1);
  conf.record(at, 2);
  side.mergedOnGithub(at, BRANCH, method, pulled);
  checklistClosed(at, as());
  return at;
}

/** The review asked for and entered. @param {string} at */
function reviewing(at) {
  ok(at, ['review', 'ask', UNIT], as());
  okSections(at, ['enter', 'review', UNIT], as());
}

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

describe('GitHub\'s landing driver and the board in a quick-fix\'s review, which reads no host (20.10, 7.2.22)', () => {
  it('reads the change off git alone at the host\'s landing as last fetched — a run there proving its scenario — asking GitHub nothing and fetching nothing, though GitHub has moved since', () => {
    const at = mergedOnHost('squash', false);
    reviewing(at);
    git(at, ['fetch', '-q', 'origin']);
    const fetched = git(at, ['rev-parse', 'refs/remotes/origin/main']).trim();
    writeState(at, layout.unit(UNIT, 'build', 'runs', '1.S1', 'run-001.json'), JSON.stringify({
      verdict: 'pass', unfixed: false, at: FROZEN_AT, checkout: at, commits: [{ repo: '.', commit: fetched }], task: null, evidence: [], recordings: [],
    }));
    madeOnGithub(at, 'main', { 'notes.md': 'Someone else\'s.\n' }, 'docs: a note');
    const asked = calls(at).length;
    const { view } = ok(at, ['board', 'sess-1'], as());

    assert.deepStrictEqual({ asked: calls(at).slice(asked), fetched: git(at, ['rev-parse', 'refs/remotes/origin/main']).trim(), notProven: view.not_proven }, {
      asked: [],
      fetched,
      notProven: [{ round: 1, scenario: '2.S1', standing: 'not proven', text: 'Given the help, when it is read, then it names --colour.' }],
    });
  });
});

describe('GitHub\'s landing driver and a quick-fix\'s review asked for in a clone holding no commit of its fixes (7.2.22, 19.5.14)', () => {
  it('reads the squash GitHub made as the fixes\' landing, by the `Task:` lines naming them', () => {
    const at = mergedOnHost('squash', true);
    side.deleted(at, BRANCH);
    git(at, ['update-ref', '-d', `refs/remotes/origin/${BRANCH}`]);
    git(at, ['reflog', 'expire', '--expire=now', '--all']);
    reviewing(at);

    assert.deepStrictEqual(changeRead(conf, at), { landed: [SET[0].file, SET[1].file].sort(), notLanded: [] });
  });
});
