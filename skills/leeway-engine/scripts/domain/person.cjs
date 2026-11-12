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
// - Its layout (P5): a title; a section an entry, headed by the
//   preference's words, holding a `Why:` paragraph and an `Examples:` list;
//   and last a `Care entries` section, a line an entry,
//   `- {project}: {kind} · {project id}`. The id keys the entry, so a
//   renamed folder keeps its entries (16.13.5); the name beside it, the
//   project's as the entry was added, is for reading. A care entry names a
//   kind the rule asks by: never danger, which always asks (16.5.1, F3).
// - A file that does not read as this layout is refused, naming the file and
//   the line, never read in part or written over: a hand edit gone wrong is
//   the person's to put right. What reads is written back whole, in the
//   layout, a wrapped line joined.
// - A read takes no lock; a change holds a lock of its own beside the file,
//   reads the record again under it, and writes it whole.
// - The care entries feed the ask rule (decision-point.cjs): a kind under a
//   care entry in a project always asks there (16.5.2), and only there
//   (16.5.3).
// - The drop's cue (16.5.4, P6): the person's "don't care" answers to a
//   kind's questions in one project, in a row — an answer to it otherwise,
//   or a reversal of one, breaks the run; one they didn't follow, and
//   Claude's own call, do neither — read from that project's evidence alone
//   (trust-evidence.cjs), never another's (16.18.7). Each run of
//   DONT_CARES in a row on a kind under a care entry there cues Claude to
//   propose dropping the entry.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { systemConfigDir } = require('../kernel/system-config.cjs');
const { LOCK_TIMEOUT_MS, writeTextAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { isId } = require('./ledger-ids.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { PERSON } = require('./user-files.cjs');

/** @typedef {import('./event-fields.cjs').Kind} Kind */
/** @typedef {import('./trust-evidence.cjs').Answer} Answer */
/** A preference in the record: its words, why, and its examples, one at least. @typedef {{preference: string, why: string, examples: string[]}} Preference */
/** A care entry: the project's id, its name as the entry was added, and the kind that always asks there. @typedef {{project: string, name: string, kind: Kind}} Care */
/** The record: its preferences, then its care entries, each in the order kept. @typedef {{preferences: Preference[], care: Care[]}} PersonRecord */

// The kinds a care entry may name, in the order the kind pick lists them
// (16.5.6, F3): danger is left out, as it always asks.
const CARE_KINDS = Object.freeze(/** @type {Kind[]} */ (['contract', 'scope', 'behaviour', 'look', 'words', 'process', 'internals']));

// How many "don't care" answers in a row cue the drop (16.5.6, P6).
const DONT_CARES = 3;

const TITLE = '# The record of you';
const CARE = 'Care entries';
const HEADING = /^## (.*)$/;
const CARE_LINE = /^- (.+): ([a-z]+) · (\S+)$/;
const WHY = /^Why:(.*)$/;
const EXAMPLES = 'Examples:';
const ITEM = /^- (.*)$/;
const RECORD_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the record of the person' };

/** The record's file. */
function personPath() {
  return path.join(systemConfigDir(), PERSON);
}

/** A section of the file as read: its heading, the line it stands on, and its lines that are not blank. @typedef {{heading: string, at: number, body: {line: string, at: number}[]}} Section */
/** @typedef {(at: number, why: string) => never} Refuse */

/**
 * The file's sections, the title alone before the first.
 * @param {string} text @param {Refuse} refuse @returns {Section[]}
 */
function sectionsOf(text, refuse) {
  /** @type {Section[]} */
  const sections = [];
  let titled = false;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    const at = i + 1;
    const heading = HEADING.exec(line);
    if (heading !== null) {
      if (heading[1].trim() === '') refuse(at, 'a section is headed by its words');
      sections.push({ heading: heading[1].trim(), at, body: [] });
    } else if (sections.length > 0) {
      if (line.trim() !== '') sections[sections.length - 1].body.push({ line, at });
    } else if (line !== '' && (titled || !line.startsWith('# '))) {
      refuse(at, 'only the title comes before the first section');
    } else if (line !== '') {
      titled = true;
    }
  });
  return sections;
}

/**
 * A preference's section read: its `Why:`, run on over the lines before
 * `Examples:`, then each `- ` example, a line indented under it running it
 * on.
 * @param {Section} section @param {Refuse} refuse @returns {Preference}
 */
function preferenceOf({ heading, at, body }, refuse) {
  /** @type {string|null} */
  let why = null;
  /** @type {string[]|null} */
  let examples = null;
  for (const { line, at: n } of body) {
    if (examples !== null) {
      const item = ITEM.exec(line);
      if (item !== null && item[1].trim() !== '') examples.push(item[1].trim());
      else if (item === null && examples.length > 0 && /^\s/.test(line)) examples[examples.length - 1] += ` ${line.trim()}`;
      else refuse(n, `"${heading}"'s examples are a list, a line each beginning "- "`);
    } else if (why === null) {
      const said = WHY.exec(line);
      if (said === null) refuse(n, `"${heading}" opens on its Why:`);
      why = said[1].trim();
    } else if (line.trim() === EXAMPLES) {
      examples = [];
    } else {
      why = `${why} ${line.trim()}`;
    }
  }
  if (why === null || why === '') refuse(at, `"${heading}" says no Why:`);
  if (examples === null || examples.length === 0) refuse(at, `"${heading}" gives no Examples:`);
  return { preference: heading, why: /** @type {string} */ (why), examples: /** @type {string[]} */ (examples) };
}

/**
 * The care entries' section read, a line an entry.
 * @param {Section} section @param {Refuse} refuse @returns {Care[]}
 */
function careOf({ body }, refuse) {
  return body.map(({ line, at }) => {
    const entry = CARE_LINE.exec(line);
    if (entry === null) return refuse(at, 'a care entry reads "- {project}: {kind} · {project id}"');
    const [, name, kind, project] = entry;
    if (!CARE_KINDS.includes(/** @type {Kind} */ (kind))) refuse(at, `"${kind}" is no kind a care entry names — ${CARE_KINDS.join(', ')}`);
    if (!isId(project)) refuse(at, `"${project}" is no project's id`);
    return { project, name: name.trim(), kind: /** @type {Kind} */ (kind) };
  });
}

/**
 * The record `text` holds, its file `file`. Refuses, naming the file and the
 * line, what does not read as the record's layout: anything but the title
 * before the first section, a preference with no Why: or no examples, a
 * care entry of another shape, naming another kind or no project's id, and
 * a preference, a care entries section or a care entry held twice.
 * @param {string} text @param {string} file @returns {PersonRecord}
 */
function parseRecord(text, file) {
  /** @type {Refuse} */
  const refuse = (at, why) => {
    throw new Error(`the record of the person, ${file}, does not read at line ${at}: ${why} — it holds its title, a section a preference with its Why: and its Examples:, then a "${CARE}" section, each "- {project}: {kind} · {project id}"; put it right by hand, or move it aside to start the record again`);
  };
  /** @type {PersonRecord} */
  const record = { preferences: [], care: [] };
  let cared = false;
  for (const section of sectionsOf(text, refuse)) {
    if (section.heading === CARE) {
      if (cared) refuse(section.at, `the record holds one "${CARE}" section`);
      cared = true;
      careOf(section, refuse).forEach((entry, i) => {
        if (record.care.some(({ project, kind }) => project === entry.project && kind === entry.kind)) refuse(section.body[i].at, `it holds ${entry.name}: ${entry.kind} twice`);
        record.care.push(entry);
      });
    } else {
      if (record.preferences.some(({ preference }) => preference === section.heading)) refuse(section.at, `it holds "${section.heading}" twice`);
      record.preferences.push(preferenceOf(section, refuse));
    }
  }
  return record;
}

/** The record as its file holds it, in its layout. @param {PersonRecord} record */
function recordText({ preferences, care }) {
  const sections = [
    ...preferences.map(({ preference, why, examples }) => [`## ${preference}`, '', `Why: ${why}`, '', EXAMPLES, ...examples.map((example) => `- ${example}`)]),
    ...(care.length === 0 ? [] : [[`## ${CARE}`, '', ...care.map(({ name, kind, project }) => `- ${name}: ${kind} · ${project}`)]]),
  ];
  return `${[[TITLE], ...sections].map((lines) => lines.join('\n')).join('\n\n')}\n`;
}

/** Whether the record holds no entry at all. @param {PersonRecord} record */
const isEmpty = ({ preferences, care }) => preferences.length === 0 && care.length === 0;

/** The record as it stands: empty where it has no file. Refuses a file that does not read. @returns {PersonRecord} */
function readRecord() {
  const file = personPath();
  return fs.existsSync(file) ? parseRecord(fs.readFileSync(file, 'utf8'), file) : { preferences: [], care: [] };
}

/**
 * The record changed by `change`, under its lock, read again under it: the
 * record `change` answers written whole — its file gone once it holds no
 * entry — and what `change` answered beside it.
 * @template T
 * @param {(record: PersonRecord) => {record: PersonRecord, answer: T}} change
 * @returns {T}
 */
function changeRecord(change) {
  const file = personPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withStateLockFile(`${file}.lock`, () => {
    const { record, answer } = change(readRecord());
    if (isEmpty(record)) fs.rmSync(file, { force: true });
    else writeTextAtomic(file, recordText(record));
    return answer;
  }, RECORD_LOCK);
}

/** The care entries standing in the project `project`, by its id. @param {PersonRecord} record @param {string} project */
function careIn({ care }, project) {
  return care.filter((entry) => entry.project === project);
}

/** Every care entry, each project's, as the ask rule reads them (16.5.2). @returns {Care[]} */
function careEntries() {
  return readRecord().care;
}

/** The record's file, where it holds a preference to shape what Claude picks (16.18.4), else null. @returns {string|null} */
function recordToRead() {
  return readRecord().preferences.length > 0 ? personPath() : null;
}

/**
 * How many "don't care" answers to `kind`'s questions run in a row as the
 * last, of `answers` — one project's evidence (the header's).
 * @param {Answer[]} answers @param {Kind} kind @returns {number}
 */
function dontCareRun(answers, kind) {
  const timed = answers.filter((answer) => answer.kind === kind && answer.standing !== 'no-weight' && answer.standing !== 'call')
    .sort((a, b) => Date.parse(/** @type {string} */ (a.event.at)) - Date.parse(/** @type {string} */ (b.event.at)));
  return timed.reduce((run, { event }) => (event.type === 'raise' && event.dont_care === true ? run + 1 : 0), 0);
}

/**
 * The cue to propose dropping the care entry on `kind` in the project whose
 * state is at `root`, its id `project` (the header's), of the care entries
 * `care`: the entry, by the project's name `name`, and how many "don't
 * care" answers ran in a row — or null where none stands, or the run is no
 * multiple of DONT_CARES.
 * @param {string} root @param {{id: string, name: string}} project @param {Kind|null} kind @param {Care[]} care
 * @returns {{care: string, kind: Kind, dont_cares: number}|null}
 */
function dropCue(root, { id, name }, kind, care) {
  if (kind === null || !care.some((entry) => entry.project === id && entry.kind === kind)) return null;
  const run = dontCareRun(evidenceOf(root).answers, kind);
  return run > 0 && run % DONT_CARES === 0 ? { care: `${name}: ${kind}`, kind, dont_cares: run } : null;
}

module.exports = {
  CARE_KINDS, DONT_CARES, personPath, parseRecord, recordText, readRecord, changeRecord, careIn, careEntries, recordToRead, dontCareRun, dropCue,
};
