'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the migration's cut of a unit whose building started (21.7.1,
// 21.8.6–21.8.8; E6) — `cut <unit> --migrating --file <plan.json>`, the cut
// and the merges' one write per building unit, applied whole, and only
// while the migration runs (E13).
//
// The plan the directive writes is one JSON object:
// - `phases`, required: the cut as `cut` takes it (cut.cjs), in build order,
//   a phase built before the migration `{name, goal, sections, built:
//   true}`, its sections the areas its old plan built (21.8.6), an area of
//   the joined spec that no old plan built placed by a phase still to build,
//   and each phase the old plan put in the tracker naming its parent there
//   by the tracker's own id, `tracker` (21.8.8);
// - `scenarios`: by the number of the area each belongs to, the text of the
//   scenarios the unfinished phases place (21.8.7), one line each, which
//   `spec.md` takes as the area's block of scenarios after it, `## N-S.
//   Scenarios for §N`, numbered `N.S1` on in the order given, where the cut
//   finds them (11.5.9);
// - `notes`: the notes for later, each its text — what the build must
//   know, and what a correction leaves for the build to settle (21.8.8);
// - `corrections`: what the directive found the manifest or the tracker
//   has wrong, settled from them and the code — each disagreement between
//   the two, and any task its phase's sources show done, superseded or no
//   longer wanted — `{was, found, changed}`, each one line — what was
//   wrong, what was found, what was changed — and, where the tracker was
//   wrong, the task it ends, `{task, title, to}`: the task by the name
//   its phase's adoption gives it, `N.n`, its title as the tracker holds
//   it, and `done` or `closed`; a correction of the plan's built marks is
//   the phases' own, and recorded alone;
// - `answers`: what the person answered for the unit (21.8.10), kept with
//   the plan so a run again asks nothing, and never read here.
//
// It refuses, writing nothing: outside the migration; a unit the project
// lacks, one whose specs the migration did not join (`spec.joined`, 078) —
// a quick-fix's never are — and one this cut has marked (below); a plan it
// cannot read, or of another shape; scenarios for an area `spec.md` lacks,
// or text that is not one line; a note holding nothing, or a heading at
// level one or two (notes.cjs); a correction of another shape, or ending a
// task of a phase naming no tracker parent; two phases naming one tracker
// parent; a phase marked built naming no tracker parent, or no section, and
// one still to build placing no scenario; an area of `spec.md` no phase places,
// naming it, its sections or a scenario; and the cut, against `spec.md` as
// its scenarios leave it, as `cut` refuses it.
// Unlike `cut`, it marks a phase built and names its tracker parent anywhere
// in the cut, and replaces every phase whole: a run killed before its mark
// starts the unit from the top.
//
// Then, in this order, each step whole, so a run again takes it from the
// top: the tracker's steps (task-verbs.cjs, `migratedTracker`) — the phases
// read as their adoption would leave them, each task a correction ends read
// as ended, and refused, every fault named and the tracker left as it was,
// where a correction names a task no adopted phase holds, or titles it
// otherwise than the tracker, where a phase marked built holds a task
// neither done nor closed or names a section outside the area of its old
// plan's topic — the topic its plan's root names, a single-topic unit's
// plan the whole spec's — a phase not marked built holds none, or a link
// holds a task neither done nor closed after one neither, of a later phase
// or another unit's, or holds another unit's task so after one of the
// unit's; then each phase naming its parent adopted, its tasks
// named in its old plan's order — the plan's task ids by number, then the
// letters after it (`oldPlanOrder`) — each task a correction ends ended,
// a close keeping what was found as its reason, and each task neither done
// nor closed given its type, fix in a bugfix and feat in any other
// (21.5.21); then the unit's files, `spec.md` with the
// plan's blocks of scenarios, any a run before wrote replaced,
// `build/notes.md` the notes whole, numbered from 1, and the manifest — the
// cut, the build begun in step, `build: {position: 'step'}`, which the
// person switches with `workunit position` (P3), naming the tasks of the
// phases not built that the tracker holds done, `done_before`, each built
// and landed before Ledger (derivations.cjs, `landedBefore`), and the areas
// each task of them neither done nor closed cites, `cites: {"N.n": ["<area>",
// …]}`, a task citing none left out (`citedAreas`), and every item past the
// topics', the old plan's and its review's, dropped (P12, old-layout.cjs's
// `PAST_THE_TOPICS`) — committed to the state
// branch, the commit held for the migration's (21.9.3). Last, the mark,
// `.cache/migrate/cut/{unit}.json` in the state, `{at, corrections}`: every
// correction the plan records, as given, which the migration review lists
// (directives.cjs, `migrate review`).
//
// A task of the old plan cites an old spec by its path in the layout before
// Ledger, in any of its forms: `docs/workflow/specification/{topic}.md`,
// before 15 February 2026; `{root}/specification/{topic}/specification.md`
// from then, its root `docs/workflow` or the old state (old-layout.cjs's
// `OLD_STATE`); and `{old state}/{unit}/specification/{topic}/specification.md`
// once the work was kept by unit, the unit the one cut. Each topic joined is the area of
// its place in `spec.joined`, the areas in the spec's order; a path naming
// another unit, or a topic not joined, cites none.
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
const { specJoined, joinedTopics, areaOfAddress } = require('./derivations.cjs');
const { OLD_STATE, OLD_PLANNING, PAST_THE_TOPICS } = require('../../../ledger-migrate/scripts/old-layout.cjs');
const { readSpec, specPath, specReading, rowsOf, fencedLines, SPEC_FILE } = require('./spec-sections.cjs');
const { phasesOf, placing, specIn, againstSpec, refuse } = require('./cut.cjs');
const { notesPath, notesAppended, topHeading } = require('./notes.cjs');
const { migratedTracker, unlinkAdopted } = require('./task-verbs.cjs');
const { parseShownTask, parseTaskId, isShownTask } = require('./task-id.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { isoNow } = require('./dates.cjs');

/** @typedef {import('./cut.cjs').Phase} Phase */
/** A disagreement the directive settled, and the task it ends where the tracker was wrong. @typedef {{was: string, found: string, changed: string, task?: string, title?: string, to?: 'done'|'closed'}} Correction */
/** @typedef {{phases: Phase[], scenarios: Record<string, string[]>, notes: string[], corrections: Correction[]}} Plan */

const MIGRATING_USAGE = 'cut <work-unit> --migrating --file <plan.json>';

/** What a plan may hold, `phases` the one it must. */
const PLAN_KEYS = Object.freeze(['phases', 'scenarios', 'notes', 'corrections', 'answers']);

const PLAN_SHAPE = '{"phases": [the cut\'s phases], "scenarios": {"<area>": ["<text>", …]}, "notes": ["<text>", …], "corrections": [{"was", "found", "changed"}, …], "answers": {…}}';

/** What a correction says, each one line. */
const CORRECTION_SAYS = Object.freeze(['was', 'found', 'changed']);

/** What a correction ending a task names, all three or none. */
const CORRECTION_ENDS = Object.freeze(['task', 'title', 'to']);

/** How a correction ends a task. */
const ENDS = Object.freeze(['done', 'closed']);

/** The type each task neither done nor closed takes, by the unit's type: feat where none is named (21.5.21). */
const TYPES = Object.freeze({ bugfix: 'fix' });

/** The type the migration gives each task neither done nor closed of a unit of `workType` (21.5.21). @param {string} workType */
const migratedType = (workType) => TYPES[/** @type {keyof TYPES} */ (workType)] ?? 'feat';

const LEVEL_TWO = /^## /;
const AREA_OF = /^## ([0-9]+)\. /;
const SCENARIOS_OF = /^## [0-9]+-S\. /;
const AREA_NUMBER = /^[1-9][0-9]*$/;
const SHOWN_TASK = /^([1-9][0-9]*)\.([1-9][0-9]*)$/;

/** An old spec's path in a task's text (the header's): the unit's folder where it names one, and the topic. */
const OLD_SPEC_PATH = new RegExp(`(?:docs/workflow|${OLD_STATE.replace('.', '\\.')})/(?:([^/\\s\`'"()]+)/)?specification/([^/\\s\`'"()]+?)(?:/specification)?\\.md`, 'g');

/**
 * The areas an old task's text cites (the header's), in the spec's order.
 * @param {string} text @param {string} unit @param {string[]} topics the topics joined, area by area @returns {string[]}
 */
function oldCitations(text, unit, topics) {
  const areas = [...text.matchAll(OLD_SPEC_PATH)].flatMap(([, folder, topic]) => (folder === undefined || folder === unit ? [topics.indexOf(topic) + 1] : []));
  return [...new Set(areas.filter((area) => area > 0))].sort((a, b) => a - b).map(String);
}

/**
 * The areas each task neither done nor closed cites, by the task, shown; a
 * task citing none left out.
 * @param {{task: string, text: string}[]} open @param {string} unit @param {string[]} topics @returns {Record<string, string[]>}
 */
function citesOf(open, unit, topics) {
  return Object.fromEntries(open.flatMap(({ task, text }) => {
    const areas = oldCitations(text, unit, topics);
    return areas.length === 0 ? [] : [[task, areas]];
  }));
}

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

/**
 * The faults in a plan's corrections, against its phases: a correction of
 * another shape, or ending a task of a phase naming no tracker parent.
 * @param {unknown} corrections @param {{tracker?: string}[]} phases
 */
function correctionFaults(corrections, phases) {
  if (!Array.isArray(corrections)) return ['the plan\'s corrections are not a list'];
  return corrections.flatMap((correction, at) => {
    const which = `correction ${at + 1}`;
    if (!isObject(correction) || Object.keys(correction).some((key) => ![...CORRECTION_SAYS, ...CORRECTION_ENDS].includes(key))) return [`${which} is not {"was", "found", "changed"}, with {"task", "title", "to"} where it ends a task`];
    const says = CORRECTION_SAYS.filter((key) => !isLine(correction[key])).map((key) => `${which}'s ${key} is not one line of text`);
    const ends = CORRECTION_ENDS.filter((key) => key in correction);
    if (ends.length === 0) return says;
    if (ends.length < CORRECTION_ENDS.length || !isLine(correction.title) || !ENDS.includes(correction.to)) return [...says, `${which} ends a task by its "task", the name its phase's adoption gives it, its "title" as the tracker holds it, and "to", done or closed — all three`];
    const named = SHOWN_TASK.exec(String(correction.task));
    if (named === null) return [...says, `${which} names "${correction.task}", which is no task — {phase}.{n}, as the cut's adoption names it`];
    const phase = phases[Number(named[1]) - 1];
    return phase?.tracker === undefined ? [...says, `${which} ends task ${correction.task}, of a phase that names no tracker parent — a correction ends a task of a phase the cut adopts`] : says;
  });
}

/**
 * The tasks the plan's corrections end, as the cut's tracker steps take
 * them: each by the name its phase's adoption gives it, its title, how it
 * ends, and what was found, the reason a close keeps.
 * @param {string} unit @param {Correction[]} corrections @returns {import('./task-verbs.cjs').TrackerCorrection[]}
 */
const trackerCorrections = (unit, corrections) => corrections.flatMap(({ task, title, to, found }) => (task === undefined ? [] : [{ ref: parseShownTask(unit, task), title: /** @type {string} */ (title), to: /** @type {'done'|'closed'} */ (to), why: found }]));

/**
 * The topics joined, area by area, against which a phase built names its
 * sections: an epic's; null for a single-topic unit, whose plan built the
 * whole spec (task-verbs.cjs, `areaFaults`).
 * @param {Record<string, any>} manifest @returns {string[]|null}
 */
const cutTopics = (manifest) => (manifest.work_type === 'epic' ? joinedTopics(manifest) : null);

/** An old plan's task id below its phase's: its number, and the letters after it. */
const OLD_TASK = /^([0-9]+)([a-z]*)$/;

/**
 * The tracker's ids of the tasks of the old plan's phase whose parent is
 * `parent`, in the plan's own order (21.8.8): its task ids from the
 * manifest's `task_map`, `{phase id}-{n}`, by number, then by the letters
 * after it — 1 < 1b < 2, 9 < 9a < 10 — what adoption names them by; none
 * where no old plan's phase has that parent.
 * @param {Record<string, any>} manifest @param {string} parent
 * @returns {string[]}
 */
function oldPlanOrder(manifest, parent) {
  const items = manifest.phases?.[OLD_PLANNING]?.items;
  const maps = Object.values(isObject(items) ? items : {})
    .map((item) => (isObject(item) && isObject(item.task_map) ? item.task_map : {}));
  const map = maps.find((each) => Object.values(each).includes(parent)) ?? {};
  const phaseId = Object.keys(map).find((id) => map[id] === parent);
  return Object.entries(map)
    .flatMap(([id, tracker]) => {
      const task = phaseId !== undefined && id.startsWith(`${phaseId}-`) ? OLD_TASK.exec(id.slice(phaseId.length + 1)) : null;
      return task === null || typeof tracker !== 'string' ? [] : [{ n: Number(task[1]), letters: task[2], tracker }];
    })
    .sort((a, b) => a.n - b.n || (a.letters < b.letters ? -1 : a.letters > b.letters ? 1 : 0))
    .map(({ tracker }) => tracker);
}

/** The faults of two phases naming one tracker parent. @param {Phase[]} phases */
function trackerFaults(phases) {
  return phases.flatMap((phase, at) => {
    const first = phases.findIndex((other) => other.tracker !== undefined && other.tracker === phase.tracker);
    return first !== -1 && first < at ? [`phases ${first + 1} and ${at + 1} name one tracker parent, ${phase.tracker}`] : [];
  });
}

/**
 * The faults of a phase of the plan as the migration holds it: one marked
 * built naming no tracker parent, or no section; one still to build placing
 * no scenario, as ready to build holds every cut (6.4.7).
 * @param {Phase[]} phases
 */
function migratedFaults(phases) {
  return phases.flatMap((phase, at) => {
    if (!('built' in phase)) return phase.scenarios.length === 0 ? [`phase ${at + 1} places no scenario — a phase still to build proves one at least`] : [];
    return [
      ...(phase.tracker === undefined ? [`phase ${at + 1} is marked built and names no tracker parent — a phase built before the migration is its old plan's, adopted from the tracker`] : []),
      ...(phase.sections.length === 0 ? [`phase ${at + 1} is marked built and names no section — a phase built before the migration names the area its old plan built`] : []),
    ];
  });
}

/**
 * The faults of an area of the spec no phase places: names it, its sections
 * or a scenario of it.
 * @param {string} text the spec @param {Phase[]} phases
 */
function placedFaults(text, phases) {
  const placed = new Set(phases.flatMap((phase) => [...placing(phase).sections, ...placing(phase).scenarios].map(areaOfAddress)));
  return specReading(text, true).headings
    .filter((heading) => heading.kind === 'area' && !placed.has(String(heading.number)))
    .map(({ number, title }) => `§${number} ${title} is placed by no phase — a phase built before the migration names the area its old plan built in its sections, and an area none built is placed by a phase still to build`);
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
  const { scenarios = {}, notes = [], corrections = [] } = plan;
  const phases = phasesOf(plan.phases);
  const faults = [...scenarioFaults(scenarios), ...noteFaults(notes), ...correctionFaults(corrections, phases)];
  if (faults.length > 0) refuse(faults);
  return { phases, scenarios, notes, corrections };
}

/**
 * A spec's text cut at each heading at level two outside a fenced block:
 * what comes before the first, then each area and each block of scenarios.
 * @param {string} text @returns {string[]}
 */
function partsOf(text) {
  const rows = rowsOf(text.trimEnd());
  const fenced = fencedLines(rows);
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

/**
 * The manifest's cut and build written, the old plan's items dropped (the header's).
 * @param {string} cwd @param {string} unit @param {Phase[]} phases @param {string[]} done the tasks done before, shown @param {Record<string, string[]>} cites
 */
function writeManifest(cwd, unit, phases, done, cites) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  manifest.cut = { phases };
  manifest.build = { position: 'step', ...(done.length === 0 ? {} : { done_before: done }), ...(Object.keys(cites).length === 0 ? {} : { cites }) };
  if (isObject(manifest.phases)) for (const phase of PAST_THE_TOPICS) delete manifest.phases[phase];
  saveWorkUnitManifest(cwd, unit, manifest);
}

/**
 * The unit, cut by the migration, refused as the header says before
 * anything is written, each refusal opening `said`.
 * @param {string} cwd @param {string} unit @param {string} [said]
 * @returns {Record<string, any>} the unit's manifest
 */
function cuttable(cwd, unit, said = 'cut') {
  if (!migrationRuns(stateRoot(cwd))) throw new Error(`${said}: a unit is cut by the migration only while it runs — the state branch has its first commit, so the migration is done`);
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  if (fs.existsSync(markPath(cwd, unit))) throw new Error(`${said}: the migration has cut ${unit} already — its mark is ${markPath(cwd, unit)}`);
  if (!specJoined(manifest)) throw new Error(`${said}: ${unit}'s specs were not joined by the migration — it cuts only a unit whose building started, its ${SPEC_FILE} those specs joined`);
  return manifest;
}

/**
 * The tracker's steps (`migratedTracker`), a refusal of theirs opening
 * `cut: ` as every refusal of the verb does.
 * @param {string} cwd @param {string} unit @param {{phase: number, parent: string, order: string[], built: boolean, sections: string[]}[]} parents @param {string} type @param {string[]|null} topics
 * @param {import('./task-verbs.cjs').TrackerCorrection[]} corrections
 */
function cutTracker(cwd, unit, parents, type, topics, corrections) {
  try {
    return migratedTracker(cwd, unit, parents, type, topics, corrections);
  } catch (err) {
    if (err instanceof Error) err.message = `cut: ${err.message}`;
    throw err;
  }
}

/**
 * The phases of the plan the tracker holds a parent of, as their adoption
 * reads them: each by its number in the cut, its parent, its tasks in its
 * old plan's order, and what the plan says of it.
 * @param {Record<string, any>} manifest @param {Phase[]} phases
 */
const adoptedPhases = (manifest, phases) => phases.flatMap((phase, at) => (phase.tracker === undefined ? [] : [{
  phase: at + 1, parent: phase.tracker, order: oldPlanOrder(manifest, phase.tracker), built: 'built' in phase, sections: phase.sections,
}]));

/** A task as `task unlink` is given it: the unit's as shown, another's by its id. @param {string} unit @param {string} value */
const givenTask = (unit, value) => (isShownTask(value) ? parseShownTask(unit, value) : parseTaskId(value));

/**
 * `task unlink <unit> <task> --after <task> --file <plan.json>`: a link the
 * cut refuses taken off, each task named as the cut's adoption of the plan
 * names it — either another unit's by its id — while the migration runs
 * and the unit is not cut yet, as the cut is.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} afterGiven @param {string} file
 */
function unlinkMigrating(cwd, unit, given, afterGiven, file) {
  const manifest = cuttable(cwd, unit, 'task unlink');
  const plan = planIn(path.resolve(cwd, file));
  return unlinkAdopted(cwd, unit, adoptedPhases(manifest, plan.phases), givenTask(unit, given), givenTask(unit, afterGiven));
}

/**
 * `cut --migrating`: the unit's plan applied whole (the header's).
 * @param {string} cwd @param {string} unit @param {string} file absolute or from cwd
 */
function cutMigrating(cwd, unit, file) {
  const manifest = cuttable(cwd, unit);
  const plan = planIn(path.resolve(cwd, file));
  const text = plannedSpec(cwd, unit, plan);
  const faults = [...trackerFaults(plan.phases), ...migratedFaults(plan.phases), ...placedFaults(text, plan.phases), ...againstSpec(cwd, unit, plan.phases.map(placing), specIn(text, true))];
  if (faults.length > 0) refuse(faults);
  const parents = adoptedPhases(manifest, plan.phases);
  const tracker = parents.length === 0 ? { adopted: [], typed: [], ended: [], done: [], open: [] } : cutTracker(cwd, unit, parents, migratedType(manifest.work_type), cutTopics(manifest), trackerCorrections(unit, plan.corrections));
  const notes = withWorkUnitLock(cwd, unit, () => {
    writeTextAtomic(specPath(cwd, unit), text);
    const wrote = writeNotes(cwd, unit, plan.notes);
    writeManifest(cwd, unit, plan.phases, tracker.done, citesOf(tracker.open, unit, joinedTopics(manifest)));
    return wrote;
  });
  /** @type {string[]} */
  const warnings = [...(tracker.warnings ?? [])];
  const paths = [`${unit}/${SPEC_FILE}`, ...(notes ? [notesPath(unit)] : []), `${unit}/manifest.json`];
  const outcome = commitStateTail(cwd, paths, `cut(${unit}): the migration's cut, ${plan.phases.length === 1 ? '1 phase' : `${plan.phases.length} phases`}`, warnings);
  const mark = markPath(cwd, unit);
  fs.mkdirSync(path.dirname(mark), { recursive: true });
  writeJsonAtomic(mark, { at: isoNow(), corrections: plan.corrections });
  /** @type {Record<string, unknown>} */
  const result = {
    unit,
    phases: plan.phases.length,
    built: plan.phases.filter((phase) => 'built' in phase).length,
    adopted: tracker.adopted,
    typed: tracker.typed,
    ...(plan.corrections.length === 0 ? {} : { corrections: plan.corrections.length, ended: tracker.ended }),
    scenarios: Object.values(plan.scenarios).reduce((sum, texts) => sum + texts.length, 0),
    notes: plan.notes.length,
    committed: outcome.committed,
  };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome);
  return result;
}

module.exports = { MIGRATING_USAGE, cutMigrating, unlinkMigrating, markPath, migratedType, oldPlanOrder, noteFaults, correctionFaults, trackerCorrections, cutTopics };
