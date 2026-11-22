'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what a migration verifier's later round reads (21.10.18).
// The first verifier of a record or a piece walks the whole of it; from the
// second round on, one checks only what changed since a round passed it,
// so no round re-judges what an earlier one passed unchanged.
//
// A topic's record (directive 079, ledger-carry.cjs): the note beside the
// record its verifier is briefed on keeps each entry hashed, its keys
// sorted, and its event, text and cites; and each section of the walk
// sheet the verifier walks, with the entries citing it — and what the
// rounds before it left: the record the last verifier to write read, each
// entry a verifier passed, `{ref}: ok` with its hash then and never
// `{ref}: see finding` since, and every section walked. A round counts
// once its verifier has written its findings; one briefed and never
// written counts for nothing. From the second round the walk sheet marks
// each entry passed (passed in an earlier round, unchanged since),
// changed, new, or unpassed (unchanged since a round that did not pass
// it), and each section closed — walked before, every entry citing it
// passed, none that cited it then gone — or open; and it lists each entry
// the last record read held and this one does not, removed since the last
// round, with its event, text and cites, so no entry leaves unseen with
// the sections only it cited. The verifier gives a verdict on each entry
// not passed, and walks the open sections alone.
//
// A phase's piece (directive 080, cut-merges.cjs): the piece each verifier
// reads is kept beside it as its brief is issued, `phases/{N}.verifying.json`,
// and becomes the piece verified, `phases/{N}.verified.json`, once that
// verifier has written its findings. The next brief draws what changed
// since the piece verified: the phase's own fields, and each scenario, note
// and correction added or removed.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');

/** @param {unknown} value @returns {unknown} */
function sortedKeys(value) {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedKeys(/** @type {Record<string, unknown>} */ (value)[key])]));
}

/** Each entry of a record by its ref, hashed, its keys sorted. @param {Record<string, unknown>[]} entries @returns {Record<string, string>} */
const entryHashes = (entries) => Object.fromEntries(entries.map((entry) => [String(entry.ref), crypto.createHash('sha256').update(JSON.stringify(sortedKeys(entry))).digest('hex')]));

/** @typedef {{event: string, text: string, cites: {path: string, section: string}[]}} Held */

/** Each entry of a record by its ref, as a later round shows it removed: its event, text and cites. @param {Record<string, any>[]} entries @returns {Record<string, Held>} */
const entriesHeld = (entries) => Object.fromEntries(entries.map((entry) => [String(entry.ref), {
  event: String(entry.event),
  text: typeof entry.text === 'string' ? entry.text : '',
  cites: Array.isArray(entry.cites) ? entry.cites.map((cite) => ({ path: String(cite?.path), section: String(cite?.section) })) : [],
}]));

/**
 * What the rounds before a verifier left: the record the last verifier to
 * write read, each entry by its hash, null before any did, and each as
 * held; each entry a round passed, with its hash then; and each section
 * walked, with the entries citing it then.
 * @typedef {{entries: Record<string, string>|null, held: Record<string, Held>, passed: Record<string, string>, walked: Record<string, string[]>}} Past
 */

/**
 * The note beside a record its verifier is briefed on: the record's hash,
 * the refs it gives a verdict on, each entry hashed and as held, the
 * sections it walks, and what the rounds before it left; or, `settled`,
 * the record as the session passed it, settling a late round's findings
 * (ledger-settle.cjs).
 * @typedef {{hash: string, refs: string[], entries: Record<string, string>, held: Record<string, Held>, sections: Record<string, string[]>, before: Past, settled?: true}} Note
 */

/** Before any round. @type {Past} */
const FIRST = Object.freeze({ entries: null, held: {}, passed: {}, walked: {} });

/**
 * What the rounds so far left, from the last verifier's note and its
 * verdicts, each ref's `ok` or not — null where it wrote no findings, so
 * its round counts for nothing. An entry its brief asked of is passed on
 * its `ok`; any entry it names `see finding`, asked of or not, is not.
 * @param {Note|null} note @param {Map<string, boolean>|null} verdicts @returns {Past}
 */
function pastOf(note, verdicts) {
  if (note === null) return FIRST;
  if (verdicts === null) return note.before;
  const passed = { ...note.before.passed };
  for (const ref of note.refs) {
    if (verdicts.get(ref) === true) passed[ref] = note.entries[ref];
    else delete passed[ref];
  }
  for (const [ref, ok] of verdicts) if (!ok) delete passed[ref];
  return { entries: note.entries, held: note.held, passed, walked: { ...note.before.walked, ...note.sections } };
}

/** @typedef {'passed'|'changed'|'new'|'unpassed'|null} EntryMark */
/** @typedef {{ref: string, event: string, text: string}} SheetEntry */
/** @typedef {{section: string, line: number, end: number, entries: SheetEntry[]}} SheetSection */
/** @typedef {{path: string, sections: SheetSection[]}} SheetFile */
/** @typedef {{section: string, line: number, end: number, closed: boolean, entries: (SheetEntry & {mark: EntryMark})[]}} MarkedSection */

/** A section of the sheet as the note keys it. @param {string} at @param {SheetSection} section */
const sectionKey = (at, { line, section }) => `${at}\n${line}\n${section}`;

/**
 * The walk sheet marked against the rounds before: each entry and each
 * section, none in a first round; the refs of the entries asked a verdict
 * of, in the record's order; each section walked, with the entries citing
 * it; and each entry the last record read held and this one does not, in
 * that record's order.
 * @param {SheetFile[]} sheet @param {Record<string, string>} hashes the record's, in its order @param {Past} past
 * @returns {{sheet: {path: string, sections: MarkedSection[]}[], asked: string[], sections: Record<string, string[]>, removed: (Held & {ref: string})[]}}
 */
function markedSheet(sheet, hashes, past) {
  const before = past.entries;
  /** @type {(ref: string) => EntryMark} */
  const markOf = (ref) => {
    if (before === null) return null;
    if (past.passed[ref] === hashes[ref]) return 'passed';
    if (!Object.hasOwn(before, ref)) return 'new';
    return before[ref] === hashes[ref] ? 'unpassed' : 'changed';
  };
  /** @type {Record<string, string[]>} */
  const sections = {};
  const marked = sheet.map(({ path: at, sections: held }) => ({
    path: at,
    sections: held.map((section) => {
      const key = sectionKey(at, section);
      const refs = section.entries.map(({ ref }) => ref);
      const walked = past.walked[key];
      const closed = walked !== undefined && refs.every((ref) => markOf(ref) === 'passed') && walked.every((ref) => refs.includes(ref));
      if (!closed) sections[key] = refs;
      return { ...section, closed, entries: section.entries.map((entry) => ({ ...entry, mark: markOf(entry.ref) })) };
    }),
  }));
  const removed = Object.keys(before ?? {}).filter((ref) => !Object.hasOwn(hashes, ref)).map((ref) => ({ ref, ...past.held[ref] }));
  return { sheet: marked, asked: Object.keys(hashes).filter((ref) => markOf(ref) !== 'passed'), sections, removed };
}

/**
 * What changed in a piece since the one its last verifier read: each field
 * of its phase changed, then each scenario, note and correction added or
 * removed; none where nothing did.
 * @param {Record<string, any>} before @param {Record<string, any>} now @returns {string[]}
 */
function pieceChanges(before, now) {
  const shown = (/** @type {unknown} */ value) => (typeof value === 'string' ? value : JSON.stringify(sortedKeys(value)));
  const fields = [...new Set([...Object.keys(before.phase ?? {}), ...Object.keys(now.phase ?? {})])]
    .filter((field) => JSON.stringify(sortedKeys(before.phase?.[field])) !== JSON.stringify(sortedKeys(now.phase?.[field])))
    .map((field) => `- The phase's ${field}: was ${shown(before.phase?.[field]) ?? 'none'}, now ${shown(now.phase?.[field]) ?? 'none'}`);
  const listed = (/** @type {string} */ part, /** @type {string} */ one) => {
    const was = (Array.isArray(before[part]) ? before[part] : []).map(shown);
    const is = (Array.isArray(now[part]) ? now[part] : []).map(shown);
    return [...is.filter((line) => !was.includes(line)).map((line) => `- A ${one} added: ${line}`), ...was.filter((line) => !is.includes(line)).map((line) => `- A ${one} removed: ${line}`)];
  };
  return [...fields, ...listed('scenarios', 'scenario'), ...listed('notes', 'note'), ...listed('corrections', 'correction')];
}

/** A file's JSON, or null where it is none. @param {string} file @returns {any} */
const jsonAt = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

/**
 * The piece the last verifier to write read: the one its brief was issued
 * on where it has written its findings since, else the one verified
 * before; null before any verifier wrote.
 * @param {{findings: string, verifying: string, verified: string}} files absolute
 */
const pieceVerified = ({ findings, verifying, verified }) => jsonAt(fs.existsSync(findings) && fs.existsSync(verifying) ? verifying : verified);

/**
 * The piece a verifier is briefed on kept beside it, the one the last
 * verifier read becoming the piece verified where it wrote its findings.
 * Run before that verifier's round is kept and cleared.
 * @param {{piece: string, findings: string, verifying: string, verified: string}} files absolute
 */
function notePiece({ piece, findings, verifying, verified }) {
  if (fs.existsSync(findings) && fs.existsSync(verifying)) fs.renameSync(verifying, verified);
  fs.copyFileSync(piece, verifying);
}

module.exports = { entryHashes, entriesHeld, pastOf, markedSheet, pieceChanges, pieceVerified, notePiece };
