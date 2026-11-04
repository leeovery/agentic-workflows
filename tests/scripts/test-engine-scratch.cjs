'use strict';

// ---------------------------------------------------------------------------
// A reviewer's scratch worktree (leeway-engine/scripts/domain/scratch.cjs):
// `scratch lay` lays the project out afresh beside the builders' isolation
// worktrees, every repository detached at the commit given and nested as
// the project lays them out, prepared as Claude Code prepares an isolation
// worktree — the files `.worktreeinclude` names copied, the directories
// `worktree.symlinkDirectories` names linked — answering the project's
// folder there; `scratch remove` takes it apart, the links alone; and what
// they refuse, writing nothing (13.2.2, 14.2.2). How the layout prepares
// each repository is test-engine-verify-mutants.cjs's, the same routine's.
//
// Layer: git. World: verify-world.cjs's, before its setup is recorded.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, refusedPristine, commitCode, initRepo, cleanupFixture, createFile, git,
} = require('./engine-harness.cjs');
const { unrecorded } = require('./verify-world.cjs');

const NAME = 'pay-1.1-a';

/** @type {string} */ let dir;
/** @type {string} */ let lib;
/** @type {string[]} */ let own;
/** @type {string[]} */ let libs;

/** The commit `repo` is checked out at. @param {string} repo */
const at = (repo) => git(repo, ['rev-parse', 'HEAD']).trim();

/** Where the scratch worktree `name` sits: beside the builders' isolation worktrees. @param {string} [name] */
const scratchAt = (name = NAME) => path.join(fs.realpathSync(dir), '.claude', 'worktrees', `leeway-scratch-${name}`);

/** How many worktrees `repo` has registered. @param {string} repo */
const registered = (repo) => git(repo, ['worktree', 'list', '--porcelain']).split('\n').filter((line) => line.startsWith('worktree ')).length;

/** A refusal, writing nothing: its error. @param {string[]} args */
const refused = (args) => refusedPristine(dir, ['scratch', ...args]).error;

beforeEach(() => {
  dir = unrecorded();
  createFile(dir, 'src/card.js', 'card\n');
  commitCode(dir, 'feat(pay): a card');
  own = [git(dir, ['rev-parse', 'HEAD~1']).trim(), at(dir)];
  lib = initRepo(path.join(dir, 'lib'));
  createFile(lib, 'x.js', 'x\n');
  commitCode(lib, 'init');
  createFile(lib, 'x.js', 'y\n');
  commitCode(lib, 'second');
  libs = [git(lib, ['rev-parse', 'HEAD~1']).trim(), at(lib)];
  const files = { '.gitignore': '.env\nnode_modules/\n', '.worktreeinclude': '.env\n', '.env': 'KEY=1\n', 'node_modules/dep/index.js': 'dep\n' };
  for (const [file, text] of Object.entries(files)) createFile(dir, file, text);
  createFile(dir, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['node_modules'] } }));
});
afterEach(() => cleanupFixture(dir));

describe('scratch lay and remove (13.2.2, 14.2.2)', () => {
  it('lays the project out at the commits given, each repository detached and nested, prepared as its checkout is, answering its folder; laid again, afresh; removed, the links alone, every registration with it', () => {
    const before = [registered(dir), registered(lib)];
    const first = ok(dir, ['scratch', 'lay', NAME, own[0], `lib=${libs[0]}`]);
    const top = scratchAt();
    const laid = [at(top), at(path.join(top, 'lib')), fs.readFileSync(path.join(top, '.env'), 'utf8'), fs.readlinkSync(path.join(top, 'node_modules'))];
    const detached = [top, path.join(top, 'lib')].map((repo) => git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim());
    fs.writeFileSync(path.join(top, 'stray.txt'), 'left by the last reviewer\n');
    ok(dir, ['scratch', 'lay', NAME, own[1].slice(0, 12), `lib=${libs[1]}`]);
    const again = [at(top), at(path.join(top, 'lib')), fs.existsSync(path.join(top, 'stray.txt'))];
    const removed = ok(dir, ['scratch', 'remove', NAME]);

    assert.deepStrictEqual(first, { ok: true, name: NAME, path: top });
    assert.deepStrictEqual(laid, [own[0], libs[0], 'KEY=1\n', path.join(fs.realpathSync(dir), 'node_modules')]);
    assert.deepStrictEqual(detached, ['HEAD', 'HEAD'], 'every repository detached');
    assert.deepStrictEqual(again, [own[1], libs[1], false], 'laid out afresh at the new commits, nothing of the last left');
    assert.deepStrictEqual(removed, { ok: true, name: NAME, removed: true });
    assert.deepStrictEqual([fs.existsSync(top), fs.readFileSync(path.join(dir, 'node_modules/dep/index.js'), 'utf8'), registered(dir), registered(lib)], [false, 'dep\n', ...before]);
    assert.deepStrictEqual(ok(dir, ['scratch', 'remove', NAME]), removed, 'one not there passes');
  });

  it('refuses a name of another shape, a child of another shape, a folder no child repository\'s or given twice, a repository given no commit and a commit a repository lacks, writing nothing; another shape answers the usage', () => {
    assert.deepStrictEqual([
      refused(['lay', 'Pay Card', own[1], `lib=${libs[1]}`]),
      refused(['lay', NAME, own[1], 'lib']),
      refused(['lay', NAME, own[1], `lib=${libs[1]}`, `api=${libs[1]}`]),
      refused(['lay', NAME, own[1], `lib=${libs[1]}`, `lib=${libs[0]}`]),
      refused(['lay', NAME, own[1]]),
      refused(['lay', NAME, libs[1], `lib=${libs[1]}`]),
      refused(['lay', NAME, own[1], 'lib=feedface']),
      refused(['remove', '../out']),
    ], [
      'scratch lay: "Pay Card" is no scratch worktree\'s name — lowercase words, digits, dots and dashes',
      'scratch lay: "lib" names no child repository\'s commit — each is <folder>=<commit>',
      'scratch lay: api is no child repository of the project\'s',
      'scratch lay: lib is given a commit twice',
      'scratch lay: no commit is given for lib — every repository of the project is laid out, each <folder>=<commit>',
      `scratch lay: the project's repository has no commit ${libs[1]}`,
      'scratch lay: `lib` has no commit feedface',
      'scratch remove: "../out" is no scratch worktree\'s name — lowercase words, digits, dots and dashes',
    ]);
    assert.match(refused(['lay', NAME]), /^Usage: engine scratch lay <name> <commit> \[<folder>=<commit> …\] \| engine scratch remove <name>$/);
    assert.strictEqual(fs.existsSync(scratchAt()), false);
  });
});
