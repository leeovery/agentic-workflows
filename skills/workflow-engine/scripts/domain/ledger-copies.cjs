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
//   what is live — the engine's dispatcher stamps the units' manifests
//   around every command it runs under the writer lock, and holds the units
//   whose manifests changed against what was live when the copies were last
//   rendered, so a change is seen however it was made, and a command that
//   changes nothing pays a stat a unit. One entry's change can move records
//   in other topics and units — one relying on an answer replaced, both ends
//   of a move, a unit whose replacement stops counting — so the render never
//   works out which: a copy is written where its text differs from what is
//   on disk, and removed where no record holds it.
// - One render at a time, and no one waits for it: a writer marks the copies
//   out of date, then claims their render without waiting. The holder folds
//   the ledger, renders and indexes, and goes round again while the mark
//   moved since its fold began; it checks the mark once more after letting
//   go, so a writer that found it held — and left at once — is rendered by
//   it. The fold reads every write committed before it, and no render folded
//   earlier lands over a later one, in the copies or the store (5.S22). The
//   claim is known by its holder's process — never broken while it runs,
//   however long a render or its index pass takes, and taken over once it
//   is gone.
// - The fold's check finishes a landing a kill cut short under the writer
//   lock (ledger.cjs): a writer checks the ledger before it claims the
//   render, so that wait is taken with the claim free. A fold never renders
//   what the branch has not committed (5.4.3).
// - Indexing follows each render inside the claim, once a checkout's
//   knowledge base is set up: each copy written indexed and each removed
//   taken out. The keyword side lands at once, the vectors left to the
//   background fill (knowledge/sync.cjs). Boot renders before its own
//   knowledge pass, which brings the store in line with the copies.
// - A render or an index that fails is a warning, never a refusal: what
//   called it stands, and the next start renders and indexes it again
//   (22.6.15).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { tryClaimFile } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { RECORDS_DIR, PRODUCT_FILE, knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { ledgerFile, checkLedger } = require('./ledger.cjs');
const { ID_FACTS, readFolded, factsOf, standingOf, currentsOf, answersOf, placeRecords, productOf } = require('./ledger-fold.cjs');
const { showerOf } = require('./ledger-read.cjs');
const { liveness, manifestOf, unitMark, livenessMarks, manifestStamps, changedUnits } = require('./ledger-units.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { recordCopy, productCopy } = require('./projections/ledger-copy.cjs');
const { recordFile, recordScope } = require('./knowledge/artifacts.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');

/** @typedef {import('../kernel/call.cjs').Call} Call */
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
 * The copies marked out of date, then brought in line with the ledger where
 * no render holds their claim — `after` given what each render changed,
 * holding it — going round while the mark moves. A project with no ledger
 * and no knowledge directory has nothing to render, and the directory is
 * not made for it.
 * @param {string} root @param {string[]} notes what a landing the read's check finished said, pushed to
 * @param {(rendered: Rendered) => void} after
 */
function renderCopies(root, notes, after) {
  const files = knowledgeFiles(root);
  if (!fs.existsSync(ledgerFile(root)) && !fs.existsSync(files.dir)) return;
  writeWhole(files.copiesOutdated, `${process.pid}.${Date.now()}.${Math.random()}`);
  for (let release = claimRender(root, notes); release !== null; release = claimRender(root, notes)) {
    /** @type {string|null} */
    let seen;
    try {
      do {
        seen = readOrNull(files.copiesOutdated);
        after(renderLocked(root, notes));
      } while (readOrNull(files.copiesOutdated) !== seen);
    } finally {
      release();
    }
    if (readOrNull(files.copiesOutdated) === seen) return;
  }
}

/**
 * The render claimed without waiting — the ledger checked first, so a
 * landing to finish is waited on with the claim free: its release, or null
 * where another render holds it.
 * @param {string} root @param {string[]} notes
 */
function claimRender(root, notes) {
  if (fs.existsSync(ledgerFile(root))) checkLedger(root, notes);
  return tryClaimFile(knowledgeFiles(root).copies);
}

/**
 * The copies brought in line with the ledger, holding their claim, and —
 * where there is a ledger — what is live stored beside them.
 * @param {string} root @param {string[]} notes
 * @returns {Rendered}
 */
function renderLocked(root, notes) {
  const live = fs.existsSync(ledgerFile(root)) ? livenessMarks(root) : null;
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
  if (live !== null) writeWhole(knowledgeFiles(root).copiesLive, JSON.stringify(live));
  return rendered;
}

/**
 * The copies rendered against the ledger, a failure a warning.
 * @param {string} cwd @param {string[]} warnings
 * @param {(rendered: Rendered) => void} [after] run holding the copies' lock
 */
function renderLedgerCopies(cwd, warnings, after = () => {}) {
  try {
    renderCopies(stateRoot(cwd), warnings, after);
  } catch (err) {
    warnings.push(`knowledge record render failed: ${messageOf(err)} — the next start renders it again`);
  }
}

/**
 * The copies rendered against the ledger and, where the checkout's knowledge
 * base is set up, indexed under the same lock: each written indexed, each
 * removed taken out. A failure of either is a warning.
 * @param {string} cwd @param {string[]} warnings
 */
function refreshLedgerCopies(cwd, warnings) {
  renderLedgerCopies(cwd, warnings, (rendered) => {
    if (!fs.existsSync(knowledgeFiles(stateRoot(cwd)).config)) return;
    syncKnowledge(cwd, [
      ...rendered.written.map((file) => ({ index: file, label: `knowledge index (${file})` })),
      ...rendered.removed.map((file) => ({ remove: recordScope(file), label: `knowledge remove (${file})` })),
    ], warnings);
  });
}

/**
 * Whether the copies are behind what is live for the units `changed` names:
 * each one's liveness now against what it was when the copies were last
 * rendered. A unit that cannot be read counts as behind, so the render that
 * follows says why.
 * @param {string} root @param {string[]} changed
 */
function copiesBehind(root, changed) {
  if (changed.length === 0 || !fs.existsSync(ledgerFile(root))) return false;
  try {
    const shown = JSON.parse(readOrNull(knowledgeFiles(root).copiesLive) ?? '{}');
    return changed.some((unit) => unitMark(unit, manifestOf(root, unit)) !== (shown[unit] ?? null));
  } catch {
    return true;
  }
}

/**
 * A command run under the writer lock, then — the lock released — the
 * ledger's copies rendered and indexed where it changed what is live
 * (ledger-copies.cjs). Every change to a unit's or a topic's liveness is
 * such a command, however it is made, so the copies follow each one from
 * here: under the lock, the units whose manifests the command changed are
 * held against what was live when the copies were last rendered. Its
 * response waits until then, so a failure there rides it as a warning,
 * whether the command answered or failed.
 * @param {Call} call @param {string} root @param {(held: Call) => void} command
 */
function followingLiveness(call, root, command) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const err = [];
  let behind = false;
  try {
    withStateLock(root, () => {
      const before = manifestStamps(root);
      try {
        command({ ...call, out: (text) => out.push(text), err: (text) => err.push(text) });
      } finally {
        behind = copiesBehind(root, changedUnits(root, before));
      }
    });
  } finally {
    /** @type {string[]} */
    const warnings = [];
    if (behind) refreshLedgerCopies(call.cwd, warnings);
    carryWarnings(out, err, warnings);
    for (const text of out) call.out(text);
    for (const text of err) call.err(text);
  }
}

/**
 * `warnings` added to the ones a response's JSON line carries — its answer
 * on stdout, or else its failure on stderr — or, where neither is JSON, on
 * a line of their own on stderr.
 * @param {string[]} out @param {string[]} err @param {string[]} warnings
 */
function carryWarnings(out, err, warnings) {
  if (warnings.length === 0) return;
  if (out.length > 0 && carriedBy(out, warnings)) return;
  if (err.length > 0 && carriedBy(err, warnings)) return;
  err.push(`${JSON.stringify({ warnings })}\n`);
}

/**
 * Whether the first of `lines` opens with a JSON object, `warnings` then
 * added to it.
 * @param {string[]} lines @param {string[]} warnings
 */
function carriedBy(lines, warnings) {
  const [first] = lines;
  const end = first.includes('\n') ? first.indexOf('\n') : first.length;
  let answer;
  try {
    answer = JSON.parse(first.slice(0, end));
  } catch {
    return false;
  }
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return false;
  lines[0] = `${JSON.stringify({ ...answer, warnings: [...(answer.warnings ?? []), ...warnings] })}${first.slice(end)}`;
  return true;
}

module.exports = { renderLedgerCopies, refreshLedgerCopies, followingLiveness };
