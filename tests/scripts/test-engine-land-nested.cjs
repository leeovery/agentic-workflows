'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's submodule pointer (leeway-engine/scripts/
// drivers/landing/local/driver.cjs), past what every driver gives (the
// nested conformance suite's): as a phase merges, each task's landing in the
// repository holding a submodule points it at the submodule's landing of
// that task, a landing leaving the pointer carrying the one before it, and
// one moving it to a commit the submodule landed nothing for keeping that
// commit; phases side by side, each moving the pointer — one at its second
// task, cut from the default branch's tip — land in either order, the later
// replayed onto the earlier; the project's default branch moved where its
// checkout has it out, the submodule's checkout kept on its default branch
// though the person's git recurses into submodules; and a project that is
// a folder of a larger repository records its submodule's pointer at the
// path from the repository's top (7.2.17). The nested repositories the
// driver passes over or refuses are test-engine-land-nested-refusals.cjs's.
// Git layer: the nested world (landing-world.cjs), built once and copied
// for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, refuses, git, tip, initRepo, addSubmodule } = require('./engine-harness.cjs');
const {
  BASE, NESTED, NESTED_TASKS, openArgs, track, cutTask, commitFiles, landedOn, setLandingDriver, useNestedWorld, landingCommits, pointersOn,
} = require('./landing-world.cjs');

const { rates, show } = NESTED_TASKS;
const project = useNestedWorld('engine-land-nested-', (dir) => setLandingDriver(dir, 'local'));

describe('land phase: the local driver\'s submodule pointer', () => {
  it('points each task\'s landing at the submodule\'s landing of that task — a landing leaving the pointer carrying the one before it, and one moving it to a commit the submodule landed nothing for keeping it', () => {
    const at = project();
    const bump = track(at.dir, '1.3', 'feat', 'Bump rates');
    const bumped = commitFiles(at.ext, bump.branch, rates.branch, { 'ext-bump.txt': 'bump\n' });
    commitFiles(at.dir, bump.branch, show.branch, { 'bump.txt': 'bump\n' }, { gitlinks: { [NESTED.ext.folder]: bumped } });
    const base = tip(at.ext, BASE);
    const pin = cutTask(at.dir, '1.4', 'feat', 'Pin ext', bump.branch, { 'pin.txt': 'pin\n' }, { gitlinks: { [NESTED.ext.folder]: base } });
    for (const task of [rates, show, bump, pin]) ok(at.dir, openArgs(task));

    ok(at.dir, ['land', 'phase', 'pay', '1']);
    const landed = Object.fromEntries(landingCommits(at.ext));
    assert.deepStrictEqual(Object.keys(landed), ['pay-1-1', 'pay-1-3']);
    assert.deepStrictEqual(pointersOn(at.dir), [['pay-1-1', landed['pay-1-1']], ['pay-1-2', landed['pay-1-1']], ['pay-1-3', landed['pay-1-3']], ['pay-1-4', base]]);
    assert.deepStrictEqual(landedOn(at.dir, 'main').map(({ subject }) => subject), ['feat(pay): Add rates', 'feat(pay): Show rates', 'feat(pay): Bump rates', 'feat(pay): Pin ext']);
  });

  it('merges phases side by side, each moving the pointer — one at its second task, cut from the default branch\'s tip — in either order: each landing pointing at the submodule\'s landing of its own task, never the commit its branch points at, the later replayed onto the earlier', () => {
    const at = project();
    const page = cutTask(at.dir, '2.2', 'fix', 'Fix the page', 'main', { 'page.txt': 'page\n' });
    const fix = track(at.dir, '2.3', 'fix', 'Fix ext');
    const fixed = commitFiles(at.ext, fix.branch, 'main', { 'ext-fix.txt': 'fix\n' });
    commitFiles(at.dir, fix.branch, page.branch, { 'fix.txt': 'fix\n' }, { gitlinks: { [NESTED.ext.folder]: fixed } });
    const was = git(at.dir, ['rev-parse', `main:${NESTED.ext.folder}`]).trim();
    for (const task of [rates, page, fix]) ok(at.dir, openArgs(task));
    ok(at.dir, ['land', 'chain', 'pay', '2.3']);

    ok(at.dir, ['land', 'phase', 'pay', '2']);
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    const landed = Object.fromEntries(landingCommits(at.ext));
    assert.deepStrictEqual(Object.keys(landed), ['pay-2-3', 'pay-1-1']);
    assert.deepStrictEqual(pointersOn(at.dir), [['pay-2-2', was], ['pay-2-3', landed['pay-2-3']], ['pay-1-1', landed['pay-1-1']]]);
    assert.strictEqual(landed['pay-1-1'], tip(at.ext, 'main'));
  });

  it('moves the project\'s default branch where its checkout has it out, the submodule\'s checkout moved by its own landing and kept on its default branch though the person\'s git recurses into submodules — but stops where a pointer is staged there, as any change not committed', () => {
    const at = project();
    git(at.dir, ['config', 'submodule.recurse', 'true']);
    git(at.dir, ['update-index', '--cacheinfo', `160000,${tip(at.ext, rates.branch)},${NESTED.ext.folder}`]);
    ok(at.dir, openArgs(rates));
    const before = tip(at.dir, 'main');
    assert.match(
      refuses(at.dir, ['land', 'phase', 'pay', '1']).error,
      new RegExp(`^land: main is checked out at ${at.dir}, with changes not committed: ${NESTED.ext.folder}, so nothing moved — .+ \\(phase 1 merged in ext, lib before it\\)$`),
    );
    assert.strictEqual(tip(at.dir, 'main'), before);
    git(at.dir, ['reset', '-q', '--', NESTED.ext.folder]);
    ok(at.dir, ['land', 'phase', 'pay', '1']);
    assert.strictEqual(git(at.dir, ['rev-parse', 'HEAD']).trim(), tip(at.dir, 'main'));
    assert.deepStrictEqual([git(at.ext, ['rev-parse', '--symbolic-full-name', 'HEAD']).trim(), git(at.ext, ['rev-parse', 'HEAD']).trim()], ['refs/heads/main', tip(at.ext, 'main')]);
    assert.strictEqual(git(at.dir, ['rev-parse', `main:${NESTED.ext.folder}`]).trim(), tip(at.ext, 'main'));
  });

  it('records the pointer of a submodule in a project that is a folder of a larger repository at its path from the repository\'s top (7.2.17)', () => {
    const at = project();
    const app = path.join(at.dir, 'app');
    const upstream = initRepo(path.join(path.dirname(at.dir), 'deep'));
    git(upstream, ['commit', '-q', '--allow-empty', '-m', 'deep']);
    const deep = addSubmodule(at.dir, 'app/deep', upstream);
    git(deep, ['tag', BASE]);
    const task = track(at.dir, '1.5', 'feat', 'Go deep');
    const pointer = commitFiles(deep, task.branch, 'main', { 'deep.txt': 'deep\n' });
    commitFiles(at.dir, task.branch, 'main', { 'app/deep.txt': 'deep\n' }, { gitlinks: { 'app/deep': pointer } });

    assert.deepStrictEqual(ok(app, openArgs(task)).repos.map((/** @type {{repo: string}} */ { repo }) => repo), ['deep', '.']);
    ok(app, ['land', 'phase', 'pay', '1']);
    assert.deepStrictEqual(landingCommits(deep).map(([shown]) => shown), ['pay-1-5']);
    assert.deepStrictEqual(pointersOn(at.dir, 'app/deep').slice(-1), [['pay-1-5', tip(deep, 'main')]]);
  });
});
