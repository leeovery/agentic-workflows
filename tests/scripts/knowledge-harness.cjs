'use strict';

// The knowledge base driven through its engine door, against a stand-in
// OpenAI-compatible embeddings endpoint that answers as its mode says and
// records what it was sent. The door runs in process and waits, so the
// endpoint — served from the test's own process — can answer it. And, in
// process, a run whose retry backoff costs no real time, a call whose output
// is held, and the vector fill's launches recorded rather than spawned.

const http = require('http');
const engine = require('../../skills/workflow-engine/scripts/engine.cjs');
const { StubProvider } = require('../../skills/workflow-engine/scripts/kernel/knowledge/embeddings.cjs');
const { launcher } = require('../../skills/workflow-engine/scripts/domain/knowledge/vectors.cjs');

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
function knowledgeCli(root, args, env = {}, input = '') {
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
 * than a process spawned, for the length of the test.
 * @param {import('node:test').TestContext} t
 * @returns {string[]}
 */
function recordLaunches(t) {
  /** @type {string[]} */
  const launched = [];
  t.mock.method(launcher, 'launch', (/** @type {string} */ root) => { launched.push(root); });
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

module.exports = { embeddingEndpoint, knowledgeCli, heldCall, recordLaunches, withoutBackoff };
