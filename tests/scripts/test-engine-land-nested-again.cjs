'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's submodule pointer (leeway-engine/scripts/
// drivers/landing/local/driver.cjs) where a landing comes late: the
// engine's own move of a pointer never moves it back, a landing the pointer
// holds moving nothing (landing-git.cjs, `pointerFrom`) — a phase whose
// merge in the project stopped after its submodule's merged, a later phase
// landing past it there, keeps pointing the submodule at the later landing
// once it lands, and finish moves nothing. A task changed after its phase
// landed, its branch pointing the submodule at its own commit, is
// test-engine-landing-conformance-nested-again.cjs's; the rest of the
// pointer's rules, test-engine-land-nested.cjs's. Git layer: the nested
// world (landing-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, git, tip } = require('./engine-harness.cjs');
const { NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, setLandingDriver, useNestedWorld, finishReady } = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-again-', (dir) => setLandingDriver(dir, 'local'));

/** Where the project's main points ext. @param {string} dir */
const pointer = (dir) => git(dir, ['rev-parse', `main:${NESTED.ext.folder}`]).trim();

/** Each repository a landing answer names, with the tasks it merged there. @param {{repos: {repo: string, merged?: string[]}[]}} answer */
const mergedIn = (answer) => answer.repos.map(({ repo, merged }) => [repo, merged ?? null]);

describe('land: the engine\'s own move of a submodule\'s pointer never moves it back (landing-git.cjs, `pointerFrom`)', () => {
  it('a phase whose merge in the project stopped after ext\'s merged, a later phase moving ext\'s pointer landing past it: the phase landed then keeps main pointing ext at the later landing, never back to its own, and finish moves nothing', () => {
    const at = project();
    const page = cutTask(at.dir, '2.2', 'fix', 'Fix the page', 'main', { 'page.txt': 'page\n' });
    const fix = track(at.dir, '2.3', 'fix', 'Fix ext');
    commitFiles(at.dir, fix.branch, page.branch, { 'fix.txt': 'fix\n' }, { gitlinks: { [NESTED.ext.folder]: commitFiles(at.ext, fix.branch, 'main', { 'ext-fix.txt': 'fix\n' }) } });
    for (const task of [rates, show, page, fix]) ok(at.dir, openArgs(task));
    ok(at.dir, ['land', 'chain', 'pay', '2.3']);
    fs.writeFileSync(path.join(at.dir, 'rates.txt'), 'in the way\n');
    const stopped = /phase 1 merged in ext/.test(refuses(at.dir, ['land', 'phase', 'pay', '1']).error);
    const later = mergedIn(ok(at.dir, ['land', 'phase', 'pay', '2']));
    const landing = tip(at.ext, 'main');
    fs.rmSync(path.join(at.dir, 'rates.txt'));
    const first = mergedIn(ok(at.dir, ['land', 'phase', 'pay', '1']));
    const kept = pointer(at.dir);
    finishReady(at.dir);

    assert.deepStrictEqual([stopped, later, first, kept, ok(at.dir, ['land', 'finish', 'pay']).repos, pointer(at.dir), tip(at.ext, 'main')], [
      true, [['ext', ['2.3']], ['.', ['2.2', '2.3']]], [['.', ['1.1', '1.2']]], landing, [], landing, landing,
    ]);
  });
});
