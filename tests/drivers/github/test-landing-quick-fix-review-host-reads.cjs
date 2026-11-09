'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and a quick-fix's review reading its change with
// the host's landing not here (leeway-engine/scripts/domain/
// review-change.cjs, over drivers/landing/github/, 7.2.22, 19.5.14, 20.10):
// its pull request squashed on GitHub and never pulled, the board reading
// it off git alone, GitHub never asked nor fetched; and squashed and pulled
// in a clone holding no commit of its fixes, its branch deleted there and
// here and every reflog expired — the squash GitHub made, naming each fix
// by its `Task:` line, read as their landing. The reviewer's scratch
// worktree laid out at the host's landing is
// test-landing-quick-fix-review-host.cjs's. Git layer:
// quick-fix-review-host.cjs's world, built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, writeState, layout, FROZEN_AT } = require('../../scripts/engine-harness.cjs');
const { calls, madeOnGithub } = require('./world.cjs');
const { UNIT, BRANCH, SET } = require('../../scripts/quick-fix-world.cjs');
const { changeRead } = require('../../scripts/quick-fix-review-by-hand.cjs');
const { reviewHost } = require('./quick-fix-review-host.cjs');

const { conf, side, as, mergedOnHost, reviewing } = reviewHost('github-landing-quick-fix-review-host-reads-');

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
