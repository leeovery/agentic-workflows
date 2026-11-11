'use strict';

// ---------------------------------------------------------------------------
// The reader (leeway-engine/scripts/domain/answer-reader.cjs): the row the
// person's own words pick among those they were shown, read by the separate
// Claude call (16.19.1). The call, the stated `claude -p` on Opus, never
// --bare (16.S70): at a gate at effort low, given up after 15 s; on a raise
// at effort high within the one-decision check's time. What it reads: the
// question, each row by its key and whole as the person saw it — a gate's
// word, label, tail and detail; a raise's answer and what the person would
// notice — and their words; its schema the rows' keys or none. The key it
// reads; and none where the words pick no row or the call fails in any way,
// a key the rows lack among them (16.19.8). How a call runs and fails is
// the kernel's (test-claude-call); what a gate and a raise make of a
// reading is theirs (test-engine-gate, test-engine-raise-answer).
//
// Layer: unit. The separate call is the stub binary (claude-stub.cjs),
// which records what each call handed it; or, where a test reads what the
// reader asks of the kernel, a stand-in for the kernel's call.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const claudeCall = require(path.join(SCRIPTS, 'kernel/claude-call.cjs'));
const { TIMEOUT_MS } = require(path.join(SCRIPTS, 'domain/ledger-one-decision.cjs'));
const { PROMPT, AT_A_GATE, ON_A_RAISE, readAtGate, readOnRaise } = require(path.join(SCRIPTS, 'domain/answer-reader.cjs'));

const QUESTION = 'When you make a new note, where should its window open?';
const RAISE_ROWS = [
  { key: '1', name: 'Cursor', text: 'On the screen the cursor is on', notice: 'the note opens where you are looking' },
  { key: '2', name: 'Main', text: 'On the main screen', notice: 'every note opens on the same screen' },
];
const GATE_ROWS = [
  { key: 'y', word: 'yes', head: 'Proceed', tail: null, detail: null },
  { key: 'n', word: 'no', head: 'Leave it unset', tail: 'setup carries on without it', detail: 'The rule stays off.\nSet it later from GitHub.' },
  { key: '3', word: null, head: 'Start again', tail: null, detail: null },
];
const WORDS = 'wherever I am looking, like you said';

/** @type {string} */
let scratch;
/** @type {string} */
let log;
/** @type {Record<string, string|undefined>} */
let saved;
const realAsk = claudeCall.askClaude;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'answer-reader-'));
  log = path.join(scratch, 'calls.jsonl');
  saved = {};
});

afterEach(() => {
  claudeCall.askClaude = realAsk;
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** The stub armed to answer `answer` to every call, logged. @param {unknown} answer */
function arm(answer) {
  const overlay = { CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': answer }) };
  for (const [key, value] of Object.entries(overlay)) {
    if (!Object.hasOwn(saved, key)) saved[key] = process.env[key];
    process.env[key] = value;
  }
}

/** What each call handed the stub. @returns {{argv: string[], input: string}[]} */
const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/**
 * The one call the reader asks of the kernel as `read` runs, the call
 * answering `row`, and what it read.
 * @param {() => string|null} read @param {string} row
 */
function asked(read, row) {
  /** @type {import('../../skills/leeway-engine/scripts/kernel/claude-call.cjs').Ask[]} */
  const asks = [];
  claudeCall.askClaude = (ask) => {
    asks.push(ask);
    return { answer: { row }, cost: 0, model: 'claude-opus-stub' };
  };
  const reading = read();
  assert.strictEqual(asks.length, 1);
  return { ...asks[0], reading };
}

/** The schema a read asks its answer to fit, over `keys`. @param {string[]} keys */
const schemaOver = (keys) => ({ type: 'object', properties: { row: { type: 'string', enum: [...keys, 'none of them'] } }, required: ['row'], additionalProperties: false });

describe('the call (16.19.1, 16.19.6, 16.S70)', () => {
  it('16.S70: is the stated claude -p on Opus, never --bare, its prompt fixed, the person\'s words on stdin; and reads the key it names', () => {
    arm({ row: '1' });

    assert.strictEqual(readOnRaise(QUESTION, RAISE_ROWS, WORDS), '1');

    const [call, ...more] = calls();
    assert.deepStrictEqual(more, []);
    const flag = (/** @type {string} */ name) => call.argv[call.argv.indexOf(name) + 1];
    assert.deepStrictEqual([call.argv[0], flag('--model'), call.argv.includes('--bare'), flag('--system-prompt')], ['-p', 'opus', false, PROMPT]);
    assert.ok(call.input.endsWith(`The reply: ${WORDS}`), call.input);
  });

  it('at a gate, where the person waits on it: effort low, given up after 15 s; each row whole as shown — its word, label and tail, its detail beneath', () => {
    const { model, effort, timeoutMs, schema, input, reading } = asked(() => readAtGate(QUESTION, GATE_ROWS, WORDS), 'n');

    assert.deepStrictEqual(AT_A_GATE, { effort: 'low', timeoutMs: 15000 });
    assert.deepStrictEqual({ model, effort, timeoutMs, schema, reading }, { model: 'opus', effort: 'low', timeoutMs: 15000, schema: schemaOver(['y', 'n', '3']), reading: 'n' });
    assert.strictEqual(input, [
      `The question: ${QUESTION}`,
      'The options:\n- y: yes — Proceed\n- n: no — Leave it unset — setup carries on without it\n  The rule stays off.\n  Set it later from GitHub.\n- 3: Start again',
      `The reply: ${WORDS}`,
    ].join('\n\n'));
  });

  it('on a raise, where a misread lands a departure: effort high, within the one-decision check\'s time; each row of Claude\'s its answer, then what the person would notice with it', () => {
    const { model, effort, timeoutMs, schema, input, reading } = asked(() => readOnRaise(QUESTION, RAISE_ROWS, WORDS), '2');

    assert.deepStrictEqual(ON_A_RAISE, { effort: 'high', timeoutMs: TIMEOUT_MS });
    assert.deepStrictEqual({ model, effort, timeoutMs, schema, reading }, { model: 'opus', effort: 'high', timeoutMs: TIMEOUT_MS, schema: schemaOver(['1', '2']), reading: '2' });
    assert.strictEqual(input, [
      `The question: ${QUESTION}`,
      'The options:\n- 1: On the screen the cursor is on\n  What you\'d notice — Cursor: the note opens where you are looking\n- 2: On the main screen\n  What you\'d notice — Main: every note opens on the same screen',
      `The reply: ${WORDS}`,
    ].join('\n\n'));
  });
});

describe('a reply read as no row (16.19.8)', () => {
  for (const [why, answer] of /** @type {[string, unknown][]} */ ([
    ['the call reads it as none of them', { row: 'none of them' }],
    ['the call names a key the rows lack', { row: '3' }],
    ['no login serves the call', 'no-login'],
    ['the call is rate limited', 'rate-limit'],
  ])) {
    it(`is null where ${why}`, () => {
      arm(answer);

      assert.strictEqual(readOnRaise(QUESTION, RAISE_ROWS, WORDS), null);
      assert.strictEqual(calls().length, 1);
    });
  }
});
