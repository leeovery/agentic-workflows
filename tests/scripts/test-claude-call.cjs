'use strict';

// ---------------------------------------------------------------------------
// The separate Claude call (leeway-engine/scripts/kernel/claude-call.cjs):
// one question the engine puts to `claude -p` itself, raw (16.19.3–16.19.5).
// Its command line flag by flag, never `--bare`; a fresh empty folder, gone
// after; an environment cleared of the calling session, the project and
// the workflows' and Leeway's own variables, the login's kept; the question
// on stdin; the answer where it fits the schema, and each way it cannot run
// — no login, a rate limit, a timeout, an answer that does not fit, a
// binary that will not start. The form answering later puts the same call,
// gives the same answers, and runs beside the calls put with it.
//
// Driven through the suite's stub binary (claude-stub.cjs), which records
// what each call handed it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { askClaude, askClaudeAsync } = require('../../skills/leeway-engine/scripts/kernel/claude-call.cjs');

const STUB = path.join(__dirname, 'claude-stub.cjs');
const SYSTEM = 'Answer whether the row is about the session.\n\nOne line.';
const SCHEMA = Object.freeze({
  type: 'object',
  properties: { rows: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, process: { type: 'boolean' } }, required: ['id', 'process'], additionalProperties: false } } },
  required: ['rows'],
  additionalProperties: false,
});
const ANSWER = Object.freeze({ rows: [{ id: 'r1', process: true }] });
// A call past its time is killed well within this, or the test fails rather
// than waiting on the stub's 10-minute wait.
const KILLED_WITHIN_MS = 10000;
const ASK = Object.freeze({ system: SYSTEM, schema: SCHEMA, model: 'sonnet', effort: 'high', input: 'row r1: shall I commit?', timeoutMs: 20000 });

/** @type {string} */
let scratch;
/** @type {string} */
let log;
/** @type {Record<string, string|undefined>} */
let saved;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-call-'));
  log = path.join(scratch, 'calls.jsonl');
  saved = {};
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** Set environment entries for this test, put back after it. @param {Record<string, string|undefined>} overlay */
function setEnv(overlay) {
  for (const [key, value] of Object.entries(overlay)) {
    if (!Object.hasOwn(saved, key)) saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** The stub armed with `answers` by what the input holds, its calls logged. @param {Record<string, unknown>} [answers] */
function arm(answers) {
  setEnv({ CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: answers === undefined ? undefined : JSON.stringify(answers) });
}

/**
 * What each call handed the stub: its environment by name, a value only
 * where the test named it in CLAUDE_STUB_LOG_VALUES.
 * @returns {{argv: string[], cwd: string, held: string[], env: Record<string, string|null>, input: string}[]}
 */
function calls() {
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

describe('the call\'s command line (16.19.4, 16.19.5)', () => {
  it('runs claude -p with 16.19.4\'s flags exactly, then the model, the effort and a JSON result — the prompt and the schema as given, never --bare', () => {
    arm({ '': ANSWER });

    askClaude(ASK);

    const [call] = calls();
    assert.deepStrictEqual(call.argv, [
      '-p',
      '--system-prompt', SYSTEM,
      '--tools', '',
      '--strict-mcp-config',
      '--setting-sources', '',
      '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false}',
      '--disable-slash-commands',
      '--no-session-persistence',
      '--json-schema', JSON.stringify(SCHEMA),
      '--model', 'sonnet',
      '--effort', 'high',
      '--output-format', 'json',
    ]);
    assert.ok(!call.argv.includes('--bare'), 'the call ran bare, which reads no subscription login');
  });

  it('hands the question over on stdin alone', () => {
    arm({ '': ANSWER });

    askClaude(ASK);

    const [call] = calls();
    assert.strictEqual(call.input, ASK.input);
    assert.ok(!call.argv.includes(ASK.input), 'the question rode the command line');
  });

  it('runs from a fresh empty folder of its own in the temp folder, removed once it answers — a new one each call', () => {
    arm({ '': ANSWER });

    askClaude(ASK);
    askClaude(ASK);

    const [first, second] = calls();
    assert.deepStrictEqual([first.held, second.held], [[], []], 'the folder held something');
    assert.strictEqual(path.dirname(first.cwd), fs.realpathSync(os.tmpdir()));
    assert.notStrictEqual(first.cwd, second.cwd, 'two calls shared a folder');
    assert.ok(!fs.existsSync(first.cwd) && !fs.existsSync(second.cwd), 'a call left its folder behind');
  });

  it('clears the environment of the calling session, the project, the session\'s plugins and harness settings and the workflows\' and Leeway\'s own variables, keeps the login and the person\'s setup, and turns auto-memory off', () => {
    const session = {
      CLAUDE_CODE_SESSION_ID: 'c6b74014', CLAUDE_PROJECT_DIR: '/work/portal', CLAUDECODE: '1', CLAUDE_CODE_CHILD_SESSION: '1',
      CLAUDE_CODE_SESSION_ATTENDED: '1', CLAUDE_PID: '8618', AI_AGENT: 'claude-code_2-1-311_agent', CLAUDE_EFFORT: 'xhigh',
      TRACEPARENT: '00-abc-def-01', CLAUDE_CODE_EXECPATH: '/opt/claude/2.1.311', CLAUDE_CODE_INVOKED_SKILLS: 'leeway',
      CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/cc-socks/8618.sock', CLAUDE_CODE_MESSAGING_TOKEN: 'secret',
      CLAUDE_CODE_SSE_PORT: '51234', CLAUDE_CODE_PLUGIN_DIRS: '/work/portal/.claude/skills', CLAUDE_CODE_PEWTER_OWL_TOOL: 'true',
      CLAUDE_CODE_THINKING_DISPLAY_UPDATES: 'false', CLAUDE_CODE_SILENT_TURN_REMINDER: 'false',
    };
    const own = { LEEWAY_GATE_SURFACE: '1', LEEWAY_HANDOFF: '1', LEEWAY_STATE: 'x' };
    const login = { ANTHROPIC_API_KEY: 'sk-test', CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4747', CLAUDE_CODE_USE_BEDROCK: '1', HTTPS_PROXY: 'http://proxy:3128' };
    setEnv({ ...session, ...own, ...login });
    arm({ '': ANSWER });
    setEnv({ CLAUDE_STUB_LOG_VALUES: [...Object.keys(login), 'HOME', 'PATH', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY'].join(',') });

    askClaude(ASK);

    const { env } = calls()[0];
    assert.deepStrictEqual(Object.keys(env).filter((key) => Object.hasOwn(session, key) || /^(WORKFLOWS|LEEWAY)_/.test(key)), []);
    for (const [key, value] of Object.entries(login)) assert.strictEqual(env[key], value, `${key} did not reach the call`);
    assert.strictEqual(env.HOME, process.env.HOME);
    assert.strictEqual(env.PATH, process.env.PATH);
    assert.strictEqual(env.CLAUDE_CONFIG_DIR, process.env.CLAUDE_CONFIG_DIR);
    assert.strictEqual(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  });

  it('runs the binary LEEWAY_CLAUDE names, and claude on PATH where it names none', () => {
    const bin = path.join(scratch, 'bin');
    fs.mkdirSync(bin);
    fs.copyFileSync(STUB, path.join(bin, 'claude'));
    fs.chmodSync(path.join(bin, 'claude'), 0o755);
    setEnv({ LEEWAY_CLAUDE: undefined, PATH: `${bin}${path.delimiter}${process.env.PATH}` });
    arm({ '': ANSWER });

    assert.deepStrictEqual(askClaude(ASK), { answer: ANSWER, cost: 0.01 });
    assert.strictEqual(calls().length, 1, 'claude on PATH was not the one run');
  });
});

describe('the call\'s answer', () => {
  it('answers the structured output where it fits the schema, with what the call cost', () => {
    arm({ '': ANSWER });

    assert.deepStrictEqual(askClaude(ASK), { answer: ANSWER, cost: 0.01 });
  });

  it('cannot run with no login — the suite\'s world has none, and the stub answers as a real Claude does there', () => {
    arm();

    assert.deepStrictEqual(askClaude(ASK), { cannot: 'no-login', detail: 'Not logged in · Please run /login' });
  });

  it('cannot run at a rate limit', () => {
    arm({ '': 'rate-limit' });

    assert.deepStrictEqual(askClaude(ASK), { cannot: 'rate-limit', detail: 'API Error: Request rejected (429) · rate limited' });
  });

  it('cannot run past its time: the call is killed outright — one deaf to SIGTERM too — and no answer stands', { timeout: KILLED_WITHIN_MS }, () => {
    arm({ '': 'timeout' });
    const started = Date.now();

    assert.deepStrictEqual(askClaude({ ...ASK, timeoutMs: 400 }), { cannot: 'timeout', detail: 'no answer within 0.4 s' });
    assert.ok(Date.now() - started < 5000, 'the call outlived its time');
  });

  it('cannot run where there is no empty folder to run it from, saying so — never a throw', () => {
    arm({ '': ANSWER });
    setEnv({ TMPDIR: path.join(scratch, 'nowhere') });

    const answer = askClaude(ASK);

    assert.strictEqual('cannot' in answer && answer.cannot, 'failed');
    assert.match(/** @type {{detail: string}} */ (answer).detail, /^no empty folder to run the call from: .*ENOENT/);
    assert.deepStrictEqual(calls(), [], 'a call ran with no folder of its own');
  });

  it('cannot run where Claude Code gives up on an answer that fits the schema', () => {
    arm({ '': 'misfit' });

    assert.deepStrictEqual(askClaude(ASK), { cannot: 'misfit', detail: 'Failed to provide valid structured output after 5 attempts' });
  });

  it('cannot run where the answer does not fit the schema, saying where — every keyword the schema uses checked', () => {
    for (const [answer, detail] of /** @type {[unknown, string][]} */ ([
      [{}, 'the answer has no rows'],
      [{ rows: 'r1' }, 'the answer.rows is not an array'],
      [{ rows: [{ id: 'r1' }] }, 'the answer.rows[0] has no process'],
      [{ rows: [{ id: 'r1', process: 'yes' }] }, 'the answer.rows[0].process is not a boolean'],
      [{ rows: [{ id: 'r1', process: true, kind: 'look' }] }, 'the answer.rows[0] has kind, which the schema does not'],
      [{ rows: [], extra: 1 }, 'the answer has extra, which the schema does not'],
      [['r1'], 'the answer is not an object'],
    ])) {
      arm({ '': answer });
      assert.deepStrictEqual(askClaude(ASK), { cannot: 'misfit', detail }, JSON.stringify(answer));
    }
    const bounded = { type: 'object', properties: { pick: { type: 'string', enum: ['one', 'several'], minLength: 3 }, rules: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 2 } } };
    for (const [answer, detail] of /** @type {[unknown, string][]} */ ([
      [{ pick: 'two' }, 'the answer.pick is none of one, several'],
      [{ rules: [] }, 'the answer.rules holds fewer than 1 items'],
      [{ rules: [1, 2, 3] }, 'the answer.rules holds more than 2 items'],
      [{ rules: [1.5] }, 'the answer.rules[0] is not an integer'],
    ])) {
      arm({ '': answer });
      assert.deepStrictEqual(askClaude({ ...ASK, schema: bounded }), { cannot: 'misfit', detail }, JSON.stringify(answer));
    }
  });

  it('refuses a schema using a keyword it cannot check an answer against, at any depth, before any call — so no part of a schema goes unchecked', () => {
    arm({ '': ANSWER });
    const deep = { ...SCHEMA, properties: { rows: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', pattern: '^r' } } } } } };

    for (const schema of [{ ...SCHEMA, pattern: '^r' }, deep]) {
      assert.throws(() => askClaude({ ...ASK, schema }), /the call's schema uses pattern, which the engine cannot check an answer against/);
    }
    assert.deepStrictEqual(calls(), [], 'a call was made with a schema the answer could not be checked against');
  });

  it('refuses a schema giving a keyword it checks in a form it cannot check — additionalProperties as a schema, a type of several or of none it knows — at any depth, before any call', () => {
    arm({ '': ANSWER });
    /** @param {Record<string, unknown>} id the inner schema of a row's id */
    const deep = (id) => ({ ...SCHEMA, properties: { rows: { type: 'array', items: { type: 'object', properties: { id } } } } });

    for (const [schema, refusal] of /** @type {[Record<string, unknown>, RegExp][]} */ ([
      [{ ...SCHEMA, additionalProperties: { type: 'string' } }, /the call's schema gives additionalProperties as \{"type":"string"\}, and the engine checks an answer against true or false/],
      [deep({ type: 'object', additionalProperties: { type: 'string' } }), /gives additionalProperties as \{"type":"string"\}/],
      [{ ...SCHEMA, type: ['object', 'null'] }, /the call's schema gives type as \["object","null"\], and the engine checks an answer against one of object, /],
      [deep({ type: ['string', 'null'] }), /gives type as \["string","null"\]/],
      [deep({ type: 'date' }), /the call's schema gives type as "date", and the engine checks an answer against one of /],
    ])) {
      assert.throws(() => askClaude({ ...ASK, schema }), refusal, JSON.stringify(schema));
    }
    assert.deepStrictEqual(calls(), [], 'a call was made with a schema the answer could not be checked against');
  });

  it('cannot run where the binary will not start, saying so', () => {
    setEnv({ LEEWAY_CLAUDE: path.join(scratch, 'no-such-claude') });

    const answer = askClaude(ASK);

    assert.strictEqual('cannot' in answer && answer.cannot, 'failed');
    assert.match(/** @type {{detail: string}} */ (answer).detail, /no-such-claude did not run: .*ENOENT/);
  });
});

describe('the call answering later', () => {
  it('puts the call the waiting form puts — its command line, the question on stdin alone, a fresh empty folder gone after — and gives the answer it gives', async () => {
    arm({ '': ANSWER });

    const later = await askClaudeAsync(ASK);
    const now = askClaude(ASK);

    const [putLater, putNow] = calls();
    assert.deepStrictEqual([later, putLater.argv, putLater.input, putLater.held], [now, putNow.argv, putNow.input, []]);
    assert.strictEqual(path.dirname(putLater.cwd), fs.realpathSync(os.tmpdir()));
    assert.ok(!fs.existsSync(putLater.cwd), 'the call left its folder behind');
  });

  it('calls put together run at once: each meets the other before either answers', async () => {
    const meet = path.join(scratch, 'meet');
    fs.mkdirSync(meet);
    arm({ '': ANSWER });
    setEnv({ CLAUDE_STUB_MEET: `2:${meet}` });

    assert.deepStrictEqual(await Promise.all([askClaudeAsync(ASK), askClaudeAsync(ASK)]), [{ answer: ANSWER, cost: 0.01 }, { answer: ANSWER, cost: 0.01 }]);
  });

  it('cannot run past its time, killed outright — one deaf to SIGTERM too — nor where the binary will not start, as the waiting form cannot', { timeout: KILLED_WITHIN_MS }, async () => {
    arm({ '': 'timeout' });
    const started = Date.now();
    assert.deepStrictEqual(await askClaudeAsync({ ...ASK, timeoutMs: 400 }), { cannot: 'timeout', detail: 'no answer within 0.4 s' });
    assert.ok(Date.now() - started < 5000, 'the call outlived its time');

    setEnv({ LEEWAY_CLAUDE: path.join(scratch, 'no-such-claude') });
    const answer = await askClaudeAsync(ASK);
    assert.strictEqual('cannot' in answer && answer.cannot, 'failed');
    assert.match(/** @type {{detail: string}} */ (answer).detail, /no-such-claude did not run: .*ENOENT/);
  });

  it('refuses a schema an answer cannot be checked against, before any call', async () => {
    arm({ '': ANSWER });

    await assert.rejects(askClaudeAsync({ ...ASK, schema: { ...SCHEMA, pattern: '^r' } }), /the call's schema uses pattern, which the engine cannot check an answer against/);
    assert.deepStrictEqual(calls(), []);
  });
});
