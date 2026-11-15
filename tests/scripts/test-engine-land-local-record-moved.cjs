'use strict';

// ---------------------------------------------------------------------------
// The local landing driver (leeway-engine/scripts/drivers/landing/local/
// driver.cjs) and a recorded task whose branch moved after its landing with
// no change of its own (landing-record.cjs, 7.2.22, R29): a later task
// rewriting its line landed by hand, then its last commit reworded, its
// branch rebased with no change, the default branch merged back into it,
// then its branch rebased onto it, each conflict with that later line
// settled the default branch's way — it stays landed after each, read at the
// default branch's tip and at its landing, its change read over its tip at
// that landing, and `land phase` merges nothing. A change of its own past
// its landing, which lands again, is
// test-engine-landing-conformance-record-changed.cjs's. Git layer: the
// landing world (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, git, tip, readManifest } = require('./engine-harness.cjs');
const { UNIT, TASKS, openArgs, cutTask, commitFiles, useLandingWorld, mergedInto } = require('./landing-world.cjs');
const { unitLanded } = require('../../skills/leeway-engine/scripts/domain/task-landed.cjs');
const { workMessage } = require('../../skills/leeway-engine/scripts/domain/commit-task.cjs');
const { projectRepos } = require('../../skills/leeway-engine/scripts/kernel/repos.cjs');

const { card } = TASKS;
const CARD = { unit: UNIT, phase: 1, n: 1 };
const project = useLandingWorld('engine-land-local-record-moved-');

/** Git calls made on main, the checkout put on it and taken back. @param {string} dir @param {string[][]} calls */
function onMain(dir, calls) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['switch', '-q', 'main']);
  for (const args of calls) git(dir, args);
  git(dir, ['switch', '-q', back]);
}

/**
 * Card's branch rebased onto `onto` by git itself, every commit made again,
 * each conflict settled `onto`'s way, the checkout put back.
 * @param {string} dir @param {string} onto
 */
function rebased(dir, onto) {
  const back = git(dir, ['symbolic-ref', '--short', 'HEAD']).trim();
  git(dir, ['rebase', '-q', '--force-rebase', '-X', 'ours', onto, card.branch]);
  git(dir, ['switch', '-q', back]);
}

describe('land: the local driver\'s recorded task, its branch moved with no change of its own (7.2.22, R29)', () => {
  it('a later task rewriting its line landed by hand, then reworded, rebased with no change, the default branch merged back, then rebased onto it: landed after each, at the default branch\'s tip and at its landing, and land phase merges nothing', () => {
    const dir = project();
    ok(dir, openArgs(card));
    ok(dir, ['land', 'phase', UNIT, '1']);
    const { commit } = readManifest(dir, UNIT).landings[`${UNIT}-1-1`]['.'];
    const [repo] = projectRepos(dir);
    /** Whether card reads landed at the default branch's tip and at its landing. */
    const landed = () => {
      const read = unitLanded(dir, UNIT, [repo], null);
      return [tip(dir, 'main'), commit].map((rev) => read.on(repo, rev).task(CARD).landed);
    };
    const reads = [];

    const later = cutTask(dir, '3.2', 'fix', 'Word the card', 'main', { 'card.txt': 'a card\n' });
    onMain(dir, [['merge', '-q', '--squash', later.branch], ['commit', '-q', '-m', 'Word the card my way']]);
    commitFiles(dir, card.branch, `${card.branch}^`, card.files, { message: workMessage('Add the card, worded better', CARD) });
    reads.push(landed());
    rebased(dir, `${card.branch}^`);
    reads.push(landed());
    mergedInto(dir, card.branch, 'main', 'theirs');
    reads.push(landed());
    rebased(dir, 'main');
    reads.push(landed());
    const main = tip(dir, 'main');
    const again = ok(dir, ['land', 'phase', UNIT, '1']);

    assert.deepStrictEqual([reads, again.already, tip(dir, 'main')], [Array(4).fill([true, true]), true, main]);
  });
});
