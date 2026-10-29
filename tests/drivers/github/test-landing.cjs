'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver (workflow-engine/scripts/drivers/landing/github/)
// on its own ground, past what every driver does (the landing conformance
// suite's): the calls it makes on gh and the stack extension for a stack of
// three tasks — each branch pushed as its pull request opens, each pull
// request based on the one before, the stack linked with the default branch
// as its base whatever GitHub's own default is, and merged whole, each pull
// request squashed under its title and " (#N)", the default branch here
// brought to the merge (7.S7, 7.S13); a stack merged only once the
// repository squashes into the pull request's title and description, a
// lone pull request whatever it squashes into (7.2.18); a phase stacked on
// a higher one, merged after it; which pull request is a task's, and which
// is no task's. What stops it, and where it leaves the default branch here,
// are test-landing-stops.cjs's; across nested repositories,
// test-landing-nested.cjs's. Git layer: the landing world on a fake GitHub
// (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const harness = require('../../scripts/engine-harness.cjs');
const { TASKS, openArgs, own, cutTask, mergeBack, landedOn, useLandingWorld } = require('../../scripts/landing-world.cjs');
const { loadDriver } = require('../../../skills/workflow-engine/scripts/domain/drivers.cjs');
const side = require('./landing.cjs');
const { GITHUB_SQUASH } = require('./gh-stub.cjs');
const { github, onGithub, bareOf, calls, closeByHand, defaultOnGithub, tipOnGithub, pulls, ok, refused, stackOfTwo } = require('./world.cjs');

const { git, tip } = harness;
const { card, total, rounding } = TASKS;
const project = useLandingWorld('github-landing-', side.prepare);

/** The query every verb reads the unit's pull requests by. */
const LIST = 'pr list --state all --limit 1000 --json number,state,headRefName,baseRefName,headRefOid,title,body';

describe('the remotes it serves (22.4.3)', () => {
  it('reads a GitHub repository off every form a remote URL takes, and serves those alone', () => {
    const driver = /** @type {any} */ (loadDriver('landing', 'github'));
    for (const url of [
      'git@github.com:acme/portal.git', 'git@github.com:acme/portal', 'https://github.com/acme/portal.git',
      'https://github.com/acme/portal/', 'https://token@github.com/acme/portal', 'ssh://git@github.com/acme/portal.git',
      'ssh://git@github.com:22/acme/portal.git', 'git://github.com/acme/portal.git', 'https://GitHub.com/acme/portal',
    ]) {
      assert.deepStrictEqual([driver.repositoryOf(url), driver.serves(url)], [{ owner: 'acme', repo: 'portal' }, true], url);
    }
    for (const url of ['https://gitlab.com/acme/portal.git', 'git@github.com.evil.io:acme/portal.git', 'https://github.com/acme', '/srv/git/portal.git']) {
      assert.deepStrictEqual([driver.repositoryOf(url), driver.serves(url)], [null, false], url);
    }
  });
});

describe('a stack of three tasks on GitHub (7.S7, 7.S13)', () => {
  it('pushes each branch as its pull request opens, bases each on the one before, links them on the default branch — never GitHub\'s own — merges the stack whole, each squashed under its title and " (#N)", and brings the default branch here to the merge', () => {
    const dir = project();
    const started = tip(dir, 'main');
    defaultOnGithub(dir, 'release');

    assert.deepStrictEqual(ok(dir, openArgs(card)), { ok: true, task: '1.1', branch: card.branch, repos: [{ repo: '.', base: 'main', pull_request: 1 }], driver: 'github' });
    assert.strictEqual(tipOnGithub(dir, card.branch), tip(dir, card.branch), 'the branch is pushed as its pull request opens');
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.1']), { ok: true, phase: 1, repos: [{ repo: '.', stack: ['1.1'], pull_requests: [1] }], driver: 'github' });
    mergeBack(dir, total.branch, card.branch);
    assert.strictEqual(own(ok(dir, openArgs(total))).base, card.branch);
    ok(dir, ['land', 'chain', 'pay', '1.2']);
    const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
    assert.deepStrictEqual(ok(dir, openArgs(tax)), { ok: true, task: '1.4', branch: tax.branch, repos: [{ repo: '.', base: total.branch, pull_request: 4 }], driver: 'github' });
    assert.deepStrictEqual(ok(dir, ['land', 'chain', 'pay', '1.4']), {
      ok: true, phase: 1, repos: [{ repo: '.', stack: ['1.1', '1.2', '1.4'], pull_requests: [1, 2, 4] }], driver: 'github',
    });

    assert.deepStrictEqual(pulls(dir), [
      { number: 1, state: 'OPEN', base: 'main' }, { number: 2, state: 'OPEN', base: card.branch }, { number: 4, state: 'OPEN', base: total.branch },
    ]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [], 'nothing merges before the phase does');

    assert.deepStrictEqual(ok(dir, ['land', 'phase', 'pay', '1']), {
      ok: true, phase: 1, repos: [{ repo: '.', into: 'main', merged: ['1.1', '1.2', '1.4'], pull_requests: [1, 2, 4] }], driver: 'github',
    });
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [
      { subject: 'feat(pay): Add card (#1)', task: 'pay-1-1', paths: ['card.txt'] },
      { subject: 'feat(pay): Show total (#2)', task: 'pay-1-2', paths: ['total.txt'] },
      { subject: 'feat(pay): Add tax (#4)', task: 'pay-1-4', paths: ['tax.txt'] },
    ]);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'MERGED', 'MERGED']);
    assert.strictEqual(git(bareOf(dir), ['rev-parse', 'release']).trim(), started, 'GitHub\'s own default branch took nothing');
    assert.strictEqual(tip(dir, 'main'), side.defaultTip(dir), 'the default branch here is at the merge');
    assert.deepStrictEqual(calls(dir), [
      LIST, `pr create --base main --head ${card.branch} --title feat(pay): Add card --body Task: pay-1-1`,
      LIST,
      LIST, `pr create --base ${card.branch} --head ${total.branch} --title feat(pay): Show total --body Task: pay-1-2`,
      LIST, 'stack link --base main --remote origin 1 2',
      LIST, `pr create --base ${total.branch} --head ${tax.branch} --title feat(pay): Add tax --body Task: pay-1-4`,
      LIST, 'stack link --base main --remote origin 1 2 4',
      LIST, 'api repos/acme/portal', 'stack link --base main --remote origin 1 2 4', 'stack merge 4 --yes --squash',
    ]);
  });
});

describe('the squash default (7.2.18)', () => {
  it('squashing as GitHub does unless told: a lone pull request merges under its title and " (#N)", and a stack is refused naming the setting and the verb that sets it while either half is not the pull request\'s — merged once it is set', () => {
    const dir = project();
    onGithub(dir, (state) => {
      state.squash = { ...GITHUB_SQUASH };
    });
    stackOfTwo(dir);
    ok(dir, openArgs(rounding));
    ok(dir, ['land', 'phase', 'pay', '2']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [{ subject: 'fix(pay): Round totals (#4)', task: 'pay-2-1', paths: ['round.txt'] }]);

    const refusal = 'land: acme/portal does not squash a pull request into its title and description, so phase 1\'s stack would land under other subjects than its tasks\' — '
      + 'set that squash default on every repository the project lands in on GitHub, as `engine github-squash yes` does, and land again';
    for (const squash of [GITHUB_SQUASH, { squash_merge_commit_title: 'PR_TITLE', squash_merge_commit_message: 'COMMIT_MESSAGES' }, { squash_merge_commit_title: 'COMMIT_OR_PR_TITLE', squash_merge_commit_message: 'PR_BODY' }]) {
      onGithub(dir, (state) => {
        state.squash = { ...squash };
      });
      assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '1']), refusal, JSON.stringify(squash));
    }
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['OPEN', 'OPEN', 'MERGED']);
    assert.strictEqual(ok(dir, ['github-squash', 'yes']).github_squash, 'set');
    ok(dir, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').slice(1), [
      { subject: 'feat(pay): Add card (#1)', task: 'pay-1-1', paths: ['card.txt'] },
      { subject: 'feat(pay): Show total (#2)', task: 'pay-1-2', paths: ['total.txt'] },
    ]);
  });
});

describe('phases and their pull requests', () => {
  it('a phase built on a higher phase not yet merged: its pull request based on that phase\'s top, its merge refused naming it, and finish merging that one first', () => {
    const dir = project();
    const four = cutTask(dir, '4.1', 'feat', 'Add four', 'main', { 'four.txt': 'four\n' });
    const more = cutTask(dir, '4.2', 'feat', 'Add more', four.branch, { 'more.txt': 'more\n' });
    ok(dir, openArgs(four));
    ok(dir, openArgs(more));
    ok(dir, ['land', 'chain', 'pay', '4.2']);
    const fix = cutTask(dir, '3.2', 'fix', 'Fix four', more.branch, { 'fix.txt': 'fix\n' });

    assert.strictEqual(own(ok(dir, openArgs(fix))).base, more.branch);
    assert.strictEqual(refused(dir, ['land', 'phase', 'pay', '3']), 'land: phase 3 stacks on phase 4, which has not merged — merge it first with `land phase pay 4`, then land again');
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), []);

    assert.deepStrictEqual(own(ok(dir, ['land', 'finish', 'pay'])).phases.map((/** @type {{phase: number}} */ phase) => phase.phase), [4, 3]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main'), [
      { subject: 'feat(pay): Add four (#1)', task: 'pay-4-1', paths: ['four.txt'] },
      { subject: 'feat(pay): Add more (#2)', task: 'pay-4-2', paths: ['more.txt'] },
      { subject: 'fix(pay): Fix four (#4)', task: 'pay-3-2', paths: ['fix.txt'] },
    ]);
    assert.ok(calls(dir).includes('pr edit 4 --base main'), 'the lone pull request is based on the default branch before it merges');
  });

  it('a task opened into a phase merged already: refused, to number it in a phase not yet merged, nothing pushed', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, ['land', 'phase', 'pay', '1']);
    const late = cutTask(dir, '1.5', 'feat', 'Add late', 'main', { 'late.txt': 'late\n' });

    assert.strictEqual(refused(dir, openArgs(late)), 'land: phase 1 is merged into main — task 1.5 lands in a phase not yet merged, so number it in one');
    assert.deepStrictEqual([tipOnGithub(dir, late.branch), pulls(dir).length], ['', 1]);
  });

  it('a task with nothing past the chain\'s tip: refused as every driver refuses it, no pull request opened and nothing pushed', () => {
    const dir = project();
    const empty = cutTask(dir, '1.5', 'feat', 'Add nothing', 'main', {});
    git(dir, ['update-ref', `refs/heads/${empty.branch}`, 'main']);

    assert.strictEqual(refused(dir, openArgs(empty)), `land: task 1.5's branch ${empty.branch} changes nothing past main — commit its change there first`);
    assert.deepStrictEqual([pulls(dir), tipOnGithub(dir, empty.branch)], [[], '']);
  });

  it('a task\'s open pull request outranks a closed one of its own, whatever their numbers, and one that is no task\'s — the person\'s own, or a bot\'s — is passed over', () => {
    const dir = project();
    ok(dir, openArgs(card));
    onGithub(dir, (state) => {
      state.pulls.push(
        { number: 2, state: 'CLOSED', head: card.branch, base: 'main', title: 'feat(pay): Add card', body: 'Task: pay-1-1' },
        { number: 3, state: 'OPEN', head: 'dependabot/npm_and_yarn/lodash-4.17.21', base: 'main', title: 'Bump lodash', body: '' },
        { number: 4, state: 'OPEN', head: 'my-own-fix', base: 'main', title: 'Fix the footer', body: '' },
      );
      state.next = 5;
    });

    assert.deepStrictEqual(own(ok(dir, ['land', 'phase', 'pay', '1'])).pull_requests, [1]);
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ subject }) => subject), ['feat(pay): Add card (#1)']);
    assert.deepStrictEqual(pulls(dir).map(({ state }) => state), ['MERGED', 'CLOSED', 'OPEN', 'OPEN']);
  });

  it('finish stopped by a pull request closed by hand in a phase another stacks on: refused naming it, and the phases finish merged before it', () => {
    const dir = project();
    const three = cutTask(dir, '3.2', 'fix', 'Fix three', 'main', { 'three.txt': 'three\n' });
    const again = cutTask(dir, '3.3', 'fix', 'Fix three again', three.branch, { 'again.txt': 'again\n' });
    const two = cutTask(dir, '2.5', 'fix', 'Fix two', again.branch, { 'two.txt': 'two\n' });
    for (const task of [card, three, again, two]) ok(dir, openArgs(task));
    closeByHand(dir, 3);

    assert.strictEqual(
      refused(dir, ['land', 'finish', 'pay']),
      'land: task 3.3\'s pull request #3 was closed on GitHub without being merged — reopen it there, as `gh pr reopen 3` does, and land again (finish merged phase 1 before it)',
    );
    assert.deepStrictEqual(landedOn(bareOf(dir), 'main').map(({ task }) => task), ['pay-1-1']);
  });
});
