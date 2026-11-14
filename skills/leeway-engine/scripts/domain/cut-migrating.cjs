'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the migration's cut of a unit whose building started (21.7.1,
// 21.8.6–21.8.8; E6) — `cut <unit> --migrating --file <plan.json>`, the cut
// and the merges' one write per building unit, applied whole, and only
// while the migration runs (E13).
//
// The plan the directive writes is one JSON object:
// - `phases`, required: the cut as `cut` takes it (cut.cjs), in build order,
//   a phase built before the migration `{name, goal, built: true}` (21.8.6),
//   and each phase the old plan put in the tracker naming its parent there
//   by the tracker's own id, `tracker` (21.8.8);
// - `scenarios`: by the number of the area each belongs to, the text of the
//   scenarios the unfinished phases place (21.8.7), one line each, which
//   `spec.md` takes as the area's block of scenarios after it, `## N-S.
//   Scenarios for §N`, numbered `N.S1` on in the order given, where the cut
//   finds them (11.5.9);
// - `notes`: the notes for later, each its text — the banked findings, and
//   each disagreement between the manifest and the tracker, whose state
//   stands (21.8.8);
// - `answers`: what the person answered for the unit (21.8.10), kept with
//   the plan so a run again asks nothing, and never read here.
//
// It refuses, writing nothing: outside the migration; a unit the project
// lacks, one whose specs the migration did not join (`spec.joined`, 078) —
// a quick-fix's never are — and one this cut has marked (below); a plan it
// cannot read, or of another shape; scenarios for an area `spec.md` lacks,
// or text that is not one line; a note holding nothing, or a heading at
// level one or two (notes.cjs); two phases naming one tracker parent; and
// the cut, against `spec.md` as its scenarios leave it, as `cut` refuses it.
// Unlike `cut`, it marks a phase built and names its tracker parent anywhere
// in the cut, and replaces every phase whole: a run killed before its mark
// starts the unit from the top.
//
// Then, in this order, each step whole, so a run again takes it from the
// top: the tracker's steps (task-verbs.cjs, `migratedTracker`) — each phase
// naming its parent adopted, refused where a phase marked built holds a
// task neither done nor closed, and each task neither done nor closed given
// its type, fix in a bugfix and feat in any other (21.5.21); then the
// unit's files, `spec.md` with the plan's blocks of scenarios, any a run
// before wrote replaced, `build/notes.md` the notes whole, numbered from 1,
// and the manifest — the cut, the build begun in step, `build: {position:
// 'step'}`, which the person switches with `workunit position` (P3), and
// the old plan's spec, planning and implementation items dropped (P12) —
// committed to the state branch, the commit held for the migration's
// (21.9.3). Last, the mark, `.cache/migrate/cut/{unit}.json` in the state.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic, writeTextAtomic } = require('../kernel/manifest-io.cjs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { migrationRuns } = require('./state-worktree.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { specJoined, OLD_PLAN_PHASES } = require('./derivations.cjs');
const { readSpec, specPath, specReading, rowsOf, specFencedLines, SPEC_FILE } = require('./spec-sections.cjs');
const { phasesOf, placing, specIn, againstSpec, refuse } = require('./cut.cjs');
const { notesPath, notesAppended, topHeading } = require('./notes.cjs');
const { migratedTracker } = require('./task-verbs.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { isoNow } = require('./dates.cjs');

/** @typedef {import('./cut.cjs').Phase} Phase */
/** @typedef {{phases: Phase[], scenarios: Record<string, string[]>, notes: string[]}} Plan */

const MIGRATING_USAGE = 'cut <work-unit> --migrating --file <plan.json>';

/** What a plan may hold, `phases` the one it must. */
const PLAN_KEYS = Object.freeze(['phases', 'scenarios', 'notes', 'answers']);

const PLAN_SHAPE = '{"phases": [the cut\'s phases], "scenarios": {"<area>": ["<text>", …]}, "notes": ["<text>", …], "answers": {…}}';

/** The type each task neither done nor closed takes, by the unit's type: feat where none is named (21.5.21). */
const TYPES = Object.freeze({ bugfix: 'fix' });

const LEVEL_TWO = /^## /;
const AREA_OF = /^## ([0-9]+)\. /;
const SCENARIOS_OF = /^## [0-9]+-S\. /;
const AREA_NUMBER = /^[1-9][0-9]*$/;

/** Where the cut marks a unit it has cut, in the state. @param {string} cwd @param {string} unit */
const markPath = (cwd, unit) => statePath(cwd, '.cache', 'migrate', 'cut', `${unit}.json`);

/** @param {unknown} text */
const isLine = (text) => typeof text === 'string' && text.trim() !== '' && !/[\r\n]/.test(text);

/** The faults in a plan's scenarios, by area. @param {unknown} scenarios */
function scenarioFaults(scenarios) {
  if (!isObject(scenarios)) return ['the plan\'s scenarios are not lists of text by area number'];
  return Object.entries(scenarios).flatMap(([area, texts]) => {
    if (!AREA_NUMBER.test(area)) return [`the plan's scenarios name "${area}", which is no area's number`];
    if (!Array.isArray(texts) || texts.length === 0) return [`the plan's scenarios for area ${area} are not a list of text`];
    return texts.flatMap((text, at) => (isLine(text) ? [] : [`scenario ${area}.S${at + 1} is not one line of text`]));
  });
}

/** The faults in a plan's notes. @param {unknown} notes */
function noteFaults(notes) {
  if (!Array.isArray(notes)) return ['the plan\'s notes are not a list of text'];
  return notes.flatMap((note, at) => {
    if (typeof note !== 'string' || note.trim() === '') return [`note ${at + 1} holds nothing`];
    const heading = topHeading(note);
    return heading === null ? [] : [`note ${at + 1} holds a heading at level one or two, which would read as another note — "${heading}"`];
  });
}

/** The faults of two phases naming one tracker parent. @param {Phase[]} phases */
function trackerFaults(phases) {
  return phases.flatMap((phase, at) => {
    const first = phases.findIndex((other) => other.tracker !== undefined && other.tracker === phase.tracker);
    return first !== -1 && first < at ? [`phases ${first + 1} and ${at + 1} name one tracker parent, ${phase.tracker}`] : [];
  });
}

/**
 * The plan in `file`, refused, naming every fault, where it does not read
 * as one (the header's).
 * @param {string} file absolute @returns {Plan}
 */
function planIn(file) {
  /** @type {unknown} */
  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    refuse([`${file} holds no plan: ${messageOf(err)}`]);
  }
  if (!isObject(plan) || !Array.isArray(plan.phases) || plan.phases.length === 0 || Object.keys(plan).some((key) => !PLAN_KEYS.includes(key))) {
    refuse([`${file} holds no plan — a plan is ${PLAN_SHAPE}`]);
  }
  const { scenarios = {}, notes = [] } = plan;
  const faults = [...scenarioFaults(scenarios), ...noteFaults(notes)];
  if (faults.length > 0) refuse(faults);
  return { phases: phasesOf(plan.phases), scenarios, notes };
}

/**
 * A spec's text cut at each heading at level two outside a fenced block:
 * what comes before the first, then each area and each block of scenarios.
 * @param {string} text @returns {string[]}
 */
function partsOf(text) {
  const rows = rowsOf(text.trimEnd());
  const fenced = specFencedLines(rows);
  /** @type {string[][]} */
  const parts = [[]];
  rows.forEach((row, at) => {
    if (!fenced[at] && LEVEL_TWO.test(row)) parts.push([]);
    /** @type {string[]} */ (parts.at(-1)).push(row);
  });
  return parts.map((part) => part.join('\n').trimEnd()).filter((part) => part !== '');
}

/** An area's block of scenarios, numbered in the order given. @param {string} area @param {string[]} texts */
const scenarioBlock = (area, texts) => [`## ${area}-S. Scenarios for §${area}`, ...texts.map((text, at) => `${area}.S${at + 1} ${text.trim()}`)].join('\n\n');

/**
 * The joined spec with the plan's blocks of scenarios, each after its area,
 * any block it held before dropped.
 * @param {string} text @param {Record<string, string[]>} scenarios
 */
function withScenarios(text, scenarios) {
  return `${partsOf(text).filter((part) => !SCENARIOS_OF.test(part)).flatMap((part) => {
    const area = AREA_OF.exec(part)?.[1];
    return area !== undefined && Object.hasOwn(scenarios, area) ? [part, scenarioBlock(area, scenarios[area])] : [part];
  }).join('\n\n')}\n`;
}

/**
 * The spec as the plan's scenarios leave it, refused where they name an
 * area it lacks.
 * @param {string} cwd @param {string} unit @param {Plan} plan
 */
function plannedSpec(cwd, unit, plan) {
  const text = readSpec(cwd, unit);
  const areas = new Set(specReading(text, true).headings.flatMap((heading) => (heading.kind === 'area' ? [String(heading.number)] : [])));
  const lacking = Object.keys(plan.scenarios).filter((area) => !areas.has(area));
  if (lacking.length > 0) refuse(lacking.map((area) => `the plan's scenarios are for area ${area}, which ${SPEC_FILE} lacks`));
  return withScenarios(text, plan.scenarios);
}

/**
 * The unit's notes for later as the plan gives them, written whole — or,
 * where it gives none, any a run before wrote taken away — answering
 * whether the file is one of the cut's writes.
 * @param {string} cwd @param {string} unit @param {string[]} notes
 */
function writeNotes(cwd, unit, notes) {
  const file = statePath(cwd, notesPath(unit));
  if (notes.length === 0) {
    if (!fs.existsSync(file)) return false;
    fs.rmSync(file);
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeTextAtomic(file, notesAppended('', notes.map((text, at) => ({ note: at + 1, phase: null, text: text.trim() }))));
  return true;
}

/** The manifest's cut and build written, the old plan's items dropped (the header's). @param {string} cwd @param {string} unit @param {Phase[]} phases */
function writeManifest(cwd, unit, phases) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  manifest.cut = { phases };
  manifest.build = { position: 'step' };
  if (isObject(manifest.phases)) for (const phase of OLD_PLAN_PHASES) delete manifest.phases[phase];
  saveWorkUnitManifest(cwd, unit, manifest);
}

/**
 * The unit, cut by the migration, refused as the header says before
 * anything is written.
 * @param {string} cwd @param {string} unit
 * @returns {Record<string, any>} the unit's manifest
 */
function cuttable(cwd, unit) {
  if (!migrationRuns(stateRoot(cwd))) throw new Error('cut: a unit is cut by the migration only while it runs — the state branch has its first commit, so the migration is done');
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`cut: there is no work unit "${unit}"`);
  if (fs.existsSync(markPath(cwd, unit))) throw new Error(`cut: the migration has cut ${unit} already — its mark is ${markPath(cwd, unit)}`);
  if (!specJoined(manifest)) throw new Error(`cut: ${unit}'s specs were not joined by the migration — it cuts only a unit whose building started, its ${SPEC_FILE} those specs joined`);
  return manifest;
}

/**
 * `cut --migrating`: the unit's plan applied whole (the header's).
 * @param {string} cwd @param {string} unit @param {string} file absolute or from cwd
 */
function cutMigrating(cwd, unit, file) {
  const manifest = cuttable(cwd, unit);
  const plan = planIn(path.resolve(cwd, file));
  const text = plannedSpec(cwd, unit, plan);
  const faults = [...trackerFaults(plan.phases), ...againstSpec(cwd, unit, plan.phases.map(placing), specIn(text, true))];
  if (faults.length > 0) refuse(faults);
  const parents = plan.phases.flatMap((phase, at) => (phase.tracker === undefined ? [] : [{ phase: at + 1, parent: phase.tracker, built: 'built' in phase }]));
  const tracker = parents.length === 0 ? { adopted: [], typed: [] } : migratedTracker(cwd, unit, parents, TYPES[manifest.work_type] ?? 'feat');
  const notes = withWorkUnitLock(cwd, unit, () => {
    writeTextAtomic(specPath(cwd, unit), text);
    const wrote = writeNotes(cwd, unit, plan.notes);
    writeManifest(cwd, unit, plan.phases);
    return wrote;
  });
  /** @type {string[]} */
  const warnings = [...(tracker.warnings ?? [])];
  const paths = [`${unit}/${SPEC_FILE}`, ...(notes ? [notesPath(unit)] : []), `${unit}/manifest.json`];
  const outcome = commitStateTail(cwd, paths, `cut(${unit}): the migration's cut, ${plan.phases.length === 1 ? '1 phase' : `${plan.phases.length} phases`}`, warnings);
  const mark = markPath(cwd, unit);
  fs.mkdirSync(path.dirname(mark), { recursive: true });
  writeJsonAtomic(mark, { at: isoNow() });
  /** @type {Record<string, unknown>} */
  const result = {
    unit,
    phases: plan.phases.length,
    built: plan.phases.filter((phase) => 'built' in phase).length,
    adopted: tracker.adopted,
    typed: tracker.typed,
    scenarios: Object.values(plan.scenarios).reduce((sum, texts) => sum + texts.length, 0),
    notes: plan.notes.length,
    committed: outcome.committed,
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { MIGRATING_USAGE, cutMigrating, markPath };
