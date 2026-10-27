'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the ledger's rendered copies in the gitignored `.knowledge/`
// (4.11.10) — each record's, which the knowledge base indexes (5.8.12,
// 22.6.6), and the product record's file, which it never does (5.8.13,
// 22.6.12). They are a cache, rebuilt from the ledger (22.6.7).
//
// - What is rendered: every place a live event stands in whose record holds
//   a current entry — a topic's, or a unit's own level's (ledger-fold.cjs) —
//   each showing its current answers only, never what they replaced, and the
//   current entries elsewhere it rests on; and once the ledger exists, the
//   product record. A place whose record holds nothing has no copy: a
//   cancelled topic or unit, or a postponed topic while it waits, has its
//   copy removed, and gets it back when it is live again (5.8.17).
// - When: the whole set is rendered against the ledger after a ledger write
//   commits and its lock is released, and after any command that changes
//   what is live — the engine's dispatcher marks liveness around every
//   command it runs under the writer lock, however the change is made. One entry's change can move
//   records in other topics and units — one relying on an answer replaced,
//   both ends of a move, a unit whose replacement stops counting — so the
//   render never works out which: a copy is written where its text differs
//   from what is on disk, and removed where no record holds it.
// - One render at a time, under the copies' own lock, never the writer's:
//   the ledger is folded inside it, so the render that holds it last reads
//   every write committed before it, and no render folded earlier lands
//   over a later one. A replaced answer is out of every copy once the
//   render after its write is done.
// - Indexing follows a render, outside its lock, once a checkout's knowledge
//   base is set up: each copy written and still there indexed, from the file
//   as it stands then, and each removed and still gone taken out — a later
//   render may have changed either meanwhile. The keyword side lands at
//   once, the vectors left to the background fill (knowledge/sync.cjs). Boot
//   renders before its own knowledge pass, which brings the store in line
//   with the copies.
// - A render or an index that fails is a warning, never a refusal: what
//   called it stands, and the next start renders and indexes it again
//   (22.6.15).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { acquireLockFile, releaseLockFile } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { RECORDS_DIR, PRODUCT_FILE, knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { ledgerFile } = require('./ledger.cjs');
const { ID_FACTS, readFolded, factsOf, standingOf, currentsOf, answersOf, placeRecords, productOf } = require('./ledger-fold.cjs');
const { showerOf } = require('./ledger-read.cjs');
const { liveness } = require('./ledger-units.cjs');
const { recordCopy, productCopy } = require('./projections/ledger-copy.cjs');
const { recordFile, recordScope } = require('./knowledge/artifacts.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');

/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./ledger-fold.cjs').RecordIds} RecordIds */
/** @typedef {import('./projections/ledger-copy.cjs').Placed} Placed */
/** @typedef {import('./projections/ledger-copy.cjs').Asked} Asked */

/**
 * What a render changed on disk, state-relative: the record copies written
 * and those removed. The product record's file is never among them.
 * @typedef {{written: string[], removed: string[]}} Rendered
 */

/**
 * `id`'s line, and where it stands where that is not in the copy.
 * @param {Shower} shower @param {string} id @param {(id: string) => boolean} inCopy
 * @returns {Placed}
 */
function placed(shower, id, inCopy) {
  return { line: shower.show(id), from: inCopy(id) ? null : standingOf(shower.folded, id) };
}

/** An entry's text. @param {Shower} shower @param {string} id @returns {string} */
function textOf(shower, id) {
  return /** @type {string} */ (shower.show(id).text);
}

/**
 * The question a decision answers, in its current wording, or null where
 * none is current: its topic or unit set aside, or leading nowhere current.
 * @param {Shower} shower @param {string} decision
 * @returns {string|null}
 */
function questionOf(shower, decision) {
  return currentsOf(shower.folded, /** @type {string} */ (factsOf(shower.folded, decision).answers))[0] ?? null;
}

/**
 * Decisions under the questions they answer, in the order each question is
 * first met; a decision whose question is not current under its own text,
 * so nothing that is not current lends a copy its words.
 * @param {Shower} shower @param {string[]} decisions @param {(id: string) => boolean} inCopy
 * @returns {Asked[]}
 */
function byQuestion(shower, decisions, inCopy) {
  /** @type {Map<string, Asked>} */
  const asked = new Map();
  for (const id of decisions) {
    const question = questionOf(shower, id) ?? id;
    /** @type {Asked} */
    const group = asked.get(question) ?? { text: textOf(shower, question), question: null, answers: [] };
    group.answers.push(placed(shower, id, inCopy));
    asked.set(question, group);
  }
  return [...asked.values()];
}

/**
 * A record's copy: its questions with their answers, then the questions
 * elsewhere its own decisions answer; its findings; and the entries
 * elsewhere it rests on that answer none of its questions.
 * @param {Shower} shower @param {string} unit @param {string|null} topic @param {RecordIds} ids
 */
function recordText(shower, unit, topic, ids) {
  const own = new Set([...ids.questions, ...ids.findings, ...ids.decisions]);
  const inCopy = (/** @type {string} */ id) => own.has(id);
  /** @type {Set<string>} */
  const answered = new Set();
  const asked = ids.questions.map((question) => {
    const answers = answersOf(shower.folded, question);
    for (const answer of answers) answered.add(answer);
    return { text: textOf(shower, question), question: placed(shower, question, inCopy), answers: answers.map((answer) => placed(shower, answer, inCopy)) };
  });
  return recordCopy({
    unit,
    topic,
    asked: [...asked, ...byQuestion(shower, ids.decisions.filter((id) => !answered.has(id)), inCopy)],
    findings: ids.findings.map((id) => placed(shower, id, inCopy)),
    elsewhere: ids.other_topics.filter(({ id }) => !answered.has(id)).map(({ id }) => placed(shower, id, inCopy)),
  });
}

/** The product record's file. @param {Shower} shower */
function productText(shower) {
  const { findings, decisions } = productOf(shower.folded);
  const nowhere = () => false;
  return productCopy({ asked: byQuestion(shower, decisions, nowhere), findings: findings.map((id) => placed(shower, id, nowhere)) });
}

/**
 * Every copy the ledger renders, by its state-relative file: each record
 * holding a current entry, and the product record's — none where there is
 * no ledger.
 * @param {string} root @param {string[]} notes what a landing the read's check finished said, pushed to
 * @returns {Map<string, string>}
 */
function copiesOf(root, notes) {
  if (!fs.existsSync(ledgerFile(root))) return new Map();
  const live = liveness(root);
  return readFolded(root, ID_FACTS, notes, (facts, entryAt) => {
    const shower = showerOf({ facts, live }, entryAt);
    /** @type {Map<string, string>} */
    const copies = new Map();
    for (const { unit, topic, record } of placeRecords(shower.folded)) {
      if (record.questions.length + record.findings.length + record.decisions.length === 0) continue;
      copies.set(recordFile(unit, topic), recordText(shower, unit, topic, record));
    }
    copies.set(PRODUCT_FILE, productText(shower));
    return copies;
  });
}

/** A copy's temporary file, as `writeWhole` names it. */
const TEMPORARY = /^\..+\.md\.\d+\.tmp$/;

/** The files in a folder of the state, state-relative, none where it is missing. @param {string} root @param {string} dir */
function filesIn(root, dir) {
  try {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** The folders the copies are written in, state-relative: the knowledge directory's, the records', and each unit's. @param {string} root */
function copyFolders(root) {
  let units;
  try {
    units = fs.readdirSync(path.join(root, RECORDS_DIR), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    units = [];
  }
  return [path.dirname(PRODUCT_FILE), RECORDS_DIR, ...units.map((unit) => `${RECORDS_DIR}/${unit.name}`)];
}

/**
 * The record copies on disk, state-relative, each temporary file a render
 * killed before its rename left removed: under the copies' lock no other is
 * being written.
 * @param {string} root @returns {string[]}
 */
function recordCopiesOnDisk(root) {
  /** @type {string[]} */
  const copies = [];
  for (const dir of copyFolders(root)) {
    for (const name of filesIn(root, dir)) {
      if (TEMPORARY.test(name)) fs.rmSync(path.join(root, dir, name), { force: true });
      else if (dir !== path.dirname(PRODUCT_FILE) && name.endsWith('.md') && !name.startsWith('.')) copies.push(`${dir}/${name}`);
    }
  }
  return copies;
}

/** `text` written to `file`, whole or not at all. @param {string} file @param {string} text */
function writeWhole(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

/** @param {string} file */
function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The copies brought in line with the ledger, under their lock, the ledger
 * folded inside it: each whose text differs from what is on disk written,
 * and each no record holds removed, a unit's folder with it once empty. A
 * project with no ledger and no knowledge directory has nothing to render,
 * and the directory is not made for it.
 * @param {string} root @param {string[]} notes what a landing the read's check finished said, pushed to
 * @returns {Rendered}
 */
function renderCopies(root, notes) {
  const { dir, copies: lock } = knowledgeFiles(root);
  if (!fs.existsSync(ledgerFile(root)) && !fs.existsSync(dir)) return { written: [], removed: [] };
  fs.mkdirSync(dir, { recursive: true });
  acquireLockFile(lock, 'Timed out waiting for the lock on the ledger\'s copies');
  try {
    return renderLocked(root, notes);
  } finally {
    releaseLockFile(lock);
  }
}

/**
 * The copies brought in line with the ledger, holding their lock.
 * @param {string} root @param {string[]} notes
 * @returns {Rendered}
 */
function renderLocked(root, notes) {
  const copies = copiesOf(root, notes);
  /** @type {Rendered} */
  const rendered = { written: [], removed: [] };
  for (const [file, text] of copies) {
    if (readOrNull(path.join(root, file)) === text) continue;
    writeWhole(path.join(root, file), text);
    if (file !== PRODUCT_FILE) rendered.written.push(file);
  }
  for (const file of recordCopiesOnDisk(root)) {
    if (copies.has(file)) continue;
    fs.rmSync(path.join(root, file));
    rendered.removed.push(file);
  }
  if (!copies.has(PRODUCT_FILE)) fs.rmSync(path.join(root, PRODUCT_FILE), { force: true });
  for (const dir of new Set(rendered.removed.map((file) => path.dirname(file)))) {
    if (dir !== RECORDS_DIR && fs.readdirSync(path.join(root, dir)).length === 0) fs.rmdirSync(path.join(root, dir));
  }
  return rendered;
}

/**
 * The copies rendered against the ledger, a failure a warning: what changed,
 * or null where the render failed.
 * @param {string} cwd @param {string[]} warnings
 * @returns {Rendered|null}
 */
function renderLedgerCopies(cwd, warnings) {
  try {
    return renderCopies(stateRoot(cwd), warnings);
  } catch (err) {
    warnings.push(`knowledge record render failed: ${messageOf(err)} — the next start renders it again`);
    return null;
  }
}

/**
 * The copies rendered against the ledger and, where the checkout's knowledge
 * base is set up, indexed: each written and still there indexed, each
 * removed and still gone taken out — a later render may have changed either
 * meanwhile. A failure is a warning.
 * @param {string} cwd @param {string[]} warnings
 */
function refreshLedgerCopies(cwd, warnings) {
  const rendered = renderLedgerCopies(cwd, warnings);
  const root = stateRoot(cwd);
  if (rendered === null || !fs.existsSync(knowledgeFiles(root).config)) return;
  const there = (/** @type {string} */ file) => fs.existsSync(path.join(root, file));
  syncKnowledge(cwd, [
    ...rendered.written.filter(there).map((file) => ({ index: file, label: `knowledge index (${file})` })),
    ...rendered.removed.filter((file) => !there(file)).map((file) => ({ remove: recordScope(file), label: `knowledge remove (${file})` })),
  ], warnings);
}

module.exports = { renderLedgerCopies, refreshLedgerCopies };
