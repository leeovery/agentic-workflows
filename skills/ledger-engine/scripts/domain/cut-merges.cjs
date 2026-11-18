'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the cut and the merges' work on a unit whose building
// started (directive 080; 21.8.6–21.8.8, E6). The unit's cut is laid out as
// its phases (`unitPhases`), numbered as the cut numbers them: each old
// plan's phase with a tracker parent, and each area of the joined spec no
// plan put in the tracker — the plans in the order their dependencies
// allow, a plan another of the unit's depends on before it, and otherwise
// in the order the spec joins their topics, each plan's phases in its own
// order, an area no plan holds where the spec joins it. The unit's sources
// are the directive's check's (`unitSourcesOf`); the tracker is read as the
// cut's adoption would leave it, writing nothing (task-verbs.cjs,
// `adoptionRead`).
//
// A phase is composed by an agent of its own, briefed with that phase alone
// (brief-records.cjs, `migrated-phase`), which writes its piece,
// `phases/{N}.json` in the unit's staging: `{"phase": {"name", "goal",
// "sections", "relies_on"} or {"name", "goal", "sections", "built": true},
// "scenarios": ["<text>", …], "notes": ["<text>", …], "corrections": […]}`
// — every phase but one the manifest counts built, whose every task the
// tracker holds ended, where the two agree: the join writes that one
// itself, named as its plan heads it, or, where its plan heads it with
// none, as its parent in the tracker is titled, and failing both for its
// plan's topic and number, its goal its plan's `**Goal**:` line, or, where
// it gives none, its plan's topic and number (21.8.6). A verifier reads each
// piece and writes its findings beside it, `phases/{N}.findings.txt`: an
// empty file is the pass, one holding findings sends the piece back to be
// amended, and no file means the piece was never verified.
//
// `migrate join <unit> --directive <id>` joins the pieces into the unit's
// plan, `plan.json`, as the cut takes it (cut-migrating.cjs): the phases in
// order, each naming its tracker parent; each phase's scenarios appended to
// its area's, numbered on from the last, the phase naming them; the notes
// and corrections in phase order; and the person's answers kept. It
// refuses, naming every fault and writing nothing: a unit no building
// unit; a phase whose piece is missing, will not read or is of another
// shape — a phase still to build with no `relies_on` or no scenario, a
// built one with either, a section `spec.md` lacks, a note or a correction
// the cut would refuse (cut-migrating.cjs, `noteFaults`, `correctionFaults`),
// and what the cut's tracker steps would refuse of the phase's piece but a
// link (task-verbs.cjs, `adoptionFaults`) — a correction naming a task no
// phase the cut adopts holds, or titling it otherwise; the phase, its tasks
// read as its corrections end them, marked built holding a task neither
// done nor closed, or not marked built holding none; and a phase marked
// built naming a section outside its old plan's area — each named by its
// phase; a piece its verifier has not passed, or whose
// findings stand; and a phase still to build of a plan that depends on
// another plan's phase still to build, relying on nothing that names it —
// the old dependency named, and both phases. It answers the plan's path
// from the project's folder, as `cut --migrating --file` reads it.
//
// `migrate join <unit> --directive <id> --phase <N> --dry-run` answers the
// faults of that phase's piece alone, as the join would name them, and
// writes nothing: the per-phase agent checks its piece with it before
// handing back. A phase it relies on counts as still to build unless the
// join writes it or its piece reads built; its verifier's verdict is the
// join's own, met there. It refuses a phase the cut lacks, one the
// join writes itself, and a piece that will not read.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { ENDED, STATUS_WORDS, adoptionRead, adoptionFaults } = require('./task-verbs.cjs');
const { loadCheck } = require('./directives.cjs');
const { noteFaults, correctionFaults, trackerCorrections, cutTopics } = require('./cut-migrating.cjs');
const { SPEC_FILE, readSpec, specSections } = require('./spec-sections.cjs');
const { DRY_RUN } = require('./ledger-carry.cjs');

/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-verbs.cjs').AdoptedPhase} AdoptedPhase */

/**
 * An old plan as the cut and the merges' check reads it.
 * @typedef {{topic: string, files: string[], root: string|null, phases: OldPhase[], dependencies: Record<string, any>[]}} MigratedPlan
 * @typedef {{number: number, title: string|null, goal: string|null, parent: string|null, built: boolean, tasks: {id: string, tracker: string, credited: boolean}[]}} OldPhase
 */

/**
 * A building unit's sources, as the check reads them.
 * @typedef {{project: string, areas: {topic: string, spec: string}[], plans: MigratedPlan[], legacy: string|null, staging: string}} UnitSources
 */

/**
 * A phase of the unit's cut: its number, its topic and area, and where it
 * comes from — an old plan's phase, with its tracker parent, what the
 * manifest says of it, its name as its plan heads it or else as the tracker
 * titles its parent, its tasks as the cut's adoption names them and the
 * topic its old plan's root names in the tracker, or an area no plan put
 * in the tracker — where the manifest and the tracker disagree over it,
 * and whether an agent composes it.
 * @typedef {{number: number, topic: string, area: number|null, plan: MigratedPlan|null, old: OldPhase|null, tasks: TaskDetail[], rooted: string|null, disagreements: string[], composed: boolean}} CutPhase
 */

/**
 * What a piece is checked against: the unit, the sections its spec numbers,
 * its cut's phases, and the topics joined, area by area, against which a
 * phase built names its sections — null for a single-topic unit.
 * @typedef {{unit: string, sections: Set<string>, phases: CutPhase[], topics: string[]|null}} CutReading
 */

const PIECE_KEYS = Object.freeze(['phase', 'scenarios', 'notes', 'corrections']);
const ENTRY_KEYS = Object.freeze(['name', 'goal', 'sections', 'relies_on', 'built']);
const PIECE_SHAPE = '{"phase": {"name", "goal", "sections", "relies_on"}, "scenarios": ["<text>", …], "notes": [], "corrections": []}, or for a phase found built {"phase": {"name", "goal", "sections", "built": true}, "scenarios": [], …}';
const USAGE = `migrate join <work-unit> --directive <id> [--phase <N> ${DRY_RUN}]`;

/** @param {unknown} text */
const isLine = (text) => typeof text === 'string' && text.trim() !== '' && !/[\r\n]/.test(text);

/** @param {unknown} list */
const isLines = (list) => Array.isArray(list) && list.every(isLine);

/** A topic's name in words. @param {string} topic */
const titled = (topic) => topic.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

/** The phase of a plan's an old task id names. @param {string} topic @param {unknown} id */
function phaseNamed(topic, id) {
  const named = typeof id === 'string' && id.startsWith(`${topic}-`) ? /^([0-9]+)-/.exec(id.slice(topic.length + 1)) : null;
  return named === null ? null : Number(named[1]);
}

/**
 * The order the unit's cut takes its plans and its areas no plan holds:
 * each a plan or an area, the plans in the order their dependencies on
 * each other allow, and otherwise in the order the spec joins their topics.
 * @param {MigratedPlan[]} plans the plans with a phase in the tracker @param {{topic: string}[]} areas
 * @returns {{topic: string, plan: MigratedPlan|null}[]}
 */
function cutOrder(plans, areas) {
  const joined = areas.map(({ topic }) => topic);
  const rank = (/** @type {string} */ topic) => (joined.includes(topic) ? joined.indexOf(topic) : joined.length);
  const entries = [
    ...plans.map((plan) => ({ topic: plan.topic, plan })),
    ...joined.filter((topic) => !plans.some((plan) => plan.topic === topic)).map((topic) => ({ topic, plan: null })),
  ].sort((a, b) => rank(a.topic) - rank(b.topic) || a.topic.localeCompare(b.topic));
  const topics = new Set(plans.map(({ topic }) => topic));
  const after = (/** @type {{plan: MigratedPlan|null}} */ { plan }) => (plan === null ? [] : plan.dependencies.map(({ on }) => String(on)).filter((on) => topics.has(on) && on !== plan.topic));
  /** @type {{topic: string, plan: MigratedPlan|null}[]} */
  const ordered = [];
  const placed = new Set();
  while (ordered.length < entries.length) {
    const next = entries.find((entry) => !placed.has(entry.topic) && after(entry).every((on) => placed.has(on)))
      ?? entries.find((entry) => !placed.has(entry.topic));
    const entry = /** @type {{topic: string, plan: MigratedPlan|null}} */ (next);
    ordered.push(entry);
    placed.add(entry.topic);
  }
  return ordered;
}

/**
 * Where the manifest and the tracker disagree over one phase: a phase the
 * manifest counts built holding a task neither done nor closed, one it does
 * not holding none; each task it credits done the tracker holds neither
 * done nor closed, and, in a phase it does not count built, each the
 * tracker holds done that it does not credit.
 * @param {MigratedPlan} plan @param {OldPhase} phase @param {number} number the phase's number in the cut @param {TaskDetail[]} tasks
 * @returns {string[]}
 */
function disagreementsOf(plan, phase, number, tasks) {
  const at = `phase ${number}, phase ${phase.number} of ${plan.topic}'s plan`;
  const open = tasks.filter(({ status }) => !ENDED.includes(status));
  const built = phase.built && open.length > 0 ? [`${at}: the manifest counts it built, and the tracker holds ${open.length} of its tasks neither done nor closed`] : [];
  const unbuilt = !phase.built && tasks.length > 0 && open.length === 0 ? [`${at}: the tracker holds every task of it ended, and the manifest does not count it built`] : [];
  const tasked = tasks.flatMap((task) => {
    const old = phase.tasks[task.ref.n - 1];
    if (old === undefined) return [];
    const said = `${old.id}, task ${number}.${task.ref.n}, "${task.title}"`;
    if (old.credited && !ENDED.includes(task.status)) return [`${said}: the manifest credits it done, and the tracker holds it ${STATUS_WORDS[task.status]}`];
    return !old.credited && !phase.built && task.status === 'done' ? [`${said}: the tracker holds it done, and the manifest does not credit it`] : [];
  });
  return [...built, ...unbuilt, ...tasked];
}

/**
 * A building unit's sources, read by the directive's check, refused for a
 * directive whose check carries no unit's work and for a unit that is no
 * building unit.
 * @param {string} cwd @param {string} unit @param {string} directive @param {string} said
 * @returns {UnitSources}
 */
function unitSources(cwd, unit, directive, said) {
  const rules = /** @type {Record<string, unknown>} */ (loadCheck(directive));
  if (typeof rules.unitSourcesOf !== 'function') throw new Error(`${said}: ${directive} carries no unit's work — its pieces are not units`);
  const sources = rules.unitSourcesOf({ projectDir: codeRoot(cwd), stateDir: stateRoot(cwd), unit });
  if (sources === null) throw new Error(`${said}: ${unit} is no unit whose building started — the cut and the merges cut a unit the move left an old plan's items on`);
  return sources;
}

/**
 * The unit's cut laid out as its phases (the header's), with the tracker
 * read as the cut's adoption would leave it — or what refused that read,
 * the phases then holding no task.
 * @param {string} cwd @param {string} unit @param {UnitSources} sources
 * @returns {{phases: CutPhase[], refused: string|null}}
 */
function unitPhases(cwd, unit, sources) {
  const tracked = sources.plans.filter((plan) => plan.phases.some(({ parent }) => parent !== null));
  const areaOf = (/** @type {string} */ topic) => {
    const at = sources.areas.findIndex((area) => area.topic === topic);
    return at === -1 ? null : at + 1;
  };
  /** @type {Omit<CutPhase, 'tasks'|'rooted'|'disagreements'|'composed'>[]} */
  const laid = [];
  for (const { topic, plan } of cutOrder(tracked, sources.areas)) {
    if (plan === null) laid.push({ number: laid.length + 1, topic, area: areaOf(topic), plan: null, old: null });
    else for (const old of plan.phases.filter(({ parent }) => parent !== null)) laid.push({ number: laid.length + 1, topic, area: areaOf(topic), plan, old });
  }
  const adopted = laid.filter(({ old }) => old !== null);
  /** @type {Map<number, {title: string|null, tasks: TaskDetail[], rooted: string|null}>} */
  const held = new Map();
  let refused = null;
  try {
    const read = adoptionRead(cwd, unit, adopted.map(({ number, old }) => {
      const phase = /** @type {OldPhase} */ (old);
      return { phase: number, parent: /** @type {string} */ (phase.parent), order: phase.tasks.map(({ tracker }) => tracker) };
    }));
    read.forEach(({ phase, plan, title, tasks }) => held.set(phase, { title: title.trim() || null, tasks, rooted: plan }));
  } catch (err) {
    refused = messageOf(err);
  }
  const phases = laid.map((phase) => {
    const { title = null, tasks = [], rooted = null } = held.get(phase.number) ?? {};
    const old = phase.old === null ? null : { ...phase.old, title: phase.old.title ?? title };
    const disagreements = phase.plan === null || old === null || refused !== null ? [] : disagreementsOf(phase.plan, old, phase.number, tasks);
    const settled = old !== null && old.built && refused === null && disagreements.length === 0;
    return { ...phase, old, tasks, rooted, disagreements, composed: !settled };
  });
  return { phases, refused };
}

/**
 * Each pair of phases the old plans' dependencies on each other hold: a
 * phase of a plan depending on another plan's phase, which it relies on
 * where both are still to build — the dependency's task id, or, where it
 * names none, that plan's last phase.
 * @param {CutPhase[]} phases
 * @returns {{phase: CutPhase, on: CutPhase, by: string}[]}
 */
function oldReliances(phases) {
  return phases.flatMap((phase) => (phase.plan === null ? [] : phase.plan.dependencies.flatMap((dependency) => {
    const on = String(dependency.on);
    const theirs = phases.filter((other) => other.topic === on && other.old !== null);
    const number = phaseNamed(on, dependency.internal_id);
    const target = number === null ? theirs.at(-1) : theirs.find(({ old }) => old?.number === number);
    return target === undefined || target === phase ? [] : [{ phase, on: target, by: typeof dependency.internal_id === 'string' ? dependency.internal_id : on }];
  })));
}

/** The unit's staging, from the state's folder. @param {UnitSources} sources @param {string} name */
const staged = (sources, name) => `${sources.staging}/${name}`;

/**
 * Where a phase's piece goes, from the state's folder, and beside it the
 * last verifier's findings on it, every verifier's before the last, the
 * points of it the session settled where a verifier reversed an earlier
 * round, the piece the last verifier was briefed on, and the piece the
 * last verifier to write its findings read (later-rounds.cjs).
 * @param {UnitSources} sources @param {number} number
 */
const piecePaths = (sources, number) => ({
  piece: staged(sources, `phases/${number}.json`),
  findings: staged(sources, `phases/${number}.findings.txt`),
  rounds: staged(sources, `phases/${number}.rounds.md`),
  settled: staged(sources, `phases/${number}.settled.md`),
  verifying: staged(sources, `phases/${number}.verifying.json`),
  verified: staged(sources, `phases/${number}.verified.json`),
});

/**
 * What the cut's tracker steps would refuse of a phase's piece but a link
 * (the header's): none for a phase no old plan put in the tracker. Only its
 * corrections of the cut's shape are read, and its sections only where each
 * is a line.
 * @param {CutPhase} phase @param {Record<string, any>} entry @param {unknown[]} corrections @param {CutReading} reading @param {{tracker?: string}[]} tracked
 * @returns {string[]}
 */
function trackerFaults(phase, entry, corrections, reading, tracked) {
  if (phase.old === null) return [];
  const shaped = /** @type {import('./cut-migrating.cjs').Correction[]} */ (corrections.filter((correction) => correctionFaults([correction], tracked).length === 0));
  /** @type {(each: CutPhase) => AdoptedPhase} */
  const adopted = (each) => ({ phase: each.number, plan: each.rooted, built: false, sections: [], tasks: each.tasks });
  const own = { ...adopted(phase), built: entry.built === true, sections: isLines(entry.sections) ? entry.sections : [] };
  return adoptionFaults(reading.phases.filter(({ old }) => old !== null).map(adopted), trackerCorrections(reading.unit, shaped), reading.topics, [own]);
}

/**
 * The faults of a phase's piece, read from its file, against the spec's
 * sections and the cut's phases; each correction's as the cut would find
 * it, and the tracker's as its tracker steps would, named by the phase.
 * @param {CutPhase} phase @param {unknown} piece @param {CutReading} reading
 * @returns {string[]}
 */
function pieceFaults(phase, piece, reading) {
  const which = `phase ${phase.number}'s piece`;
  if (!isObject(piece) || !isObject(piece.phase) || Object.keys(piece).some((key) => !PIECE_KEYS.includes(key)) || Object.keys(piece.phase).some((key) => !ENTRY_KEYS.includes(key))) {
    return [`${which} is not ${PIECE_SHAPE}`];
  }
  const { phase: entry, scenarios = [], notes = [], corrections = [] } = piece;
  const { sections, phases } = reading;
  const built = entry.built === true;
  const tracked = phases.map(({ old }) => (old?.parent ? { tracker: old.parent } : {}));
  return [
    ...(isLine(entry.name) && isLine(entry.goal) ? [] : [`${which} gives no name or goal of one line`]),
    ...(isLines(entry.sections) && entry.sections.length > 0 ? [] : [`${which} names no section`]),
    ...(isLines(entry.sections) ? entry.sections.filter((address) => !sections.has(address)).map((address) => `${which} draws on section "${address}", which ${SPEC_FILE} lacks`) : []),
    ...('built' in entry && !built ? [`${which} marks it "built": ${JSON.stringify(entry.built)} — a phase found built is "built": true, and one still to build names no "built"`] : []),
    ...(built && ('relies_on' in entry || (Array.isArray(scenarios) && scenarios.length > 0)) ? [`${which} marks it built and gives it ${'relies_on' in entry ? '"relies_on"' : 'scenarios'} — a phase found built places no scenario and relies on nothing`] : []),
    ...(!built && !Array.isArray(entry.relies_on) ? [`${which} gives no "relies_on" — a phase still to build names what it relies on, [] for nothing`] : []),
    ...(!built && (!isLines(scenarios) || scenarios.length === 0) ? [`${which} gives no scenario of one line — a phase still to build places its scenarios`] : []),
    ...(Array.isArray(notes) ? noteFaults(notes).map((fault) => `${which}: ${fault}`) : [`${which}'s notes are not a list`]),
    ...(Array.isArray(corrections) ? correctionFaults(corrections, tracked).map((fault) => `${which}: ${fault}`) : [`${which}'s corrections are not a list`]),
    ...trackerFaults(phase, entry, Array.isArray(corrections) ? corrections : [], reading, tracked).map((fault) => `${which}: ${fault}`),
  ];
}

/**
 * Whether the verifier passed a phase's piece: its findings file empty —
 * standing findings or none written refuse the join.
 * @param {string} root @param {UnitSources} sources @param {CutPhase} phase
 * @returns {string[]}
 */
function verifiedFaults(root, sources, phase) {
  const { findings } = piecePaths(sources, phase.number);
  const file = path.join(root, findings);
  if (!fs.existsSync(file)) return [`phase ${phase.number}'s piece is not verified — ${findings} is no file`];
  return fs.readFileSync(file, 'utf8').trim() === '' ? [] : [`phase ${phase.number}'s piece has its verifier's findings standing — ${findings}`];
}

/** The sections the unit's spec numbers. @param {string} cwd @param {string} unit @returns {Set<string>} */
const specAddresses = (cwd, unit) => new Set(specSections(readSpec(cwd, unit)).keys());

/**
 * A phase's piece as its file holds it, or the fault that it will not read.
 * @param {string} root @param {UnitSources} sources @param {CutPhase} phase
 * @returns {{piece: any, fault: string|null}}
 */
function pieceIn(root, sources, phase) {
  const rel = piecePaths(sources, phase.number).piece;
  try {
    return { piece: JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')), fault: null };
  } catch (err) {
    return { piece: null, fault: `phase ${phase.number} has no piece that reads — ${rel}: ${messageOf(err)}` };
  }
}

/**
 * Each phase still to build of `phases` that relies on nothing for a phase
 * still to build its plan depends on, in the join's words — `of` alone where
 * one is named; `building` says which are still to build, and `reliesOn`
 * what a phase's piece relies on.
 * @param {CutPhase[]} phases @param {(phase: CutPhase) => boolean} building @param {(number: number) => unknown[]} reliesOn @param {CutPhase|null} [of]
 */
function unreliedFaults(phases, building, reliesOn, of = null) {
  return oldReliances(phases).filter(({ phase, on }) => (of === null || phase === of) && building(phase) && building(on) && !reliesOn(phase.number).includes(on.number))
    .map(({ phase, on, by }) => `phase ${phase.number}, of ${phase.topic}'s plan, relies on nothing for ${by}, which phase ${on.number}, of ${on.topic}'s plan, builds — it relies on phase ${on.number}`);
}

/**
 * The plan the cut takes, joined from the pieces (the header's), or every
 * fault that refuses the join.
 * @param {string} root the state's folder @param {UnitSources} sources @param {CutReading} reading
 * @returns {{plan: Record<string, any>|null, faults: string[]}}
 */
function joined(root, sources, reading) {
  const { phases } = reading;
  const read = phases.map((phase) => {
    if (!phase.composed) return { phase, piece: null, faults: [] };
    const { piece, fault } = pieceIn(root, sources, phase);
    if (fault !== null) return { phase, piece: null, faults: [fault] };
    return { phase, piece, faults: [...pieceFaults(phase, piece, reading), ...verifiedFaults(root, sources, phase)] };
  });
  const faults = read.flatMap((each) => each.faults);
  const stillToBuild = new Set(read.filter(({ phase, piece }) => phase.composed && piece?.phase?.built !== true).map(({ phase }) => phase.number));
  const reliesOn = (/** @type {number} */ number) => read.find(({ phase }) => phase.number === number)?.piece?.phase?.relies_on ?? [];
  const unrelied = unreliedFaults(phases, (phase) => stillToBuild.has(phase.number), reliesOn);
  if (faults.length > 0 || unrelied.length > 0) return { plan: null, faults: [...faults, ...unrelied] };
  /** @type {Record<string, string[]>} */
  const scenarios = {};
  const cut = read.map(({ phase, piece }) => {
    const tracker = phase.old?.parent ?? undefined;
    if (piece === null) return { name: phase.old?.title ?? `${titled(phase.topic)}, phase ${phase.old?.number}`, goal: phase.old?.goal ?? `Phase ${phase.old?.number} of the ${phase.topic} plan, built before the migration.`, sections: phase.area === null ? [] : [String(phase.area)], built: true, ...(tracker === undefined ? {} : { tracker }) };
    const { built, relies_on: relies, ...entry } = piece.phase;
    if (built === true) return { ...entry, built: true, ...(tracker === undefined ? {} : { tracker }) };
    const area = String(phase.area);
    const block = (scenarios[area] ??= []);
    const ids = piece.scenarios.map((/** @type {string} */ text) => `${area}.S${block.push(text)}`);
    return { ...entry, scenarios: ids, relies_on: relies, ...(tracker === undefined ? {} : { tracker }) };
  });
  const pieces = read.flatMap(({ piece }) => (piece === null ? [] : [piece]));
  return { plan: { phases: cut, scenarios, notes: pieces.flatMap(({ notes = [] }) => notes), corrections: pieces.flatMap(({ corrections = [] }) => corrections) }, faults: [] };
}

/**
 * The faults of one phase's piece, as the join would name them, nothing
 * written (the header's): its own, and where it relies on nothing for a
 * phase its plan depends on, which counts as still to build unless the join
 * writes it or its piece reads built.
 * @param {string} root @param {UnitSources} sources @param {CutReading} reading @param {string} number
 */
function pieceCheck(root, sources, reading, number) {
  const { unit, phases } = reading;
  const phase = phases.find((each) => String(each.number) === number);
  if (phase === undefined) throw new Error(`migrate join: ${unit}'s cut has no phase ${number} — its phases are numbered 1 to ${phases.length}`);
  if (!phase.composed) throw new Error(`migrate join: phase ${phase.number} of ${unit}'s cut is built, and the manifest and the tracker agree — the join writes it`);
  const { piece, fault } = pieceIn(root, sources, phase);
  if (fault !== null) throw new Error(`migrate join: ${fault}`);
  const building = (/** @type {CutPhase} */ other) => (other === phase ? piece?.phase?.built !== true : other.composed && pieceIn(root, sources, other).piece?.phase?.built !== true);
  const reliance = unreliedFaults(phases, building, () => (Array.isArray(piece?.phase?.relies_on) ? piece.phase.relies_on : []), phase);
  return { unit, phase: phase.number, faults: [...pieceFaults(phase, piece, reading), ...reliance] };
}

/**
 * `migrate join <unit> --directive <id> [--phase <N> --dry-run]` (the
 * header's).
 * @param {string} cwd @param {string[]} argv
 */
function joinPlan(cwd, argv) {
  const [unit, flag, directive, ...rest] = argv;
  const checked = rest.length === 3 && rest[0] === '--phase' && rest[2] === DRY_RUN ? rest[1] : null;
  if (unit === undefined || flag !== '--directive' || directive === undefined || (rest.length > 0 && checked === null)) throw new Error(`migrate join: ${USAGE}`);
  const said = 'migrate join';
  const sources = unitSources(cwd, unit, directive, said);
  const root = stateRoot(cwd);
  const { phases, refused } = unitPhases(cwd, unit, sources);
  if (refused !== null) throw new Error(`${said}: the tracker could not be read as the cut adopts ${unit}'s plans — ${refused}`);
  /** @type {Set<string>} */
  let sections;
  try {
    sections = specAddresses(cwd, unit);
  } catch (err) {
    throw new Error(`${said}: ${messageOf(err)}`);
  }
  const reading = { unit, sections, phases, topics: cutTopics(loadWorkUnitManifest(cwd, unit)) };
  if (checked !== null) return pieceCheck(root, sources, reading, checked);
  const { plan, faults } = joined(root, sources, reading);
  if (plan === null) throw new Error(`${said}: ${faults.join('; ')}`);
  const file = path.join(root, staged(sources, 'plan.json'));
  let held = {};
  try {
    held = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    held = {};
  }
  writeJsonAtomic(file, { ...plan, ...(isObject(held) && isObject(held.answers) ? { answers: held.answers } : {}) });
  return {
    unit,
    plan: path.relative(codeRoot(cwd), file),
    phases: plan.phases.length,
    built: plan.phases.filter((/** @type {Record<string, unknown>} */ phase) => phase.built === true).length,
    scenarios: Object.values(plan.scenarios).reduce((sum, texts) => sum + texts.length, 0),
    corrections: plan.corrections.length,
  };
}

module.exports = { cutOrder, unitSources, unitPhases, oldReliances, piecePaths, specAddresses, joinPlan };
