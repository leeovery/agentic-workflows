'use strict';

// ---------------------------------------------------------------------------
// The local landing driver across nested repositories where a landing comes
// late (leeway-engine/scripts/drivers/landing/local/driver.cjs): a phase
// whose merge in the project stopped after its clone's merged, a later
// phase landing past it there, lands the rest once run again, its clone's
// merge never made twice, and finish moves nothing. A task changed after
// its phase landed is test-engine-landing-conformance-nested-again.cjs's.
// Git layer: the nested world (landing-world.cjs), built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ok, refuses, tip } = require('./engine-harness.cjs');
const { NESTED_TASKS, openArgs, track, cutTask, commitFiles, setLandingDriver, useNestedWorld, finishReady } = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-again-', (dir) => setLandingDriver(dir, 'local'));

/** Each repository a landing answer names, with the tasks it merged there. @param {{repos: {repo: string, merged?: string[]}[]}} answer */
const mergedIn = (answer) => answer.repos.map(({ repo, merged }) => [repo, merged ?? null]);

describe('land: a landing that comes late across nested repositories', () => {
  it('a phase whose merge in the project stopped after ext\'s merged, a later phase landing past it in ext: the phase lands the rest once run again, its merge in ext never made twice, and finish moves nothing', () => {
    const at = project();
    const page = cutTask(at.dir, '2.2', 'fix', 'Fix the page', 'main', { 'page.txt': 'page\n' });
    const fix = track(at.dir, '2.3', 'fix', 'Fix ext');
    commitFiles(at.ext, fix.branch, 'main', { 'ext-fix.txt': 'fix\n' });
    commitFiles(at.dir, fix.branch, page.branch, { 'fix.txt': 'fix\n' });
    for (const task of [rates, show, page, fix]) ok(at.dir, openArgs(task));
    ok(at.dir, ['land', 'chain', 'pay', '2.3']);
    fs.writeFileSync(path.join(at.dir, 'rates.txt'), 'in the way\n');
    const stopped = /phase 1 merged in ext/.test(refuses(at.dir, ['land', 'phase', 'pay', '1']).error);
    const later = mergedIn(ok(at.dir, ['land', 'phase', 'pay', '2']));
    const landing = tip(at.ext, 'main');
    fs.rmSync(path.join(at.dir, 'rates.txt'));
    const first = mergedIn(ok(at.dir, ['land', 'phase', 'pay', '1']));
    finishReady(at.dir);

    assert.deepStrictEqual([stopped, later, first, ok(at.dir, ['land', 'finish', 'pay']).repos, tip(at.ext, 'main')], [
      true, [['ext', ['2.3']], ['.', ['2.2', '2.3']]], [['.', ['1.1', '1.2']]], [], landing,
    ]);
  });
});
