'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and when a quick-fix's pull request is read
// (leeway-engine/scripts/domain/finish.cjs, workunit-move.cjs, landing.cjs,
// over drivers/landing/github/): the board, drawn at the close's window,
// reaching neither GitHub nor the remote — no gh call and no fetch — the
// landing read only once its screen is drawn and at its yes, once in each
// — the screen, the fixes laid on main, fetching main alone, no pull
// request read; each verb listing the pull requests at most once — a fix's
// record never, reading its commits off git alone, its opening and the
// close's yes once, the yes fetching main once before its merge and once
// after it (N1); and a pull
// request closed by hand on GitHub read as none open, so the quick-fix
// moves to a feature, nothing having landed, the move closing nothing, its
// yes listing the pull requests once. Git layer:
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
  it('the board, drawn at the close\'s window, reaches neither GitHub nor the remote — no gh call and no fetch — and each verb reads the pull request once: a fix\'s record never, whether it holds a commit of its own read off git alone; its opening and the close\'s yes once each, the close\'s screen never — its fixes laid on main, the screen fetches main alone — the yes merging the one it read open and fetching main once before its merge and once after, as it brings main up to it', () => {
    dir = world();
    /** A run's gh calls, each by its verb, its reads of the remote, and of those its fetches of main and of the branch. @param {() => unknown} run */
    const made = (run) => {
      const before = calls(dir).length;
      const reads = traced(run).commands.filter((command) => /^(fetch|ls-remote)\b/.test(command));
      const of = (/** @type {string} */ branch) => reads.filter((command) => command.endsWith(` +refs/heads/${branch}:refs/remotes/origin/${branch}`)).length;
      return { gh: calls(dir).slice(before).filter((call) => /^(pr|api|stack) /.test(call)).map((call) => call.split(' ').slice(0, 2).join(' ')), reads: reads.length, main: of('main'), branch: of(BRANCH) };
    };
    const recorded = made(() => fixesRecorded(dir, 2, as()));
    const refs = remoteRefs();
    const board = made(() => ['this', 'unit', 'all'].forEach((tab) => ok(dir, ['board', 'sess-1', '--tab', tab, '--unit', UNIT], as())));

    assert.deepStrictEqual([
      recorded, board, remoteRefs(), made(() => ok(dir, ['land', 'open', UNIT, '1.1'], as())), made(() => output(dir, ['render', 'finish', UNIT], as())), made(() => ok(dir, ['finish', 'yes', UNIT], as())),
    ], [
      { gh: [], reads: 0, main: 0, branch: 0 }, { gh: [], reads: 0, main: 0, branch: 0 }, refs,
      { gh: ['pr list'], reads: 2, main: 1, branch: 1 }, { gh: [], reads: 1, main: 1, branch: 0 }, { gh: ['pr list', 'pr view', 'pr merge'], reads: 3, main: 2, branch: 1 },
    ]);
  });

  it('closed by hand on GitHub, it reads as none open, so the quick-fix moves to a feature, the move closing nothing', () => {
    dir = world();
    closeByHand(dir, 1);
    const brief = writeState(dir, layout.cache('scratch', 'brief.md'), `# ${UNIT}\n\nWhat the work showed.\n`);
    const payload = writeState(dir, layout.cache('scratch', 'move.json'), JSON.stringify({ description: `The ${UNIT} work, as feature work.`, reason: 'It needs a decision.', brief }));
    okSections(dir, ['workunit', 'move', UNIT, '--to', 'feature', '--file', payload], as());
    const { next } = ok(dir, ['gate', 'start this work', '--pick', 'y'], as());
    const before = calls(dir).length;
    const res = ok(dir, next.argv, as());

    assert.deepStrictEqual([res.work_type, res.fixes_closed, res.pull_request_closed, res.branches, pulls(dir), calls(dir).slice(before).map((call) => call.split(' ').slice(0, 2).join(' '))], [
      'feature', [], false, [`moved/fix/${UNIT}`], [{ number: 1, state: 'CLOSED', base: 'main' }], ['pr list'],
    ]);
  });
});
