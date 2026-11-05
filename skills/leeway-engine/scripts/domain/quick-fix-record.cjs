'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's short record after the work (19.5.6, 19.5.17)
// — `quick-fix record <unit> <task> --file <record.md>` — and what its
// close stands on of its fixes (finish.cjs).
//
// The record's file is markdown under three level-two headings, in this
// order, and no other heading at level one or two: `## What changed`,
// `## Why` and `## Leaves out`, none empty. The verb writes it into the
// unit's `summary.md`, a file only the engine writes (layout.cjs), after
// every record before it — each written once its fix is done, so in the
// order the fixes landed — under the fix's title as the tracker holds it,
// a heading of its own, each section an item, its lines after the first
// beneath it:
//
//   ## {fix title}
//
//   - What changed: …
//   - Why: …
//   - Leaves out: …
//
// It commits `summary.md` alone, then indexes it where this checkout's
// knowledge base is set up, each fix's record a chunk of its own
// (knowledge/artifacts.cjs), an index that fails a warning. It refuses,
// writing and committing nothing, every refusal opening `quick-fix record:
// `: a unit the project lacks or holds not in progress; one that is no
// quick-fix built by its own arm (`quickFixBuild`, derivations.cjs) — a
// quick-fix today's scoping made among them; a task that is none of its
// fixes, phase 1's, or one the tracker lacks; a fix not done; a fix whose
// record is written already, its title a heading of `summary.md`; and a
// file that does not read as a record, every fault named.
//
// The close stands on every fix ended, done or closed, and each fix done
// with its record written (`recordedFixes`). Known edge: a record is found
// by its fix's title, so of two fixes with one title the second's is
// refused as written already.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { knowledgeFiles } = require('../kernel/knowledge/files.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { unitInProgress } = require('./topic-standing.cjs');
const { quickFixBuild, buildRefusal, FIXES_PHASE } = require('./derivations.cjs');
const { parseShownTask, shownTask, taskId, taskName } = require('./task-id.cjs');
const { trackedTask, copiedTasks, givenText, ENDED, STATUS_WORDS } = require('./task-verbs.cjs');
const { headingLevels } = require('./spec-sections.cjs');
const { committed } = require('./task-account.cjs');
const { refusing } = require('./staged-payload.cjs');
const { summaryFile } = require('./knowledge/artifacts.cjs');
const { syncKnowledge } = require('./knowledge/sync.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */

const QUICK_FIX_USAGE = 'quick-fix record <work-unit> <task> --file <record.md>';

/** A record's sections, as their headings read, in order. */
const RECORD_SECTIONS = Object.freeze(['What changed', 'Why', 'Leaves out']);

/** Each line's level-two heading's title, by its line, a fenced line never one. @param {string[]} lines @returns {Map<number, string>} */
function levelTwo(lines) {
  const levels = headingLevels(lines);
  return new Map(lines.flatMap((line, at) => (levels[at] === 2 ? [[at, line.replace(/^#+[ \t]*/, '').trim()]] : [])));
}

/**
 * A record's file read by its grammar (the header's): each section's text by
 * its heading, trimmed. Refused where it does not read, every fault named.
 * @param {string} text @returns {Record<string, string>}
 */
function readRecord(text) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const headings = levelTwo(lines);
  const starts = [...headings.keys()];
  /** @type {string[]} */
  const faults = [];
  if (headingLevels(lines).includes(1)) faults.push('it holds a level-one heading — the fix\'s title heads its record in summary.md');
  if (lines.slice(0, starts[0] ?? lines.length).some((line) => line.trim() !== '')) faults.push(`it opens with \`## ${RECORD_SECTIONS[0]}\``);
  if ([...headings.values()].join('\n') !== RECORD_SECTIONS.join('\n')) {
    faults.push(`its sections are ${RECORD_SECTIONS.map((title) => `\`## ${title}\``).join(', ')}, in that order, and no other at level two`);
    throw new Error(faults.join('; '));
  }
  const bodies = starts.map((at, i) => lines.slice(at + 1, starts[i + 1] ?? lines.length).join('\n').trim());
  faults.push(...RECORD_SECTIONS.flatMap((title, i) => (bodies[i] === '' ? [`## ${title} is empty`] : [])));
  if (faults.length > 0) throw new Error(faults.join('; '));
  return Object.fromEntries(RECORD_SECTIONS.map((title, i) => [title, bodies[i]]));
}

/** A section as its item in `summary.md`, its lines after the first beneath it. @param {string} title @param {string} body */
function itemOf(title, body) {
  const [first, ...rest] = body.split('\n');
  return [`- ${title}: ${first}`, ...rest.map((line) => (line.trim() === '' ? '' : `  ${line}`))].join('\n');
}

/** A fix's record as `summary.md` holds it (the header's). @param {string} title @param {Record<string, string>} record */
const recordBlock = (title, record) => [`## ${title}`, '', ...RECORD_SECTIONS.map((section) => itemOf(section, record[section]))].join('\n');

/** The unit's `summary.md` as it stands, empty where none is written. @param {string} cwd @param {string} unit */
function summaryText(cwd, unit) {
  const file = statePath(cwd, summaryFile(unit));
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** The titles of the fixes whose records `summary.md` holds. @param {string} cwd @param {string} unit @returns {Set<string>} */
const recordedTitles = (cwd, unit) => new Set(levelTwo(summaryText(cwd, unit).split('\n')).values());

/**
 * The unit's manifest, refused where it is no quick-fix built by its own
 * arm.
 * @param {string} cwd @param {string} unit
 */
function quickFixOf(cwd, unit) {
  const manifest = unitInProgress(cwd, unit);
  if (quickFixBuild(manifest)) return manifest;
  throw new Error(manifest.work_type === 'quick-fix' ? /** @type {string} */ (buildRefusal(manifest)) : `${unit} is a ${manifest.work_type}, and only a quick-fix keeps a short record of each fix`);
}

/**
 * The fix the record is for, as the tracker holds it, refused where it is
 * none of the unit's fixes, not done, or its record is written already.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function doneFix(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  if (ref.phase !== FIXES_PHASE.number) throw new Error(`${taskName(ref)} is none of its fixes — a quick-fix's fixes are its phase ${FIXES_PHASE.number}, ${FIXES_PHASE.number}.n`);
  const fix = trackedTask(cwd, ref, `${taskName(ref)} is not in the tracker — its fixes are listed by task list ${unit} ${FIXES_PHASE.number}`);
  if (fix.status !== 'done') throw new Error(`${taskName(ref)} is ${STATUS_WORDS[fix.status]} — a fix's record is written once it is done: task done ${unit} ${shownTask(ref)}`);
  if (recordedTitles(cwd, unit).has(fix.title)) throw new Error(`${taskName(ref)}'s record is written already — ${summaryFile(unit)} holds \`## ${fix.title}\``);
  return { ref, fix };
}

/**
 * The record's file read as a record, refused where it does not read.
 * @param {string} cwd @param {string} file
 */
function givenRecord(cwd, file) {
  const text = givenText(cwd, file, 'record');
  try {
    return readRecord(text);
  } catch (err) {
    throw new Error(`${file} does not read as a fix's record — ${messageOf(err)}`);
  }
}

/** `summary.md` indexed, where this checkout's knowledge base is set up, a failure a warning. @param {string} cwd @param {string} unit @param {string[]} warnings */
function indexSummary(cwd, unit, warnings) {
  if (!fs.existsSync(knowledgeFiles(stateRoot(cwd)).config)) return;
  syncKnowledge(cwd, [{ index: summaryFile(unit), label: `knowledge index (${summaryFile(unit)})` }], warnings);
}

/**
 * `quick-fix record`: the fix's record written into `summary.md` after
 * every record before it, committed, and indexed.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} file
 */
function recordFix(cwd, unit, given, file) {
  quickFixOf(cwd, unit);
  const { ref, fix } = doneFix(cwd, unit, given);
  const record = givenRecord(cwd, file);
  const before = summaryText(cwd, unit).trimEnd();
  const at = statePath(cwd, summaryFile(unit));
  fs.mkdirSync(path.dirname(at), { recursive: true });
  writeTextAtomic(at, `${before === '' ? '' : `${before}\n\n`}${recordBlock(fix.title, record)}\n`);
  /** @type {string[]} */
  const warnings = [...(fix.warnings ?? [])];
  const answer = committed(cwd, [summaryFile(unit)], `quick-fix(${unit}): record ${shownTask(ref)}`, warnings, { unit, task: shownTask(ref), id: taskId(ref), summary: at });
  indexSummary(cwd, unit, warnings);
  return warnings.length > 0 ? { ...answer, warnings } : answer;
}

/**
 * The quick-fix's fixes done, each with its record written, read from a
 * copy of the tracker's store, so the board asking whether the close draws
 * never waits on a writer — refused while a fix is not ended, or one done
 * has no record, naming each and the way on.
 * @param {string} cwd @param {string} unit @returns {TaskDetail[]}
 */
function recordedFixes(cwd, unit) {
  const [fixes] = copiedTasks(cwd, unit, [FIXES_PHASE.number]);
  const open = fixes.filter(({ status }) => !ENDED.includes(status));
  if (open.length > 0) {
    const standing = open.map(({ ref, status }) => `${shownTask(ref)} is ${STATUS_WORDS[status]}`).join(', ');
    throw new Error(`${unit} closes once each of its fixes has ended — ${standing}: each is done once it lands, or closed with its reason`);
  }
  const done = fixes.filter(({ status }) => status === 'done');
  const recorded = recordedTitles(cwd, unit);
  const owed = done.filter(({ title }) => !recorded.has(title)).map(({ ref }) => shownTask(ref));
  if (owed.length > 0) {
    throw new Error(`${unit} closes once each fix done has its record — ${owed.join(', ')} ${owed.length === 1 ? 'has' : 'have'} none: quick-fix record ${unit} ${owed[0]} --file <record.md>`);
  }
  return done;
}

/**
 * `quick-fix record <unit> <task> --file <record.md>`: the verb's answer,
 * its refusal opening on its command.
 * @param {string} cwd @param {string[]} positional @param {Record<string, string>} opts
 * @returns {Record<string, unknown>}
 */
function runQuickFixVerb(cwd, [verb, ...args], opts) {
  const { file, ...rest } = opts;
  if (verb !== 'record' || args.length !== 2 || typeof file !== 'string' || Object.keys(rest).length > 0) throw new Error(`Usage: engine ${QUICK_FIX_USAGE}`);
  return refusing('quick-fix record', () => recordFix(cwd, args[0], args[1], file));
}

module.exports = { QUICK_FIX_USAGE, RECORD_SECTIONS, readRecord, recordedFixes, runQuickFixVerb };
