// What the ledger copies' suites share (test-engine-ledger-copies.cjs,
// test-engine-ledger-copies-boot.cjs, test-engine-ledger-copies-race.cjs):
// the seams on the render's claim and on the moment its fold has read the
// ledger, installed before the engine loads; the unit and topics written to,
// its phases, and the copies they render; and the helpers over a suite's own
// fixture (`copiesHelpers`).

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');

// Seams, set before the engine is loaded so the copies' render binds them: a
// test hooks the render's claim, and the moment its fold has read the ledger
// and what is live.
const manifestIo = require(path.join(SCRIPTS, 'kernel/manifest-io.cjs'));
const projection = require(path.join(SCRIPTS, 'domain/projections/ledger-copy.cjs'));
/** @type {{claimed: ((release: () => void) => () => void)|null, folded: (() => void)|null}} */
const seams = { claimed: null, folded: null };
const { tryClaimFile, productCopy } = { tryClaimFile: manifestIo.tryClaimFile, productCopy: projection.productCopy };
manifestIo.tryClaimFile = (/** @type {string} */ file, /** @type {number|undefined} */ staleMs) => {
  const release = tryClaimFile(file, staleMs);
  return release && seams.claimed ? seams.claimed(release) : release;
};
projection.productCopy = (/** @type {any} */ view) => {
  if (seams.folded) seams.folded();
  return productCopy(view);
};

const { ok, statePath } = require('./engine-harness.cjs');
const store = require(path.join(SCRIPTS, 'kernel/knowledge/store.cjs'));
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));

const UNIT = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'session-1' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });
const NOTE = `${UNIT}.discussion.note-window`;
const SPACE = `${UNIT}.discussion.space-homing`;
const NOTE_COPY = '.knowledge/records/fumi/note-window.md';
const SPACE_COPY = '.knowledge/records/fumi/space-homing.md';

/** A discovery map row a topic's cancel and postpone take. @param {number} order @param {string} summary */
function row(order, summary) {
  return { order, summary, routing: 'discussion', source: 'discovery' };
}

const PHASES = Object.freeze({
  discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
  discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
});

/**
 * The copies suites' helpers over the project `dir()` names, the suite's own
 * fixture.
 * @param {() => string} dir
 */
function copiesHelpers(dir) {
  /**
   * One ledger write that must succeed: its response.
   * @param {string} verb @param {string} address @param {string[]} flags @param {Record<string, unknown>} content
   */
  function write(verb, address, flags, content) {
    return ok(dir(), ['ledger', verb, address, ...flags], { env: SESSION, stdin: JSON.stringify(content) });
  }

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
  seams, UNIT, SESSION, MADE, NOTE, SPACE, NOTE_COPY, SPACE_COPY, PHASES, copiesHelpers,
};
