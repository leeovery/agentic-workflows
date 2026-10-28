'use strict';

// What the ledger's read suites share (test-engine-ledger-read.cjs,
// test-engine-ledger-liveness.cjs): the unit and topics they write to, and
// the helpers over a suite's own fixture (`ledgerReadHelpers`) — the write
// verbs, the reads, the ledger's lines and events, and the forms an entry
// takes in a record and a map.

require('./hermetic-env.cjs');

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, statePath } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const { LEDGER } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const { shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const UNIT = 'fumi';
const SESSION_ID = 'session-1';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const MENU = `${UNIT}.discussion.menu-bar`;
// Every field of an event that names an entry.
const LINKS = ['id', 'answers', 'part_of', 'relies_on', 'replaces', 'cause', 'question', 'into', 'duplicate', 'entry', 'after'];
// What a reader holding the ledger's lines would need many times over, and
// what the reads need with room to spare.
const HEAP_MB = 48;

/** A discovery map row a topic's cancel and postpone take. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

const PHASES = Object.freeze({
  discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

/** @param {{id: string}[]} shown */
function ids(shown) {
  return shown.map((entry) => entry.id);
}

/**
 * The read suites' helpers over the project `dir()` names, the suite's own
 * fixture.
 * @param {() => string} dir
 */
function ledgerReadHelpers(dir) {
  /**
   * One ledger write that must succeed: its response.
   * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
   * @param {Record<string, string|undefined>} [env]
   */
  function write(verb, address, flags, content, env = SESSION) {
    return ok(dir(), ['ledger', verb, address, ...flags], { env, stdin: JSON.stringify(content) });
  }

  /** A question asked at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] */
  function ask(address, text, flags = []) {
    return write('ask', address, flags, { ...MADE, text }).id;
  }

  /** A finding at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
  function find(address, text, flags = [], content = {}) {
    return write('find', address, flags, { ...MADE, text, how: 'seen in a spike', ...content }).id;
  }

  /** A decision answering `question` at `address`: its short id. @param {string} address @param {string} question @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
  function decide(address, question, text, flags = [], content = {}) {
    return write('decide', address, ['--answers', question, ...flags], { ...MADE, text, why: `Why: ${text}`, ...content }).id;
  }

  /** `old` replaced at `address`, a changed mind: the replacement's short id. @param {string} address @param {string} old @param {string} text */
  function change(address, old, text) {
    return write('replace', address, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], text, why: `Why: ${text}` }).id;
  }

  /** @param {string[]} args */
  function read(...args) {
    return ok(dir(), ['ledger', ...args]);
  }

  /** The ledger's lines, as written. */
  function rawLines() {
    const file = statePath(dir(), LEDGER);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').slice(0, -1) : [];
  }

  /** The ledger's events. @returns {Record<string, any>[]} */
  function events() {
    return rawLines().map((line) => JSON.parse(line));
  }

  /** The full id a short id shows. @param {string} short */
  function full(short) {
    const ids = events().map((e) => e.id).filter((id) => id.startsWith(short));
    assert.strictEqual(ids.length, 1, `${short} names ${ids.length} ids`);
    return ids[0];
  }

  /**
   * The entry `short` names as a read must show it: its line as written but
   * its version, every id in it in the short form the ledger gives it now.
   * @param {string} short @returns {Record<string, unknown>}
   */
  function line(short) {
    const all = events();
    const shorts = shortIds(all.map((e) => e.id));
    const { v, ...event } = /** @type {Record<string, any>} */ (all.find((e) => e.id === full(short)));
    assert.strictEqual(v, 1);
    for (const field of LINKS) {
      if (Array.isArray(event[field])) event[field] = event[field].map((/** @type {string} */ id) => shorts.get(id));
      else if (typeof event[field] === 'string') event[field] = shorts.get(event[field]);
    }
    return event;
  }

  /** An entry as a record shows it on its own or in a chain: its line, and the confirmations that it holds. @param {string} short @param {string[]} [holds] */
  function held(short, holds = []) {
    return { ...line(short), holds: holds.map(line) };
  }

  /** A current entry as a record shows it: its line, its confirmations, and the entries it replaced beneath it. @param {string} short @param {string[]} replaced @param {string[]} [holds] */
  function current(short, replaced = [], holds = []) {
    return { ...held(short, holds), replaced: replaced.map((old) => held(old)) };
  }

  /**
   * A merge as a record shows it: its line, the duplicate it named while that
   * is live, and whether it holds.
   * @param {string} short @param {string|null} duplicate @param {boolean} holds
   */
  function shownMerge(short, duplicate, holds) {
    return { ...line(short), duplicate_entry: duplicate === null ? null : line(duplicate), holds };
  }

  /** A topic's map, each row its question, where it stands, and its answers' ids. @param {string} topic */
  function answered(topic) {
    return read('map', UNIT, topic).questions.map((/** @type {{id: string, stands: string, answers: {id: string}[]}} */ r) => [r.id, r.stands, ids(r.answers)]);
  }

  /**
   * Assert a topic's map and its record agree: the record shows each question
   * standing on the map, and every answer the map shows it, among its own
   * decisions or from where it stands, tied to the question it answers.
   * @param {string} topic
   */
  function assertAgree(topic) {
    const record = read('record', UNIT, topic);
    const rows = read('map', UNIT, topic).questions.filter((/** @type {{stands: string}} */ r) => r.stands !== 'moved-away');
    assert.deepStrictEqual(ids(rows), ids(record.questions), `${topic}'s map and record show different questions`);
    for (const row of rows) {
      for (const { id } of row.answers) {
        const elsewhere = record.other_topics.find((/** @type {{id: string}} */ o) => o.id === id);
        assert.ok(ids(record.decisions).includes(id) || elsewhere?.named.includes(row.id), `${topic}'s record does not show ${id}, which its map shows answering ${row.id}`);
      }
    }
  }

  /** `old` replaced from the spec, at the unit's level, a changed mind: the replacement's short id. @param {string} old @param {Record<string, unknown>} content */
  function changeFromSpec(old, content) {
    return write('replace', `${UNIT}.specification`, ['--replaces', old, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], ...content }).id;
  }

  /** `question` reworded at `address`: the new wording's short id. @param {string} address @param {string} question @param {string} text */
  function reword(address, question, text) {
    return write('replace', address, ['--replaces', question, '--reason', 'changed-mind'], { ...MADE, drops: ['the old wording'], text }).id;
  }

  /** A third topic on the unit, the menu bar. */
  function menuBar() {
    createManifest(dir(), UNIT, {
      work_type: 'epic',
      phases: {
        discovery: { items: { ...PHASES.discovery.items, 'menu-bar': row(3, 'The menu bar') } },
        discussion: { items: { ...PHASES.discussion.items, 'menu-bar': { status: 'in-progress' } } },
      },
    });
  }

  /** A second unit on the project, mint, a feature discussing itself. */
  function mint() {
    createManifest(dir(), 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
  }

  /** A second epic on the project, dock, discussing a topic named as one of fumi's is, space homing, and its badge. */
  function dock() {
    createManifest(dir(), 'dock', {
      work_type: 'epic',
      phases: {
        discovery: { items: { 'space-homing': row(1, 'Where the dock homes notes'), badge: row(2, 'The badge') } },
        discussion: { items: { 'space-homing': { status: 'in-progress' }, badge: { status: 'in-progress' } } },
      },
    });
  }

  /** Each row of a topic's map: its question, where it stands, and the topics it moved in from and away to. @param {string} unit @param {string} topic */
  function moves(unit, topic) {
    return read('map', unit, topic).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.moved_from, r.moved_to]);
  }

  return { write, ask, find, decide, change, read, rawLines, events, full, line, current, shownMerge, answered, assertAgree, changeFromSpec, reword, menuBar, mint, dock, moves };
}

module.exports = {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, MENU, HEAP_MB, PHASES, ids, ledgerReadHelpers,
};
