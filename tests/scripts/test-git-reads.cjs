'use strict';

// ---------------------------------------------------------------------------
// A verb's reads of git, each asked once (kernel/git-reads.cjs), through
// both of the engine's runners (kernel/git, kernel/isolated-git): a read
// kept for the verb by its folder, its arguments, its stdin and its `GIT_`
// variables; each form of git the engine runs taken for a read kept, a read
// never kept or a write; the working tree's and the index's reads never
// kept, nor a read git gave no answer to; everything kept dropped at each
// kind of write — through either runner, in any repository, and the
// engine's own write of git's files — at each kind of process the engine
// starts — a driver's tool, the Claude call's stand-in, a hook, a project's
// own command, each way the one place that starts them starts one, and no
// process started anywhere else — at every lock taken, and at every wait,
// a sleep and an await; and nothing kept past the verb. The walk kept with
// them is test-engine-repos.cjs's; the state commit's reads,
// test-engine-state-commit.cjs's; a config read leaving the hooks' names,
// test-engine-state-worktree.cjs's.
//
// Layer: git. World: a project with one commit, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { git: unseen, traced, withEnv, codeProject, createFile, STATE_DIR_NAME } = require('./engine-harness.cjs');
const { useTempFolder, filesUnder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { kindOf, keptRead } = require(path.join(SCRIPTS, 'kernel/git-reads.cjs'));
const { git, gitRun, OPERATION_MARKERS } = require(path.join(SCRIPTS, 'kernel/git.cjs'));
const { spawnSync, spawn, execFileSync } = require(path.join(SCRIPTS, 'kernel/spawn.cjs'));
const { isolatedGit, withVerbReads } = require(path.join(SCRIPTS, 'kernel/isolated-git.cjs'));
const { sleepSync } = require(path.join(SCRIPTS, 'kernel/process.cjs'));
const { askClaude } = require(path.join(SCRIPTS, 'kernel/claude-call.cjs'));
const { runShellCommand } = require(path.join(SCRIPTS, 'kernel/shell-command.cjs'));
const { DRIVER_KINDS } = require(path.join(SCRIPTS, 'kernel/manifest-schema.cjs'));
const { listDrivers } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));
const { repairStateWorktree } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { acquireLockFile, releaseLockFile, withWriterLock } = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));

const world = useTempFolder('git-reads-');

/** The project's branches as the engine reads them. @param {string} dir */
const branches = (dir) => git(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']).split('\n').filter(Boolean);

/** The settings the isolated runner puts ahead of a command. */
const ISOLATED = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.autocrlf=false'];

/** A repository's facts as kernel/isolated-git asks them: its directories and paths, then where the folder sits. */
const FACT_DIRECTORIES = ['--path-format=absolute', '--git-common-dir', '--absolute-git-dir',
  ...[...OPERATION_MARKERS.map(([marker]) => marker), 'leeway-commit.lock'].flatMap((name) => ['--git-path', name])];
const FACT_PLACE = ['--show-toplevel', '--show-prefix'];

/**
 * Every form of git the engine runs, as the spawn logs of its whole flow
 * found them, by its kind: a read kept, a read never kept, or a call that
 * may write; a form whose stdin counts is given with it.
 * @type {Record<'kept'|'read'|'write', Array<string[]|{argv: string[], input: string}>>}
 */
const FORMS_RUN = {
  kept: [
    [...ISOLATED, 'for-each-ref', '--format=%(refname)%00%(objectname)', 'refs/heads/'],
    ['for-each-ref'],
    ['for-each-ref', '--format=%(refname)', '--contains', 'HEAD', 'refs/heads/', 'refs/remotes/'],
    ['for-each-ref', '--merged=main', '--format=%(refname)', 'refs/heads/'],
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    { argv: ['cat-file', '--batch=%(objectname)'], input: 'refs/heads/leeway-state:.ledger.jsonl\n' },
    ['cat-file', '-e', 'HEAD'],
    ['cat-file', 'blob', 'HEAD:README.md'],
    ['cherry', 'main', 'fix', 'fix^'],
    ['config', '--bool', '--get', 'core.bare'],
    ['config', '--get', 'init.defaultBranch'],
    ['config', 'get', 'user.name'],
    ['config', '--type=bool', '--default=false', '--get', 'commit.gpgSign'],
    ['config', '-z', '--name-only', '--get-regexp', '^hook\\..+\\.command$'],
    ['config', '-z', '--name-only', '--list'],
    ['log', '-z', '--format=%B', '--fixed-strings', '--grep=Task: unit-', '--since=1', 'main', '--'],
    ['log', '-z', '--format=%B', '--all', '--reflog', '--fixed-strings', '--grep=Task: unit-', '--'],
    ['log', '--first-parent', '-1', '--format=%H', 'main', '--', 'src'],
    ['log', '-z', '--reverse', '--topo-order', '--no-merges', '--format=%H', 'fix', '--not', 'main', '--'],
    ['log', '--reverse', '--relative', '--no-renames', '--no-show-signature', '--fixed-strings', '--grep=Task:', '--format=%H', '--name-only', '-z'],
    ['ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    ['ls-tree', '-z', 'HEAD', '--', 'src'],
    ['merge-base', '--independent', 'a', 'b', 'c'],
    ['merge-base', '--is-ancestor', 'a', 'b'],
    ['merge-base', 'a', 'b'],
    ['merge-tree', '--write-tree', '-z', '--name-only', '--no-messages', '--merge-base=a', 'b', 'c'],
    ['remote'],
    ['remote', 'get-url', 'origin'],
    ['rev-list', '--ignore-missing', '--reverse', '--topo-order', '--parents', 'fix', '--not', 'main'],
    ['rev-list', '--max-parents=0', 'HEAD'],
    ['rev-list', '--count', 'HEAD'],
    ['rev-list', '-1', 'fix', '--not', 'main'],
    ['rev-parse', ...FACT_DIRECTORIES, ...FACT_PLACE, '--symbolic-full-name', 'HEAD', '--'],
    ['rev-parse', ...FACT_DIRECTORIES, ...FACT_PLACE],
    ['rev-parse', ...FACT_DIRECTORIES],
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    ['rev-parse', '-q', '--verify', 'HEAD'],
    ['rev-parse', '--short', 'HEAD'],
    ['rev-parse', 'HEAD', 'HEAD^{tree}', '--show-toplevel', '--git-common-dir', '--git-path', 'leeway-commit.index', '--absolute-git-dir'],
    ['show', '--no-color', '--relative', '--stat=200', '--stat-graph-width=20', '--format=', 'HEAD', '--'],
    ['show', 'HEAD:manifest.json'],
    ['show-ref', '--verify', '--quiet', 'refs/heads/main'],
    ['symbolic-ref', '-q', 'HEAD'],
    ['symbolic-ref', '--quiet', 'HEAD'],
  ],
  read: [
    [...ISOLATED, '--version'],
    ['add', '--all', '--dry-run', '--', 'src/app.js'],
    ['check-ignore', '-q', 'src/app.js'],
    ['config', '--file', '.gitmodules', '-z', '--get-regexp', '^submodule\\..*\\.path$'],
    ['diff', '--cached', '--raw', '--relative', '--no-renames', '--ignore-submodules=none', '-z', 'HEAD'],
    ['diff', '--name-only', '-z', '--no-renames', '--no-relative', 'main...fix', '--', '.leeway'],
    ['diff', '--no-color', '--no-ext-diff', '-U0', '--no-renames', 'a', 'b', '--', 'src'],
    ['diff', '--numstat', '-z', '--find-renames', 'a', '--', 'src'],
    ['hash-object', '--stdin'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
    ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
    ['ls-files', '--stage', '--full-name', '-z', '--', 'src/app.js'],
    ['ls-remote', 'origin', 'refs/heads/leeway-state'],
    ['status', '--porcelain', '-z', '--untracked-files=all', '--no-renames'],
    ['var', '-l'],
    ['var', 'GIT_COMMITTER_IDENT'],
    ['worktree', 'list', '--porcelain'],
    ['show', ':src/app.js'],
    ['rev-parse', ':src/app.js'],
    { argv: ['cat-file', '--batch-check'], input: 'HEAD\n:staged.md\n' },
  ],
  write: [
    [...ISOLATED, 'commit-tree', 'tree', '-p', 'parent', '-F', '-'],
    ['add', '--', 'src/app.js'],
    ['add', '--all', '--', 'manifest.json'],
    ['add', '--ignore-removal', '--pathspec-from-file=-', '--pathspec-file-nul'],
    ['add', '--', '--dry-run'],
    ['branch', '--no-track', 'fix', 'main'],
    ['branch', '-D', 'fix'],
    ['branch', '-m', 'fix', 'kept'],
    ['checkout-index', '-f', '-z', '--stdin', '--prefix=/tmp/tree/'],
    ['commit', '-m', 'the task', '--', 'src/app.js'],
    ['commit-tree', '-S', 'tree', '-p', 'parent', '-F', '-'],
    ['config', 'user.name', 'someone'],
    ['config', '--unset', 'user.name'],
    ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main'],
    ['gc'],
    ['hash-object', '-w', '--stdin'],
    ['merge', '-q', '--ff-only', 'fix'],
    ['merge-file', '--union', 'ours', 'base', 'theirs'],
    ['mktree'],
    ['push', '--quiet', '--force-with-lease=main:abc', 'origin', 'main'],
    ['read-tree', '--empty'],
    ['read-tree', '-m', '-u', 'a', 'b'],
    ['read-tree', 'HEAD'],
    ['remote', 'add', 'other', '/elsewhere'],
    ['reset', '--quiet', '--pathspec-from-file=-', '--pathspec-file-nul', 'HEAD'],
    ['restore', '--source=HEAD', '--staged', '--worktree', '--', 'src/app.js'],
    ['rm', '--cached', '-r', '-q', '--ignore-unmatch', '--', 'src/app.js'],
    ['switch', '-q', '--no-track', '-c', 'fix', 'main'],
    ['symbolic-ref', 'HEAD', 'refs/heads/fix'],
    ['symbolic-ref', '-d', 'HEAD'],
    ['update-index', '--add', '--cacheinfo', '100644,abc,src/app.js'],
    ['update-index', '-q', '--refresh'],
    ['update-ref', '--stdin'],
    ['update-ref', '-d', 'refs/heads/fix'],
    ['update-ref', '-m', 'land: main', 'refs/heads/main', 'new', 'old'],
    ['worktree', 'add', '-q', '--detach', 'tree', 'HEAD'],
    ['worktree', 'remove', '--force', '--force', 'tree'],
    ['worktree', 'lock', '--reason', 'held', 'tree'],
    ['worktree', 'prune'],
    ['write-tree'],
  ],
};

/** A script at `file` that runs `command`. @param {string} file @param {string} command */
function standIn(file, command) {
  fs.writeFileSync(file, `#!/bin/sh\n${command}\n`, { mode: 0o755 });
  return file;
}

/**
 * The project's branches as one verb reads them before and after `between`,
 * which makes a branch where the verb's own git never sees it made.
 * @param {string} main @param {() => void} between
 */
function readAcross(main, between) {
  return withVerbReads(() => {
    const before = branches(main);
    between();
    return [before, branches(main)];
  });
}

describe('a verb\'s reads of git', () => {
  it('answers a read asked again in a verb from what it kept, through either runner: git asked once by each, its answer kept though the branches moved unseen', () => {
    const { main } = codeProject(world());

    const { result, commands } = traced(() => withVerbReads(() => {
      const runner = isolatedGit(main);
      const first = [branches(main), runner.run(['for-each-ref', 'refs/heads/'])];
      unseen(main, ['branch', 'unseen']);
      return [first, [branches(main), runner.run(['for-each-ref', 'refs/heads/'])]];
    }));

    assert.deepStrictEqual(result[1], result[0]);
    assert.deepStrictEqual(result[0][0], ['main']);
    assert.strictEqual(commands.filter((command) => command.startsWith('for-each-ref')).length, 2);
  });

  it('keeps a read by its folder, its arguments, its stdin and its GIT_ variables: a change to any one asks git again', () => {
    const { main } = codeProject(world());
    const other = codeProject(world(), { name: 'other' }).main;

    const { commands } = traced(() => withVerbReads(() => {
      for (const time of [1, 2]) {
        git(main, ['cat-file', '--batch-check'], undefined, 'HEAD\n');
        git(other, ['cat-file', '--batch-check'], undefined, 'HEAD\n');
        git(main, ['cat-file', '--batch-check=%(objectname)'], undefined, 'HEAD\n');
        git(main, ['cat-file', '--batch-check'], undefined, 'HEAD:README.md\n');
        git(main, ['cat-file', '--batch-check'], { GIT_LEEWAY_ASKED: String(time) }, 'HEAD\n');
      }
    }));

    assert.strictEqual(commands.filter((command) => command.startsWith('cat-file')).length, 6);
  });

  it('keeps nothing outside a verb, nor from one verb for the next', () => {
    const { main } = codeProject(world());

    const seen = [branches(main)];
    unseen(main, ['branch', 'first']);
    seen.push(branches(main), withVerbReads(() => branches(main)));
    unseen(main, ['branch', 'second']);
    seen.push(withVerbReads(() => branches(main)));

    assert.deepStrictEqual(seen, [['main'], ['first', 'main'], ['first', 'main'], ['first', 'main', 'second']]);
  });

  it('takes each form of git the engine runs for what it is — a read kept, a read never kept, or a call that may write — and any command it does not list for a write', () => {
    const wrong = Object.entries(FORMS_RUN).flatMap(([kind, forms]) => forms
      .map((form) => (Array.isArray(form) ? { argv: form, input: undefined } : form))
      .filter(({ argv, input }) => kindOf(argv, input) !== kind)
      .map(({ argv }) => `${argv.join(' ')}: not ${kind}`));

    assert.deepStrictEqual(wrong, []);
  });

  it('never keeps a read of the working tree or the index: status, ls-files, diff and an index entry named are asked again', () => {
    const { main } = codeProject(world());
    const reads = () => [
      git(main, ['status', '--porcelain']),
      git(main, ['ls-files', '--others']),
      git(main, ['diff', '--name-only']),
      git(main, ['cat-file', '--batch-check'], undefined, ':staged.md\n'),
    ];

    const [before, after] = withVerbReads(() => {
      const first = reads();
      createFile(main, 'new.md', 'new\n');
      createFile(main, 'README.md', 'changed\n');
      createFile(main, 'staged.md', 'staged\n');
      unseen(main, ['add', 'staged.md']);
      return [first, reads()];
    });

    assert.deepStrictEqual(after.map((answer, i) => answer !== before[i]), [true, true, true, true]);
  });

  it('never keeps a read git gave no answer to — one that could not start, or ran out of time — but asks it again', () => {
    const { main } = codeProject(world());
    const [none, slow] = [path.join(world(), 'none'), path.join(world(), 'slow')];
    fs.mkdirSync(none);
    fs.mkdirSync(slow);
    standIn(path.join(slow, 'git'), 'exec sleep 5');
    const head = () => gitRun(main, ['rev-parse', 'HEAD'], undefined, undefined, 200);

    const answers = withVerbReads(() => [withEnv({ PATH: none }, head), withEnv({ PATH: `${slow}${path.delimiter}${process.env.PATH}` }, head), head()]);

    assert.deepStrictEqual(answers.map((res) => /** @type {NodeJS.ErrnoException|undefined} */ (res.error)?.code ?? res.stdout.trim()),
      ['ENOENT', 'ETIMEDOUT', unseen(main, ['rev-parse', 'HEAD']).trim()]);
  });

  it('keeps a value worked out from git and the working tree as it keeps git\'s reads, never one a write was made across', () => {
    const { main } = codeProject(world());
    let worked = 0;
    const value = (/** @type {boolean} */ writes) => keptRead('probe', main, () => {
      worked += 1;
      if (writes) git(main, ['update-ref', 'refs/heads/written', 'HEAD']);
      return worked;
    });

    assert.deepStrictEqual(withVerbReads(() => [value(true), value(false), value(false)]), [1, 2, 2]);
  });
});

describe('everything kept dropped at a write', () => {
  it('at a write through the engine\'s own git, in another repository: the read after sees what moved unseen', () => {
    const { main } = codeProject(world());
    const other = codeProject(world(), { name: 'other' }).main;

    const seen = readAcross(main, () => {
      unseen(main, ['branch', 'unseen']);
      git(other, ['update-ref', 'refs/heads/written', 'HEAD']);
    });

    assert.deepStrictEqual(seen, [['main'], ['main', 'unseen']]);
  });

  it('at a write through the isolated runner, a config call that writes among them — never at one that reads', () => {
    const { main } = codeProject(world());
    const runner = isolatedGit(main);

    const seen = withVerbReads(() => {
      const before = branches(main);
      unseen(main, ['branch', 'unseen']);
      runner.tryRun(['config', '--get', 'leeway.probe']);
      const read = branches(main);
      runner.run(['config', 'leeway.probe', 'set']);
      return [before, read, branches(main)];
    });

    assert.deepStrictEqual(seen, [['main'], ['main'], ['main', 'unseen']]);
  });

  it('where the engine relinks a copied project\'s state worktree, writing git\'s own files itself', () => {
    const { main } = codeProject(world(), { state: true });
    const copy = path.join(world(), 'copy');
    fs.cpSync(main, copy, { recursive: true, verbatimSymlinks: true });
    const root = path.join(copy, STATE_DIR_NAME);
    const common = () => fs.realpathSync(path.resolve(root, isolatedGit(root).run(['rev-parse', '--git-common-dir']).trim()));

    const seen = withVerbReads(() => {
      const before = common();
      repairStateWorktree(root);
      return [before, common()];
    });

    assert.deepStrictEqual(seen, [fs.realpathSync(path.join(main, '.git')), fs.realpathSync(path.join(copy, '.git'))]);
  });
});

describe('everything kept dropped at every process the engine starts', () => {
  it('at a driver\'s tool, each shipped driver\'s, as the driver runs it', () => {
    const { main } = codeProject(world());
    const bin = path.join(world(), 'bin');
    fs.mkdirSync(bin);
    const needs = DRIVER_KINDS.flatMap((kind) => listDrivers(kind)).flatMap((driver) => driver.needs);
    for (const { tool } of needs) standIn(path.join(bin, tool), `git -C '${main}' branch "tool-$$"`);

    const grown = withEnv({ PATH: `${bin}${path.delimiter}${process.env.PATH}` }, () => withVerbReads(() => needs.map(({ found }) => {
      const before = branches(main).length;
      try {
        found();
      } catch {
        // The stand-in answers no version: its run is the whole of it here.
      }
      return branches(main).length - before;
    })));

    assert.ok(needs.length > 0, 'no shipped driver needs a tool');
    assert.deepStrictEqual(grown, needs.map(() => 1));
  });

  it('at the Claude call, its stand-in run as the call runs it', () => {
    const { main } = codeProject(world());
    const claude = standIn(path.join(world(), 'claude'), `git -C '${main}' branch asked`);
    const ask = { system: 'Answer.', schema: { type: 'object' }, model: 'sonnet', effort: 'low', input: 'a question', timeoutMs: 20000 };

    const seen = withEnv({ LEEWAY_CLAUDE: claude }, () => readAcross(main, () => askClaude(ask)));

    assert.deepStrictEqual(seen, [['main'], ['asked', 'main']]);
  });

  it('at a hook, run by the call that may write', () => {
    const { main } = codeProject(world());
    standIn(path.join(main, '.git/hooks/pre-commit'), 'git branch hooked');

    const seen = readAcross(main, () => git(main, ['commit', '--allow-empty', '-m', 'hooked']));

    assert.deepStrictEqual(seen, [['main'], ['hooked', 'main']]);
  });

  it('at a project\'s own command', () => {
    const { main } = codeProject(world());

    const seen = readAcross(main, () => runShellCommand(main, 'git branch checked'));

    assert.deepStrictEqual(seen, [['main'], ['checked', 'main']]);
  });

  it('at every start through the one place the engine starts a process, each of its three ways', () => {
    const { main } = codeProject(world());
    const starts = [() => spawnSync('true'), () => spawn('true', [], { stdio: 'ignore' }), () => execFileSync('true')];

    const grown = starts.map((start, n) => readAcross(main, () => {
      unseen(main, ['branch', `started-${n}`]);
      start();
    }).map((seen) => seen.length));

    assert.deepStrictEqual(grown, [[1, 2], [2, 3], [3, 4]]);
  });

  it('starting a process nowhere else: no module of the engine but that place and git\'s two runners reaches child_process', () => {
    const reaches = filesUnder(SCRIPTS).filter((file) => file.endsWith('.cjs') && /require\(\s*['"](node:)?child_process['"]\s*\)/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SCRIPTS, file)).sort();

    assert.deepStrictEqual(reaches, ['kernel/git.cjs', 'kernel/isolated-git.cjs', 'kernel/spawn.cjs']);
  });
});

describe('everything kept dropped at every lock taken, its last holder\'s writes read after it', () => {
  it('at a lock file taken, and at the writer lock claimed', () => {
    const { main, root } = codeProject(world(), { state: true });
    const lock = path.join(world(), 'probe.lock');
    // A first claim reads this process's start time, a `ps` that drops of itself.
    withWriterLock(root, () => {});

    const seen = [
      readAcross(main, () => {
        unseen(main, ['branch', 'filed']);
        acquireLockFile(lock, 'the probe lock stands');
        releaseLockFile(lock);
      }),
      readAcross(main, () => {
        unseen(main, ['branch', 'claimed']);
        withWriterLock(root, () => {});
      }),
    ];

    assert.deepStrictEqual(seen, [
      [['leeway-state', 'main'], ['filed', 'leeway-state', 'main']],
      [['filed', 'leeway-state', 'main'], ['claimed', 'filed', 'leeway-state', 'main']],
    ]);
  });
});

describe('everything kept dropped at every wait', () => {
  it('at a sleep', () => {
    const { main } = codeProject(world());

    const seen = readAcross(main, () => {
      unseen(main, ['branch', 'unseen']);
      sleepSync(1);
    });

    assert.deepStrictEqual(seen, [['main'], ['main', 'unseen']]);
  });

  it('at an await: nothing is kept past the verb\'s synchronous run', async () => {
    const { main } = codeProject(world());

    const seen = await withVerbReads(async () => {
      const before = branches(main);
      unseen(main, ['branch', 'unseen']);
      await null;
      return [before, branches(main)];
    });

    assert.deepStrictEqual(seen, [['main'], ['main', 'unseen']]);
  });
});
