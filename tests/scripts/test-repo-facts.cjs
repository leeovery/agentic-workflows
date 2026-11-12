'use strict';

// ---------------------------------------------------------------------------
// A repository's facts in one call (kernel/isolated-git.cjs, `repoFacts`):
// every fact the engine asked in words of its own before — where a folder
// sits in its work tree, the common and the worktree's own git directories,
// each operation's marker and the commit lock, the ref HEAD names and its
// branch — answered as each of those words answered it, in every shape the
// engine meets: the main checkout, a linked worktree and a folder of each,
// the state worktree, a detached HEAD, an unborn branch, a submodule, a bare
// repository and a worktree of one; asked in one rev-parse wherever HEAD
// names a commit in a work tree; kept for the verb, and asked again after a
// switch, a worktree added or removed, and a commit; a marker's presence
// read each time, never kept; and every reader of a fact answering from
// them, asking git nothing of its own. What the readers' verbs cost is
// pinned in their own suites; the memo the facts are kept in,
// test-git-reads.cjs's.
//
// Layer: git. World: a code project, copied for each test, and the shapes
// built beside it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git, traced, codeProject, initRepo, addSubmodule, commitCode, createFile } = require('./engine-harness.cjs');
const { useTempFolder, bareRepo } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { repoFacts, isolatedGit, withVerbReads, mainCheckout, workTree } = require(path.join(SCRIPTS, 'kernel/isolated-git.cjs'));
const { git: engineGit, OPERATION_MARKERS, operationInProgress, onBranch, commitStaged } = require(path.join(SCRIPTS, 'kernel/git.cjs'));
const { placeOf, projectRepos } = require(path.join(SCRIPTS, 'kernel/repos.cjs'));
const { onStateBranch, withCommitLock } = require(path.join(SCRIPTS, 'domain/commit.cjs'));
const { stateRemote } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { holdsTrace } = require(path.join(SCRIPTS, 'domain/code-trace.cjs'));
const { stagedHeldOut } = require(path.join(SCRIPTS, 'domain/worktree-prep.cjs'));
const { putOnBranch } = require(path.join(SCRIPTS, 'domain/fix-branch.cjs'));
const { quickFixBranch } = require(path.join(SCRIPTS, 'domain/landing-names.cjs'));

const world = useTempFolder('repo-facts-');

/** Whether a traced command is the facts' own rev-parse. @param {string} command */
const asksFacts = (command) => command.startsWith('rev-parse --path-format=absolute --git-common-dir --absolute-git-dir');

/** The words a rev-parse asks one of the facts in: each of them but HEAD's, which `symbolic-ref` asked. */
const FACT_WORDS = new RegExp(`^rev-parse\\b.*(--git-common-dir|--absolute-git-dir|--show-toplevel|--show-prefix|--symbolic-full-name|--git-path (${
  [...OPERATION_MARKERS.map(([marker]) => marker), 'leeway-commit.lock'].join('|')})( |$))`);

/** Whether a traced command asks one of the facts, in any words. @param {string} command */
const asksAFact = (command) => /^symbolic-ref (-q|--quiet)\b/.test(command) || FACT_WORDS.test(command);

/**
 * The facts at `cwd` as the engine asked each in its own words before, each
 * resolved as its caller resolved it.
 * @param {string} cwd
 */
function askedApart(cwd) {
  const ask = (/** @type {string[]} */ args) => isolatedGit(cwd).tryRun(args);
  const resolved = (/** @type {string[]} */ args) => path.resolve(cwd, /** @type {string} */ (ask(args)).trim());
  const place = ask(['rev-parse', '--show-toplevel', '--show-prefix']);
  const [top, prefix] = place === null ? [] : place.split('\n');
  return {
    place: place === null ? null : { top, prefix },
    commonDir: fs.realpathSync(resolved(['rev-parse', '--git-common-dir'])),
    gitDir: /** @type {string} */ (ask(['rev-parse', '--absolute-git-dir'])).trim(),
    markers: Object.fromEntries(OPERATION_MARKERS.map(([marker]) => [marker, resolved(['rev-parse', '--git-path', marker])])),
    commitLock: resolved(['rev-parse', '--git-path', 'leeway-commit.lock']),
    head: ask(['symbolic-ref', '-q', 'HEAD'])?.trim() ?? null,
    branch: ask(['symbolic-ref', '-q', '--short', 'HEAD'])?.trim() ?? null,
  };
}

/**
 * Every shape the engine meets a repository in, by its name, at the folder
 * the facts are asked from, and whether that folder answers in one call.
 * @returns {{shape: string, at: string, oneCall: boolean}[]}
 */
function shapes() {
  const { main, root } = codeProject(world(), { state: true });
  const source = initRepo(path.join(world(), 'sdk-source'));
  createFile(source, 'sdk.js', '1\n');
  commitCode(source, 'sdk');
  const sdk = addSubmodule(main, 'vendor/sdk', source);
  const linked = path.join(world(), 'linked');
  git(main, ['worktree', 'add', '-q', '-b', 'feature', linked]);
  const detached = path.join(world(), 'detached');
  git(main, ['worktree', 'add', '-q', '--detach', detached]);
  for (const tree of [main, linked]) fs.mkdirSync(path.join(tree, 'src', 'deep'), { recursive: true });
  const bare = bareRepo(path.join(world(), 'bare.git'));
  git(main, ['push', '-q', bare, 'main']);
  const bareLinked = path.join(world(), 'bare-linked');
  git(bare, ['worktree', 'add', '-q', bareLinked, 'main']);
  return [
    { shape: 'the main checkout', at: main, oneCall: true },
    { shape: 'a folder of the main checkout', at: path.join(main, 'src', 'deep'), oneCall: true },
    { shape: 'a linked worktree', at: linked, oneCall: true },
    { shape: 'a folder of a linked worktree', at: path.join(linked, 'src', 'deep'), oneCall: true },
    { shape: 'the state worktree', at: root, oneCall: true },
    { shape: 'a detached HEAD', at: detached, oneCall: true },
    { shape: 'a submodule', at: sdk, oneCall: true },
    { shape: 'a worktree of a bare repository', at: bareLinked, oneCall: true },
    { shape: 'an unborn branch', at: initRepo(path.join(world(), 'unborn')), oneCall: false },
    { shape: 'a bare repository', at: bare, oneCall: false },
  ];
}

describe('a repository\'s facts', () => {
  it('answers each fact as the words the engine asked it in before answered it, in every shape the engine meets — in one rev-parse wherever HEAD names a commit in a work tree', () => {
    const met = shapes();

    const answered = met.map(({ shape, at }) => {
      const { result, commands } = traced(() => repoFacts(at));
      return { shape, facts: result, oneCall: commands.length === 1 && asksFacts(commands[0]) };
    });

    assert.deepStrictEqual(answered, met.map(({ shape, at, oneCall }) => ({ shape, facts: askedApart(at), oneCall })));
  });

  it('answers none in a folder of no repository', () => {
    assert.strictEqual(repoFacts(world()), null);
  });
});

describe('the facts kept for the verb, and asked again after each write that moves them', () => {
  /**
   * Each write, the folder the facts are asked at, and what it moves there:
   * the work tree's top and HEAD's ref, before it and after.
   * @type {{write: string, ready?: (main: string) => void, at: (main: string) => string, run: (main: string) => void, before: (main: string) => object, after: (main: string) => object}[]}
   */
  const WRITES = [
    {
      write: 'a switch',
      at: (main) => main,
      run: (main) => engineGit(main, ['switch', '-q', '-c', 'side']),
      before: (main) => ({ top: main, head: 'refs/heads/main' }),
      after: (main) => ({ top: main, head: 'refs/heads/side' }),
    },
    {
      write: 'a worktree added',
      ready: (main) => fs.mkdirSync(path.join(main, 'trees', 'added'), { recursive: true }),
      at: (main) => path.join(main, 'trees', 'added'),
      run: (main) => engineGit(main, ['worktree', 'add', '-q', '-b', 'added', path.join(main, 'trees', 'added')]),
      before: (main) => ({ top: main, head: 'refs/heads/main' }),
      after: (main) => ({ top: path.join(main, 'trees', 'added'), head: 'refs/heads/added' }),
    },
    {
      write: 'a worktree removed',
      ready: (main) => git(main, ['worktree', 'add', '-q', '-b', 'gone', path.join(main, 'trees', 'gone')]),
      at: (main) => path.join(main, 'trees', 'gone'),
      run: (main) => {
        engineGit(main, ['worktree', 'remove', path.join(main, 'trees', 'gone')]);
        fs.mkdirSync(path.join(main, 'trees', 'gone'));
      },
      before: (main) => ({ top: path.join(main, 'trees', 'gone'), head: 'refs/heads/gone' }),
      after: (main) => ({ top: main, head: 'refs/heads/main' }),
    },
    {
      write: 'a commit, its hook moving HEAD',
      ready: (main) => fs.writeFileSync(path.join(main, '.git', 'hooks', 'post-commit'), '#!/bin/sh\ngit branch hooked && git symbolic-ref HEAD refs/heads/hooked\n', { mode: 0o755 }),
      at: (main) => main,
      run: (main) => engineGit(main, ['commit', '-q', '--allow-empty', '-m', 'hooked']),
      before: (main) => ({ top: main, head: 'refs/heads/main' }),
      after: (main) => ({ top: main, head: 'refs/heads/hooked' }),
    },
  ];

  for (const { write, ready = () => {}, at, run, before, after } of WRITES) {
    it(`${write}: the facts kept across reads, then asked again and moved`, () => {
      const { main } = codeProject(world());
      ready(main);
      const moved = (/** @type {import('../../skills/leeway-engine/scripts/kernel/isolated-git.cjs').RepoFacts} */ facts) => ({ top: facts.place?.top, head: facts.head });

      const { result, commands } = traced(() => withVerbReads(() => {
        const first = repoFacts(at(main));
        const kept = repoFacts(at(main));
        run(main);
        return [first, kept, repoFacts(at(main))].map(moved);
      }));

      assert.deepStrictEqual(result, [before(main), before(main), after(main)]);
      assert.strictEqual(commands.filter(asksFacts).length, 2, 'the facts asked once before the write and once after it');
    });
  }

  it('reads whether a marker is there each time it is asked, never keeping it: a merge begun without git is met in the same verb', () => {
    const { main } = codeProject(world());
    const head = git(main, ['rev-parse', 'HEAD']);

    const seen = withVerbReads(() => {
      const before = operationInProgress(main);
      fs.writeFileSync(repoFacts(main).markers.MERGE_HEAD, head);
      return [before, operationInProgress(main)];
    });

    assert.deepStrictEqual(seen, [null, { operation: 'a merge', marker: 'MERGE_HEAD' }]);
  });
});

describe('every reader of a fact answering from the facts', () => {
  it('asks git none of the facts in words of its own: each answers from those its verb read, or asks them once after its own write', () => {
    const { main } = codeProject(world(), { state: true });
    createFile(main, '.gitignore', 'node_modules/\n');
    git(main, ['add', '.gitignore']);
    git(main, ['commit', '-q', '-m', 'ignore']);
    git(main, ['remote', 'add', 'alpha', path.join(world(), 'alpha.git')]);
    git(main, ['remote', 'add', 'zeta', path.join(world(), 'zeta.git')]);
    const nested = initRepo(path.join(main, 'api'));
    createFile(nested, 'index.js', '1\n');
    commitCode(nested, 'api');
    git(nested, ['switch', '-q', '-c', quickFixBranch('unit')]);
    createFile(main, 'staged.md', 'staged\n');
    git(main, ['add', 'staged.md']);
    const repos = projectRepos(main);

    /** Each reader, by what it reads and where, and the facts it asks: none, or once after its own write. */
    const READERS = [
      ['the operation in progress (kernel/git)', () => operationInProgress(main), 0],
      ['whether HEAD names a branch (kernel/git)', () => onBranch(main), 0],
      ['the main checkout (kernel/isolated-git)', () => mainCheckout(main), 0],
      ['the work tree (kernel/isolated-git)', () => workTree(main), 0],
      ['where the project sits (kernel/repos)', () => placeOf(main), 0],
      ['whether the state branch is out (domain/commit)', () => onStateBranch(main), 0],
      ['the commit lock and the state branch refused (domain/commit)', () => withCommitLock(main, () => {}), 0],
      ['the branch the state\'s remote is chosen by (domain/state-worktree)', () => stateRemote(isolatedGit(main)), 0],
      ['the trace at the tips of the branches (domain/code-trace)', () => holdsTrace(main), 0],
      ['the project\'s own checkout (domain/worktree-prep)', () => stagedHeldOut(repos, repos[0]), 0],
      ['the branch a nested repository has out (domain/fix-branch)', () => putOnBranch(main, 'unit', [repos[1]]), 0],
      ['HEAD\'s ref, after the commit\'s staging (kernel/git)', () => commitStaged(main, ['staged.md'], 'staged'), 1],
    ];

    // The verb reads the facts at both repositories first, so what the trace
    // holds past those two is the reader's own.
    const asked = READERS.map(([reader, read]) => {
      const { commands } = traced(() => withVerbReads(() => {
        repoFacts(main);
        repoFacts(nested);
        read();
      }));
      const facts = commands.filter(asksAFact);
      return [reader, facts.length - 2, facts.every(asksFacts)];
    });

    assert.deepStrictEqual(asked, READERS.map(([reader, , times]) => [reader, times, true]));
  });
});
