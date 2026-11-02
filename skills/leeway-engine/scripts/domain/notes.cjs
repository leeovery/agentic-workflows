'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the notes for later (12.10, 13.8) — what lies outside a task,
// banked as it arrives and read at a phase's end — and the consolidation
// report that reads them.
//
// `task note <unit> --file <note> [--phase N]` deposits a note into the
// unit's `build/notes.md`, the engine's alone (layout.cjs), and commits it,
// pushed (12.10.2, 6.1.7). Each note is a level-two heading, `## Note {k}`,
// numbered after the last and never reused, over its text from the file;
// one held for a phase not yet written, so that phase's task writer takes
// it, reads `## Note {k}, for phase {N}` (12.9.10). The note refuses, every
// refusal opening `task note: `: a unit the project lacks; no such file, a
// file holding nothing, or a heading at level one or two, which would read
// as another note; and for `--phase`, a unit with no cut, a phase its cut
// lacks, and a phase written in the tracker already, whose finds are tasks
// in it. It runs under the writer lock (engine.cjs); a commit git refuses is
// a warning, the note written.
//
// At a phase's end the consolidation agent reads the notes it has to take —
// those held for no phase that no other phase's report took, whatever their
// numbers, as phases run side by side and close in either order (12.6.3,
// 6.4.8) — and drops each the code settled, with its reason, or makes it a
// task in the phase (12.10.3, 12.10.4). Its report sits at
// `build/phases/phase-{N}/consolidation.md` and ends in its last section,
// `## The notes`, a list (list-items.cjs), or, where it took none, `None`
// as all the section holds:
//
//   - Note 1: dropped — {why the code settled it}
//   - Note 2, Note 4: a task — {the task's title}
//
// An item opening on `Note` or `Notes` that does not read so is refused,
// naming it, never left to read as a note not taken.
//
// A note banked after a phase's consolidation is one more the phase has to
// take, every note at its end (12.10.3): the report gains its line, the
// lines before it left as they are, and its lines are read wherever they
// come. The phase's notes are consolidated where it has none to take,
// report or not; or where its report reads, takes every one of them, takes
// none another phase's report took or held for a phase, and takes each once
// (`consolidationFaults`, for the phase close's `notes-consolidated`, 6.4.9).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { headingLevels } = require('./spec-sections.cjs');
const { BULLET, listItems, saysNone } = require('./list-items.cjs');
const { parsePhase, phaseName } = require('./task-id.cjs');
const { phaseWritten, givenText } = require('./task-verbs.cjs');

/** @typedef {{note: number, phase: number|null, text: string}} Note */
/** What a consolidation does with the notes it names. @typedef {{notes: number[], kind: 'dropped'|'task', text: string}} Taken */

const NOTE_HEADING = /^## Note ([1-9][0-9]*)(?:, for phase ([1-9][0-9]*))?$/;
const NAMED = 'Note [1-9][0-9]*';
const TAKEN = new RegExp(`^${BULLET}(${NAMED}(?:, ${NAMED})*): (dropped|a task)[ \\t]+(?:—|–|--?)[ \\t]+(\\S.*)$`, 'i');
const NOTE_SHAPED = new RegExp(`^${BULLET}[*_]*notes?(?![\\w-])`, 'i');
const THE_NOTES = '## The notes';
const GRAMMAR = 'each item reads `- Note {k}: dropped — {why}` or `- Note {k}[, Note {k}…]: a task — {title}`';
const PHASE_FOLDER = /^phase-([1-9][0-9]*)$/;

/** @param {string} reason @returns {never} */
function refuse(reason) {
  throw new Error(`task note: ${reason}`);
}

/** A unit's notes for later, state-relative. @param {string} unit */
function notesPath(unit) {
  return `${unit}/build/notes.md`;
}

/** A phase's consolidation report, state-relative. @param {string} unit @param {number} phase */
function consolidationPath(unit, phase) {
  return `${unit}/build/phases/phase-${phase}/consolidation.md`;
}

/** Text split into its lines, with whether each is a heading at level one or two, fenced blocks aside. @param {string} text */
function linesOf(text) {
  const lines = text.trimEnd().split(/\r\n?|\n/);
  const levels = headingLevels(lines);
  return lines.map((line, at) => ({ line, top: levels[at] === 1 || levels[at] === 2 }));
}

/** `fn`'s answer, its refusal the verb's. @template T @param {() => T} fn @returns {T} */
function refusing(fn) {
  try {
    return fn();
  } catch (err) {
    return refuse(messageOf(err));
  }
}

/**
 * The unit's notes, in order; none before the first. Refused where the file
 * holds anything but notes numbered from 1.
 * @param {string} cwd @param {string} unit @returns {Note[]}
 */
function readNotes(cwd, unit) {
  const file = statePath(cwd, notesPath(unit));
  if (!fs.existsSync(file)) return [];
  /** @type {{note: number, phase: number|null, lines: string[]}[]} */
  const notes = [];
  for (const { line, top } of linesOf(fs.readFileSync(file, 'utf8'))) {
    const heading = top ? NOTE_HEADING.exec(line) : null;
    if (heading !== null) notes.push({ note: Number(heading[1]), phase: heading[2] === undefined ? null : Number(heading[2]), lines: [] });
    else if (top || (notes.length === 0 && line.trim() !== '')) throw new Error(`${notesPath(unit)} holds "${line.trim()}", which is no note — the engine writes its notes, through task note`);
    else notes.at(-1)?.lines.push(line);
  }
  notes.forEach(({ note }, at) => {
    if (note !== at + 1) throw new Error(`${notesPath(unit)} numbers note ${at + 1} as ${note} — the engine writes its notes, through task note`);
  });
  return notes.map(({ note, phase, lines: held }) => ({ note, phase, text: held.join('\n').trim() }));
}

/**
 * The phase `--phase` names, refused where the unit's cut lacks it or the
 * tracker has it written already.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {string} given
 */
function heldFor(cwd, unit, manifest, given) {
  const phase = parsePhase(given);
  const phases = manifest.cut?.phases ?? [];
  if (phases.length === 0) refuse(`${unit} has no cut — a note is held for a phase of its cut`);
  if (phase > phases.length) refuse(`${unit}'s cut has no phase ${phase} — its phases are 1 to ${phases.length}`);
  if (phaseWritten(cwd, unit, phase)) refuse(`${phaseName(unit, phase)} is written already — a find for it is a task there: engine task create ${unit} ${phase} --file <task>`);
  return phase;
}

/**
 * `task note`: a note deposited into the unit's notes for later, and
 * committed.
 * @param {string} cwd @param {string} unit @param {string} file @param {string} [given] `--phase`, where given
 */
function depositNote(cwd, unit, file, given) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) refuse(`there is no work unit "${unit}"`);
  const text = refusing(() => givenText(cwd, file, 'note'));
  const heading = linesOf(text).find(({ top }) => top);
  if (heading !== undefined) refuse(`a note holds no heading at level one or two, which would read as another note — "${heading.line.trim()}"`);
  const phase = given === undefined ? null : heldFor(cwd, unit, manifest, given);
  const notes = refusing(() => readNotes(cwd, unit));
  const note = notes.length + 1;
  const written = `## Note ${note}${phase === null ? '' : `, for phase ${phase}`}\n\n${text}\n`;
  const at = statePath(cwd, notesPath(unit));
  fs.mkdirSync(path.dirname(at), { recursive: true });
  writeTextAtomic(at, notes.length === 0 ? written : `${fs.readFileSync(at, 'utf8').trimEnd()}\n\n${written}`);
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [notesPath(unit)], `task(${unit}): note ${note}${phase === null ? '' : `, for phase ${phase}`}`, warnings);
  /** @type {Record<string, unknown>} */
  const result = { number: note, ...(phase === null ? {} : { phase }), committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

/**
 * A consolidation report read by its grammar (the header's): what it does
 * with each note it names, nothing where it says `None`. Refused where it
 * does not read, every line that does not read named.
 * @param {string} text @returns {Taken[]}
 */
function readConsolidation(text) {
  const lines = linesOf(text);
  const at = lines.reduce((last, { top }, index) => (top ? index : last), -1);
  if (at === -1 || lines[at].line.trim() !== THE_NOTES) throw new Error(`its last heading at level one or two is not \`${THE_NOTES}\``);
  const listed = lines.slice(at + 1).map(({ line }) => line);
  if (saysNone(listed)) return [];
  const { items, faults } = listItems(listed, TAKEN, (line) => (NOTE_SHAPED.test(line) ? `"${line.trim()}" under ${THE_NOTES} does not read as the notes it takes — ${GRAMMAR}` : null));
  if (faults.length > 0) throw new Error(faults.join('; '));
  if (items.length === 0) throw new Error(`nothing under ${THE_NOTES} takes a note — ${GRAMMAR} — or all it holds is \`None.\``);
  return items.map(({ opened, beneath }) => ({
    notes: opened[1].split(', ').map((named) => Number(named.slice('Note '.length))),
    kind: opened[2].toLowerCase() === 'dropped' ? 'dropped' : 'task',
    text: [opened[3], ...beneath.map(({ line }) => line.trim())].join('\n').trim(),
  }));
}

/** The notes a phase's report takes, none where it has no report or it does not read. @param {string} cwd @param {string} unit @param {number} phase */
function takenBy(cwd, unit, phase) {
  const file = statePath(cwd, consolidationPath(unit, phase));
  if (!fs.existsSync(file)) return [];
  try {
    return readConsolidation(fs.readFileSync(file, 'utf8')).flatMap(({ notes }) => notes);
  } catch {
    return [];
  }
}

/**
 * Each note another phase's report took than `phase`'s, with that phase.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {Map<number, number>}
 */
function takenElsewhere(cwd, unit, phase) {
  const folder = statePath(cwd, `${unit}/build/phases`);
  const others = (fs.existsSync(folder) ? fs.readdirSync(folder) : [])
    .map((name) => Number(PHASE_FOLDER.exec(name)?.[1]))
    .filter((other) => Number.isInteger(other) && other !== phase);
  return new Map(others.flatMap((other) => takenBy(cwd, unit, other).map((note) => [note, other])));
}

/**
 * What stands between a phase and its notes consolidated (the header's),
 * none where they are.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string[]}
 */
function consolidationFaults(cwd, unit, phase) {
  const notes = new Map(readNotes(cwd, unit).map((note) => [note.note, note]));
  const elsewhere = takenElsewhere(cwd, unit, phase);
  const toTake = [...notes.values()].filter((note) => note.phase === null && !elsewhere.has(note.note));
  const rel = consolidationPath(unit, phase);
  if (!fs.existsSync(statePath(cwd, rel))) {
    if (toTake.length === 0) return [];
    return [`${phaseName(unit, phase)} has no consolidation report, and ${toTake.length === 1 ? 'a note waits' : 'notes wait'} for one: ${toTake.map(({ note }) => `note ${note}`).join(', ')} — ${rel}`];
  }
  /** @type {number[]} */
  let named;
  try {
    named = readConsolidation(fs.readFileSync(statePath(cwd, rel), 'utf8')).flatMap((taken) => taken.notes);
  } catch (err) {
    return [`${rel} does not read as a consolidation report — ${messageOf(err)}`];
  }
  const faults = named.flatMap((note, at) => {
    if (named.indexOf(note) !== at) return [`note ${note} is taken twice`];
    const held = notes.get(note);
    if (held === undefined) return [`there is no note ${note}`];
    if (held.phase !== null) return [`note ${note} is held for phase ${held.phase}, whose task writer takes it`];
    return elsewhere.has(note) ? [`note ${note} was consolidated in phase ${elsewhere.get(note)}`] : [];
  });
  const left = toTake.filter((note) => !named.includes(note.note));
  return [...faults, ...left.map(({ note }) => `note ${note} is neither dropped nor made a task`)];
}

module.exports = { notesPath, consolidationPath, readNotes, depositNote, readConsolidation, consolidationFaults };
