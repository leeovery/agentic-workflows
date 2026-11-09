'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and when a quick-fix's pull request is read
// (leeway-engine/scripts/domain/finish.cjs, workunit-move.cjs, landing.cjs,
// over drivers/landing/github/): the board, drawn at the close's window,
// reaching neither GitHub nor the remote — no gh call and no fetch — the
// landing read only once its screen is drawn and at its yes, once in each;
// and a pull request closed by hand on GitHub read as none open, so the
// quick-fix moves to a feature, nothing having landed, the move closing
// nothing. Git layer:
// quick-fix-world.cjs's two fixes built on a fake GitHub (world.cjs), their
// pull request #1 open, built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { useTempFolder } = require('../../scripts/discovery-test-utils.cjs');
const { UNIT, BRANCH, twoFixesBuilt, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const side = require('./landing.cjs');
const { GH_ENV, calls, closeByHand, pulls } = require('./world.cjs');

const { ok, okSections, output, git, writeState, layout, traced, fixtureFrom, cleanupFixture } = harness;

const world = fixtureFrom('github-landing-quick-fix-reads-', (dir) => twoFixesBuilt(dir, { ready: side.prepare, env: GH_ENV }));
const config = useTempFolder('github-landing-quick-fix-reads-config-');

let dir = ''; // the project

afterEach(() => {
  cleanupFixture(dir);
});

/** This test's conversation, as a call's options, under the stand-in gh. */
const as = () => ({ env: { ...GH_ENV, LEEWAY_CONFIG_DIR: config(), CLAUDE_CODE_SESSION_ID: 'sess-1', TMUX: undefined, TMUX_PANE: undefined } });

/** The remote's branches as this repository last fetched them. */
const remoteRefs = () => git(dir, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/remotes/']);

describe('when a quick-fix\'s pull request on GitHub is read (N3, N4)', () => {
  it('the board, drawn at the close\'s window, reaches neither GitHub nor the remote — no gh call and no fetch — and the close\'s screen and its yes each read the pull request once', () => {
    dir = world();
    fixesRecorded(dir, 2, as());
    const [before, refs] = [calls(dir).length, remoteRefs()];
    const { commands } = traced(() => ['this', 'unit', 'all'].forEach((tab) => ok(dir, ['board', 'sess-1', '--tab', tab, '--unit', UNIT], as())));
    const board = [calls(dir).slice(before), commands.filter((command) => /^(fetch|ls-remote|push)\b/.test(command)), remoteRefs()];
    const branchReads = (/** @type {() => unknown} */ run) => traced(run).commands.filter((command) => command.startsWith('fetch ') && command.endsWith(`+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`)).length;

    assert.deepStrictEqual([board, branchReads(() => output(dir, ['render', 'finish', UNIT], as())), branchReads(() => ok(dir, ['finish', 'yes', UNIT], as()))], [[[], [], refs], 1, 1]);
  });

  it('closed by hand on GitHub, it reads as none open, so the quick-fix moves to a feature, the move closing nothing', () => {
    dir = world();
    closeByHand(dir, 1);
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    const payload = writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
    okSections(dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], as());
    const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], as());
    const res = ok(dir, next.argv, as());

    assert.deepStrictEqual([res.work_type, res.fixes_closed, res.pull_request_closed, res.branches, pulls(dir)], [
      'feature', [], false, [`moved/fix/${UNIT}`], [{ number: 1, state: 'CLOSED', base: 'main' }],
    ]);
  });
});
