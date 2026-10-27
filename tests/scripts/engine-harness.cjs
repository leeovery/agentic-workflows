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
// takes a key away. A command that waits on the embedding provider answers
// through `callAsync`.
//
// A suite whose transactions index sets its fixture's knowledge up
// keyword-only: the store they build is real, what it holds is the
// assertion, and no vector fill is ever launched.
//
// A fixture is a git repository with its state worktree at `.leeway/`
// (`discovery-test-utils.cjs` makes it). A suite reads a state commit off the
// state branch (`stateGit`), and an owned code-tree file's off the code
// tree's.
//
// A suite spawns a process only where the process is the subject: the real
// CLI's pipe and exit behaviour, a child that must run concurrently (a lock
// race), a script that is not the engine.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  STATE_DIR_NAME, git, testIdentity, setupFixture, setupFixtureAt, cleanupFixture, statePath,
} = require('./discovery-test-utils.cjs');
const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { findStateRoot } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');
const { knowledgeFiles } = require('../../skills/workflow-engine/scripts/kernel/knowledge/files.cjs');

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
   * The raw answer of a command that waits on the embedding provider.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const callAsync = (dir, args, { env, stdin } = {}) => engine.runAsync(args, { cwd: dir, env, stdin });

  /**
   * The raw answer of a call that must succeed.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  function succeeded(dir, args, opts) {
    const res = call(dir, args, opts);
    assert.strictEqual(res.code, 0,
      `engine ${args.join(' ')} failed\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    return res;
  }

  /**
   * A call that must succeed: the response line parsed, and everything after
   * it (the rendered sections a transaction appends, '' when none).
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  function okSections(dir, args, opts) {
    const res = succeeded(dir, args, opts);
    const nl = res.stdout.indexOf('\n');
    const parsed = JSON.parse((nl === -1 ? res.stdout : res.stdout.slice(0, nl)).trim());
    assert.strictEqual(parsed.ok, true, `engine ${args.join(' ')} answered ok:false: ${res.stdout}`);
    return { res: parsed, sections: nl === -1 ? '' : res.stdout.slice(nl + 1) };
  }

  /**
   * A call that must succeed: the parsed response line.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const ok = (dir, args, opts) => okSections(dir, args, opts).res;

  /**
   * A call that must refuse: exit 1, nothing on stdout, `{ok:false}` on stderr.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  function refuses(dir, args, opts) {
    const res = call(dir, args, opts);
    assert.strictEqual(res.code, 1,
      `engine ${args.join(' ')} was expected to refuse\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.strictEqual(res.stdout, '', `a refusal says nothing on stdout: ${res.stdout}`);
    const parsed = JSON.parse(res.stderr.trim());
    assert.strictEqual(parsed.ok, false, `refusal is not clean {ok:false} JSON: ${res.stderr}`);
    return parsed;
  }

  /**
   * The whole stdout of a call that must succeed — a render surface's
   * sections, a bare read's value.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const output = (dir, args, opts) => succeeded(dir, args, opts).stdout;

  return { call, callAsync, ok, okSections, refuses, output };
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

/**
 * The files the store holds chunks of, state-relative and sorted — none
 * without a store.
 * @param {string} dir @returns {string[]}
 */
function indexedFiles(dir) {
  const file = knowledgeFiles(statePath(dir)).store;
  if (!fs.existsSync(file)) return [];
  return [...new Set(store.allChunks(store.loadStore(file)).map((chunk) => chunk.source_file))].sort();
}

/**
 * Git in the world's state worktree.
 * @param {string} dir @param {string[]} args
 */
function stateGit(dir, args) {
  return git(statePath(dir), args);
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
 * A temp world — the git repo, its state worktree, a test identity and no
 * signing — that an engine commit lands in. Content is the suite's own;
 * `cleanupFixture` removes it.
 * @param {string} [prefix] temp-directory prefix, so a leftover names its suite
 */
function setupGitFixture(prefix = 'engine-') {
  return setupFixture(prefix);
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

const { call, callAsync, ok, okSections, refuses, output } = harness();

module.exports = {
  ENGINE, harness,
  call, callAsync, ok, okSections, refuses, output,
  keywordOnlyKnowledge, unreadableKnowledge, indexedFiles,
  STATE_DIR_NAME, statePath, git, stateGit, commitAll, testIdentity, initRepo, githubOffline,
  setupGitFixture, setupFixtureAt, addSubmodule, cleanupFixture,
};
