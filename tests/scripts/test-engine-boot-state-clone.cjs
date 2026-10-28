'use strict';

// ---------------------------------------------------------------------------
// A fresh clone's state (workflow-engine/scripts/domain/state-checks.cjs,
// domain/boot.cjs): the remote's state branch made its own and checked out,
// a remote out of reach; and two boots at once, everything made once.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const harness = require('./engine-harness.cjs');
const { git } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));

const {
  useWorld, STUB_ENGINE, read, tip, remoteTip, codeProject, cloneOf, boot, bootRefused, setUp, commitOnState, placed, IN_PLACE, traced, bootsWithNothingToDo, outOfReach,
} = require('./boot-state-world.cjs');

const world = useWorld();

// --- a fresh clone ------------------------------------------------------------

describe('a fresh clone (4.S11, 22.S2)', () => {
  it('makes the remote\'s leeway-state its own, checked out at .leeway/ and locked — and the next boot has nothing to do', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { root } = setUp({ remote: bare });
    commitOnState(root, { 'manifest.json': '{"kept":true}\n' });
    const fresh = cloneOf(bare, 'fresh');

    const res = boot(fresh);

    assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.strictEqual(read(fresh, '.leeway/manifest.json'), '{"kept":true}\n');
    bootsWithNothingToDo(fresh, bare);
  });

  it('with the remote out of reach, checks out its branch as the clone fetched it, and says the remote could not be reached', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh');
    outOfReach(fresh);

    const { result: res, commands } = traced((trace) => boot(fresh, trace));

    assert.strictEqual(res.state, 'ready');
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^leeway-state could not be fetched from origin, so this session works on the state it has: git ls-remote failed: /);
    assert.deepStrictEqual(commands.filter((c) => /^(push|fetch|ls-remote) /.test(c)).map((c) => c.split(' ')[0]), ['ls-remote'], 'the remote was asked once, and never pushed to');
  });

  it('with the remote out of reach and nothing fetched, stops saying so — never as lost state — and writes nothing', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh', ['--single-branch', '--branch', 'main']);
    outOfReach(fresh);
    const before = git(fresh, ['for-each-ref']);

    assert.match(bootRefused(fresh), /^origin could not be reached, and this clone holds no leeway-state of its own, so boot wrote nothing — start again once it can be reached: git ls-remote failed: /);

    assert.strictEqual(git(fresh, ['for-each-ref']), before);
    assert.ok(!fs.existsSync(path.join(fresh, '.leeway')));
    assert.strictEqual(git(fresh, ['status', '--porcelain']), '');
  });
});

// --- two boots at once ----------------------------------------------------------

/**
 * Two boots at once, each a process of its own, as two sessions opened on
 * one project start: their answers.
 * @param {string} dir
 * @returns {Promise<any[]>}
 */
function twoBootsAtOnce(dir) {
  const one = () => new Promise((resolve) => {
    const child = spawn(process.execPath, [STUB_ENGINE, 'boot'], { cwd: dir, env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', () => resolve(JSON.parse(out.trim() === '' ? err : out.split('\n')[0])));
  });
  return Promise.all([one(), one()]);
}

/** Everything a boot makes, by count: the state's first commits, its registrations, the ignore line and the commits the code tree gained. @param {string} main */
function madeOnce(main) {
  return {
    roots: git(main, ['rev-list', '--max-parents=0', STATE_BRANCH]).trim().split('\n').length,
    registrations: fs.readdirSync(path.join(main, '.git/worktrees')),
    ignore: read(main, '.gitignore'),
    code: git(main, ['log', '--format=%s']).trim().split('\n'),
  };
}

describe('two boots at once (4.S3)', () => {
  it('on a project being set up, both answer ready, and everything is made once', async () => {
    const main = codeProject();

    const answers = await twoBootsAtOnce(main);

    assert.deepStrictEqual(answers.map((a) => [a.ok, a.state, a.error]), [[true, 'ready', undefined], [true, 'ready', undefined]]);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.deepStrictEqual(madeOnce(main), {
      roots: 1, registrations: ['-leeway'], ignore: '.leeway/\n',
      code: ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state', 'code'],
    });
    bootsWithNothingToDo(main, null);
  });

  it('on a fresh clone, both answer ready, and the remote\'s branch is checked out once', async () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    setUp({ remote: bare });
    const fresh = cloneOf(bare, 'fresh');

    const answers = await twoBootsAtOnce(fresh);

    assert.deepStrictEqual(answers.map((a) => [a.ok, a.state, a.error]), [[true, 'ready', undefined], [true, 'ready', undefined]]);
    assert.strictEqual(tip(fresh, STATE_BRANCH), remoteTip(bare));
    assert.deepStrictEqual(placed(path.join(fresh, '.leeway')), IN_PLACE);
    assert.deepStrictEqual(fs.readdirSync(path.join(fresh, '.git/worktrees')), ['-leeway']);
    bootsWithNothingToDo(fresh, bare);
  });
});
