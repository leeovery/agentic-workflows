'use strict';

// ---------------------------------------------------------------------------
// The labeller (leeway-engine/scripts/domain/labeller.cjs): the kind of a
// question Claude put, read by the separate Claude call (16.11, 16.19). The
// kind each set of twelve answers composes, as `trust/kinds.py` composes it
// (16.S39); the call, the stated `claude -p` on Sonnet at effort high from
// a fresh empty folder, Claude's words on stdin (16.S57, 26.S9), several
// put at once; the label, all twelve answers in 16.11.2's order beside the
// labeller that wrote them (16.S38, 27.S2), null on any failure; the
// questions the release ships; and a label put beside other work, awaited
// once the work answers, its call cancelled where the work refuses. How a
// started call runs, answers and fails is the kernel's (test-claude-call).
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
const labeller = require(path.join(SCRIPTS, 'domain/labeller.cjs'));
const { KINDS } = require(path.join(SCRIPTS, 'domain/event-fields.cjs'));

const { ORDER, compose, kindOf, hardToUndo, checkable, danger, labelFields, questionText, startLabel, labelsAtOnce, labelledBeside } = labeller;

// 16.11.2's order.
const QUESTIONS = ['process', 'checkable', 'user_sees', 'looks', 'words', 'flow', 'scope', 'contract', 'danger', 'hard_to_undo', 'one_is_wrong', 'internals'];

/** Twelve answers, every one no but those named. @param {...string} yes @returns {boolean[]} */
const answering = (...yes) => QUESTIONS.map((key) => yes.includes(key));

/** The call's answer as the stub gives it: an object by question. @param {...string} yes */
const answered = (...yes) => Object.fromEntries(QUESTIONS.map((key) => [key, yes.includes(key)]));

const QUESTION = 'When you make a new note, where should its window open?';
const ROWS = ['On the screen the cursor is on — the note opens where you are looking', 'On the main screen — every note opens on the same screen'];

/** @type {string} */
let scratch;
/** @type {string} */
let log;
/** @type {Record<string, string|undefined>} */
let saved;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'labeller-'));
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

/** The stub armed to answer `answer` to every call, logged, over `env`. @param {unknown} answer @param {Record<string, string>} [env] */
function arm(answer, env = {}) {
  const overlay = { CLAUDE_STUB_LOG: log, CLAUDE_STUB_ANSWERS: JSON.stringify({ '': answer }), ...env };
  for (const [key, value] of Object.entries(overlay)) {
    if (!Object.hasOwn(saved, key)) saved[key] = process.env[key];
    process.env[key] = value;
  }
}

/** What each call handed the stub. @returns {{argv: string[], cwd: string, held: string[], env: Record<string, string|null>, input: string}[]} */
const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : []);

/** Whether the process `pid` names still runs. @param {number} pid */
function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('the kind twelve answers compose (16.11.3, 16.11.4)', () => {
  // `trust/kinds.py` `compose()`, case by case: each kind from its question,
  // in 16.11.3's order, the first yes deciding.
  const CASES = [
    [['process', 'danger', 'contract', 'scope', 'user_sees', 'looks'], 'process'],
    [['danger', 'contract', 'scope', 'user_sees', 'looks'], 'danger'],
    [['contract', 'scope', 'user_sees', 'words'], 'contract'],
    [['scope', 'user_sees', 'looks'], 'scope'],
    [['user_sees', 'looks', 'words', 'flow'], 'look'],
    [['user_sees', 'words', 'flow'], 'words'],
    [['user_sees', 'flow'], 'behaviour'],
    [['user_sees'], 'behaviour'],
    [['looks', 'words', 'flow', 'internals', 'hard_to_undo', 'one_is_wrong', 'checkable'], 'internals'],
    [[], 'internals'],
  ];
  for (const [yes, kind] of CASES) {
    it(`${yes.length === 0 ? 'every answer no' : `yes to ${yes.join(', ')}`} composes ${kind}`, () => {
      assert.strictEqual(compose(answering(...yes)), kind);
    });
  }

  it('16.S39: past process, danger, contract and scope, a user seeing it and how it looks composes look; a user seeing it and of look, words and steps only the steps, behaviour — flow no kind of its own; no user seeing it, internals', () => {
    assert.deepStrictEqual([compose(answering('user_sees', 'looks')), compose(answering('user_sees', 'flow')), compose(answering('looks'))], ['look', 'behaviour', 'internals']);
  });

  it('27.S2: composes only the kinds the streams hold, none split along the answers', () => {
    const every = Array.from({ length: 2 ** QUESTIONS.length }, (_, n) => compose(QUESTIONS.map((_q, i) => Boolean(n & (1 << i)))));
    assert.deepStrictEqual([...new Set(every)].sort(), [...KINDS].sort());
  });
});

describe('what a label marks (16.11.7, 16.5.1)', () => {
  const label = { labeller: 'claude-sonnet-stub', answers: answering('process', 'danger', 'hard_to_undo') };

  it('reads hard to undo from question 10, checkable from question 2 and danger from question 9, whatever the kind; each null with no label', () => {
    assert.deepStrictEqual([kindOf(label), hardToUndo(label), checkable(label), danger(label)], ['process', true, false, true]);
    assert.deepStrictEqual([kindOf(null), hardToUndo(null), checkable(null), danger(null)], [null, null, null, null]);
  });

  it('gives a decision\'s line its kind and its hard-to-undo mark, both null with no label', () => {
    assert.deepStrictEqual([labelFields(label), labelFields(null)], [{ kind: 'process', hard_to_undo: true }, { kind: null, hard_to_undo: null }]);
  });
});

describe('the call (16.19.3–16.19.6, 16.S57, 26.S9)', () => {
  it('16.S57, 26.S9: is the stated claude -p on Sonnet at effort high, never --bare, the shipped questions its prompt and their answers its schema, from a fresh empty folder, Claude\'s words alone on stdin; several put at once, meeting before either answers, each its own question\'s label', () => {
    const meet = path.join(scratch, 'meet');
    fs.mkdirSync(meet);
    arm(answered('user_sees', 'words'), { CLAUDE_STUB_MEET: `2:${meet}` });

    const labels = labelsAtOnce([questionText(QUESTION, ROWS), questionText(QUESTION, [])]);

    assert.deepStrictEqual(labels.map(kindOf), ['words', 'words'], 'the calls were put one after another');
    const made = calls();
    const shipped = JSON.parse(fs.readFileSync(path.join(SCRIPTS, '../content/trust/questions.json'), 'utf8'));
    for (const call of made) {
      const flag = (/** @type {string} */ name) => call.argv[call.argv.indexOf(name) + 1];
      assert.deepStrictEqual([call.argv[0], flag('--model'), flag('--effort'), call.argv.includes('--bare')], ['-p', 'sonnet', 'high', false]);
      assert.deepStrictEqual(JSON.parse(flag('--json-schema')), { type: 'object', properties: Object.fromEntries(QUESTIONS.map((key) => [key, { type: 'boolean' }])), required: QUESTIONS, additionalProperties: false });
      for (const q of shipped) assert.ok(flag('--system-prompt').includes(`- ${q.id}: ${q.q}\n    true: ${q.true}\n    false: ${q.false}`), `the prompt words ${q.id} otherwise`);
      assert.deepStrictEqual(call.held, [], 'the call ran from a folder holding something');
      assert.ok(!call.cwd.startsWith(scratch) && !call.cwd.startsWith(process.cwd()), `the call ran from ${call.cwd}`);
      assert.ok(!fs.existsSync(call.cwd), 'the call\'s folder outlived it');
    }
    assert.notStrictEqual(made[0].cwd, made[1].cwd, 'two calls shared a folder');
    assert.deepStrictEqual(made.map((call) => call.input).sort(), [QUESTION, `${QUESTION}\n\nThe answers offered:\n- ${ROWS[0]}\n- ${ROWS[1]}`]);
  });

  it('runs with auto-memory off', () => {
    arm(answered(), { CLAUDE_STUB_LOG_VALUES: 'CLAUDE_CODE_DISABLE_AUTO_MEMORY' });

    startLabel(QUESTION).wait();

    assert.strictEqual(calls()[0].env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  });

  it('asks no more than its own words: the prompt names no project', () => {
    assert.ok(!/fumi|portal|tick|agntc|The projects/i.test(labeller.promptOf()), 'the prompt describes the projects');
  });
});

describe('the label (16.11.5, 16.19.11, 16.S38, 27.S2)', () => {
  it('27.S2: holds all twelve answers in 16.11.2\'s order and the labeller that wrote them, by the full id of the model that answered', () => {
    arm(answered('user_sees', 'words', 'hard_to_undo'), { CLAUDE_STUB_MODELS: JSON.stringify(['claude-haiku-4-5', 'claude-sonnet-5-0']) });

    const label = startLabel(QUESTION).wait();

    assert.deepStrictEqual(label, { labeller: 'claude-sonnet-5-0', answers: answering('user_sees', 'words', 'hard_to_undo') });
    assert.deepStrictEqual(ORDER, QUESTIONS);
  });

  for (const [why, answer, env] of /** @type {[string, unknown, Record<string, string>][]} */ ([
    ['it cannot run', 'rate-limit', {}],
    ['it names no model the trust log can key', answered(), { CLAUDE_STUB_MODELS: JSON.stringify(['Sonnet 5']) }],
  ])) {
    it(`is null where the call fails — ${why} — so the question asks (16.19.8)`, () => {
      arm(answer, env);

      assert.strictEqual(startLabel(QUESTION).wait(), null);
    });
  }
});

describe('the questions the release ships (16.16.1)', () => {
  it('are the twelve, in 16.11.2\'s order, each with what reads as true and as false', () => {
    const shipped = JSON.parse(fs.readFileSync(path.join(SCRIPTS, '../content/trust/questions.json'), 'utf8'));
    assert.deepStrictEqual(shipped.map((/** @type {Record<string, string>} */ q) => q.id), QUESTIONS);
    for (const q of shipped) assert.deepStrictEqual(Object.keys(q), ['id', 'q', 'true', 'false']);
  });
});

describe('a label put beside other work', () => {
  it('answers the work and the label, put at once', async () => {
    arm(answered('scope'));

    const { done, label } = await labelledBeside(Promise.resolve('checked'), QUESTION);

    assert.deepStrictEqual([done, kindOf(label)], ['checked', 'scope']);
  });

  it('refuses as the work refuses, the label\'s call cancelled: none left running, its folder gone', { timeout: 10000 }, async () => {
    const meet = path.join(scratch, 'meet');
    fs.mkdirSync(meet);
    arm('timeout', { CLAUDE_STUB_MEET: `1:${meet}` });
    const refused = new Promise((_resolve, reject) => {
      const look = setInterval(() => {
        if (fs.readdirSync(meet).length === 0) return;
        clearInterval(look);
        reject(new Error('several rules'));
      }, 10);
    });

    await assert.rejects(labelledBeside(refused, QUESTION), /several rules/);

    const [pid] = fs.readdirSync(meet).map(Number);
    for (const by = Date.now() + 5000; running(pid) && Date.now() < by;) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(!running(pid), 'the label\'s call outlived the refusal');
    assert.ok(!fs.existsSync(calls()[0].cwd), 'the label\'s folder outlived the refusal');
  });
});
