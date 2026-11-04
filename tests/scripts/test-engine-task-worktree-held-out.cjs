'use strict';

// ---------------------------------------------------------------------------
// A task's worktree, its prepared links and nested clones held out
// (leeway-engine/scripts/domain/worktree-prep.cjs; the commit door's staging,
// engine.cjs's checkedGroups): a link the worktree's preparation made at a
// folder a committed `.gitignore` names, in the root or a child, is no change
// of the task's — the door, `code status` and a take-over pass over it, and
// task done and task close each end their task, the link removed with its
// worktree — the door staging neither it nor a nested clone where a merge
// names their folder, and refusing by either route, in the root and a child,
// an index that holds either already, by every way git stages one: the link,
// a clone's gitlink no `.gitmodules` maps, a file in a clone's folder at any
// depth, its remedy quoted for the shell — what is the task's own, a link of
// its own or work inside an untracked clone, committing beside them. Git
// layer: the task worktree world (task-worktree-world.cjs), built once and
// copied for each test. The worktree taken apart as the task ends:
// test-engine-task-worktree-end.cjs; its submodules, each a gitlink
// `.gitmodules` maps: test-engine-task-worktree-submodules.cjs.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { ok, output, refuses, git, createFile, initRepo, accountTaken } = require('./engine-harness.cjs');
const { UNIT, taskWorktreeWorld, as, building, isolation, layOut, statusOf } = require('./task-worktree-world.cjs');

const project = taskWorktreeWorld('engine-task-worktree-held-out-');

describe('a task\'s worktree: the links its preparation made and the nested clones, held out of the door', () => {
  /**
   * The project with a committed `.gitignore` naming `vendor/` in the root
   * and its clone `lib`, each checkout holding a `vendor` folder the
   * project's settings name to link; and a worktree of Claude Code's
   * isolation, linked as it links one.
   */
  function linkedProject() {
    const at = project();
    for (const repo of [at.dir, at.lib]) {
      fs.appendFileSync(path.join(repo, '.gitignore'), 'vendor/\n');
      git(repo, ['add', '.gitignore']);
      git(repo, ['commit', '-q', '-m', 'ignore vendor']);
      createFile(repo, 'vendor/kit.txt', 'kit\n');
    }
    createFile(at.dir, '.claude/settings.local.json', JSON.stringify({ worktree: { symlinkDirectories: ['vendor'] } }));
    /** @param {string} name */
    const linkedIsolation = (name) => {
      const tree = isolation(at.dir, name);
      fs.symlinkSync(path.join(at.dir, 'vendor'), path.join(tree, 'vendor'), 'dir');
      return tree;
    };
    return { at, linkedIsolation };
  }

  /**
   * The chain's tip moved past task 3.1's branch in lib, and merged back in
   * the task's lib, `git merge --no-ff --no-commit`, as the chain slot says.
   * @param {string} lib the clone's checkout @param {string} tree the task's lib
   */
  function chainMergedBack(lib, tree) {
    git(tree, ['branch', 'chained']);
    git(lib, ['checkout', '-q', 'chained']);
    createFile(lib, 'chained.txt', 'chained\n');
    git(lib, ['add', 'chained.txt']);
    git(lib, ['commit', '-q', '-m', 'chained work']);
    git(lib, ['checkout', '-q', '-']);
    git(tree, ['merge', '-q', '--no-ff', '--no-commit', 'chained']);
  }

  it('a link the worktree\'s preparation made — the root\'s, Claude Code\'s, and a child repository\'s — is no change of a task\'s where a committed .gitignore names its folder as one, vendor/: the door stages none of it though a folder named holds it, leaves it out of left_dirty and refuses it named, code status — which verify run reads — and the uncommitted diff read none — a link the settings do not name being the work\'s — a /clear\'s take-over passes it, and task done and task close each end their task', () => {
    const { at, linkedIsolation } = linkedProject();
    const session = building(at.dir, ['3.1', '3.2']);
    const a = linkedIsolation('a');
    ok(a, layOut('3.1'), as(session));
    ok(linkedIsolation('c'), layOut('3.2'), as(session));
    createFile(a, 'lib/lib-fees.txt', 'fees\n');

    const committed = ok(a, ['commit', '--paths', 'lib', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session));
    const staged = git(path.join(a, 'lib'), ['show', '--name-only', '--format=', 'HEAD']).trim();
    const named = refuses(a, ['commit', '--paths', 'lib/vendor', '--task', UNIT, '3.1', '-m', 'feat(pay): vendor'], as(session)).error;
    const status = ok(a, ['code', 'status'], as(session)).files;
    const diff = output(a, ['code', 'diff'], as(session));
    fs.symlinkSync(path.join(at.lib, 'vendor'), path.join(a, 'lib', 'kit'), 'dir');
    const own = ok(a, ['code', 'status'], as(session)).files;
    fs.unlinkSync(path.join(a, 'lib', 'kit'));
    const later = building(at.dir, ['3.1', '3.2']);
    const takenOver = ok(linkedIsolation('b'), layOut('3.1'), as(later)).taken_over?.worktree;
    accountTaken(at.dir, UNIT, '3.1');
    ok(at.dir, ['task', 'done', UNIT, '3.1'], as(later));
    ok(at.dir, ['task', 'close', UNIT, '3.2', '--reason', 'Not needed.'], as(later));

    assert.deepStrictEqual([committed.left_dirty, staged, status, diff, own, takenOver], [[], 'lib-fees.txt', [], '', [{ path: 'lib/kit', status: '??' }], a]);
    assert.strictEqual(named, 'commit --paths: "vendor" in lib is a link the worktree\'s preparation made, as worktree.symlinkDirectories names, never the work\'s — leave it out');
    assert.deepStrictEqual([statusOf(at.dir, '3.1'), statusOf(at.dir, '3.2'), fs.readFileSync(path.join(at.lib, 'vendor', 'kit.txt'), 'utf8')], ['done', 'closed', 'kit\n']);
  });

  it('S1 (12.14): a merge committed through the door stages as any commit does — naming a child\'s folder holding a prepared link and a nested clone commits neither, the merge whole beside them', () => {
    const { at, linkedIsolation } = linkedProject();
    const session = building(at.dir, ['3.1']);
    const a = linkedIsolation('a');
    ok(a, layOut('3.1'), as(session));
    const lib = path.join(a, 'lib');
    const deps = initRepo(path.join(lib, 'deps'));
    git(deps, ['commit', '-q', '--allow-empty', '-m', 'deps']);
    chainMergedBack(at.lib, lib);
    createFile(lib, 'lib-fees.txt', 'fees\n');

    const merged = ok(a, ['commit', '--paths', 'lib', '--task', UNIT, '3.1', '-m', 'merge(pay): the chain back'], as(session));

    assert.deepStrictEqual([
      git(lib, ['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(' ').length - 1,
      git(lib, ['ls-tree', '--name-only', 'HEAD', '--', 'vendor', 'deps']).trim(),
      git(lib, ['show', '--name-only', '--format=', '--first-parent', '-m', 'HEAD']).trim().split('\n').sort(),
      merged.left_dirty,
    ], [2, '', ['chained.txt', 'lib-fees.txt'], []]);
  });

  /**
   * A commit on top of `repo`'s HEAD holding `entries` beside its tree —
   * each `[mode, object, name]` — made by plumbing, so no checkout moves.
   * @param {string} repo @param {Array<[string, string, string]>} entries @returns {string}
   */
  function heldCommit(repo, entries) {
    const index = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'held-index-'))), 'index');
    const plumb = (/** @type {string[]} */ args, /** @type {string} */ input = '') => execFileSync('git', args, { cwd: repo, input, encoding: 'utf8', env: { ...process.env, GIT_INDEX_FILE: index } }).trim();
    try {
      plumb(['read-tree', 'HEAD']);
      for (const [mode, object, name] of entries) plumb(['update-index', '--add', '--cacheinfo', `${mode},${object},${name}`]);
      return plumb(['commit-tree', plumb(['write-tree']), '-p', 'HEAD', '-m', 'held']);
    } finally {
      fs.rmSync(path.dirname(index), { recursive: true, force: true });
    }
  }

  /** Why the door refuses a commit in `repo` whose index holds `names`, each with what it is, as its way on names them. @param {string} repo @param {Array<[string, string]>} held */
  const heldRefusal = (repo, held) => `commit --paths: the index in ${repo === '' ? '.' : repo} holds ${held.map(([name, what]) => `${name}, ${what}`).join('; and ')}, which the door never commits — unstage ${held.length === 1 ? 'it' : 'them'}, \`git${repo === '' ? '' : ` -C ${repo}`} restore --staged -- ${held.map(([name]) => name).join(' ')}\`, then run the commit again`;
  const LINK = 'a link the worktree\'s preparation made, as worktree.symlinkDirectories names';
  const CLONE = 'the gitlink of a repository nested in it that no .gitmodules entry maps';

  it('S1 (12.14): every way the index comes to hold a prepared link or a nested clone before a door commit — git add in each form, --force past an ignore rule, the index\'s plumbing, a checkout, restore or reset from a commit holding one, a merge, pick, revert, patch or stash bringing one, a file a merge writes in the clone\'s folder, git add -A mid-merge — refuses the commit by either route, in a child and the root, nothing committed, naming each and how to unstage them; git add -N stages neither', () => {
    const { at, linkedIsolation } = linkedProject();
    const session = building(at.dir, ['3.1']);
    const a = linkedIsolation('a');
    ok(a, layOut('3.1'), as(session));
    const lib = path.join(a, 'lib');
    const kit = initRepo(path.join(lib, 'kit'));
    git(kit, ['commit', '-q', '--allow-empty', '-m', 'kit']);
    const kitHead = git(kit, ['rev-parse', 'HEAD']).trim();
    createFile(lib, 'lib-rates.txt', 'rates\n');
    git(lib, ['add', '-N', 'kit', 'vendor']);
    ok(a, ['commit', '--paths', 'lib/lib-rates.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add rates'], as(session));
    const intended = git(lib, ['ls-tree', '--name-only', 'HEAD', '--', 'kit', 'vendor', 'lib-rates.txt']).trim();
    git(lib, ['reset', '-q']);
    const linkBlob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: lib, input: fs.readlinkSync(path.join(lib, 'vendor')), encoding: 'utf8' }).trim();
    const heldKit = heldCommit(lib, [['160000', kitHead, 'kit']]);
    const heldLink = heldCommit(lib, [['120000', linkBlob, 'vendor']]);
    const heldBoth = heldCommit(lib, [['160000', kitHead, 'kit'], ['120000', linkBlob, 'vendor']]);
    const kitRemoved = execFileSync('git', ['commit-tree', 'HEAD^{tree}', '-p', heldKit, '-m', 'kit removed'], { cwd: lib, encoding: 'utf8' }).trim();
    const fileBlob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: lib, input: 'f\n', encoding: 'utf8' }).trim();
    const heldFile = heldCommit(lib, [['100644', fileBlob, 'kit/f']]);
    const patch = (/** @type {string} */ name) => execFileSync('git', ['diff', '--binary', 'HEAD', heldBoth, '--', name], { cwd: lib, encoding: 'utf8' });
    const applied = (/** @type {string[]} */ args, /** @type {string} */ input) => execFileSync('git', ['apply', ...args], { cwd: lib, input, encoding: 'utf8' });
    const exclude = path.join(git(lib, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), 'info', 'exclude');
    createFile(lib, 'lib-fees.txt', 'fees\n');
    const before = git(lib, ['rev-parse', 'HEAD']).trim();
    const commit = (named = 'lib/lib-fees.txt') => refuses(a, ['commit', '--paths', named, '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session)).error;
    const unstage = () => git(lib, ['reset', '-q']);
    const ended = () => git(lib, ['merge', '--abort']);
    const INSIDE = 'in the folder of a repository nested in it';
    const both = /** @type {Array<[string, string]>} */ ([['kit', CLONE], ['vendor', LINK]]);
    /** Each way: its name, how it stages, what the door names, how it is undone. */
    const ways = /** @type {Array<[string, () => void, Array<[string, string]>, () => void]>} */ ([
      ...[['-A'], ['.'], ['--all', '.'], ['--', '*']].map((args) => [`git add ${args.join(' ')}`, () => git(lib, ['add', ...args]), both, unstage]),
      ['git stage .', () => git(lib, ['stage', '.']), both, unstage],
      ['git add kit', () => git(lib, ['add', 'kit']), [['kit', CLONE]], unstage],
      ['git add kit/', () => git(lib, ['add', 'kit/']), [['kit', CLONE]], unstage],
      ['git add vendor', () => git(lib, ['add', 'vendor']), [['vendor', LINK]], unstage],
      ['git add -f past an ignore rule', () => { fs.appendFileSync(exclude, 'kit\nvendor\n'); git(lib, ['add', '-f', 'kit', 'vendor']); }, both, () => { unstage(); fs.writeFileSync(exclude, fs.readFileSync(exclude, 'utf8').replace('kit\nvendor\n', '')); }],
      ['git update-index --cacheinfo', () => { git(lib, ['update-index', '--add', '--cacheinfo', `160000,${kitHead},kit`]); git(lib, ['update-index', '--add', '--cacheinfo', `120000,${linkBlob},vendor`]); }, both, unstage],
      ['git update-index of a file in the clone\'s folder', () => git(lib, ['update-index', '--add', '--cacheinfo', `100644,${fileBlob},kit/f`]), [['kit/f', INSIDE]], unstage],
      ['git update-index of a file two folders into the clone\'s', () => git(lib, ['update-index', '--add', '--cacheinfo', `100644,${fileBlob},kit/src/f`]), [['kit/src/f', INSIDE]], unstage],
      ['git checkout <commit> -- <path>', () => { git(lib, ['checkout', heldKit, '--', 'kit']); git(lib, ['checkout', heldLink, '--', 'vendor']); }, both, unstage],
      ['git checkout <commit> -- .', () => git(lib, ['checkout', heldBoth, '--', '.']), both, unstage],
      ['git restore --staged --source', () => { git(lib, ['restore', '--staged', '--source', heldKit, '--', 'kit']); git(lib, ['restore', '--staged', '--source', heldLink, '--', 'vendor']); }, both, unstage],
      ['git reset <commit> -- <path>', () => { git(lib, ['reset', '-q', heldKit, '--', 'kit']); git(lib, ['reset', '-q', heldLink, '--', 'vendor']); }, both, unstage],
      ['git read-tree -m', () => git(lib, ['read-tree', '-m', 'HEAD', heldKit]), [['kit', CLONE]], unstage],
      ['git cherry-pick -n', () => git(lib, ['cherry-pick', '-n', heldKit]), [['kit', CLONE]], unstage],
      ['git revert -n of the clone\'s removal', () => git(lib, ['revert', '-n', kitRemoved]), [['kit', CLONE]], () => { git(lib, ['revert', '--quit']); unstage(); }],
      ['git apply --cached', () => { applied(['--cached'], patch('kit')); applied(['--cached'], patch('vendor')); }, both, unstage],
      ['git apply --index', () => applied(['--index'], patch('kit')), [['kit', CLONE]], unstage],
      ['git stash apply --index', () => { git(lib, ['add', 'kit', 'vendor']); git(lib, ['stash', 'push', '-q', '--', 'kit', 'vendor']); git(lib, ['stash', 'apply', '-q', '--index']); }, both, () => { unstage(); git(lib, ['stash', 'drop', '-q']); }],
      ['git merge --no-ff --no-commit', () => git(lib, ['merge', '-q', '--no-ff', '--no-commit', heldKit]), [['kit', CLONE]], ended],
      ['git merge of a tree holding a file in the clone\'s folder', () => git(lib, ['merge', '-q', '--no-ff', '--no-commit', heldFile]), [['kit/f', INSIDE]], ended],
      ['git add -A mid-merge', () => { chainMergedBack(at.lib, lib); git(lib, ['add', '-A']); }, both, ended],
    ]);

    const refused = ways.map(([name, stage, , undo]) => {
      stage();
      const error = commit();
      undo();
      return [name, error];
    });
    const root = initRepo(path.join(a, 'deps'));
    git(root, ['commit', '-q', '--allow-empty', '-m', 'deps']);
    createFile(a, 'fees.txt', 'fees\n');
    const rootBefore = git(a, ['rev-parse', 'HEAD']).trim();
    git(a, ['add', '-A']);
    const rootOrdinary = commit('fees.txt');
    git(a, ['reset', '-q']);
    git(a, ['merge', '-q', '--no-ff', '--no-commit', execFileSync('git', ['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'chained'], { cwd: a, encoding: 'utf8' }).trim()]);
    git(a, ['add', '-A']);
    const rootMerging = commit('fees.txt');

    assert.deepStrictEqual(refused, ways.map(([name, , held]) => [name, heldRefusal('lib', held)]));
    assert.deepStrictEqual([intended, git(lib, ['rev-parse', 'HEAD']).trim()], ['lib-rates.txt', before], 'git add -N records the clone and the link as intended, never staged: the door commits beside them, neither');
    const rootHeld = /** @type {Array<[string, string]>} */ ([['deps', CLONE], ['vendor', LINK]]);
    assert.deepStrictEqual([rootOrdinary, rootMerging, git(a, ['rev-parse', 'HEAD']).trim()], [heldRefusal('', rootHeld), heldRefusal('', rootHeld), rootBefore]);
  });

  it('S1 (12.14): what is the task\'s own commits beside them — a symbolic link at a name the settings do not link, staged by git add -A; work inside an untracked clone, committed in the clone alone, its holder taking no pointer — and a clone whose path holds a space is refused, the remedy quoted for the shell, though the repository\'s settings hide submodules from a diff', () => {
    const at = project();
    const session = building(at.dir, ['3.1']);
    const a = isolation(at.dir, 'a');
    ok(a, layOut('3.1'), as(session));
    const lib = path.join(a, 'lib');
    fs.symlinkSync('lib.txt', path.join(lib, 'alias.txt'));
    git(lib, ['add', '-A']);
    const linked = ok(a, ['commit', '--paths', 'lib/alias.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): alias'], as(session)).committed;
    const deps = initRepo(path.join(lib, 'deps'));
    git(deps, ['commit', '-q', '--allow-empty', '-m', 'deps']);
    createFile(deps, 'fees.txt', 'fees\n');
    const inClone = ok(a, ['commit', '--paths', 'lib/deps/fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): fees in deps'], as(session)).committed;
    const spaced = initRepo(path.join(lib, 'my kit'));
    git(spaced, ['commit', '-q', '--allow-empty', '-m', 'kit']);
    git(lib, ['config', 'diff.ignoreSubmodules', 'all']);
    git(lib, ['add', 'my kit']);
    createFile(lib, 'lib-fees.txt', 'fees\n');
    const refused = refuses(a, ['commit', '--paths', 'lib/lib-fees.txt', '--task', UNIT, '3.1', '-m', 'feat(pay): add fees'], as(session)).error;

    assert.deepStrictEqual([linked.map(({ repo }) => repo), git(lib, ['ls-tree', 'HEAD', '--', 'alias.txt']).split(' ')[0]], [['lib'], '120000']);
    assert.deepStrictEqual([inClone.map(({ repo }) => repo), git(lib, ['ls-tree', '--name-only', 'HEAD', '--', 'deps']).trim(), git(deps, ['show', '--name-only', '--format=', 'HEAD']).trim()], [['lib/deps'], '', 'fees.txt']);
    assert.strictEqual(refused, `commit --paths: the index in lib holds my kit, ${CLONE}, which the door never commits — unstage it, \`git -C lib restore --staged -- 'my kit'\`, then run the commit again`);
  });
});
