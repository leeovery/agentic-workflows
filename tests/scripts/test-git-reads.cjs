'use strict';

// ---------------------------------------------------------------------------
// A verb's reads of git, each asked once (kernel/git-reads.cjs), through
// both of the engine's runners (kernel/git, kernel/isolated-git): a read
// kept for the verb by its folder, its arguments, its stdin and its `GIT_`
// variables; which calls read and which may write; the working tree's and
// the index's reads never kept; everything kept dropped at each kind of
// write — through either runner, in any repository, and the engine's own
// write of git's files — at each kind of process the engine starts — a
// driver's tool, the Claude call's stand-in, a hook, a project's own command,
// and every module that starts one — at every lock taken, and at every
// wait, a sleep and an await; and nothing kept past the verb. The walk kept with them is
// test-engine-repos.cjs's; the state commit's reads,
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
const { mayWrite, keptRead } = require(path.join(SCRIPTS, 'kernel/git-reads.cjs'));
const { git } = require(path.join(SCRIPTS, 'kernel/git.cjs'));
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

  it('takes a call for a read only where its command is listed, in the forms that read — every other call may write', () => {
    const reads = [
      ['rev-parse', 'HEAD'], ['-c', 'log.showSignature=false', '--literal-pathspecs', 'log', '-1'], ['cat-file', '-e', 'HEAD'],
      ['merge-tree', '--write-tree', 'main', 'side'], ['status', '--porcelain'], ['ls-files', '-z'], ['diff', '--cached'],
      ['var', 'GIT_COMMITTER_IDENT'], ['--version'], ['config', '--get', 'user.name'], ['config', '-z', '--name-only', '--list'],
      ['config', 'get', 'user.name'], ['config', '--file', '.gitmodules', '--get-regexp', 'path'], ['symbolic-ref', '-q', 'HEAD'],
      ['remote'], ['remote', 'get-url', 'origin'], ['worktree', 'list', '--porcelain'], ['hash-object', '--stdin'],
      ['add', '--all', '--dry-run', '--', 'src/app.js'],
    ];
    const writes = [
      ['update-ref', 'refs/heads/side', 'HEAD'], ['commit', '-m', 'x'], ['-c', 'log.showSignature=false', 'push', 'origin', 'main'],
      ['fetch', 'origin'], ['config', 'user.name', 'x'], ['config', '--unset', 'user.name'], ['symbolic-ref', 'HEAD', 'refs/heads/side'],
      ['symbolic-ref', '-d', 'HEAD'], ['remote', 'add', 'other', '/elsewhere'], ['worktree', 'add', 'tree'], ['hash-object', '-w', '--stdin'],
      ['add', '--', '--dry-run'], ['gc'],
    ];

    assert.deepStrictEqual([reads.filter((argv) => mayWrite(argv)), writes.filter((argv) => !mayWrite(argv))], [[], []]);
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

  it('keeps a value worked out from git\'s reads as it keeps them, never one a write was made across', () => {
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

  it('in every module of the engine that starts one, git\'s runners aside', () => {
    const runners = ['kernel/git.cjs', 'kernel/isolated-git.cjs'];
    const starting = filesUnder(SCRIPTS).filter((file) => file.endsWith('.cjs') && fs.readFileSync(file, 'utf8').includes('require(\'child_process\')'))
      .map((file) => path.relative(SCRIPTS, file));

    assert.deepStrictEqual(runners.filter((runner) => !starting.includes(runner)), [], 'the search found git\'s own runners');
    assert.deepStrictEqual(starting.filter((file) => !runners.includes(file) && !fs.readFileSync(path.join(SCRIPTS, file), 'utf8').includes('dropReads()')), []);
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
