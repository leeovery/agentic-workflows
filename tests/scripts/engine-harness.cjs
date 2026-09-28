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
// takes a key away, which is how a suite reproduces an environment it used to
// pass down by replacement. A command that waits on the embedding provider
// answers through `callAsync`.
//
// A suite whose transactions index sets its fixture's knowledge up
// keyword-only: the store they build is real, what it holds is the
// assertion, and no vector fill is ever launched.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { cleanupFixture } = require('./discovery-test-utils.cjs');
const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
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
  const config = knowledgeFiles(dir).config;
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, '{ "knowledge": { "provider": null } }\n');
}

/**
 * The files the store holds chunks of, sorted — none without a store.
 * @param {string} dir @returns {string[]}
 */
function indexedFiles(dir) {
  const file = knowledgeFiles(dir).store;
  if (!fs.existsSync(file)) return [];
  return [...new Set(store.allChunks(store.loadStore(file)).map((chunk) => chunk.source_file))].sort();
}

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/**
 * A temp git repo with a `.workflows/` tree, a test identity and no signing —
 * the world an engine commit lands in. Content and a first commit are the
 * suite's own; `cleanupFixture` removes it.
 * @param {string} [prefix] temp-directory prefix, so a leftover names its suite
 */
function setupGitFixture(prefix = 'engine-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

const { call, callAsync, ok, okSections, refuses, output } = harness();

module.exports = {
  ENGINE, harness,
  call, callAsync, ok, okSections, refuses, output,
  keywordOnlyKnowledge, indexedFiles,
  git, setupGitFixture, cleanupFixture,
};
