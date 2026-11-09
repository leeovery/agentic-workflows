'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and what on GitHub is a quick-fix's (R18;
// leeway-engine/scripts/domain/landing.cjs, fix-branch.cjs, over
// drivers/landing/github/), in a nested clone the quick-fix touches: a pull
// request of a branch by its name opened there long before the unit,
// closed and its branch deleted, is none of its, and the fix there lands;
// a branch by its name an earlier quick-fix left there, stamped with a
// task of the same name long before the unit, its pull request open, is
// another's: the opening refuses, naming it, its repository and the way
// on, and once it is deleted the fix lands, the other never retitled. In
// the project's own repository, test-landing-quick-fix-stranger.cjs's.
// Conformance layer: quick-fix-world.cjs's `quickFixNestedConformance` on
// GitHub's side (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, createFile } = require('../../scripts/engine-harness.cjs');
const { UNIT, BRANCH, SET, createFix, quickFixNestedConformance } = require('../../scripts/quick-fix-world.cjs');
const { NESTED } = require('../../scripts/landing-world.cjs');
const { github, strangerPull, branchDeleted } = require('./world.cjs');

const { as, project, built, ended, closed, landed } = quickFixNestedConformance('github', 'github-landing-quick-fix-stranger-nested-');

const LIB = { 'lib/lib.txt': 'lib --colour\n' };
const ID = `${UNIT}-1-1`;
const OLD = { head: BRANCH, base: NESTED.lib.into, files: { 'old.txt': 'an old typo fix\n' } };

/** A pull request GitHub holds, as its number, state and title. @param {string} dir @param {number} number */
const pullOn = (dir, number) => github(dir).pulls.filter((pull) => pull.number === number).map(({ state, title }) => ({ number, state, title }));

describe('what on GitHub is a quick-fix\'s, in a nested clone it touches (R18)', () => {
  it('a pull request of its branch\'s name opened there long before the unit, closed and its branch deleted, is none of its: the fix there lands', () => {
    const at = project();
    const number = strangerPull(at.lib, { ...OLD, message: 'Fix an old typo', state: 'CLOSED', kept: false });
    built(at, 1, LIB);
    closed(at);

    assert.deepStrictEqual([landed(at).lib, pullOn(at.lib, number)], [[[ID, ['lib.txt']]], [{ number, state: 'CLOSED', title: 'Fix an old typo' }]]);
  });

  it('a branch an earlier quick-fix of the same name left there, stamped long before the unit, its pull request open: the opening refuses naming it; deleted there, the fix lands, the other never retitled', () => {
    const at = project();
    const number = strangerPull(at.lib, { ...OLD, message: `Fix an old typo\n\nLeeway-Task: ${ID}` });
    createFix(at.dir, 1, SET[0].title, as());
    ok(at.dir, ['task', 'start', UNIT, '1.1'], as());
    createFile(at.dir, 'lib/lib.txt', LIB['lib/lib.txt']);
    ok(at.dir, ['commit', '--paths', 'lib/lib.txt', '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${SET[0].title.toLowerCase()}`], as());
    const refusal = refuses(at.dir, ['land', 'open', UNIT, '1.1'], as()).error;
    branchDeleted(at.lib, number);
    ok(at.dir, ['land', 'open', UNIT, '1.1'], as());
    ended(at, 1);
    closed(at);

    assert.strictEqual(refusal, `land: lib's host holds a branch ${BRANCH} that is not ${UNIT}'s — none of its commits is a fix of ${UNIT}'s or was made since ${UNIT} was — and nothing moved: delete it there, or rename it, then try again`);
    assert.deepStrictEqual([landed(at).lib, pullOn(at.lib, number)], [[[ID, ['lib.txt']]], [{ number, state: 'CLOSED', title: 'Fix an old typo' }]]);
  });
});
