'use strict';

// ---------------------------------------------------------------------------
// GitHub's landing driver and what on GitHub is a quick-fix's (R18;
// leeway-engine/scripts/domain/landing.cjs, fix-branch.cjs, over
// drivers/landing/github/), in the project's own repository: a pull request
// of a branch by its name opened long before the unit, closed and its
// branch deleted, is none of its — never "reopen it there" — and the
// quick-fix lands; one opened then and left open, its branch there made by
// hand, refuses the first start, naming it and the way on, and once it is
// deleted the quick-fix lands, the other never retitled; and a fork's pull
// request of the same name, opened since, is none of its either, the
// quick-fix opening and landing its own beside it. In a nested clone the
// quick-fix touched, test-landing-quick-fix-stranger-nested.cjs's.
// Conformance layer: quick-fix-world.cjs's `quickFixConformance` on GitHub's
// side (world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, createFile } = require('../../scripts/engine-harness.cjs');
const { UNIT, DESCRIPTION, BRANCH, SET, createFix, quickFixConformance, fixesRecorded } = require('../../scripts/quick-fix-world.cjs');
const { github, strangerPull, branchDeleted } = require('./world.cjs');

const { as, project, built, landed } = quickFixConformance('github', 'github-landing-quick-fix-stranger-');

const OLD = { head: BRANCH, files: { 'src/old.js': 'an old typo fix of mine\n' }, message: 'Fix an old typo' };

/** Fix 1.1 recorded, and the close made. @param {string} dir */
function closedOnFirst(dir) {
  fixesRecorded(dir, 1, as());
  ok(dir, ['finish', 'yes', UNIT], as());
}

/** A pull request GitHub holds, as its number, state and title. @param {string} dir @param {number} number */
const pullOn = (dir, number) => github(dir).pulls.filter((pull) => pull.number === number).map(({ state, title }) => ({ number, state, title }));

describe('what on GitHub is a quick-fix\'s, in the project\'s own repository (R18)', () => {
  it('a pull request of its branch\'s name opened long before the unit, closed and its branch deleted, is none of its: the quick-fix lands', () => {
    const dir = project();
    const number = strangerPull(dir, { ...OLD, state: 'CLOSED', kept: false });
    built(dir, 1);
    closedOnFirst(dir);

    assert.deepStrictEqual([landed(dir), pullOn(dir, number)], [[[`fix(${UNIT}): ${DESCRIPTION}`, [SET[0].file]]], [{ number, state: 'CLOSED', title: OLD.message }]]);
  });

  it('one opened then and left open, its branch there made by hand, refuses the first start naming it and the way on; deleted there, the quick-fix lands, the other never retitled', () => {
    const dir = project();
    const number = strangerPull(dir, OLD);
    createFix(dir, 1, SET[0].title, as());
    const refusal = refuses(dir, ['task', 'start', UNIT, '1.1'], as()).error;
    branchDeleted(dir, number);
    ok(dir, ['task', 'start', UNIT, '1.1'], as());
    createFile(dir, SET[0].file, SET[0].text);
    ok(dir, ['commit', '--paths', SET[0].file, '--task', UNIT, '1.1', '-m', `fix(${UNIT}): ${SET[0].title.toLowerCase()}`], as());
    ok(dir, ['land', 'open', UNIT, '1.1'], as());
    ok(dir, ['task', 'done', UNIT, '1.1'], as());
    closedOnFirst(dir);

    assert.strictEqual(refusal, `land: the project's host holds a branch ${BRANCH} that is not ${UNIT}'s — it holds no commit of a fix of ${UNIT}'s, so it was made by hand or before ${UNIT} was — and nothing moved: delete it there, or rename it, then try again`);
    assert.deepStrictEqual([landed(dir), pullOn(dir, number)], [[[`fix(${UNIT}): ${DESCRIPTION}`, [SET[0].file]]], [{ number, state: 'CLOSED', title: OLD.message }]]);
  });

  it('a fork\'s pull request of the same name, opened since the unit was made, is none of its: the quick-fix opens and lands its own beside it', () => {
    const dir = project();
    const number = strangerPull(dir, { ...OLD, fork: 'someone', created: new Date().toISOString() });
    built(dir, 1);
    closedOnFirst(dir);

    assert.deepStrictEqual([landed(dir), pullOn(dir, number), github(dir).pulls.filter((pull) => pull.fork === undefined).map(({ state }) => state)], [
      [[`fix(${UNIT}): ${DESCRIPTION}`, [SET[0].file]]], [{ number, state: 'OPEN', title: OLD.message }], ['MERGED'],
    ]);
  });
});
