'use strict';

// The knowledge base driven through its engine door, against a stand-in
// OpenAI-compatible embeddings endpoint that answers as its mode says and
// records what it was sent. The door runs in process and waits, so the
// endpoint — served from the test's own process — can answer it. And, in
// process, a run whose retry backoff costs no real time, a call whose output
// is held, and the vector fill's launches recorded rather than spawned. And
// the world a suite drives the door over: a work unit written and
// registered, the knowledge config, the store's metadata and its chunks, and
// a system config directory of the test's own.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const engine = require('../../skills/workflow-engine/scripts/engine.cjs');
const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../skills/workflow-engine/scripts/kernel/knowledge/files.cjs');
const { StubProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/embeddings.cjs');
const { launcher } = require('../../skills/workflow-engine/scripts/kernel/call.cjs');
const { createManifest, statePath } = require('./discovery-test-utils.cjs');

/** How the endpoint answers in each failing mode. */
const FAILURES = {
  quota: { status: 429, headers: {}, body: { error: { code: 'insufficient_quota', message: 'You exceeded your current quota.' } } },
  'rate-limited': { status: 429, headers: { 'retry-after': '20' }, body: { error: { message: 'Rate limit reached. Please try again in 20s.' } } },
  down: { status: 503, headers: {}, body: { error: { message: 'Service unavailable.' } } },
};

/**
 * @typedef {object} EmbeddingEndpoint
 * @property {'ok'|'silent'|keyof typeof FAILURES} mode  how it answers the next request — `silent` never does
 * @property {string[][]} requests  each request's inputs, in order
 * @property {string} url  the base URL a config names it by
 * @property {object} config  the knowledge settings that point a project at it
 * @property {() => Promise<void>} close
 */

/**
 * A stand-in endpoint, listening: `ok` embeds each input with the stub
 * provider's vectors, `silent` holds every request open unanswered, any
 * other mode fails every request as FAILURES says.
 * @param {number} dimensions
 * @returns {Promise<EmbeddingEndpoint>}
 */
async function embeddingEndpoint(dimensions) {
  const stub = new StubProvider({ dimensions });
  /** @type {any} */
  const endpoint = { mode: 'ok', requests: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const { input } = JSON.parse(body);
      const texts = Array.isArray(input) ? input : [input];
      endpoint.requests.push(texts);
      if (endpoint.mode === 'silent') return;
      const failure = FAILURES[endpoint.mode];
      res.writeHead(failure ? failure.status : 200, { 'content-type': 'application/json', ...(failure ? failure.headers : {}) });
      res.end(JSON.stringify(failure ? failure.body : { data: texts.map((text, index) => ({ index, embedding: stub.embed(text) })) }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  endpoint.url = `http://127.0.0.1:${/** @type {import('net').AddressInfo} */ (server.address()).port}/v1`;
  endpoint.config = { provider: 'openai-compatible', base_url: endpoint.url, model: 'stand-in', dimensions };
  endpoint.close = () => new Promise((resolve) => {
    server.close(() => resolve(undefined));
    server.closeAllConnections();
  });
  return endpoint;
}

/**
 * `engine knowledge <args>` in `root`, the call's environment laid over the
 * process's own, `input` its stdin.
 * @param {string} root @param {string[]} args @param {Record<string, string|undefined>} [env] @param {string} [input]
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function engineKnowledge(root, args, env = {}, input = '') {
  return engine.runAsync(['knowledge', ...args], { cwd: root, env, stdin: input });
}

/**
 * A call whose output is held: `output.stdout` and `output.stderr` gather
 * what the domain writes.
 * @param {string} cwd
 */
function heldCall(cwd) {
  const output = { stdout: '', stderr: '' };
  return {
    output,
    call: {
      cwd,
      out: (/** @type {string} */ text) => { output.stdout += text; },
      err: (/** @type {string} */ text) => { output.stderr += text; },
      stdin: () => '',
    },
  };
}

/**
 * The vector fill's launches recorded — the project root of each — rather
 * than a process spawned, for the length of the test; any other detached
 * job's launch dropped, never spawned either.
 * @param {import('node:test').TestContext} t
 * @returns {string[]}
 */
function recordLaunches(t) {
  /** @type {string[]} */
  const launched = [];
  t.mock.method(launcher, 'launch', (/** @type {string} */ root, /** @type {string[]} */ argv) => {
    if (argv.join(' ') === 'knowledge fill') launched.push(root);
  });
  return launched;
}

/**
 * Run `run` in process with setTimeout mocked, every timer it sets fired at
 * once — a retry's backoff then costs no real time.
 * @template T
 * @param {import('node:test').TestContext} t @param {() => Promise<T>} run
 * @returns {Promise<T>}
 */
async function withoutBackoff(t, run) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let settled = false;
  const running = run();
  running.then(() => { settled = true; }, () => { settled = true; });
  while (!settled) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.runAll();
  }
  t.mock.timers.reset();
  return running;
}

/**
 * The work unit `name` written into the world's state and registered in the
 * project manifest, its manifest's own fields laid over the defaults.
 * @param {string} root @param {string} name @param {string} workType @param {Record<string, any>} [fields]
 */
function knowledgeUnit(root, name, workType, fields = {}) {
  createManifest(root, name, { work_type: workType, created: '2026-01-01', ...fields });
  const registry = statePath(root, 'manifest.json');
  const project = JSON.parse(fs.readFileSync(registry, 'utf8'));
  project.work_units = { ...project.work_units, [name]: { work_type: workType } };
  fs.writeFileSync(registry, JSON.stringify(project, null, 2) + '\n');
}

/**
 * The world's knowledge config, its `knowledge` object as given.
 * @param {string} root @param {Record<string, any>} knowledge
 */
function configureKnowledge(root, knowledge) {
  const { config } = knowledgeFiles(statePath(root));
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ knowledge }) + '\n');
}

/** The world's knowledge files. @param {string} root */
const knowledgeAt = (root) => knowledgeFiles(statePath(root));

/** The store's metadata as written. @param {string} root */
function knowledgeMetadata(root) {
  return JSON.parse(fs.readFileSync(knowledgeAt(root).metadata, 'utf8'));
}

/**
 * The chunks the store holds, those of one identity where it is named.
 * @param {string} root @param {{workUnit?: string, phase?: string, topic?: string}} [identity]
 */
function storedChunks(root, { workUnit, phase, topic } = {}) {
  return store.allChunks(store.loadStore(knowledgeAt(root).store)).filter((c) =>
    (workUnit === undefined || c.work_unit === workUnit)
    && (phase === undefined || c.phase === phase)
    && (topic === undefined || c.topic === topic));
}

/**
 * A system config directory of the test's own, holding each file given —
 * `config.json`, `credentials.json` — as written; removed after the test.
 * A call takes it as its `WORKFLOWS_CONFIG_DIR`.
 * @param {import('node:test').TestContext} t @param {Record<string, string>} [files]
 * @returns {string}
 */
function systemConfigDir(t, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-system-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

module.exports = {
  embeddingEndpoint, engineKnowledge, heldCall, recordLaunches, withoutBackoff,
  knowledgeUnit, configureKnowledge, knowledgeAt, knowledgeMetadata, storedChunks, systemConfigDir,
};
