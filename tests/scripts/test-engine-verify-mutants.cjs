'use strict';

// ---------------------------------------------------------------------------
// The mutation tool over a phase's lines (leeway-engine/scripts/domain/
// verify.cjs, `verify mutants`): run at the phase's tips wherever it is
// called from, the project laid out there in a scratch worktree of the
// engine's beside the builders' isolation worktrees, below no folder a test
// runner leaves out — prepared as an isolation worktree is, each repository's
// included files copied and the settings' directories linked — and taken
// apart after, the tool runs in the project's folder there — a project
// nested in a larger repository its folder of it, never the repository's
// top — and is handed the lines the phase's commits changed in every
// repository holding its work, by their paths from that folder, as they
// stand at its tip, and the verb answers what survived on them, read
// whatever the tool's exit code, each survivor's path read as the
// project's, a survivor on none of the changed files refused — writing
// nothing but the survivors, left in the unit's cache under the tips it ran
// at (15.S9, 15.6.3, 15.6.6, 7.2.17).
//
// Layer: git. World: verify-world.cjs's, the setup recorded.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ok, refusedPristine, commitCode, initRepo, addSubmodule, cleanupFixture, createFile, treeSnapshot, head, git,
} = require('./engine-harness.cjs');
const { UNIT, SETUP, steer, steering, setupArgs, world } = require('./verify-world.cjs');

const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

/** Task 1.`n`'s branch, as the landing names it. @param {number} n */
const branchOf = (n) => taskBranch({ unit: UNIT, phase: 1, n }, 'feat', 'Take a card');

/** @type {string} */ let dir;
afterEach(() => cleanupFixture(dir));

describe('verify mutants: the mutation tool over a phase\'s lines (15.6.3, 15.6.6)', () => {
  beforeEach(() => { dir = world(); });

  /** A code commit of `files` in `repo`, its message closing on `trailer`. @param {string} repo @param {Record<string, string>} files @param {string} trailer */
  function commitWith(repo, files, trailer) {
    for (const [file, text] of Object.entries(files)) createFile(repo, file, text);
    commitCode(repo, `feat(pay): work\n\n${trailer}`);
  }

  /**
   * The phase's commits on its tasks' branches, stacked — its own, another
   * unit's of a like name, and the next phase's — in the root and in a
   * nested repository, each checkout left on its default branch.
   */
  function phaseWork() {
    git(dir, ['checkout', '-q', '-b', branchOf(1)]);
    commitWith(dir, { 'src/card.js': 'const card = 1;\nconst brand = "visa";\nconst cvc = 3;\n' }, 'Leeway-Task: pay-1-1');
    commitWith(dir, { 'src/other.js': 'other\n' }, 'Leeway-Task: pay-1-2-1');
    git(dir, ['checkout', '-q', '-b', branchOf(2)]);
    commitWith(dir, { 'src/form.js': 'a\nb\n', 'src/card.js': 'const card = 1;\nconst brand = "visa";\nconst cvc = 4;\n' }, 'Leeway-Task: pay-1-2');
    commitWith(dir, { 'src/refund.js': 'refund\n' }, 'Leeway-Task: pay-2-1');
    git(dir, ['checkout', '-q', 'main']);
    const lib = initRepo(path.join(dir, 'lib'));
    createFile(lib, 'x.js', 'x\n');
    commitCode(lib, 'init');
    git(lib, ['checkout', '-q', '-b', branchOf(1)]);
    commitWith(lib, { 'x.js': 'x\ny\n' }, 'Leeway-Task: pay-1-1');
    git(lib, ['checkout', '-q', 'main']);
  }

  /** Where the engine lays the project out at phase 1's tips: beside the builders' isolation worktrees. */
  const scratch = () => path.join(fs.realpathSync(dir), '.claude', 'worktrees', `leeway-mutants-${UNIT}-phase-1`);

  /** The folders Jest, Vitest and their like leave out of a test run wherever they fall on its path. */
  const LEFT_OUT = ['.git', '.hg', '.sl', '.cache', '.idea', '.output', '.temp'];

  /** The survivors the tool reports, written for it. @param {unknown} survivors */
  const surviving = (survivors) => steering(dir, 'survivors.json', JSON.stringify(survivors));

  it('15.S9: run from a checkout at none of the phase\'s tips, the tool runs at them, laid out by the engine and taken apart after, handed the lines the phase\'s commits changed in every repository holding its work, as they stand at its tip, and the verb answers the survivors on them alone — a path given from `./`, absolute or nested read as the project\'s — whatever the tool\'s exit code, writing nothing but the survivors, left in the unit\'s cache under the tips it ran at', () => {
    phaseWork();
    surviving([
      { path: './src/card.js', line: 2, mutant: 'string "visa" → ""' },
      { path: path.join(scratch(), 'src', 'form.js'), line: 1, mutant: 'removed' },
      { path: 'lib/x.js', line: 2, mutant: 'y → z' },
      { path: 'src/card.js', line: 1, mutant: '1 → 0' },
    ]);
    steering(dir, 'fail-mutate', '3');
    const before = { tree: treeSnapshot(dir), head: head(dir) };

    const res = ok(dir, ['verify', 'mutants', UNIT, '1']);

    const survivors = [
      { path: 'src/card.js', line: 2, mutant: 'string "visa" → ""' },
      { path: 'src/form.js', line: 1, mutant: 'removed' },
      { path: 'lib/x.js', line: 2, mutant: 'y → z' },
    ];
    assert.deepStrictEqual(res, { ok: true, unit: UNIT, phase: 1, survivors });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(steer(dir), 'changed.json'), 'utf8')), [
      { path: 'src/card.js', lines: [[2, 3]] },
      { path: 'src/form.js', lines: [[1, 2]] },
      { path: 'lib/x.js', lines: [[2, 2]] },
    ]);
    const commits = [{ repo: '.', commit: git(dir, ['rev-parse', branchOf(2)]).trim() }, { repo: 'lib', commit: git(path.join(dir, 'lib'), ['rev-parse', branchOf(1)]).trim() }];
    const key = crypto.createHash('sha256').update(JSON.stringify(commits)).digest('hex').slice(0, 16);
    const cached = { [`.cache/${UNIT}/build/mutants/phase-1/${key}.json`]: `${JSON.stringify({ commits, survivors }, null, 2)}\n` };
    assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, { ...before, tree: { ...before.tree, ...cached } });
    assert.deepStrictEqual([fs.existsSync(scratch()), git(dir, ['worktree', 'list', '--porcelain']).includes(scratch())], [false, false], 'the scratch worktree is taken apart');
  });

  it('a scratch worktree an interrupted run left behind, registered in each repository, is taken apart before the layout, and the run goes on', () => {
    phaseWork();
    surviving([]);
    git(dir, ['worktree', 'add', '-q', '--detach', scratch(), 'main']);
    git(path.join(dir, 'lib'), ['worktree', 'add', '-q', '--detach', path.join(scratch(), 'lib'), 'main']);

    const res = ok(dir, ['verify', 'mutants', UNIT, '1']);

    assert.deepStrictEqual([res.survivors, fs.readFileSync(path.join(steer(dir), 'ran-in'), 'utf8').trim(), fs.existsSync(scratch())], [[], scratch(), false]);
  });

  it('a submodule holding none of the phase\'s work is laid out at the commit the phase\'s tip points it at, never where its own checkout stands', (t) => {
    const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-mutants-ext-')));
    t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
    const source = initRepo(path.join(folder, 'ext-source'));
    createFile(source, 'e.txt', 'pointed\n');
    commitCode(source, 'pointed');
    const ext = addSubmodule(dir, 'ext', source);
    git(dir, ['checkout', '-q', '-b', branchOf(1)]);
    commitWith(dir, { 'src/card.js': 'const card = 1;\nconst brand = "visa";\n' }, 'Leeway-Task: pay-1-1');
    git(dir, ['checkout', '-q', 'main']);
    createFile(ext, 'e.txt', 'moved on\n');
    commitCode(ext, 'moved on');
    steering(dir, 'look', 'ext/e.txt\n');
    surviving([]);

    ok(dir, ['verify', 'mutants', UNIT, '1']);

    assert.strictEqual(fs.readFileSync(path.join(steer(dir), 'looked'), 'utf8').trim(), 'ext/e.txt holds pointed');
  });

  it('the tool runs beside the builders\' isolation worktrees, in .claude/worktrees of the project\'s main checkout, whichever checkout calls it — below no folder a test runner leaves out', () => {
    phaseWork();
    surviving([]);
    const builder = path.join(fs.realpathSync(dir), '.claude', 'worktrees', 'agent-1');
    git(dir, ['worktree', 'add', '-q', '--detach', builder, 'main']);

    ok(builder, ['verify', 'mutants', UNIT, '1']);

    const ran = fs.readFileSync(path.join(steer(dir), 'ran-in'), 'utf8').trim();
    assert.strictEqual(ran, scratch());
    assert.deepStrictEqual(path.relative(fs.realpathSync(dir), ran).split(path.sep).filter((folder) => LEFT_OUT.includes(folder)), []);
  });

  it('the tool runs in a worktree prepared as Claude Code prepares an isolation worktree, in each repository: the ignored files its own .worktreeinclude names copied, and the directories the project\'s settings name in worktree.symlinkDirectories linked, never copied — a file not ignored, one ignored and not named, and a name leaving the project passed over', () => {
    phaseWork();
    const lib = path.join(dir, 'lib');
    const files = {
      '.gitignore': '.env\n.env.local\nnode_modules/\n', '.worktreeinclude': '.env\nnotes.txt\n', '.env': 'KEY=1\n', '.env.local': 'LOCAL=1\n', 'notes.txt': 'notes\n',
      'node_modules/tool/run.txt': 'run\n', 'lib/.gitignore': '.env\n.secret\n', 'lib/.worktreeinclude': '.secret\n', 'lib/.env': 'LIB=1\n', 'lib/.secret': 'SECRET=1\n', 'lib/vendor/kit.txt': 'kit\n',
    };
    for (const [file, text] of Object.entries(files)) createFile(dir, file, text);
    const outside = `../${path.basename(fs.mkdtempSync(path.join(path.dirname(dir), 'outside-')))}`;
    createFile(dir, '.claude/settings.json', JSON.stringify({ worktree: { symlinkDirectories: ['node_modules', outside] } }));
    createFile(dir, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['vendor/'] } }));
    steering(dir, 'look', `${['.env', '.env.local', 'notes.txt', 'node_modules', 'node_modules/tool/run.txt', outside, 'lib/.env', 'lib/.secret', 'lib/vendor', 'lib/vendor/kit.txt'].join('\n')}\n`);
    surviving([]);

    try {
      ok(dir, ['verify', 'mutants', UNIT, '1']);
    } finally {
      fs.rmSync(path.join(dir, outside), { recursive: true, force: true });
    }

    assert.deepStrictEqual(fs.readFileSync(path.join(steer(dir), 'looked'), 'utf8').trimEnd().split('\n'), [
      '.env holds KEY=1',
      '.env.local is not there',
      'notes.txt is not there',
      `node_modules linked to ${fs.realpathSync(path.join(dir, 'node_modules'))}`,
      'node_modules/tool/run.txt holds run',
      `${outside} is not there`,
      'lib/.env is not there',
      'lib/.secret holds SECRET=1',
      `lib/vendor linked to ${fs.realpathSync(path.join(lib, 'vendor'))}`,
      'lib/vendor/kit.txt holds kit',
    ]);
    assert.deepStrictEqual([fs.readFileSync(path.join(dir, 'node_modules/tool/run.txt'), 'utf8'), fs.readFileSync(path.join(lib, 'vendor/kit.txt'), 'utf8'), fs.existsSync(scratch())], ['run\n', 'kit\n', false], 'taking the worktree apart removes the links alone');
  });

  it('7.2.17: a project nested in a larger repository is laid out as a task\'s worktree has it — the tool runs in the project\'s folder of the scratch worktree, handed paths from there, its included files, its links and its child repository there', () => {
    const app = path.join(dir, 'app');
    fs.mkdirSync(app);
    for (const folder of ['verify', 'src']) git(dir, ['mv', folder, `app/${folder}`]);
    for (const [file, text] of Object.entries({ 'README.md': 'the larger repository\n', 'app/.gitignore': '.env\nvendor/\n', 'app/.worktreeinclude': '.env\n' })) createFile(dir, file, text);
    commitCode(dir, 'chore: the project moves into app/');
    createFile(app, '.env', 'KEY=1\n');
    createFile(app, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['vendor'] } }));
    steering(dir, 'verdict', 'pass\n');
    ok(app, setupArgs(dir, SETUP));
    git(dir, ['checkout', '-q', '-b', branchOf(1)]);
    commitWith(dir, { 'app/src/card.js': 'const card = 1;\nconst brand = "visa";\n' }, 'Leeway-Task: pay-1-1');
    git(dir, ['checkout', '-q', 'main']);
    const lib = initRepo(path.join(app, 'lib'));
    for (const [file, text] of Object.entries({ '.gitignore': 'vendor/\n', 'x.js': 'x\n' })) createFile(lib, file, text);
    commitCode(lib, 'init');
    createFile(lib, 'vendor/kit.txt', 'kit\n');
    git(lib, ['checkout', '-q', '-b', branchOf(1)]);
    commitWith(lib, { 'x.js': 'y\n' }, 'Leeway-Task: pay-1-1');
    git(lib, ['checkout', '-q', 'main']);
    steering(dir, 'look', '.env\nlib/x.js\nlib/vendor\n');
    surviving([]);

    ok(app, ['verify', 'mutants', UNIT, '1']);

    const read = (/** @type {string} */ name) => fs.readFileSync(path.join(steer(dir), name), 'utf8');
    assert.strictEqual(read('ran-in').trim(), path.join(scratch(), 'app'));
    assert.deepStrictEqual(JSON.parse(read('changed.json')), [{ path: 'src/card.js', lines: [[2, 2]] }, { path: 'lib/x.js', lines: [[1, 1]] }]);
    assert.deepStrictEqual(read('looked').trimEnd().split('\n'), ['.env holds KEY=1', 'lib/x.js holds y', `lib/vendor linked to ${fs.realpathSync(path.join(lib, 'vendor'))}`]);
    assert.strictEqual(fs.existsSync(scratch()), false, 'taken apart');
  });

  it('a survivor naming none of the files the phase changed — another phase\'s, or a nested repository\'s path from its own root — is refused, naming each and the path\'s form', () => {
    phaseWork();
    surviving([{ path: 'src/refund.js', line: 1, mutant: 'removed' }, { path: 'x.js', line: 2, mutant: 'y → z' }, { path: 'src/card.js', line: 2, mutant: 'kept' }]);

    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the mutation tool named src/refund.js, x.js, none of the files the phase changed — a survivor\'s path is the project\'s, from its root, as $LEEWAY_CHANGED names each file');
  });

  it('survivors the tool did not write are refused with its exit code and output, the scratch worktree taken apart all the same in every repository, and survivors not of their shape are refused', () => {
    phaseWork();
    steering(dir, 'fail-mutate', '2');
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the mutation tool wrote no $LEEWAY_RUN/survivors.json — it writes what survived there, [] where nothing did; it exited 2. The last of its output, 40 lines at most:\nmutants survived');
    const registered = (/** @type {string} */ repo) => git(repo, ['worktree', 'list', '--porcelain']).includes(scratch());
    assert.deepStrictEqual([fs.existsSync(scratch()), registered(dir), registered(path.join(dir, 'lib'))], [false, false, false], 'the scratch worktree is taken apart where the tool fails');
    for (const written of ['not json', JSON.stringify([{ path: 'src/card.js', line: '2', mutant: 'x' }]), JSON.stringify({ survivors: [] })]) {
      steering(dir, 'survivors.json', written);
      assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error, 'verify mutants: the mutation tool\'s survivors.json is not a list of {path, line, mutant}');
    }
  });

  it('refused: a setup naming no mutation tool, a phase beyond the cut, and a phase whose tasks hold no work', () => {
    const { mutation: _mutation, ...without } = SETUP;
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '3']).error, 'verify mutants: "3" is no phase of pay\'s cut — it has 2 phases');
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error, 'verify mutants: no repository of the project holds work on phase 1 of pay\'s tasks');
    steering(dir, 'verdict', 'pass\n');
    ok(dir, setupArgs(dir, without));
    assert.strictEqual(refusedPristine(dir, ['verify', 'mutants', UNIT, '1']).error,
      'verify mutants: the verify setup names no mutation tool — where the language has none, each reviewer breaks the riskiest line of a criterion\'s code in a scratch worktree (15.6.5)');
  });
});
