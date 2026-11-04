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
// a warning, the note written. A notes file holding anything but notes
// numbered from 1 refuses every read of it, naming the fault and how the
// person puts it right by hand, the next note committing it. A second
// clone's merge keeps them so, placing each machine's notes by note and
// renaming this machine's consolidation reports with them (4.7,
// state-merge-paths.cjs, `renumberedReport`).
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
//
// A fix phase of the review's has no consolidation, so a note its builders
// bank is one no phase's report takes: the review phase answers it
// (review-phase.cjs, `notesUntaken`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { refusing } = require('./staged-payload.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { cutLength } = require('./derivations.cjs');
const { headingLevels, fencedLines } = require('./spec-sections.cjs');
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
const PUT_RIGHT = 'the engine writes its notes, through task note, and the person puts the file right by hand: each note under its heading, `## Note {k}` or `## Note {k}, for phase {N}`, numbered from 1 in the order they stand; the next note commits the file';

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

/**
 * A notes file's notes, in order; none before the first. Refused, naming the
 * fault, where it holds anything but notes numbered from 1.
 * @param {string} text @returns {Note[]}
 */
function notesOf(text) {
  /** @type {{note: number, phase: number|null, lines: string[]}[]} */
  const notes = [];
  for (const { line, top } of linesOf(text)) {
    const heading = top ? NOTE_HEADING.exec(line) : null;
    if (heading !== null) notes.push({ note: Number(heading[1]), phase: heading[2] === undefined ? null : Number(heading[2]), lines: [] });
    else if (top || (notes.length === 0 && line.trim() !== '')) throw new Error(`holds "${line.trim()}", which is no note`);
    else notes.at(-1)?.lines.push(line);
  }
  notes.forEach(({ note }, at) => {
    if (note !== at + 1) throw new Error(`numbers note ${at + 1} as ${note}`);
  });
  return notes.map(({ note, phase, lines: held }) => ({ note, phase, text: held.join('\n').trim() }));
}

/**
 * The unit's notes, in order; none before the first. Refused where the file
 * holds anything but notes numbered from 1, saying how the person puts it
 * right.
 * @param {string} cwd @param {string} unit @returns {Note[]}
 */
function readNotes(cwd, unit) {
  const file = statePath(cwd, notesPath(unit));
  if (!fs.existsSync(file)) return [];
  try {
    return notesOf(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${notesPath(unit)} ${messageOf(err)} — ${PUT_RIGHT}`);
  }
}

/** A notes file's text with `notes` written after what it holds. @param {string} text @param {Note[]} notes */
function notesAppended(text, notes) {
  const blocks = notes.map(({ note, phase, text: body }) => `## Note ${note}${phase === null ? '' : `, for phase ${phase}`}\n\n${body}`);
  return `${[text.trimEnd(), ...blocks].filter((part) => part !== '').join('\n\n')}\n`;
}

/**
 * The phase `--phase` names, refused where the unit's cut lacks it or the
 * tracker has it written already.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {string} given
 */
function heldFor(cwd, unit, manifest, given) {
  const phase = parsePhase(given);
  const phases = cutLength(manifest);
  if (phases === 0) refuse(`${unit} has no cut — a note is held for a phase of its cut`);
  if (phase > phases) refuse(`${unit}'s cut has no phase ${phase} — its phases are 1 to ${phases}`);
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
  const text = refusing('task note', () => givenText(cwd, file, 'note'));
  const heading = linesOf(text).find(({ top }) => top);
  if (heading !== undefined) refuse(`a note holds no heading at level one or two, which would read as another note — "${heading.line.trim()}"`);
  const phase = given === undefined ? null : heldFor(cwd, unit, manifest, given);
  const notes = refusing('task note', () => readNotes(cwd, unit));
  const note = notes.length + 1;
  const at = statePath(cwd, notesPath(unit));
  fs.mkdirSync(path.dirname(at), { recursive: true });
  writeTextAtomic(at, notesAppended(notes.length === 0 ? '' : fs.readFileSync(at, 'utf8'), [{ note, phase, text }]));
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

/**
 * A consolidation report renamed as its notes were renumbered (`at`, a
 * note's number to its new one; a number `at` lacks stays as it is): its
 * text with each item's names renumbered and every other byte as it was.
 * Null where the report does not read, so what it names is not known.
 * @param {string} text @param {Map<number, number>} at @returns {string|null}
 */
function renumberedReport(text, at) {
  try {
    readConsolidation(text);
  } catch {
    return null;
  }
  const parts = text.split(/(\r\n?|\n)/);
  const lines = parts.filter((_, i) => i % 2 === 0);
  const levels = headingLevels(lines);
  const fenced = fencedLines(lines);
  const section = levels.reduce((last, level, i) => (level === 1 || level === 2 ? i : last), -1);
  const renamed = lines.map((line, i) => {
    const opened = i > section && !fenced[i] ? TAKEN.exec(line) : null;
    if (opened === null) return line;
    const from = line.indexOf(opened[1]);
    const names = opened[1].replace(/[0-9]+/g, (n) => String(at.get(Number(n)) ?? n));
    return `${line.slice(0, from)}${names}${line.slice(from + opened[1].length)}`;
  });
  return parts.map((part, i) => (i % 2 === 0 ? renamed[i / 2] : part)).join('');
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
 * The notes a phase has to take (the header's), in order: those held for no
 * phase that no other phase's report took.
 * @param {Note[]} notes @param {Map<number, number>} elsewhere @returns {Note[]}
 */
function toTakeOf(notes, elsewhere) {
  return notes.filter((note) => note.phase === null && !elsewhere.has(note.note));
}

/** The notes phase `phase` has to take at its end. @param {string} cwd @param {string} unit @param {number} phase */
function notesToTake(cwd, unit, phase) {
  return toTakeOf(readNotes(cwd, unit), takenElsewhere(cwd, unit, phase));
}

/** The notes held for no phase that no phase's report took, in order. @param {string} cwd @param {string} unit */
function notesUntaken(cwd, unit) {
  return toTakeOf(readNotes(cwd, unit), takenElsewhere(cwd, unit, 0));
}

/** The notes held for phase `phase`, which its task writer takes. @param {string} cwd @param {string} unit @param {number} phase */
function notesHeldFor(cwd, unit, phase) {
  return readNotes(cwd, unit).filter((note) => note.phase === phase);
}

/**
 * What stands between a phase and its notes consolidated (the header's),
 * none where they are.
 * @param {string} cwd @param {string} unit @param {number} phase @returns {string[]}
 */
function consolidationFaults(cwd, unit, phase) {
  const notes = new Map(readNotes(cwd, unit).map((note) => [note.note, note]));
  const elsewhere = takenElsewhere(cwd, unit, phase);
  const toTake = toTakeOf([...notes.values()], elsewhere);
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

module.exports = {
  notesPath, consolidationPath, notesOf, readNotes, notesAppended, depositNote, readConsolidation, renumberedReport, notesToTake, notesUntaken, notesHeldFor, consolidationFaults,
};
