'use strict';

// ---------------------------------------------------------------------------
// What the ledger suites share (test-engine-ledger*.cjs, and
// test-engine-verdict.cjs over the ledger's departures): the unit, the
// session and the topics they write to, the unit's starting phases, and the
// worlds built from them (`ledgerWorld`; `writtenWorld`, its entries
// written once and copied, and `askedWorld`, its questions; and the copies
// suites' hook `useCopiesWorld`); one write that must succeed, the ledger's
// text, lines and entries, an entry's full id, and the one-decision check's
// runs logged (`ledgerHelpers`); the person's answer to Claude's lean, a
// raise drawn and answered (`answeredRaise`); and over those, the helpers
// each aspect's suites share: the reads and the forms an entry takes
// in a record and a map (`ledgerReadHelpers`), the written line and a refusal
// asserted (`ledgerWriteHelpers`), and the rendered copies (`copiesHelpers`).
// The copies' seams are ledger-copies-seams.cjs, which must load before the
// engine does.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, okSectionsAsync, refusedPristine, stateGit, statePath, layout, setupGitFixture, fixtureFrom, keywordOnlyKnowledge, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { shortIds } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { LEDGER_VERSION } = require(path.join(SCRIPTS, 'domain/ledger-events.cjs'));
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));
const { systemConfigDir } = require(path.join(SCRIPTS, 'kernel/system-config.cjs'));
const { DECISION_CHECKS } = require(path.join(SCRIPTS, 'domain/user-files.cjs'));

const UNIT = 'fumi';
const SESSION_ID = 'session-1';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const MENU = `${UNIT}.discussion.menu-bar`;

/** A discovery map row a topic's cancel and postpone take. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

// The unit's two topics, each mapped and under discussion.
const PHASES = Object.freeze({
  discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

// The write suites' unit: a third topic, the menu bar, on the map and not
// yet under discussion.
const WRITE_PHASES = Object.freeze({
  discovery: { items: { 'note-window': {}, 'space-homing': {}, 'menu-bar': {} } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

/**
 * A project world from the fixture library with the unit's manifest
 * written there: its folder.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite
 * @param {Record<string, unknown>} [phases]
 */
function ledgerWorld(prefix, phases = PHASES) {
  const dir = setupGitFixture(prefix);
  createManifest(dir, UNIT, { work_type: 'epic', phases });
  return dir;
}

/**
 * A world many tests start from, built once and copied for each
 * (`fixtureFrom`): the unit's manifest written with `phases`, and the
 * entries `build` writes through the ledger's verbs. Answers the world, and
 * what `build` answered — each entry's short id by its name — filled as
 * the world is first built.
 * @template {string} Name
 * @param {string} prefix @param {Record<string, unknown>} phases
 * @param {(write: ReturnType<typeof ledgerHelpers>['write']) => Record<Name, string>} build
 * @returns {{world: (dir?: string) => string, made: Record<Name, string>}}
 */
function writtenWorld(prefix, phases, build) {
  const made = /** @type {Record<Name, string>} */ ({});
  const world = fixtureFrom(prefix, (template) => {
    createManifest(template, UNIT, { work_type: 'epic', phases });
    Object.assign(made, build(ledgerHelpers(() => template).write));
  });
  return { world, made };
}

/**
 * A world many tests start from (`writtenWorld`): Claude's `questions`
 * asked on the note window. Answers the world, and each question's short id
 * by its name.
 * @template {string} Name
 * @param {string} prefix @param {Record<string, unknown>} phases @param {Record<Name, string>} questions
 * @returns {{world: (dir?: string) => string, asked: Record<Name, string>}}
 */
function askedWorld(prefix, phases, questions) {
  const { world, made } = writtenWorld(prefix, phases, (write) => /** @type {Record<Name, string>} */ (Object.fromEntries(
    Object.entries(questions).map(([name, text]) => [name, write('ask', NOTE, [], { ...MADE, text }).id]),
  )));
  return { world, asked: made };
}

/**
 * The copies suites' world for each test of the calling file — the unit's,
 * its knowledge set up keyword-only — made before it and removed after it.
 * @returns {() => string} the running test's project
 */
function useCopiesWorld() {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = ledgerWorld('ledger-copies-');
    keywordOnlyKnowledge(dir);
  });
  afterEach(() => {
    cleanupFixture(dir);
  });
  return () => dir;
}

/**
 * The helpers every ledger suite's own share, over the project `dir()`
 * names, the suite's own fixture.
 * @param {() => string} dir
 */
function ledgerHelpers(dir) {
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
    const file = statePath(dir(), layout.ledger);
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

  /** The full id a short id shows. @param {string} short */
  function full(short) {
    const ids = entries().map((e) => e.id).filter((id) => id.startsWith(short));
    assert.strictEqual(ids.length, 1, `${short} names ${ids.length} ids`);
    return ids[0];
  }

  /**
   * The one-decision check's runs logged in the config folder `config`, each
   * line but its time, which must be one.
   * @param {string} [config]
   * @returns {Record<string, unknown>[]}
   */
  function checkRuns(config = systemConfigDir()) {
    const file = path.join(config, DECISION_CHECKS);
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').slice(0, -1).map((text) => {
      const { at, ...line } = JSON.parse(text);
      assert.ok(!Number.isNaN(Date.parse(at)), `a run logged at ${at}`);
      return line;
    });
  }

  /**
   * A run as the log holds it, but its time: in this project, of the `verb`
   * in `unit`, its `outcome`, the rules it found, and the model that
   * answered — the stub's id for Opus, none where unchecked.
   * @param {string} verb @param {'one'|'several'|'unchecked'} outcome @param {number|null} rules @param {string} [unit]
   */
  function checkRun(verb, outcome, rules, unit = UNIT) {
    const { project_id: id } = JSON.parse(fs.readFileSync(statePath(dir(), layout.projectManifest), 'utf8'));
    return { v: 1, project_id: id, project: path.basename(dir()), unit, verb, rules, outcome, model: outcome === 'unchecked' ? null : 'claude-opus-stub' };
  }

  return { write, ledgerText, rawLines, entries, full, checkRuns, checkRun };
}

// ---------------------------------------------------------------------------
// The person's answer to Claude's lean, through a raise (test-engine-ledger-
// trust.cjs, test-engine-verdict.cjs).
// ---------------------------------------------------------------------------

/**
 * Claude's call leaning to `lean` over `other`: the call a raise takes on
 * stdin.
 * @param {string} lean @param {string} other
 */
function leaningCall(lean, other) {
  return {
    question: 'What is a note?',
    rows: [{ key: '1', name: 'Lean', text: lean, notice: 'what Claude would build' }, { key: '2', name: 'Other', text: other, notice: 'what else it could be' }],
    lean: '1', why: 'It follows the person.', sort: 'several', mechanism: 'How a note is built.', product_wide: false,
  };
}

/**
 * The person's answer to Claude's lean on `question` at `address`: a raise
 * drawn and answered in the conversation `env` names, Claude leaning to
 * `lean` over `other`, the person picking `key` — `1` the lean, `2` the
 * other — who moved whom on stdin where `moved` gives it. Answers the
 * entry's short id.
 * @param {string} dir @param {string} address @param {string} question
 * @param {{lean: string, other: string, key: '1'|'2', moved?: string, env: Record<string, string|undefined>}} answer
 */
async function answeredRaise(dir, address, question, { lean, other, key, moved, env }) {
  const { res } = await okSectionsAsync(dir, ['raise', address, '--answers', question], { env, stdin: JSON.stringify(leaningCall(lean, other)) });
  const given = { why: 'The person said why.', ...(moved === undefined ? {} : { who_moved_whom: moved }) };
  return ok(dir, ['raise', 'answer', res.raise, '--pick', key], { env, stdin: JSON.stringify(given) }).id;
}

// ---------------------------------------------------------------------------
// The read suites (test-engine-ledger-read.cjs, -map, -merges, -stands,
// -liveness).
// ---------------------------------------------------------------------------

// Every field of an event that names an entry.
const LINKS = ['id', 'answers', 'part_of', 'relies_on', 'replaces', 'cause', 'question', 'into', 'duplicate', 'entry', 'after'];
// What a reader holding the ledger's lines would need many times over, and
// what the reads need with room to spare.
const HEAP_MB = 48;

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
  const { write, rawLines, entries, full } = ledgerHelpers(dir);

  /** A question asked at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] */
  function ask(address, text, flags = []) {
    return write('ask', address, flags, { ...MADE, text }).id;
  }

  /** A finding at `address`: its short id. @param {string} address @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
  function find(address, text, flags = [], content = {}) {
    return write('find', address, flags, { ...MADE, text, how: 'seen in a spike', known: 'spike', ...content }).id;
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

  /**
   * The entry `short` names as a read must show it: its line as written but
   * its version, every id in it in the short form the ledger gives it now.
   * @param {string} short @returns {Record<string, unknown>}
   */
  function line(short) {
    const all = entries();
    const shorts = shortIds(all.map((e) => e.id));
    const { v, ...event } = /** @type {Record<string, any>} */ (all.find((e) => e.id === full(short)));
    assert.strictEqual(v, LEDGER_VERSION);
    for (const field of LINKS) {
      if (Array.isArray(event[field])) event[field] = event[field].map((/** @type {string} */ id) => shorts.get(id));
      else if (typeof event[field] === 'string') event[field] = shorts.get(event[field]);
    }
    return event;
  }

  /** An entry as a record shows it on its own or in a chain: its line, the confirmations that it holds, the person's keeps of it, and the files linked from it. @param {string} short @param {string[]} [holds] @param {string[]} [kept] @param {Record<string, unknown>[]} [assets] */
  function held(short, holds = [], kept = [], assets = []) {
    return { ...line(short), holds: holds.map(line), kept: kept.map(line), assets };
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
   * decisions or from where it stands — tied to the question it answers,
   * where that question stands on the topic.
   * @param {string} topic
   */
  function assertAgree(topic) {
    const record = read('record', UNIT, topic);
    const rows = read('map', UNIT, topic).questions;
    const standing = rows.filter((/** @type {{stands: string}} */ r) => !['moved-away', 'elsewhere', 'question-set-aside'].includes(r.stands));
    assert.deepStrictEqual(ids(standing), ids(record.questions), `${topic}'s map and record show different questions`);
    for (const row of rows) {
      if (row.stands === 'question-set-aside') assert.ok([...ids(record.decisions), ...ids(record.other_topics)].includes(row.id), `${topic}'s record does not show ${row.id}, which its map shows as a row of its own`);
      for (const { id } of row.answers) {
        const elsewhere = record.other_topics.find((/** @type {{id: string}} */ o) => o.id === id);
        const shown = standing.includes(row) ? elsewhere?.named.includes(row.id) : elsewhere !== undefined;
        assert.ok(ids(record.decisions).includes(id) || shown, `${topic}'s record does not show ${id}, which its map shows answering ${row.id}`);
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

  return { write, ask, find, decide, change, read, rawLines, entries, full, line, current, shownMerge, answered, assertAgree, changeFromSpec, reword, menuBar, mint, dock, moves };
}

// ---------------------------------------------------------------------------
// The write suites (test-engine-ledger-write.cjs, -links, -trust).
// ---------------------------------------------------------------------------

const ID = /^[0-9A-Za-z]{21}$/;

/** @typedef {{phase: string, topic: string|null}} Place */

const AT_NOTE = Object.freeze({ phase: 'discussion', topic: 'note-window' });

/**
 * The write suites' helpers over the project `dir()` names, the suite's own
 * fixture, which a test may set up afresh.
 * @param {() => string} dir
 */
function ledgerWriteHelpers(dir) {
  const { write, ledgerText, rawLines, entries, full } = ledgerHelpers(dir);

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
    assert.strictEqual(raw, JSON.stringify({ v: LEDGER_VERSION, id, event, unit: UNIT, topic: place.topic, phase: place.phase, session: SESSION_ID, at, ...own }));
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
    assert.strictEqual(stateGit(dir(), ['show', '--name-only', '--pretty=format:', 'HEAD']).trim(), layout.ledger);
    assert.strictEqual(stateGit(dir(), ['show', `HEAD:${layout.ledger}`]), ledgerText());
  }

  /**
   * A write that must be refused, writing nothing and committing nothing:
   * its refusal.
   * @param {string} verb @param {string} address @param {string[]} flags @param {unknown} content
   * @param {RegExp} pattern @param {Record<string, string|undefined>} [env]
   */
  function refused(verb, address, flags, content, pattern, env = SESSION) {
    const res = refusedPristine(dir(), ['ledger', verb, address, ...flags], { env, stdin: typeof content === 'string' ? content : JSON.stringify(content) });
    assert.match(res.error, pattern);
    return res;
  }

  /** A question asked on the note window: its response. @param {string} [text] */
  function ask(text = 'What is a note, at its most basic?') {
    return write('ask', NOTE, [], { ...MADE, text });
  }

  /** A finding found on the note window, relying on what `flags` name: its response. @param {string[]} [flags] */
  function find(flags = []) {
    return write('find', NOTE, flags, { ...MADE, text: 'Spaces keep their ids across restarts.', how: 'seen in a spike', known: 'spike' });
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

  return { write, ledgerText, rawLines, entries, full, assertLast, assertAnswered, refused, ask, find, decide, change, oneOfEach };
}

// ---------------------------------------------------------------------------
// The copies suites (test-engine-ledger-copies.cjs, -boot, -race).
// ---------------------------------------------------------------------------

const NOTE_COPY = layout.knowledge('records', 'fumi', 'note-window.md');
const SPACE_COPY = layout.knowledge('records', 'fumi', 'space-homing.md');

/**
 * The copies suites' helpers over the project `dir()` names, the suite's own
 * fixture.
 * @param {() => string} dir
 */
function copiesHelpers(dir) {
  const { write } = ledgerHelpers(dir);

  /** A question asked at `address`: its short id. @param {string} address @param {string} text */
  function ask(address, text) {
    return write('ask', address, [], { ...MADE, text }).id;
  }

  /** A decision answering `question` at `address`: its short id. @param {string} address @param {string} question @param {string} text @param {string[]} [flags] @param {Record<string, unknown>} [content] */
  function decide(address, question, text, flags = [], content = {}) {
    return write('decide', address, ['--answers', question, ...flags], { ...MADE, text, why: 'It follows the person.', ...content }).id;
  }

  /** A copy's text, state-relative, or null where there is none. @param {string} rel */
  function copy(rel) {
    const file = statePath(dir(), rel);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }

  /** The text of every chunk the store holds. */
  function indexedText() {
    return store.allChunks(store.loadStore(knowledgeFiles(statePath(dir())).store)).map((c) => c.content).join('\n');
  }

  /** A decision on the note window, a floating panel ruling out a document window: its question's and its own short ids. */
  function floatingPanel() {
    const question = ask(NOTE, 'Is a note a window?');
    return { question, decision: decide(NOTE, question, 'A floating panel.', [], { rules_out: ['a document window', 'a sheet'] }) };
  }

  return { write, ask, decide, copy, indexedText, floatingPanel };
}

module.exports = {
  UNIT, SESSION_ID, SESSION, MADE, NOTE, SPACE, MENU, row, PHASES, WRITE_PHASES, ledgerWorld, writtenWorld, askedWorld, useCopiesWorld, ledgerHelpers, leaningCall, answeredRaise,
  LINKS, HEAP_MB, ids, ledgerReadHelpers,
  ID, AT_NOTE, ledgerWriteHelpers,
  NOTE_COPY, SPACE_COPY, copiesHelpers,
};
