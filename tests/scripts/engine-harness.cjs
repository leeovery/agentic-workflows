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
// pass down by replacement.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { cleanupFixture } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

/**
 * @typedef {object} CallOptions
 * @property {Record<string, string|undefined>} [env] overlay for this call; `undefined` unsets a key
 * @property {string} [stdin] what the call reads on stdin
 */

/**
 * The shapes bound to one engine module — `harness()` for the repo's own.
 * A suite that runs the engine from a copied skills tree (its own stub
 * `migrate.cjs` or `knowledge.cjs` beside it, which the engine resolves from
 * its own `__dirname`) binds that copy's `engine.cjs`; `stubbedEngine()` is
 * that tree for the knowledge CLI alone.
 * @param {string} [enginePath]
 */
function harness(enginePath = ENGINE) {
  /** @type {{run: (argv: string[], opts: {cwd: string, env?: Record<string, string|undefined>, stdin?: string}) => {stdout: string, stderr: string, code: number}}} */
  const engine = require(enginePath);

  /**
   * The raw answer, nothing asserted.
   * @param {string} dir @param {string[]} args @param {CallOptions} [opts]
   */
  const call = (dir, args, { env, stdin } = {}) => engine.run(args, { cwd: dir, env, stdin });

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

  return { call, ok, okSections, refuses, output };
}

// A knowledge CLI that records instead of indexing: the engine's KB behaviour
// has to be deterministic in tests, where the real CLI's answer depends on the
// machine's knowledge configuration. Each invocation is appended to
// `knowledge-calls.log` in the project cwd; `STUB_KNOWLEDGE_EXIT` makes it fail.
const STUB_KNOWLEDGE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
fs.appendFileSync('knowledge-calls.log', process.argv.slice(2).join(' ') + '\\n');
if (process.env.STUB_KNOWLEDGE_EXIT) {
  process.stderr.write('kb exploded\\n');
  process.exit(parseInt(process.env.STUB_KNOWLEDGE_EXIT, 10));
}
process.exit(0);
`;

/** @type {ReturnType<typeof harness>|null} */
let stubbed = null;

/**
 * The engine copied into a temp skills tree beside a stub knowledge CLI — the
 * layout an install has, so the engine's own `__dirname`-relative resolution
 * is what a suite exercises while the real store stays out of it. One tree per
 * process: the copy is never written to, and each fixture brings its own
 * project directory.
 */
function stubbedEngine() {
  if (stubbed) return stubbed;
  const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-skills-'));
  process.on('exit', () => fs.rmSync(skills, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  fs.cpSync(path.dirname(ENGINE), path.join(skills, 'workflow-engine/scripts'), { recursive: true });
  const stub = path.join(skills, 'workflow-knowledge/scripts/knowledge.cjs');
  fs.mkdirSync(path.dirname(stub), { recursive: true });
  fs.writeFileSync(stub, STUB_KNOWLEDGE);
  stubbed = harness(path.join(skills, 'workflow-engine/scripts/engine.cjs'));
  return stubbed;
}

/** What the stub knowledge CLI was asked for, in order. @param {string} project */
function knowledgeCalls(project) {
  const log = path.join(project, 'knowledge-calls.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
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

const { call, ok, okSections, refuses, output } = harness();

module.exports = {
  ENGINE, harness, stubbedEngine, knowledgeCalls,
  call, ok, okSections, refuses, output,
  git, setupGitFixture, cleanupFixture,
};
