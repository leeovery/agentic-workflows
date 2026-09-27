'use strict';

// The knowledge CLI driven as a process, against a stand-in OpenAI-compatible
// embeddings endpoint that answers as its mode says and records what it was
// sent. The CLI runs asynchronously, so the endpoint — served from the test's
// own process — can answer it. And, in process, a run whose retry backoff
// costs no real time.

const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { StubProvider } = require('../../src/knowledge/embeddings');

const BUNDLE = path.join(__dirname, '..', '..', 'skills', 'workflow-knowledge', 'scripts', 'knowledge.cjs');

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
 * Run the knowledge CLI in `root`, the call's environment laid over the
 * process's own.
 * @param {string} root @param {string[]} args @param {Record<string, string>} [env]
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function knowledgeCli(root, args, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [BUNDLE, ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? /** @type {any} */ (err).code : 0, stdout, stderr });
    });
  });
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

module.exports = { embeddingEndpoint, knowledgeCli, withoutBackoff };
