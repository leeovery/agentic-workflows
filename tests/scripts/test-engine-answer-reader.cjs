'use strict';

// ---------------------------------------------------------------------------
// The reader (leeway-engine/scripts/domain/answer-reader.cjs): the row the
// person's own words pick among those they were shown, read by the separate
// Claude call (16.19.1). The call, the stated `claude -p` on Opus at effort
// high, never --bare, the question, the rows by their keys and the words on
// stdin, its schema the rows' keys or none (16.S70); the key it reads; and
// none where the words pick no row or the call fails in any way, a key the
// rows lack among them (16.19.8). How a call runs and fails is the kernel's
// (test-claude-call); what a gate and a raise make of a reading is theirs
// (test-engine-gate, test-engine-raise-answer).
//
// Layer: unit. The separate call is the stub binary (claude-stub.cjs),
// which records what each call handed it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { PROMPT, readAnswer } = require(path.join(SCRIPTS, 'domain/answer-reader.cjs'));

const ASKED = Object.freeze({
  question: 'When you make a new note, where should its window open?',
  rows: [{ key: '1', text: 'On the screen the cursor is on' }, { key: '2', text: 'On the main screen' }],
  words: 'wherever I am looking, like you said',
});

/** @type {string} */
let scratch;
/** @type {string} */
let log;
/** @type {Record<string, string|undefined>} */
let saved;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'answer-reader-'));
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

describe('the call (16.19.1, 16.19.6, 16.S70)', () => {
  it('16.S70: is the stated claude -p on Opus at effort high, never --bare, its prompt fixed and its schema one of the rows\' keys or none; the question, the rows by their keys and the person\'s words on stdin; and reads the key it names', () => {
    arm({ row: '1' });

    assert.strictEqual(readAnswer(ASKED), '1');

    const [call, ...more] = calls();
    assert.deepStrictEqual(more, []);
    const flag = (/** @type {string} */ name) => call.argv[call.argv.indexOf(name) + 1];
    assert.deepStrictEqual([call.argv[0], flag('--model'), flag('--effort'), call.argv.includes('--bare'), flag('--system-prompt')], ['-p', 'opus', 'high', false, PROMPT]);
    assert.deepStrictEqual(JSON.parse(flag('--json-schema')), {
      type: 'object', properties: { row: { type: 'string', enum: ['1', '2', 'none of them'] } }, required: ['row'], additionalProperties: false,
    });
    assert.strictEqual(call.input, [
      `The question: ${ASKED.question}`,
      'The options:\n- 1: On the screen the cursor is on\n- 2: On the main screen',
      `The reply: ${ASKED.words}`,
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

      assert.strictEqual(readAnswer(ASKED), null);
      assert.strictEqual(calls().length, 1);
    });
  }
});
