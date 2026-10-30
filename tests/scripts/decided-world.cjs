'use strict';

// ---------------------------------------------------------------------------
// The decided suites' world and helpers (test-engine-decided-screen.cjs,
// test-engine-decided-yes.cjs, test-engine-decided-close.cjs): an epic, `fumi`, its two topics under
// discussion, the note window's map written through the ledger's verbs —
// the person's own answer, Claude's calls of two kinds and one unlabelled,
// a call handed over — and its decided checklist marked but for the closing
// pass; and a feature, `solo`, whose one question the person answered, its
// checklist marked but for the closing pass. Built once per process and
// copied for each test, its trust log in a config folder of the test's own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, output, readManifest, statePath, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, row } = require('./ledger-world.cjs');

const SOLO = 'solo';
const SOLO_AT = `${SOLO}.discussion.${SOLO}`;
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const NO_PAYLOAD = Object.freeze({ lines: [], candidates: [] });

/** Claude's items of the decided checklist, but the closing pass. */
const MARKED = ['decisions-entered', 'replacements-checked', 'conflicts-read', 'findings-rerun', 'product-lines-shown'];

/** The decided checklist items of `topic` marked but for the closing pass, at `at`. @param {string} at */
function markedItems(at) {
  return Object.fromEntries(MARKED.map((item) => [item, { state: 'done', at }]));
}

/** One ledger write in `dir`: its short id. @param {string} dir @param {string} verb @param {string} at @param {string[]} flags @param {Record<string, unknown>} content */
function writeIn(dir, verb, at, flags, content) {
  return ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A question asked at `at` and answered as `answer` says: both short ids. @param {string} dir @param {string} at @param {string} text @param {Record<string, unknown>} answer */
function answeredIn(dir, at, text, answer) {
  const question = writeIn(dir, 'ask', at, [], { ...MADE, text });
  return { question, answer: writeIn(dir, 'decide', at, ['--answers', question], { why: 'Because.', ...answer }) };
}

/**
 * The decided checklist of `unit`'s `topic` marked again but for the
 * closing pass, now — after its last close, so the marks count — written
 * as the world writes its first marks; marking an item is the checklist
 * suite's.
 * @param {string} dir @param {string} unit @param {string} topic
 */
function markAllButTheClosingPass(dir, unit, topic) {
  const manifest = readManifest(dir, unit);
  const decided = (manifest.checklists ??= {}).decided ??= {};
  const record = decided[topic] ??= {};
  record.items = { ...record.items, ...markedItems(new Date().toISOString()) };
  createManifest(dir, unit, manifest);
}

/** The note window's entries, by name, as the world wrote them. @type {Record<string, {question: string, answer: string}>} */
const NOTE_MAP = {};

const world = fixtureFrom('decided-', (dir) => {
  const first = '2026-10-01T09:00:00.000Z';
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') }, dismissed: ['dock-badge'] },
      discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
    },
    checklists: { decided: { 'note-window': { items: markedItems(first) } } },
  });
  createManifest(dir, SOLO, { phases: { discussion: { items: { [SOLO]: { status: 'in-progress' } } } }, checklists: { decided: { [SOLO]: { items: markedItems(first) } } } });
  Object.assign(NOTE_MAP, {
    shape: answeredIn(dir, NOTE, 'How does first run open?', { ...PERSON, text: 'The tour first.' }),
    title: answeredIn(dir, NOTE, 'What is the screen titled?', { ...MADE, text: 'Welcome.', kind: 'words' }),
    sync: answeredIn(dir, NOTE, 'Is sync on at first run?', { ...MADE, text: 'On, once a folder is picked.', kind: 'behaviour' }),
    price: answeredIn(dir, NOTE, 'Is pricing mentioned?', { ...MADE, text: 'Not in first run.', kind: 'behaviour' }),
    banner: answeredIn(dir, NOTE, 'Is there a login item banner?', { ...MADE, text: 'No banner.' }),
    corner: answeredIn(dir, NOTE, 'Which corner does a note open in?', { ...MADE, given: 'your-call', text: 'Top left.' }),
  });
  answeredIn(dir, SOLO_AT, 'Does a tally reset daily?', { ...PERSON, text: 'At midnight.' });
});

/**
 * The world for each test of the calling file, copied before it and
 * removed after it, its trust log in a config folder of its own.
 * @returns {() => string} the running test's project
 */
function useDecidedWorld() {
  const config = useTempFolder('decided-config-');
  /** @type {string} */
  let dir;
  /** @type {string|undefined} */
  let pinned;
  beforeEach(() => {
    dir = world();
    pinned = process.env.LEEWAY_CONFIG_DIR;
    process.env.LEEWAY_CONFIG_DIR = config();
  });
  afterEach(() => {
    process.env.LEEWAY_CONFIG_DIR = pinned;
    cleanupFixture(dir);
  });
  return () => dir;
}

/** A section of a render by its marker's name. @param {string} out @param {string} name */
function sectionOf(out, name) {
  const at = out.indexOf(`=== ${name} (`);
  assert.ok(at !== -1, `no ${name} section in:\n${out}`);
  const body = out.slice(out.indexOf('\n', at) + 1);
  const end = body.search(/^=== /m);
  return end === -1 ? body : body.slice(0, end);
}

/**
 * The decided suites' helpers, over the project `dir()` names.
 * @param {() => string} dir
 */
function decidedHelpers(dir) {
  /** The closing pass marked done on `unit`'s `topic`, and the checklist closed. @param {string} [unit] @param {string} [topic] */
  function close(unit = UNIT, topic = 'note-window') {
    ok(dir(), ['checklist', 'done', 'decided', unit, topic, 'closing-pass'], { env: SESSION });
    return ok(dir(), ['checklist', 'close', 'decided', unit, topic], { env: SESSION });
  }

  /** Claude's payload written to the cache: its path. @param {Record<string, unknown>} given */
  function payload(given) {
    const file = statePath(dir(), '.cache', 'scratch', `decided-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(given));
    return file;
  }

  /** The decided screen of `address`, `flags` given. @param {string[]} [flags] @param {string} [address] */
  function screen(flags = [], address = `${UNIT}.note-window`) {
    return output(dir(), ['render', 'decided', address, ...flags], { env: SESSION });
  }

  /** The screen staged from `given`. @param {Record<string, unknown>} given @param {string} [address] */
  function staged(given, address) {
    return screen(['--file', payload(given)], address);
  }

  /** The person's answer at the gate shown: what it leads to. @param {string} name @param {string} key */
  function answer(name, key) {
    return ok(dir(), ['gate', name, '--pick', key], { env: SESSION }).next;
  }

  /** What a gate's `next` of kind engine runs, answered. @param {{kind: string, argv: string[]}} next */
  function run(next) {
    assert.strictEqual(next.kind, 'engine');
    return next.argv[0] === 'render' ? output(dir(), next.argv, { env: SESSION }) : ok(dir(), next.argv, { env: SESSION });
  }

  /** The person's reversal of Claude's call on the note window: the departure's short id. @param {string} call @param {string} text */
  function reverse(call, text) {
    return writeIn(dir(), 'replace', NOTE, ['--replaces', call, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text, why: 'The person wants it so.' });
  }

  return { close, payload, screen, staged, answer, run, reverse };
}

module.exports = {
  SOLO, SOLO_AT, PERSON, NO_PAYLOAD, NOTE_MAP, writeIn, answeredIn, markAllButTheClosingPass, useDecidedWorld, sectionOf, decidedHelpers,
};
