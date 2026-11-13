'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the record of the person (16.18) — the person's preferences
// in words, each with its reason and examples, and their care entries
// (16.5.2): `person.md` in the system config directory (4.11.14, 16.18.8),
// one record across every project on the machine, never a project's
// (16.18.6). It ships empty, no file at all, and its file goes with its last
// entry (16.18.5). Only the engine writes it, and only on the person's yes
// (16.13.2, 16.18.2, person-verbs.cjs); the layout hook refuses Claude's own
// writes to it (user-files.cjs).
//
// - Its layout (P5): the version line,
//   `<!-- leeway: the record of you, version N -->`; the title; a section a
//   preference, headed by its words, holding its `Why:` and its `Examples:`
//   list; and a `Care entries` section, a line an entry,
//   `- {project}: {kind} · {project id} · {added}`. The id keys the entry,
//   so a renamed folder keeps its entries (16.13.5); the name beside it, the
//   project's as the entry was added, is for reading; `added`, the time it
//   was added, is where the drop's cue starts counting. A care entry names a
//   kind the rule asks by: never danger, which always asks (16.5.1, F3).
// - The engine reads the care entries and the preferences' headings alone;
//   the prose reads the preferences as text (16.18.4). A preference's
//   section is the person's as they wrote it — however they word, list or
//   annotate it — and so is whatever stands before the first section: read
//   by its heading, and written back unchanged unless it is the preference
//   kept or dropped. Only the care entries are read strictly: a care
//   section that does not read refuses the verbs that read care entries,
//   naming the file and the line for the person to put right.
// - One file serves every project, and each project runs its own release of
//   the engine, so engines of several releases read and write it. The
//   version line names the layout the file holds, and its own shape never
//   changes; a file with none is read as this version. A record of a newer
//   version than this engine's is never written: its care entries are read
//   where their lines parse as this version's, the rest skipped, and a
//   change refuses, telling the person to update Leeway.
// - A read takes no lock; a change holds a lock of its own beside the file,
//   reads the record again under it, and writes it whole.
// - The care entries feed the ask rule (decision-point.cjs): a kind under a
//   care entry in a project always asks there (16.5.2), and only there
//   (16.5.3).
// - The drop's cue (16.5.4, P6): the person's "don't care" answers to a
//   kind's questions in one project, given since its care entry there was
//   added, in a row, a blind question's among them though it weighs
//   nothing — an answer to it otherwise, or a reversal of one, breaks the
//   run; one they didn't follow, and Claude's own call, do neither — read
//   from that project's evidence alone (trust-evidence.cjs), never
//   another's (16.18.7). Each run of DONT_CARES in a row cues Claude to
//   propose dropping the entry.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { LOCK_TIMEOUT_MS, writeTextAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { TIME, CARE_KINDS } = require('./event-fields.cjs');
const { isId } = require('./ledger-ids.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { PERSON } = require('./user-files.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./trust-evidence.cjs').Answer} Answer */
/** A preference as it is kept: its words, why, and its examples, one at least. @typedef {{preference: string, why: string, examples: string[]}} Preference */
/** A care entry: the project's id, its name as the entry was added, the kind that always asks there, and when it was added. @typedef {{project: string, name: string, kind: Kind, added: string}} Care */
/** A section as the file holds it: its heading's words, the line the heading stands on (0 for one not yet written), and its lines under the heading as written. @typedef {{heading: string, at: number, lines: string[]}} Section */
/** The record: the version of its layout, what stands before its first section but the version line, as written, and its sections in order, the care entries' among them. @typedef {{version: number, head: string[], sections: Section[]}} PersonRecord */

// The layout this engine reads and writes (P5).
const VERSION = 1;

// How many "don't care" answers in a row cue the drop (16.5.6, P6).
const DONT_CARES = 3;

const TITLE = '# The record of you';
const CARE = 'Care entries';
const VERSION_LINE = /^<!-- leeway: the record of you, version (\d+) -->$/;
const HEADING = /^## +(\S.*?)\s*$/;
const CARE_LINE = /^- (.+): ([a-z]+) · (\S+) · (\S+)$/;
const CARE_SHAPE = '"- {project}: {kind} · {project id} · {when added}"';
const RECORD_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the record of the person' };

/** The record's file. */
function personPath() {
  return path.join(systemConfigDir(), PERSON);
}

/** The version line of the layout `version`. @param {number} version */
const versionLine = (version) => `<!-- leeway: the record of you, version ${version} -->`;

/** The record as it ships: no entry, the title alone. @returns {PersonRecord} */
const shipped = () => ({ version: VERSION, head: [TITLE], sections: [] });

/**
 * The record `text` holds: its version — this one's where it names none —
 * what stands before its first section, and each section by its heading.
 * Never refused: only its care entries are read strictly (careOf).
 * @param {string} text @returns {PersonRecord}
 */
function parseRecord(text) {
  /** @type {PersonRecord} */
  const record = { version: VERSION, head: [], sections: [] };
  text.replace(/\r\n/g, '\n').split('\n').forEach((line, i) => {
    const heading = HEADING.exec(line);
    const version = VERSION_LINE.exec(line.trim());
    if (heading !== null) record.sections.push({ heading: heading[1], at: i + 1, lines: [] });
    else if (record.sections.length > 0) record.sections[record.sections.length - 1].lines.push(line);
    else if (version !== null) record.version = Number(version[1]);
    else record.head.push(line);
  });
  return record;
}

/** Whether `line` is blank. @param {string} line */
const blank = (line) => line.trim() === '';

/** `lines` without the blank lines that end them. @param {string[]} lines */
function untailed(lines) {
  let end = lines.length;
  while (end > 0 && blank(lines[end - 1])) end -= 1;
  return lines.slice(0, end);
}

/** `lines` without the blank lines at either end. @param {string[]} lines */
function trimmed(lines) {
  const start = lines.findIndex((line) => !blank(line));
  return start === -1 ? [] : untailed(lines.slice(start));
}

/**
 * The record as its file holds it: this engine's version line, then what
 * stands before the first section and each section as written, a blank
 * line between each.
 * @param {PersonRecord} record
 */
function recordText({ head, sections }) {
  const blocks = [[versionLine(VERSION)], trimmed(head), ...sections.map(({ heading, lines }) => [`## ${heading}`, ...untailed(lines)])];
  return `${blocks.filter((block) => block.length > 0).map((block) => block.join('\n')).join('\n\n')}\n`;
}

/** Whether the record holds nothing of the person's: no section, and nothing before one but a title. @param {PersonRecord} record */
const isEmpty = ({ head, sections }) => sections.length === 0 && head.every((line) => blank(line) || line.startsWith('# '));

/** The record as it stands: as it shipped where it has no file. @returns {PersonRecord} */
function readRecord() {
  const file = personPath();
  return fs.existsSync(file) ? parseRecord(fs.readFileSync(file, 'utf8')) : shipped();
}

/**
 * Refuse a change to `record`, its file `file`, where a newer release of
 * the engine wrote it, in a layout this one would write over.
 * @param {PersonRecord} record @param {string} [file]
 */
function checkWritable({ version }, file = personPath()) {
  if (version > VERSION) throw new Error(`the record of the person, ${file}, was written by a newer Leeway, in its layout version ${version} — this one writes version ${VERSION}, so it changes nothing there: update Leeway in this project to change the record; its care entries still count meanwhile`);
}

/**
 * The record changed by `change`, under its lock, read again under it: the
 * record `change` answers written whole — its file gone once it holds
 * nothing of the person's — and what `change` answered beside it. Refuses
 * a record a newer release wrote.
 * @template T
 * @param {(record: PersonRecord) => {record: PersonRecord, answer: T}} change
 * @returns {T}
 */
function changeRecord(change) {
  const file = personPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withStateLockFile(`${file}.lock`, () => {
    const read = readRecord();
    checkWritable(read, file);
    const { record, answer } = change(read);
    if (isEmpty(record)) fs.rmSync(file, { force: true });
    else writeTextAtomic(file, recordText(record));
    return answer;
  }, RECORD_LOCK);
}

/**
 * A care entry's line read: the entry, or why it does not read.
 * @param {string} line @returns {Care|string}
 */
function careLine(line) {
  const read = CARE_LINE.exec(line.trimEnd());
  if (read === null) return `a care entry reads ${CARE_SHAPE}`;
  const [, name, kind, project, added] = read;
  if (!CARE_KINDS.includes(/** @type {Kind} */ (kind))) return `"${kind}" is no kind a care entry names — ${CARE_KINDS.join(', ')}`;
  if (!isId(project)) return `"${project}" is no project's id`;
  if (!TIME.test(added)) return `"${added}" is no time it was added`;
  return { project, name: name.trim(), kind: /** @type {Kind} */ (kind), added };
}

/**
 * The care entries `record` holds, its file `file`. Of this version, or
 * none named, read strictly: refused, naming the file and the line, are a
 * second care entries section, a line of another shape, naming another
 * kind, no project's id or no time it was added, and an entry held twice.
 * Of a newer version, read where a line parses as this version's, the rest
 * skipped.
 * @param {PersonRecord} record @param {string} [file] @returns {Care[]}
 */
function careOf(record, file = personPath()) {
  const strict = record.version <= VERSION;
  /** @type {(at: number, why: string) => void} */
  const refuse = (at, why) => {
    if (strict) throw new Error(`the record of the person, ${file}, does not read at line ${at}: ${why} — its care entries are one "${CARE}" section, a line each, ${CARE_SHAPE}; put the line right by hand`);
  };
  const sections = record.sections.filter(({ heading }) => heading === CARE);
  if (sections.length > 1) refuse(sections[1].at, `it holds one "${CARE}" section`);
  /** @type {Care[]} */
  const care = [];
  for (const { at, lines } of sections) {
    lines.forEach((line, i) => {
      if (blank(line)) return;
      const read = careLine(line);
      if (typeof read === 'string') refuse(at + 1 + i, read);
      else if (care.some(({ project, kind }) => project === read.project && kind === read.kind)) refuse(at + 1 + i, `it holds ${read.name}: ${read.kind} twice`);
      else care.push(read);
    });
  }
  return care;
}

/** Whether the record holds the preference `words`. @param {PersonRecord} record @param {string} words */
const holdsPreference = ({ sections }, words) => sections.some(({ heading }) => heading === words);

/**
 * The record with the preference kept, written as the engine writes one,
 * after the rest and before the care entries.
 * @param {PersonRecord} record @param {Preference} preference @returns {PersonRecord}
 */
function withPreference(record, { preference, why, examples }) {
  const section = { heading: preference, at: 0, lines: ['', `Why: ${why}`, '', 'Examples:', ...examples.map((example) => `- ${example}`)] };
  const care = record.sections.findIndex(({ heading }) => heading === CARE);
  const at = care === -1 ? record.sections.length : care;
  return { ...record, sections: [...record.sections.slice(0, at), section, ...record.sections.slice(at)] };
}

/** The record with the preference `words` dropped. @param {PersonRecord} record @param {string} words @returns {PersonRecord} */
function withoutPreference(record, words) {
  return { ...record, sections: record.sections.filter(({ heading }) => heading !== words) };
}

/**
 * The record holding the care entries `care` in its care entries' section,
 * where it stands, or after the rest — no section where there are none.
 * @param {PersonRecord} record @param {Care[]} care @returns {PersonRecord}
 */
function withCare(record, care) {
  const others = record.sections.filter(({ heading }) => heading !== CARE);
  if (care.length === 0) return { ...record, sections: others };
  const section = { heading: CARE, at: 0, lines: ['', ...care.map(({ name, kind, project, added }) => `- ${name}: ${kind} · ${project} · ${added}`)] };
  if (others.length === record.sections.length) return { ...record, sections: [...others, section] };
  return { ...record, sections: record.sections.map((held) => (held.heading === CARE ? section : held)) };
}

/** The care entries standing in the project `project`, by its id. @param {Care[]} care @param {string} project */
function careIn(care, project) {
  return care.filter((entry) => entry.project === project);
}

/** Every care entry, each project's, as the ask rule reads them (16.5.2). @returns {Care[]} */
function careEntries() {
  return careOf(readRecord());
}

/** The record's file wherever it stands, for the prose to read (16.18.4) — never read here — else null. @returns {string|null} */
function recordToRead() {
  const file = personPath();
  return fs.existsSync(file) ? file : null;
}

/**
 * Whether an answer the evidence holds is the person's to a question:
 * one that weighs as theirs, or their "don't care", a blind question's
 * weighing nothing.
 * @param {Answer} answer
 */
function answeredOn({ standing, event }) {
  return event.dont_care === true || (standing !== 'no-weight' && standing !== 'call');
}

/**
 * How many "don't care" answers to `kind`'s questions run in a row as the
 * last, of `answers` given after `since` — one project's evidence (the
 * header's).
 * @param {Answer[]} answers @param {Kind} kind @param {string} since @returns {number}
 */
function dontCareRun(answers, kind, since) {
  const from = Date.parse(since);
  const at = (/** @type {Answer} */ answer) => Date.parse(/** @type {string} */ (answer.event.at));
  const timed = answers.filter((answer) => answer.kind === kind && answeredOn(answer) && at(answer) > from)
    .sort((a, b) => at(a) - at(b));
  return timed.reduce((run, { event }) => (event.type === 'raise' && event.dont_care === true ? run + 1 : 0), 0);
}

/**
 * The cue to propose dropping the care entry on `kind` in the project whose
 * state is at `root` (the header's), of the care entries `care`: the entry,
 * by the project's name now, `name`, and how many "don't care" answers ran
 * in a row since it was added — or null where none stands, or the run is
 * no multiple of DONT_CARES.
 * @param {string} root @param {{id: string, name: string}} project @param {Kind|null} kind @param {Care[]} care
 * @returns {{care: string, kind: Kind, dont_cares: number}|null}
 */
function dropCue(root, { id, name }, kind, care) {
  const entry = careIn(care, id).find((held) => held.kind === kind);
  if (entry === undefined) return null;
  const run = dontCareRun(evidenceOf(root).answers, entry.kind, entry.added);
  return run > 0 && run % DONT_CARES === 0 ? { care: `${name}: ${entry.kind}`, kind: entry.kind, dont_cares: run } : null;
}

module.exports = {
  CARE, personPath, readRecord, checkWritable, changeRecord, careOf, holdsPreference, withPreference, withoutPreference, withCare, careIn,
  careEntries, recordToRead, dropCue,
};
