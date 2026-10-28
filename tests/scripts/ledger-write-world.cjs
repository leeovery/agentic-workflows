'use strict';

// What the ledger's write suites share (test-engine-ledger-write.cjs,
// test-engine-ledger-links.cjs): the unit and topics they write to, and the
// helpers over a suite's own fixture (`ledgerWriteHelpers`) — the write
// verbs, the ledger's text, lines and entries, an entry's full id, and the
// last line and a refusal asserted.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, refuses, stateGit, statePath } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const UNIT = 'fumi';
const SESSION_ID = 'session-1';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const ID = /^[0-9A-Za-z]{21}$/;

const PHASES = Object.freeze({
  discovery: { items: { 'note-window': {}, 'space-homing': {}, 'menu-bar': {} } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

/** @typedef {{phase: string, topic: string|null}} Place */

const AT_NOTE = Object.freeze({ phase: 'discussion', topic: 'note-window' });

/**
 * The write suites' helpers over the project `dir()` names, the suite's own
 * fixture, which a test may set up afresh.
 * @param {() => string} dir
 */
function ledgerWriteHelpers(dir) {
  /**
   * One ledger write that must succeed: its response.
   * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
   * @param {Record<string, string|undefined>} [env]
   */
  function write(verb, address, flags, content, env = SESSION) {
    return ok(dir(), ['ledger', verb, address, ...flags], { env, stdin: JSON.stringify(content) });
  }

  /** The ledger's text, '' where there is none. */
  function ledgerText() {
    const file = statePath(dir(), LEDGER);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }

  /** The ledger's lines, as written. */
  function rawLines() {
    return ledgerText().split('\n').slice(0, -1);
  }

  /** The ledger's entries. @returns {Record<string, any>[]} */
  function entries() {
    return rawLines().map((line) => JSON.parse(line));
  }

  /** The state branch's tip. */
  function stateTip() {
    return stateGit(dir(), ['rev-parse', 'HEAD']).trim();
  }

  /** The full id a short id shows. @param {string} short */
  function full(short) {
    const ids = entries().map((e) => e.id).filter((id) => id.startsWith(short));
    assert.strictEqual(ids.length, 1, `${short} names ${ids.length} ids`);
    return ids[0];
  }

  /**
   * Assert the ledger's last line is exactly the event of `own` made at
   * `place` by this session: the engine's version first, then its id, the
   * event and its tags, the time written, and its own fields in the schema's
   * order. Answers its id.
   * @param {string} event @param {Place} place @param {Record<string, unknown>} own
   * @returns {string}
   */
  function assertLast(event, place, own) {
    const raw = /** @type {string} */ (rawLines().at(-1));
    const { id, at } = JSON.parse(raw);
    assert.match(id, ID);
    assert.ok(Math.abs(Date.parse(at) - Date.now()) < 60000, `${at} is not the time written`);
    assert.strictEqual(raw, JSON.stringify({ v: 1, id, event, unit: UNIT, topic: place.topic, phase: place.phase, session: SESSION_ID, at, ...own }));
    return id;
  }

  /**
   * Assert a response shows the entry's short id — its shortest prefix no other
   * id in the ledger shares — and the state commit carrying the ledger alone.
   * @param {Record<string, any>} res @param {string} id
   */
  function assertAnswered(res, id) {
    assert.deepStrictEqual(Object.keys(res), ['ok', 'id', 'committed']);
    assert.strictEqual(res.id, shortIds(entries().map((e) => e.id)).get(id));
    assert.strictEqual(res.committed, stateGit(dir(), ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(dir(), ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), LEDGER);
    assert.strictEqual(stateGit(dir(), ['show', `HEAD:${LEDGER}`]), ledgerText());
  }

  /**
   * A write that must be refused, appending nothing and committing nothing:
   * its refusal.
   * @param {string} verb @param {string} address @param {string[]} flags @param {unknown} content
   * @param {RegExp} pattern @param {Record<string, string|undefined>} [env]
   */
  function refused(verb, address, flags, content, pattern, env = SESSION) {
    const before = { ledger: ledgerText(), tip: stateTip() };
    const res = refuses(dir(), ['ledger', verb, address, ...flags], { env, stdin: typeof content === 'string' ? content : JSON.stringify(content) });
    assert.match(res.error, pattern);
    assert.deepStrictEqual({ ledger: ledgerText(), tip: stateTip() }, before, 'a refusal appended or committed');
    return res;
  }

  /** A question asked on the note window: its response. @param {string} [text] */
  function ask(text = 'What is a note, at its most basic?') {
    return write('ask', NOTE, [], { ...MADE, text });
  }

  /** A finding found on the note window, relying on what `flags` name: its response. @param {string[]} [flags] */
  function find(flags = []) {
    return write('find', NOTE, flags, { ...MADE, text: 'Spaces keep their ids across restarts.', how: 'seen in a spike' });
  }

  /** A decision answering `question` on the note window: its response. @param {string} question @param {Record<string, unknown>} [content] */
  function decide(question, content = {}) {
    return write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A near-frameless floating note.', why: 'Notes are furniture on the desk.', ...content });
  }

  /** A replacement of `old` on the note window, a changed mind: its response. @param {string} old @param {Record<string, unknown>} [content] */
  function change(old, content = { text: 'A frameless surface.', why: 'Lighter.' }) {
    return write('replace', NOTE, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], ...content });
  }

  /** Each event the verbs write, one of each, on the note window: their short ids. */
  function oneOfEach() {
    const q = ask().id;
    const d = decide(q).id;
    const f = find(['--relies-on', d]).id;
    const r = change(d).id;
    const h = write('hold', NOTE, ['--entry', f, '--after', r], MADE).id;
    const m = write('move', NOTE, ['--question', ask('Which display does a note open on?').id, '--to', 'space-homing'], MADE).id;
    return { q, f, d, r, h, m };
  }

  return { write, ledgerText, rawLines, entries, stateTip, full, assertLast, assertAnswered, refused, ask, find, decide, change, oneOfEach };
}

module.exports = {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, ID, PHASES, AT_NOTE, ledgerWriteHelpers,
};
