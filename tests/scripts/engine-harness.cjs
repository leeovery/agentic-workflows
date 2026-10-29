'use strict';

// The engine runner and git fixture the node suites share.
//
// Calls go through the engine's in-process entry (`engine.run`): the CLI's
// argv contract — same argv, same two streams, same exit code — without a
// process per assertion. One shape per answer the engine gives: the raw
// three parts for a suite asserting the process contract itself, a success
// (the response line, and the sections after it where a caller wants them),
// a refusal, and the whole stdout of a call that must succeed (a render's
// sections, a bare read's value).
//
// Every shape takes the project directory first, then argv, then the call's
// own environment and stdin. The environment is an overlay whose `undefined`
// takes a key away. A command that answers later — a knowledge verb that
// waits on the embedding provider, a raise's draw — answers through
// `callAsync`, and its success and refusal through `okSectionsAsync` and
// `refusesAsync`.
//
// A suite whose transactions index sets its fixture's knowledge up
// keyword-only: the store they build is real, what it holds is the
// assertion, and no vector fill is ever launched. A read of what a store
// holds is refused where there is none; its absence is asserted apart.
//
// A fixture is a git repository with its state worktree at `.leeway/`
// (`discovery-test-utils.cjs` makes it). A world many tests start from is
// built once per process and copied for each (`fixtureFrom`). A suite reads
// a state commit off the state branch (`stateGit`), and an owned code-tree
// file's off the code tree's.
//
// A suite spawns a process only where the process is the subject: the real
// CLI's pipe and exit behaviour, a child that must run concurrently (a lock
// race), a script that is not the engine. A race runs its contenders as
// children that wait at a barrier until every one is ready and report
// evidence that they met (`contend`). A call that must wait on a lock
// another holds runs in process, its attempts at the lock watched
// (`lockAttempts`): the test lets the lock go at the call's own attempt,
// never when a timer guesses the call has reached its wait.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const {
  STATE_DIR_NAME, TEMPLATE_DATE, withEnv, datedAt, git, testIdentity, bareRepo, templateFolder, copyWorld, copyFolder, setupFixture, setupFixtureAt, cleanupFixture,
  statePath, stateRelative, layout, writeState, readState, readManifest, createFile,
} = require('./discovery-test-utils.cjs');
const { FROZEN_MS, FROZEN_AT, withFrozenClock } = require('./frozen-clock.cjs');
const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { findStateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');
const { knowledgeFiles } = require('../../skills/workflow-engine/scripts/kernel/knowledge/files.cjs');
const { trustLogPath } = require('../../skills/workflow-engine/scripts/domain/trust-log.cjs');
const {
  STATE_BRANCH, createState, createStateBranchFromRemote, addStateWorktree, withStateLock, commitState,
} = require('../../skills/workflow-engine/scripts/domain/state-worktree.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

/**
 * @typedef {object} CallOptions
 * @property {Record<string, string|undefined>} [env] overlay for this call; `undefined` unsets a key
 * @property {string} [stdin] what the call reads on stdin
 */

/**
 * The shapes bound to one engine module — `harness()` for the repo's own. A
 * suite that runs the engine from a copied skills tree (its own stub
 * `migrate.cjs` beside it, which the engine resolves from its own
 * `__dirname`) binds that copy's `engine.cjs`.
 * @param {string} [enginePath]
 */
function harness(enginePath = ENGINE) {
  /** @type {typeof import('../../skills/workflow-engine/scripts/engine.cjs')} */
  const engine = require(enginePath);

  /**
   * The raw answer, nothing asserted.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const call = (dir, args, { env, stdin } = {}) => engine.run(args, { cwd: dir, env, stdin });

  /**
   * The raw answer of a command that answers later.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const callAsync = (dir, args, { env, stdin } = {}) => engine.runAsync(args, { cwd: dir, env, stdin });

  /**
   * The raw answer of a call that must succeed.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const succeeded = (dir, args, opts) => success(call(dir, args, opts), args);

  /**
   * A call that must succeed: the response line parsed, and everything after
   * it (the rendered sections a transaction appends, '' when none).
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const okSections = (dir, args, opts) => sectionsOf(succeeded(dir, args, opts), args);

  /**
   * `okSections` for a command that answers later.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const okSectionsAsync = async (dir, args, opts) => sectionsOf(success(await callAsync(dir, args, opts), args), args);

  /**
   * A call that must succeed: the parsed response line.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const ok = (dir, args, opts) => okSections(dir, args, opts).res;

  /**
   * A call that must refuse: exit 1, nothing on stdout, `{ok:false}` on stderr.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const refuses = (dir, args, opts) => refusal(call(dir, args, opts), args);

  /**
   * `refuses` for a command that answers later.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const refusesAsync = async (dir, args, opts) => refusal(await callAsync(dir, args, opts), args);

  /**
   * The whole stdout of a call that must succeed — a render surface's
   * sections, a bare read's value.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const output = (dir, args, opts) => succeeded(dir, args, opts).stdout;

  return { call, callAsync, ok, okSections, okSectionsAsync, refuses, refusesAsync, output };
}

/** @typedef {{stdout: string, stderr: string, code: number}} Answer */

/** An answer that must be a success. @param {Answer} res @param {string[]} args */
function success(res, args) {
  assert.strictEqual(res.code, 0,
    `engine ${args.join(' ')} failed\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  return res;
}

/** A success's response line parsed, and the sections after it. @param {Answer} res @param {string[]} args */
function sectionsOf(res, args) {
  const nl = res.stdout.indexOf('\n');
  const parsed = JSON.parse((nl === -1 ? res.stdout : res.stdout.slice(0, nl)).trim());
  assert.strictEqual(parsed.ok, true, `engine ${args.join(' ')} answered ok:false: ${res.stdout}`);
  return { res: parsed, sections: nl === -1 ? '' : res.stdout.slice(nl + 1) };
}

/** An answer that must be a refusal: its `{ok:false}` parsed. @param {Answer} res @param {string[]} args */
function refusal(res, args) {
  assert.strictEqual(res.code, 1,
    `engine ${args.join(' ')} was expected to refuse\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '', `a refusal says nothing on stdout: ${res.stdout}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false, `refusal is not clean {ok:false} JSON: ${res.stderr}`);
  return parsed;
}

/**
 * The checkout's knowledge set up keyword-only, as `setup --keyword-only`
 * pins it: a transaction's index builds a real store, and never launches a
 * vector fill.
 * @param {string} dir
 */
function keywordOnlyKnowledge(dir) {
  const config = knowledgeFiles(statePath(dir)).config;
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, '{ "knowledge": { "provider": null } }\n');
}

/**
 * The checkout set up keyword-only over a store that cannot be loaded: every
 * index into it and every removal from it fails, deterministically.
 * @param {string} dir
 */
function unreadableKnowledge(dir) {
  keywordOnlyKnowledge(dir);
  const files = knowledgeFiles(statePath(dir));
  store.writeMetadata(files.metadata, {});
  fs.writeFileSync(files.store, 'not a store');
}

/** Whether the checkout holds a knowledge store. @param {string} dir */
function hasStore(dir) {
  return fs.existsSync(knowledgeFiles(statePath(dir)).store);
}

/**
 * The files the store holds chunks of, state-relative and sorted; refused
 * where there is no store, which `hasStore` says.
 * @param {string} dir @returns {string[]}
 */
function indexedFiles(dir) {
  assert.ok(hasStore(dir), `no knowledge store in ${dir}`);
  return [...new Set(store.allChunks(store.loadStore(knowledgeFiles(statePath(dir)).store)).map((chunk) => chunk.source_file))].sort();
}

/**
 * Git in the world's state worktree.
 * @param {string} dir @param {string[]} args
 */
function stateGit(dir, args) {
  return git(statePath(dir), args);
}

/**
 * The ledger's entries in order, as the engine reads them: checked first,
 * each line read as an event of its version's shape.
 * @param {string} root the state root @param {string[]} [notes] what a landing the check finished said, pushed to
 * @returns {Record<string, unknown>[]}
 */
function ledgerEntries(root, notes = []) {
  const { withLedger } = require('../../skills/workflow-engine/scripts/domain/ledger.cjs');
  return withLedger(root, notes, (ledger) => [...ledger.entries()].map(({ event }) => event));
}

/** A ref's commit. @param {string} dir @param {string} ref @returns {string} */
function tip(dir, ref) {
  return git(dir, ['rev-parse', ref]).trim();
}

/** The remote's state branch tip, or '' where it holds none. @param {string} bare */
function remoteTip(bare) {
  return git(bare, ['for-each-ref', '--format=%(objectname)', `refs/heads/${STATE_BRANCH}`]).trim();
}

/**
 * `files` written in the state worktree at `root`, each at its
 * state-relative path, and committed there through the machinery, under the
 * writer lock — pushed where there is a remote: the commit's outcome.
 * @param {string} root @param {Record<string, string>} files @param {string} [message]
 */
function commitOnState(root, files, message = 'state: a change') {
  for (const [rel, content] of Object.entries(files)) createFile(root, rel, content);
  return withStateLock(root, () => commitState(root, Object.keys(files), message));
}

/** The state branch's commit, as the state worktree has it checked out. @param {string} dir */
function head(dir) {
  return stateGit(dir, ['rev-parse', 'HEAD']).trim();
}

/** The subjects of the state commits made since `from`, oldest first. @param {string} dir @param {string} from */
function commitsSince(dir, from) {
  return stateGit(dir, ['log', '--reverse', '--format=%s', `${from}..HEAD`]).split('\n').slice(0, -1);
}

/** The last state commit's subject. @param {string} dir */
function lastMessage(dir) {
  return stateGit(dir, ['log', '-1', '--format=%s']).trim();
}

/**
 * Every file in the state as it stands, state-relative, with its text.
 * @param {string} dir @returns {Record<string, string>}
 */
function treeSnapshot(dir) {
  /** @type {Record<string, string>} */
  const files = {};
  /** @param {string} rel */
  const walk = (rel) => {
    for (const entry of fs.readdirSync(statePath(dir, rel), { withFileTypes: true })) {
      const at = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(at);
      else files[at] = fs.readFileSync(statePath(dir, at), 'utf8');
    }
  };
  walk('');
  return files;
}

/**
 * A call that must refuse, leaving every file of the state as it was and
 * the state branch where it stood: its refusal.
 * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
 */
function refusedPristine(dir, args, opts) {
  const before = { tree: treeSnapshot(dir), head: head(dir) };
  const refused = refuses(dir, args, opts);
  assert.deepStrictEqual({ tree: treeSnapshot(dir), head: head(dir) }, before, `engine ${args.join(' ')} wrote or committed on refusing`);
  return refused;
}

/**
 * Run `fn` with git tracing every command it runs, in this process and in
 * every one it starts: its result, and each command traced, its arguments
 * after `git `.
 * @template T @param {() => T} fn @returns {{result: T, commands: string[]}}
 */
function traced(fn) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'git-trace-'));
  const file = path.join(folder, 'trace.log');
  try {
    const result = withEnv({ GIT_TRACE: file }, fn);
    const log = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { result, commands: [...log.matchAll(/trace: built-in: git (.*)$/gm)].map((m) => m[1]) };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * The code tree in `dir` committed whole, its state left as it stands.
 * @param {string} dir @param {string} message
 */
function commitCode(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

/**
 * Everything in the world committed, each side where it holds a change: the
 * code tree on its branch, the state on the state branch where the
 * repository has one.
 * @param {string} dir @param {string} message
 */
function commitAll(dir, message) {
  const state = findStateRoot(dir);
  for (const side of state === null ? [dir] : [dir, state]) {
    git(side, ['add', '-A']);
    if (git(side, ['status', '--porcelain']) !== '') git(side, ['commit', '-q', '-m', message]);
  }
}

/**
 * A git repo at `dir`, the folder made where it is missing, under the test
 * identity — a project's root, or a repo of its own inside one.
 * @param {string} dir
 * @returns {string} dir
 */
function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init', '-q', '-b', 'main']);
  testIdentity(dir);
  return dir;
}

/**
 * The environment that keeps a remote on GitHub off the network: a git
 * config file, written in `dir` and read in place of the empty global one,
 * that rewrites `git@github.com:` to GitHub on port 0. To whatever reads the
 * remote's URL it is still GitHub's, but ssh refuses port 0 before it looks
 * the host up — so a suite standing in for GitHub serves it through a
 * stand-in ssh, and a call the stand-in misses fails, never reaching
 * github.com.
 * @param {string} dir
 * @returns {{GIT_CONFIG_GLOBAL: string}}
 */
function githubOffline(dir) {
  const file = path.join(dir, 'github-offline.gitconfig');
  fs.writeFileSync(file, '[url "ssh://git@github.com:0/"]\n\tinsteadOf = git@github.com:\n');
  return { GIT_CONFIG_GLOBAL: file };
}

/**
 * A `ps` that fails, made in `dir`: `path` puts it first on the PATH, where
 * every start-time read comes back empty, as when `ps` cannot be spawned;
 * `runs()` answers the arguments of each run it was asked for.
 * @param {string} dir
 * @returns {{path: string, runs: () => string[]}}
 */
function failingPs(dir) {
  const bin = fs.mkdtempSync(path.join(dir, 'ps-'));
  const log = path.join(bin, 'runs');
  fs.writeFileSync(path.join(bin, 'ps'), `#!/bin/sh\necho "$*" >> "${log}"\nexit 1\n`, { mode: 0o755 });
  return {
    path: `${bin}:${process.env.PATH}`,
    runs: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').slice(0, -1) : []),
  };
}

/** What a full disk answers an append with. */
const NO_SPACE = 'ENOSPC: no space left on device, write';

/**
 * Fail every append to the trust log the configuration names at the time,
 * as a full disk does — after writing it, where it `lands` — until the
 * answered mock is restored.
 * @param {import('node:test').TestContext} t @param {boolean} [lands]
 */
function failingTrustAppends(t, lands = false) {
  const append = fs.appendFileSync;
  return t.mock.method(fs, 'appendFileSync', (/** @type {any} */ file, /** @type {any} */ data) => {
    if (file !== trustLogPath()) return append(file, data);
    if (lands) append(file, data);
    throw Object.assign(new Error(NO_SPACE), { code: 'ENOSPC' });
  });
}

/**
 * A temp world — the git repo, its state worktree, a test identity and no
 * signing — that an engine commit lands in. Content is the suite's own;
 * `cleanupFixture` removes it.
 * @param {string} [prefix] temp-directory prefix, so a leftover names its suite
 */
function setupGitFixture(prefix = 'engine-') {
  return setupFixture(prefix);
}

/**
 * A world many tests start from, made once per process: `build` fills a
 * fresh world at the first call, and every call answers a copy of it — at
 * the folder given, or in a temp folder of its own — the build's git work
 * paid once, not per test. A world whose git config names a path outside
 * it, a remote beside it, is no template: the copy would share it.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite; the template's is `{prefix}template-`
 * @param {(dir: string) => void} build
 * @returns {(dir?: string) => string} symbolic links resolved — the path the engine names it by
 */
function fixtureFrom(prefix, build) {
  /** @type {string|null} */
  let made = null;
  return (dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))) => {
    if (made === null) {
      const template = setupFixtureAt(templateFolder(`${prefix}template-`));
      build(template);
      made = template;
    }
    return copyWorld(made, dir);
  };
}

/**
 * A world of several repositories many tests start from, made once per
 * process: `build` fills an empty folder at the first call, and every call
 * copies what it made into `dir`, each repository moved onto the copy's
 * paths (`copyFolder`) — a remote beside a project among them.
 * @param {string} prefix the template's temp-directory prefix, so a leftover names its suite
 * @param {(folder: string) => void} build
 * @returns {(dir: string) => string} dir, symbolic links resolved
 */
function folderFrom(prefix, build) {
  /** @type {string|null} */
  let made = null;
  return (dir) => {
    if (made === null) {
      const template = templateFolder(`${prefix}template-`);
      build(template);
      made = template;
    }
    return copyFolder(made, dir);
  };
}

/** A clone of the remote `bare` at `dir`, under the test identity. @param {string} bare @param {string} dir @param {string[]} [args] further `git clone` flags */
function cloneOf(bare, dir, args = []) {
  git(path.dirname(dir), ['clone', '-q', ...args, bare, dir]);
  testIdentity(dir);
  return dir;
}

/**
 * @typedef {object} ProjectShape
 * @property {string} [name] the project's folder, and its remote's `{name}.git`
 * @property {boolean} [remote] a bare remote beside it as `origin`, `main` pushed there
 * @property {boolean} [state] its state worktree made, pushed where there is a remote
 * @property {'sha1'|'sha256'} [objectFormat]
 */

/**
 * A project of `shape` built in `folder`, every commit dated as the
 * project world's are.
 * @param {string} folder @param {Required<ProjectShape>} shape
 */
function buildProject(folder, shape) {
  datedAt(TEMPLATE_DATE, () => buildDated(folder, shape));
}

/** @param {string} folder @param {Required<ProjectShape>} shape */
function buildDated(folder, { name, remote, state, objectFormat }) {
  const main = path.join(folder, name);
  fs.mkdirSync(main);
  git(main, ['init', '-q', '-b', 'main', `--object-format=${objectFormat}`]);
  testIdentity(main);
  createFile(main, 'README.md', `# ${name}\n`);
  git(main, ['add', 'README.md']);
  git(main, ['commit', '-q', '-m', 'code']);
  if (remote) {
    const bare = bareRepo(path.join(folder, `${name}.git`), [`--object-format=${objectFormat}`]);
    git(main, ['remote', 'add', 'origin', bare]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  if (state) createState(path.join(main, STATE_DIR_NAME));
}

/** @type {Map<string, (dir: string) => string>} */
const projects = new Map();

/**
 * A project at `{dir}/{name}` with one code commit on `main` — and, as its
 * shape asks, a bare remote beside it and its state — each shape made once
 * per process and copied; its commits dated as the project world's are.
 * @param {string} dir @param {ProjectShape} [shape]
 * @returns {{main: string, root: string, bare: string|null}} the main checkout, its state root, and its remote
 */
function codeProject(dir, { name = 'project', remote = false, state = false, objectFormat = 'sha1' } = {}) {
  const shape = { name, remote, state, objectFormat };
  const key = JSON.stringify(shape);
  if (!projects.has(key)) projects.set(key, folderFrom(`project-${name}-`, (folder) => buildProject(folder, shape)));
  const at = /** @type {(dir: string) => string} */ (projects.get(key))(dir);
  const main = path.join(at, name);
  return { main, root: path.join(main, STATE_DIR_NAME), bare: remote ? path.join(at, `${name}.git`) : null };
}

/** @typedef {{main: string, root: string}} Machine */

/** @type {Map<string, (dir: string) => string>} */
const machines = new Map();

/**
 * Two machines on one remote: here, a project, `name`, at `{dir}/{name}`,
 * its state pushed to the bare remote beside it, `{name}.git`; and there, a
 * clone of the remote at `{dir}/other-machine`, its state worktree made from
 * the remote's state branch. Made once per process for each name, copied;
 * the project's commits dated as the project world's are.
 * @param {string} dir @param {{name?: string}} [opts]
 * @returns {{here: Machine, there: Machine, bare: string}}
 */
function twoMachines(dir, { name = 'project' } = {}) {
  if (!machines.has(name)) {
    machines.set(name, folderFrom(`two-machines-${name}-`, (folder) => {
      buildProject(folder, { name, remote: true, state: true, objectFormat: 'sha1' });
      const there = cloneOf(path.join(folder, `${name}.git`), path.join(folder, 'other-machine'));
      createStateBranchFromRemote(path.join(there, STATE_DIR_NAME));
      addStateWorktree(path.join(there, STATE_DIR_NAME));
    }));
  }
  const at = /** @type {(dir: string) => string} */ (machines.get(name))(dir);
  /** @param {string} folder @returns {Machine} */
  const machine = (folder) => ({ main: path.join(at, folder), root: path.join(at, folder, STATE_DIR_NAME) });
  return { here: machine(name), there: machine('other-machine'), bare: path.join(at, `${name}.git`) };
}

/**
 * `rel` added to the repo at `dir` as a submodule cloned from the repo at
 * `source`, the addition committed; the clone commits under the test identity.
 * `force` adds it where the repo ignores its folder.
 * @param {string} dir @param {string} rel @param {string} source
 * @param {{force?: boolean}} [opts]
 * @returns {string} the clone's path
 */
function addSubmodule(dir, rel, source, { force = false } = {}) {
  git(dir, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', ...(force ? ['-f'] : []), source, rel]);
  git(dir, ['commit', '-q', '-m', `add ${rel}`]);
  const clone = path.join(dir, rel);
  testIdentity(clone);
  return clone;
}

/**
 * The lock `file` written as held by this live process — a peer holding it,
 * to any caller.
 * @param {string} file @returns {string} the lock
 */
function holdLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, pid_start: processStartTime(process.pid) }));
  return file;
}

/**
 * Each attempt this process makes at the lock `file` for the rest of the
 * test — a claim linked into place, or a lock file opened exclusively —
 * `made`, or `taken` where another holds it. `onTaken` runs at each attempt
 * that finds it taken, given how many have, before the attempt answers.
 * @param {import('node:test').TestContext} t @param {string} file
 * @param {(taken: number) => void} [onTaken]
 * @returns {Array<'made'|'taken'>}
 */
function lockAttempts(t, file, onTaken = () => {}) {
  /** @type {Array<'made'|'taken'>} */
  const attempts = [];
  /** @param {'linkSync'|'openSync'} name @param {(args: any[]) => unknown} target */
  const watch = (name, target) => {
    const real = /** @type {(...args: any[]) => any} */ (fs[name]);
    t.mock.method(fs, name, (/** @type {any[]} */ ...args) => {
      if (target(args) !== file) return real(...args);
      try {
        const made = real(...args);
        attempts.push('made');
        return made;
      } catch (err) {
        if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') throw err;
        attempts.push('taken');
        onTaken(attempts.filter((attempt) => attempt === 'taken').length);
        throw err;
      }
    });
  };
  watch('linkSync', ([, to]) => to);
  watch('openSync', ([at, flags]) => (flags === 'wx' ? at : null));
  return attempts;
}

/**
 * What every contender's script opens with: `fs`, and its calls —
 * `atBarrier()`, where it says it is ready and waits until every contender
 * is; `report(r)`, its one line back, last; and `untilAllReported()`, where
 * it waits, holding what it holds, until every contender has reported.
 */
const CONTENDER = [
  "const fs = require('fs');",
  "const atBarrier = () => { fs.writeSync(1, 'ready\\n'); fs.readSync(0, Buffer.alloc(1)); };",
  "const report = (r) => fs.writeSync(1, JSON.stringify(r) + '\\n');",
  'const untilAllReported = () => fs.readSync(0, Buffer.alloc(1));',
].join('\n');

/**
 * Well inside the writer lock's 60s wait: a contender still running then
 * has hung on a lock that never comes free, and is killed.
 */
const CONTENDER_TIMEOUT_MS = 30000;

/**
 * One contender, a node child running `script`, killed should it run past
 * CONTENDER_TIMEOUT_MS: the `lines` it prints; `printed(n)`, resolved once
 * it has printed `n` of them or exited; and `done`, with its exit code, the
 * signal that killed it, its stderr and its lines.
 * @param {string} script @param {string[]} args @param {NodeJS.ProcessEnv} env
 */
function contender(script, args, env) {
  const child = spawn(process.execPath, ['-e', script, ...args], { env, timeout: CONTENDER_TIMEOUT_MS, killSignal: 'SIGKILL' });
  child.stdin.on('error', () => {}); // one that has exited has no stdin left to write to
  /** @type {string[]} */
  const lines = [];
  let stderr = '';
  let exited = false;
  /** @type {Set<() => void>} */
  const waiters = new Set();
  const changed = () => { for (const wake of waiters) wake(); };
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  readline.createInterface({ input: child.stdout }).on('line', (line) => { lines.push(line); changed(); });
  /** @type {Promise<{code: number|null, signal: NodeJS.Signals|null, stderr: string, lines: string[]}>} */
  const done = new Promise((resolve) => child.on('close', (code, signal) => { exited = true; changed(); resolve({ code, signal, stderr, lines }); }));
  /** @param {number} count @returns {Promise<void>} */
  const printed = (count) => new Promise((resolve) => {
    const check = () => {
      if (lines.length < count && !exited) return;
      waiters.delete(check);
      resolve();
    };
    waiters.add(check);
    check();
  });
  return { child, lines, printed, done };
}

/**
 * Race `n` contenders, each running CONTENDER and then `body` with argv
 * `args` — or, where contenders play parts, `args(i)` for the i-th. Each
 * barrier lifts once every one has reached it, so they go on together
 * however slowly each got there; their stdin closes once every one has
 * reported. Answers each one's report.
 * @param {number} n @param {string} body @param {string[]|((i: number) => string[])} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<any[]>}
 */
async function contend(n, body, args, env = process.env) {
  const runs = Array.from({ length: n }, (_, i) => contender(`${CONTENDER}\n${body}`, typeof args === 'function' ? args(i) : args, env));
  for (let line = 1; ; line++) {
    await Promise.all(runs.map((run) => run.printed(line)));
    if (!runs.every((run) => run.lines[line - 1] === 'ready')) break;
    for (const run of runs) run.child.stdin.write('g');
  }
  for (const run of runs) run.child.stdin.end();
  const results = await Promise.all(runs.map((run) => run.done));
  for (const { code, signal, stderr } of results) {
    assert.strictEqual(code, 0, signal ? `a contender still running after ${CONTENDER_TIMEOUT_MS}ms was killed\n${stderr}` : stderr);
  }
  return results.map(({ lines }) => JSON.parse(/** @type {string} */ (lines.at(-1))));
}

// A migration runner standing in for the real one, its report in the real
// one's format byte for byte, for boot parses it. STUB_MIGRATE_MODE picks
// what it does: nothing (unset); `update`, a migration recorded and a state
// document changed, stopping for review; `update-config`, the project's
// settings (STUB_MIGRATE_SETTINGS) and .gitignore changed; `record-only`, a
// migration recorded and nothing changed; `fail`, a crash. Where
// STUB_MIGRATE_MARK names a file, it records there the state branch's tip as
// it found it: that it ran, and over what state. STUB_MIGRATE_NOTICES is a
// notices payload; STUB_MIGRATE_REPORT stands in for the run report's
// payload, and STUB_MIGRATE_NO_REPORT plays a runner from before the report.
const STUB_MIGRATE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const mode = process.env.STUB_MIGRATE_MODE || '';
const record = process.argv[process.argv.indexOf('--record') + 1];
if (process.env.STUB_MIGRATE_MARK) {
  fs.appendFileSync(process.env.STUB_MIGRATE_MARK, require('child_process').execFileSync('git', ['rev-parse', '${STATE_BRANCH}'], { encoding: 'utf8' }));
}
let ran = 1;
if (mode === 'update') {
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.mkdirSync(${JSON.stringify(path.join(STATE_DIR_NAME, layout.unit('payments')))}, { recursive: true });
  fs.appendFileSync(record, '045\\n');
  fs.writeFileSync(${JSON.stringify(path.join(STATE_DIR_NAME, layout.unit('payments', 'marker.md')))}, 'migrated\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 2 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n' +
    'Follow the explicit instructions in the migration skill before proceeding.\\n'
  );
} else if (mode === 'update-config') {
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.mkdirSync('.claude', { recursive: true });
  fs.appendFileSync(record, '046\\n');
  fs.writeFileSync('.claude/settings.json', process.env.STUB_MIGRATE_SETTINGS || '{"permissions":{}}\\n');
  fs.appendFileSync('.gitignore', '.DS_Store\\n');
  process.stdout.write(
    '\\n' +
    '1 migration(s) applied, 3 file(s) updated.\\n' +
    '\\n' +
    '---STOP_GATE: FILES_UPDATED---\\n' +
    'You MUST now follow the migration skill instructions to STOP and let the user review.\\n'
  );
} else if (mode === 'record-only') {
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.appendFileSync(record, '047\\n');
  process.stdout.write('[SKIP] No changes needed\\n');
} else if (mode === 'fail') {
  process.stdout.write('partial output before the failure\\n');
  process.stderr.write('boom: migration 099 exploded\\n');
  process.exit(1);
} else {
  ran = 0;
  process.stdout.write('[SKIP] No changes needed\\n');
}
if (process.env.STUB_MIGRATE_NOTICES) {
  process.stdout.write('---MIGRATION_NOTICES---\\n' + process.env.STUB_MIGRATE_NOTICES + '\\n');
}
if (!process.env.STUB_MIGRATE_NO_REPORT) {
  process.stdout.write('---MIGRATIONS_RUN---\\n');
  process.stdout.write((process.env.STUB_MIGRATE_REPORT || JSON.stringify({ ran })) + '\\n');
}
`;

/** @type {(ReturnType<typeof harness> & {path: string})|null} */
let stub = null;

/**
 * The engine copied, once per process, into a skills folder beside the
 * stand-in migration runner (`STUB_MIGRATE`) — boot finds the runner beside
 * its own file, so the copy runs that resolution as installed: its path,
 * and the shapes bound to it. The copy is never written to; each test
 * brings its own project.
 */
function stubEngine() {
  if (stub !== null) return stub;
  const skills = templateFolder('engine-skills-');
  fs.cpSync(path.dirname(path.dirname(ENGINE)), path.join(skills, 'workflow-engine'), { recursive: true });
  createFile(skills, 'workflow-migrate/scripts/migrate.cjs', STUB_MIGRATE);
  const at = path.join(skills, 'workflow-engine/scripts/engine.cjs');
  stub = { ...harness(at), path: at };
  return stub;
}

const { call, callAsync, ok, okSections, okSectionsAsync, refuses, refusesAsync, output } = harness();

module.exports = {
  ENGINE, harness, stubEngine,
  call, callAsync, ok, okSections, okSectionsAsync, refuses, refusesAsync, refusedPristine, output, holdLock, lockAttempts, contend,
  FROZEN_MS, FROZEN_AT, withFrozenClock, withEnv, datedAt,
  keywordOnlyKnowledge, unreadableKnowledge, hasStore, indexedFiles,
  STATE_DIR_NAME, statePath, stateRelative, layout, createFile, writeState, readState, readManifest,
  git, stateGit, commitOnState, head, commitsSince, lastMessage, treeSnapshot, traced, ledgerEntries, tip, remoteTip,
  commitCode, commitAll, testIdentity, bareRepo, initRepo, cloneOf, githubOffline, failingPs,
  NO_SPACE, failingTrustAppends,
  setupGitFixture, setupFixtureAt, fixtureFrom, folderFrom, codeProject, twoMachines, addSubmodule, cleanupFixture,
};
