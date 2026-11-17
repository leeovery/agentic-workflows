'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared derivations — phase joins, topic lifecycle, next-phase
// computation and map ordering. Pure over loaded manifests: same input,
// same answer. Generic loads come from domain/reads — derivations may
// require reads; never the reverse.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { loadProjectManifest } = require('./reads.cjs');
const { titlecase } = require('./conventions.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { shownTask } = require('./task-id.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
const { WORK_TYPE_PIPELINES, DERIVED_PHASES, TOPIC_PHASES, isTopicPhase, TERMINAL_STATUSES, BUILD_PHASES, EXPERIMENT_SPAWN_PHASES, EXPERIMENT_TERMINAL_STATUSES, illegalNameReason, isParentExperimentId, compareExperimentIds } = require('../kernel/manifest-schema.cjs');

/**
 * Whether the unit's build has begun: ready to build's yes recorded on its
 * manifest as `build`, which concludes its spec (P7).
 * @param {Record<string, any>} manifest
 */
function buildBegun(manifest) {
  return isObject(manifest.build);
}

/**
 * Whether the topic's decided close stands: its checklist closed, and
 * neither voided — its discussion gone on since (checklist.cjs) — nor taken
 * by a yes since.
 * @param {Record<string, any>} manifest @param {string} topic
 */
function decidedCloseStands(manifest, topic) {
  const record = isObject(manifest.checklists?.decided) ? manifest.checklists.decided[topic] : undefined;
  const closed = isObject(record) ? record.closed : undefined;
  if (typeof closed !== 'string') return false;
  return [record.voided, record.taken].every((since) => typeof since !== 'string' || since < closed);
}

/**
 * Record on the unit's manifest, as it is saved, that the topic's
 * discussion has gone on — a message delivered, an experiment's report, a
 * feature's discussion entered again, a question asked or moved onto it — so
 * its decided close, where one stands, is void (9.7.9): whether it was.
 * @param {Record<string, any>} manifest @param {string} topic @param {string} at
 */
function voidDecidedClose(manifest, topic, at) {
  if (!decidedCloseStands(manifest, topic)) return false;
  manifest.checklists.decided[topic].voided = at;
  return true;
}

/** The day the unit started, its manifest's `created`, null where it holds none (20.15.4). @param {Record<string, any>} manifest @returns {string|null} */
const startedOn = (manifest) => (typeof manifest.created === 'string' ? manifest.created : null);

/**
 * Whether a feature's one topic has closed into its spec, with no gate
 * (11.2.1): its decided close standing. The one screen, decided and ready to
 * build, marks it decided after (11.8.5).
 * @param {Record<string, any>} manifest
 */
const closedIntoSpec = (manifest) => manifest.work_type === 'feature' && decidedCloseStands(manifest, manifest.name);

/** The key a phase's start or close keeps its checklist under (6.4.12). @param {number} number @param {'start'|'close'} end */
const phaseKey = (number, end) => `phase-${number}-${end}`;

/**
 * Whether a phase of the unit's cut was built before the migration cut it,
 * `built: true` on the phase (21.8.6): started, closed and merged wherever a
 * phase is read, with no checklist of its own.
 * @param {Record<string, any>} manifest @param {number} number
 */
const phaseBuilt = (manifest, number) => (Array.isArray(manifest.cut?.phases) ? manifest.cut.phases[number - 1]?.built === true : false);

/** Whether the checklist of a phase's start or close has closed, or the phase was built before the migration. @param {Record<string, any>} manifest @param {number} number @param {'start'|'close'} end */
function phaseEnded(manifest, number, end) {
  if (phaseBuilt(manifest, number)) return true;
  const record = isObject(manifest.checklists) ? manifest.checklists[phaseKey(number, end)] : undefined;
  return isObject(record) && record.closed !== undefined;
}

/** Whether a phase of the unit has started: its start's checklist closed (6.4.8). @param {Record<string, any>} manifest @param {number} number */
const phaseStarted = (manifest, number) => phaseEnded(manifest, number, 'start');

/** Whether a phase of the unit has closed: its close's checklist closed (6.4.9). @param {Record<string, any>} manifest @param {number} number */
const phaseClosed = (manifest, number) => phaseEnded(manifest, number, 'close');

/**
 * A phase of a unit's cut as it is read: a built phase, which keeps its
 * name, goal and the areas its old plan built (21.8.6), read as placing no
 * scenario and relying on nothing.
 * @typedef {{name?: string, goal?: string, sections: string[], scenarios: string[], relies_on: Array<number|string>, built?: true, tracker?: string}} CutPhase
 */

/** The phases of the unit's cut, none where it has none, each as it is read. @param {Record<string, any>} manifest @returns {CutPhase[]} */
const cutPhases = (manifest) => (Array.isArray(manifest.cut?.phases)
  ? manifest.cut.phases.map((/** @type {any} */ phase) => (phase?.built === true ? { scenarios: [], relies_on: [], ...phase } : phase))
  : []);

/** The topics whose old specs the migration joined into the unit's spec, area by area, `spec.joined` (21.8.5); none where it joined none. @param {Record<string, any>} manifest @returns {string[]} */
const joinedTopics = (manifest) => (Array.isArray(manifest.spec?.joined) ? manifest.spec.joined : []);

/** Whether the unit's spec is its old specs joined by the migration (21.8.5): history, concluded and never corrected. @param {Record<string, any>} manifest */
const specJoined = (manifest) => joinedTopics(manifest).length > 0;

/** The tasks of the cut's phases not built that the tracker held done as the migration adopted them, shown, `build.done_before` (21.8.8). @param {Record<string, any>} manifest @returns {string[]} */
const doneBefore = (manifest) => (Array.isArray(manifest.build?.done_before) ? manifest.build.done_before : []);

/**
 * Whether each of the unit's tasks landed before the migration cut the unit
 * (21.8.8): a task of a phase built before it, or one the tracker held done
 * as the migration adopted its phase (`build.done_before`) — built and
 * landed before Ledger, so wherever a task's standing is read it is passed
 * and landed, no landing naming it and no stack of the build holding it.
 * @param {Record<string, any>} manifest @returns {(ref: TaskRef) => boolean}
 */
function landedBefore(manifest) {
  const done = new Set(doneBefore(manifest));
  return (ref) => phaseBuilt(manifest, ref.phase) || done.has(shownTask(ref));
}

/**
 * Whether each of the unit's tasks has landed: landed before the migration
 * (`landedBefore`), else as the landing record reads it, `landed`
 * (task-landed.cjs).
 * @param {Record<string, any>} manifest @param {(ref: TaskRef) => boolean} landed @returns {(ref: TaskRef) => boolean}
 */
function hasLanded(manifest, landed) {
  const before = landedBefore(manifest);
  return (ref) => before(ref) || landed(ref);
}

/** Whether the unit landed any work before the migration cut it: a phase built, or a task done, before it (`landedBefore`). @param {Record<string, any>} manifest */
const landedAnyBefore = (manifest) => cutPhases(manifest).some(({ built }) => built === true) || doneBefore(manifest).length > 0;

/**
 * Of tasks of the unit, those the build built since the migration: each but
 * those landed before it (`landedBefore`), which no stack holds.
 * @template {{ref: TaskRef}} T @param {Record<string, any>} manifest @param {T[]} tasks @returns {T[]}
 */
function builtSince(manifest, tasks) {
  const before = landedBefore(manifest);
  return tasks.filter(({ ref }) => !before(ref));
}

/**
 * Whether a phase's tasks hold nothing built since the migration cut the
 * unit: one at least not closed, each landed before it (`builtSince`) — the
 * phase's review passing with nothing to read.
 * @param {Record<string, any>} manifest @param {{ref: TaskRef, status: string}[]} tasks
 */
function nothingBuiltSince(manifest, tasks) {
  const live = tasks.filter(({ status }) => status !== 'closed');
  return live.length > 0 && builtSince(manifest, live).length === 0;
}

/** Whether a phase of the unit's cut names its parent in the tracker, adopted by the migration (21.8.8): its tasks the old plan's, written. @param {Record<string, any>} manifest @param {number} number */
const phaseAdopted = (manifest, number) => cutPhases(manifest)[number - 1]?.tracker !== undefined;

/**
 * The areas of the joined spec each task of the old plan cites, as the
 * migration's cut found them in its text, `build.cites` (21.8.8): by the
 * task, the areas' numbers, none for a task it found citing none.
 * @param {Record<string, any>} manifest @returns {(ref: TaskRef) => string[]}
 */
function citedAreas(manifest) {
  const cites = isObject(manifest.build?.cites) ? manifest.build.cites : {};
  return (ref) => (Array.isArray(cites[shownTask(ref)]) ? cites[shownTask(ref)] : []);
}

/** The area a section, `N` or `N.M`, or a scenario, `N.Sk`, belongs to. @param {string} address */
const areaOfAddress = (address) => address.split('.')[0];

/** The tasks of phase `number` done before the migration cut the unit, shown (`build.done_before`). @param {Record<string, any>} manifest @param {number} number @returns {string[]} */
const doneBeforeIn = (manifest, number) => doneBefore(manifest).filter((task) => task.startsWith(`${number}.`));

/** Whether a phase of the cut places an area: names it, a part or a scenario of it, or holds a task the cut found citing it. @param {Record<string, any>} manifest @param {string} area */
function placesArea(manifest, area) {
  /** @type {Record<string, string[]>} */
  const cites = manifest.build?.cites ?? {};
  return (/** @type {CutPhase} */ phase, /** @type {number} */ at) => [...phase.sections, ...phase.scenarios].some((address) => areaOfAddress(address) === area)
    || Object.entries(cites).some(([task, areas]) => task.startsWith(`${at + 1}.`) && areas.includes(area));
}

/**
 * How much of an area of the unit's spec was built before the migration cut
 * the unit (21.8.8): `built` where every phase of the cut placing it was
 * built before it (`placesArea`); `partly` where some was, or holds a task
 * done before it (`doneBeforeIn`); null where none placing it was or done
 * any — so for every unit that landed nothing before it — and where none
 * places it.
 * @param {Record<string, any>} manifest @param {string} area @returns {'built'|'partly'|null}
 */
function areaBuilt(manifest, area) {
  const places = placesArea(manifest, area);
  const placing = cutPhases(manifest).flatMap((phase, at) => (places(phase, at) ? [{ built: phase.built === true, done: doneBeforeIn(manifest, at + 1).length > 0 }] : []));
  if (placing.length > 0 && placing.every(({ built }) => built)) return 'built';
  return placing.some(({ built, done }) => built || done) ? 'partly' : null;
}

/** How many phases the unit's cut holds, none where it has none. @param {Record<string, any>} manifest */
const cutLength = (manifest) => cutPhases(manifest).length;

/**
 * Whether the unit's build is through every phase of its cut, each closed —
 * a phase not yet written never read as finished (7.4.3, 12.6.7). The
 * review phase's fix phases, numbered past the cut, are its own (P14).
 * @param {Record<string, any>} manifest
 */
function buildFinished(manifest) {
  const phases = cutPhases(manifest);
  return phases.length > 0 && phases.every((_, at) => phaseClosed(manifest, at + 1));
}

/**
 * Whether a phase is one of the review phase's fix phases: numbered past
 * the build's own (`buildLength`) — of a build through every phase of its
 * cut, or of a quick-fix, whose fixes are its one phase (P14, 14.3.2).
 * @param {Record<string, any>} manifest @param {number} phase
 */
function isFixPhase(manifest, phase) {
  return (quickFixBuild(manifest) || buildFinished(manifest)) && phase > buildLength(manifest);
}

/** A quick-fix's one phase, the fixes, each fix its own task (19.5.4, E4). */
const FIXES_PHASE = Object.freeze({ number: 1, name: 'the fixes' });

/**
 * Whether the unit is built as a quick-fix: its own tasks in its one phase,
 * with no cut, no ready to build and no position (19.5.4, E4). The one
 * place a quick-fix's build is told from a build by its cut, whose readers
 * never see one.
 * @param {Record<string, any>} manifest
 */
function quickFixBuild(manifest) {
  return manifest.work_type === 'quick-fix';
}

/**
 * Whether a quick-fix's fixes have begun: its entry's record, on its
 * manifest, of their phase written (19.5.4), read so the tracker need not
 * be.
 * @param {Record<string, any>} manifest
 */
function fixesBegun(manifest) {
  return isObject(manifest.fixes);
}

/**
 * Whether a quick-fix's fixes are under way: begun, the unit in progress.
 * @param {Record<string, any>} manifest
 */
function fixesUnderWay(manifest) {
  return quickFixBuild(manifest) && fixesBegun(manifest) && manifest.status === 'in-progress';
}

/**
 * Whether a bug's investigation is under way: its topic's item in progress.
 * @param {Record<string, any>} manifest
 */
function investigationUnderWay(manifest) {
  return manifest.work_type === 'bugfix' && itemOf(manifest, 'investigation', manifest.name)?.status === 'in-progress';
}

/**
 * Whether the tracker holds the unit's tasks: its build by the cut begun,
 * or a quick-fix's fixes begun.
 * @param {Record<string, any>} manifest
 */
function tasksBegun(manifest) {
  return buildBegun(manifest) || (quickFixBuild(manifest) && fixesBegun(manifest));
}

/**
 * How many phases the unit's build holds of its own, the review phase's fix
 * phases numbered on past them (P14): its cut's, or a quick-fix's one.
 * @param {Record<string, any>} manifest
 */
function buildLength(manifest) {
  return quickFixBuild(manifest) ? FIXES_PHASE.number : cutLength(manifest);
}

/**
 * Why the unit's build cannot be entered, nor its review phase or its
 * finish reached, with its way on, or null where it can: a build by its
 * cut not begun — never a quick-fix, whose fixes are built at its own arm
 * of the build's entry and closed at finish (`quickFixBuild`).
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function buildRefusal(manifest) {
  if (quickFixBuild(manifest) || buildBegun(manifest)) return null;
  return `${manifest.name}'s build has not begun — ready to build's yes begins it: render ready-to-build ${manifest.name}`;
}

/**
 * Whether the person asked for a quick-fix's review at its close (19.5.13):
 * the request recorded beside its fixes' beginning, `fixes.review_asked`.
 * @param {Record<string, any>} manifest
 */
function reviewAsked(manifest) {
  return fixesBegun(manifest) && typeof manifest.fixes.review_asked === 'string';
}

/**
 * Why a quick-fix's review phase cannot be entered, with its way on, or
 * null where it can and for any other unit: its review runs only once the
 * person asks for one at its close (19.5.14), its row there `review ask`.
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function quickFixReviewRefusal(manifest) {
  if (!quickFixBuild(manifest) || reviewAsked(manifest)) return null;
  return `${manifest.name} is a quick-fix, whose review runs only once the person asks for one at its close — render finish ${manifest.name} draws it`;
}

/**
 * Whether the unit's review phase has begun: its build through every phase
 * of its cut (14.6.1), or a quick-fix whose review the person asked for at
 * its close (19.5.13) — where the review's fix phases are numbered on past
 * the build's own (P14).
 * @param {Record<string, any>} manifest
 */
function reviewBegun(manifest) {
  return buildFinished(manifest) || (quickFixBuild(manifest) && reviewAsked(manifest));
}

/**
 * Where a unit stands in the build's two places, read from its own records
 * and never from items (P13): the build in progress until every phase of
 * its cut has closed, then completed; the review phase in progress from
 * then, the build running straight into it (14.6.1, 24.1.6); and both
 * completed once finish has completed the unit (14.5).
 * @param {Record<string, any>} manifest @param {'implementation'|'review'} phase
 * @returns {'in-progress'|'completed'|null}
 */
function buildPlaceStatus(manifest, phase) {
  if (manifest.status === 'completed') return 'completed';
  if (!buildFinished(manifest)) return phase === 'implementation' ? 'in-progress' : null;
  return phase === 'implementation' ? 'completed' : 'in-progress';
}

/**
 * Where a quick-fix's implementation stands, read from its own record:
 * in progress once its fixes have begun, completed with the unit.
 * @param {Record<string, any>} manifest @returns {'in-progress'|'completed'|null}
 */
function fixesStatus(manifest) {
  if (manifest.status === 'completed') return 'completed';
  return fixesBegun(manifest) ? 'in-progress' : null;
}

/**
 * A phase's status: a topic's phase over its live items, any other off the
 * unit's own records, never items. The one spec a unit writes reads
 * completed once its build has begun, in progress while its `spec.md` is
 * written — the state's to say, so the caller says it (spec-standing.cjs) —
 * and none before. A build by the cut reads its build and its review phase
 * off its own records (`buildPlaceStatus`), a quick-fix its implementation
 * off its own (`fixesStatus`), and either reads none before it begins.
 * @param {Record<string, any>} manifest @param {string} phase @param {boolean} [specWritten]
 * @returns {string|null}
 */
function phaseStatus(manifest, phase, specWritten = false) {
  if (phase === 'specification') return buildBegun(manifest) ? 'completed' : specWritten ? 'in-progress' : null;
  if (BUILD_PHASES.includes(phase) && buildBegun(manifest)) return buildPlaceStatus(manifest, /** @type {'implementation'|'review'} */ (phase));
  if (phase === 'implementation' && quickFixBuild(manifest)) return fixesStatus(manifest);
  if (!TOPIC_PHASES.includes(phase)) return null;
  const p = (manifest.phases || {})[phase] || {};
  const keys = p.items && typeof p.items === 'object' ? Object.keys(p.items) : [];
  if (keys.length > 0) {
    // Non-live statuses drop out of aggregation: the terminal ones — a
    // postponed topic waits on the roadmap, and must not mask the siblings'
    // state (unfiltered, the label went insertion-order-dependent) — and
    // `unstarted`, pre-live: a stub holding messages for a topic no session
    // has started — it must not flip the phase's aggregate label.
    const NON_LIVE = [...TERMINAL_STATUSES, 'unstarted'];
    if (keys.length === 1) {
      const status = (p.items[keys[0]] || {}).status || null;
      return NON_LIVE.includes(status) ? null : status;
    }
    const statuses = keys.map(k => (p.items[k] || {}).status).filter(s => s && !NON_LIVE.includes(s));
    if (statuses.length === 0) return null;
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'in-progress')) return 'in-progress';
    return statuses[0];
  }
  return null;
}

/**
 * A topic phase's items, each with its name.
 * @param {Record<string, any>} manifest @param {import('../kernel/manifest-schema.cjs').TopicPhase} phase
 * @returns {Record<string, any>[]}
 */
function phaseItems(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (!p.items || typeof p.items !== 'object') return [];
  return Object.entries(p.items).map(([name, data]) => ({ name, ...data }));
}

function phaseData(manifest, phase) {
  return (manifest.phases || {})[phase] || {};
}

/** @param {object} manifest @param {import('../kernel/manifest-schema.cjs').TopicPhase} phase @param {string} topic @returns {Record<string, any>|undefined} */
function itemOf(manifest, phase, topic) {
  const item = (phaseData(manifest, phase).items || {})[topic];
  return item && typeof item === 'object' ? item : undefined;
}

// The unit cancel, reactivate and postpone act on, keyed by the name the
// user sees: the Discovery unit, the map row with every conversation under
// its name (its experiment series rides along through its records, never a
// status).
const UNIT_PHASES = {
  discovery: ['discussion'],
};

/**
 * The phase items a unit carries, in unit-phase order — only those that
 * exist.
 * @param {object} manifest @param {keyof typeof UNIT_PHASES} stage @param {string} name
 * @returns {{phase: string, item: Record<string, any>}[]}
 */
function unitItems(manifest, stage, name) {
  return UNIT_PHASES[stage].flatMap((phase) => {
    const item = isTopicPhase(phase) ? itemOf(manifest, phase, name) : undefined;
    return item ? [{ phase, item }] : [];
  });
}

/**
 * A unit's phase items a cancel would take — those carrying a live status.
 * An item with no status was never attempted; a terminal one is already
 * closed.
 * @param {object} manifest @param {keyof typeof UNIT_PHASES} stage @param {string} name
 * @returns {{phase: string, item: Record<string, any>}[]}
 */
function liveUnitItems(manifest, stage, name) {
  return unitItems(manifest, stage, name)
    .filter(({ item }) => typeof item.status === 'string' && !TERMINAL_STATUSES.includes(item.status));
}

/**
 * Whether a Discovery unit exists under the name — a map row, or a
 * discussion item for a topic the map never carried.
 * @param {object} manifest @param {string} topic
 */
function discoveryUnitExists(manifest, topic) {
  return itemOf(manifest, 'discovery', topic) !== undefined || unitItems(manifest, 'discovery', topic).length > 0;
}

/**
 * @typedef {object} CancelPlan
 * @property {{phase: string, item: Record<string, any>}[]} items  the live phase items the cancel stashes
 * @property {string[]} records   every open experiment record, top-level and sub, in register order
 */

/**
 * What a topic's cancel takes — the one reading the transaction executes and
 * the cancel gate renders.
 * @param {object} manifest @param {string} name
 * @returns {CancelPlan}
 */
function cancelPlan(manifest, name) {
  return { items: liveUnitItems(manifest, 'discovery', name), records: openRecords(manifest, name) };
}

/**
 * A topic's non-terminal experiment records, in register order — empty when
 * the topic holds no series.
 * @param {object} manifest @param {string} topic
 * @returns {string[]}
 */
function openRecords(manifest, topic) {
  const series = itemOf(manifest, 'experiment', topic);
  return Object.entries((series && series.experiments) || {})
    .filter(([, r]) => r && typeof r === 'object' && !EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)))
    .map(([id]) => id)
    .sort(compareExperimentIds);
}

/**
 * Each of the unit's topics holding open experiment records, with them in
 * register order — what a cancel of the whole unit ends (18.4.22).
 * @param {object} manifest
 * @returns {{topic: string, ids: string[]}[]}
 */
function unitOpenRecords(manifest) {
  return phaseItems(manifest, 'experiment').map(({ name }) => ({ topic: name, ids: openRecords(manifest, name) })).filter(({ ids }) => ids.length > 0);
}

/**
 * The open records as the experiments a unit gate counts — a split is worked
 * inside its parent, so `E2` with `E2.1` open is one experiment, named with
 * its children (`E2, with E2.1` alone; `E1, E2 with E2.1` among others). A
 * sub-record whose parent has closed stands as its own entry.
 * @param {string[]} records  open ids in register order
 * @returns {string[]}
 */
function openExperiments(records) {
  const parents = records.filter(isParentExperimentId);
  const orphans = records.filter((id) => !isParentExperimentId(id) && !parents.includes(id.split('.')[0]));
  const families = [...parents, ...orphans]
    .sort(compareExperimentIds)
    .map((id) => ({ id, subs: records.filter((r) => r.startsWith(`${id}.`)) }));
  const one = families.length === 1;
  return families.map(({ id, subs }) => (subs.length === 0 ? id : `${id}${one ? ',' : ''} with ${subs.join(', ')}`));
}

// ---------------------------------------------------------------------------
// The roadmap joins — derivations over the PROJECT manifest's `roadmap` node.
// The item's lifecycle is the absence or presence of a join, never a stored
// status, so every consumer asks these instead of reading the field.
// ---------------------------------------------------------------------------

/**
 * The roadmap items on a project manifest — `{}` for an absent or malformed
 * node, the same reading `roadmapState` makes.
 * @param {object|null|undefined} project
 * @returns {Record<string, Record<string, any>>}
 */
function roadmapItems(project) {
  const roadmap = project && typeof project === 'object' ? project.roadmap : undefined;
  if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) return {};
  const items = roadmap.items;
  return items && typeof items === 'object' && !Array.isArray(items) ? items : {};
}

/**
 * The join, when the item carries one. A malformed `pulled_to` (not an
 * object, no work_unit) reads as no join — the write side owns shape.
 * @param {Record<string, any>} item
 * @returns {{work_unit: string, topic?: string}|null}
 */
function itemJoin(item) {
  const j = item.pulled_to;
  if (j && typeof j === 'object' && !Array.isArray(j) && typeof j.work_unit === 'string' && j.work_unit !== '') {
    return j;
  }
  return null;
}

/**
 * The archive mark an item carries (18.8.13) — when it was archived and the
 * horizon it left, `{at, horizon}`, and the topic whose postpone the archive
 * ended, `postponed_from`, where it ended one — or null. A malformed mark
 * reads as none, as a malformed join does.
 * @param {Record<string, any>} item
 * @returns {{at: string, horizon: string|null, postponed_from?: unknown}|null}
 */
function itemArchived(item) {
  const mark = item.archived;
  return mark && typeof mark === 'object' && !Array.isArray(mark) && typeof mark.at === 'string' ? mark : null;
}

/**
 * Whether an item waits on the roadmap: joined to no work, and not archived.
 * @param {Record<string, any>} item
 * @returns {boolean}
 */
function itemWaiting(item) {
  return itemJoin(item) === null && itemArchived(item) === null;
}

/**
 * The way an archived item comes back onto the roadmap (18.8.13).
 * @param {string} name
 * @returns {string}
 */
function bringBack(name) {
  return `bring it back onto a horizon (engine roadmap move ${name} --horizon <h>)`;
}

/**
 * Why `names` cannot seed new work, or null where they can: each a roadmap
 * item, waiting — joined to no work and not archived — and named once. The
 * one check a pull's handoff into discovery and start this work share.
 * @param {Record<string, any>} project @param {unknown[]} names
 * @returns {string|null}
 */
function roadmapSeedRefusal(project, names) {
  const items = roadmapItems(project);
  for (const [at, name] of names.entries()) {
    const item = typeof name === 'string' && Object.hasOwn(items, name) ? items[name] : undefined;
    if (item === undefined) return `the roadmap has no item ${JSON.stringify(name)} to seed the work`;
    const join = itemJoin(item);
    if (join !== null) return `roadmap item "${name}" is joined to work unit "${join.work_unit}" already — only a waiting item seeds new work`;
    if (itemArchived(item) !== null) return `roadmap item "${name}" is archived — only a waiting item seeds new work; ${bringBack(/** @type {string} */ (name))} first`;
    if (names.indexOf(name) < at) return `roadmap item "${name}" is named twice`;
  }
  return null;
}

/**
 * A topic's address — `{work_unit, topic}` — or null for an absent or
 * malformed one. The write side owns shape, as it does for the join.
 * @param {unknown} value
 * @returns {{work_unit: string, topic: string}|null}
 */
function topicAddress(value) {
  const at = /** @type {Record<string, unknown>} */ (value);
  return at && typeof at === 'object' && !Array.isArray(at)
    && typeof at.work_unit === 'string' && at.work_unit !== ''
    && typeof at.topic === 'string' && at.topic !== ''
    ? /** @type {{work_unit: string, topic: string}} */ (at)
    : null;
}

/**
 * The postpone an item carries, when it carries one — the epic and topic it
 * left, or null.
 * @param {Record<string, any>} item
 * @returns {{work_unit: string, topic: string}|null}
 */
function itemPostponedFrom(item) {
  return topicAddress(item.postponed_from);
}

/**
 * @typedef {object} PostponeTarget
 * @property {string} name   the item the postpone writes — the topic's own item's name, or the name the topic goes by
 * @property {Record<string, any>|undefined} item  what already sits there
 * @property {boolean} joined  the item is joined to this topic, so the postpone re-waits it
 * @property {boolean} archived  the item is this topic's own, archived since an earlier postpone, so the postpone brings it back
 * @property {boolean} clash  the item is another's, so the postpone refuses
 */

/**
 * The topic whose postpone an archive ended, as the item's archive mark
 * keeps it, or null. @param {Record<string, any>} item
 */
function archivedHold(item) {
  return topicAddress(itemArchived(item)?.postponed_from);
}

/**
 * The roadmap item a postpone would write: the topic's own — joined to
 * `{workUnit, topic}` and re-waited, or archived with its mark naming the
 * topic and brought back, whatever its name — or, where it has none, the
 * name a birth would take, the one the topic goes by (8.8.20), with
 * whatever already sits on it: an item a postpone of this epic made there,
 * archived with no hold on its mark and brought back, or another's (the
 * clash). The one join the plan's lock, the gate's statement, and the verb
 * all read.
 * @param {object|null|undefined} project @param {string} workUnit @param {string} topic
 * @param {string} goes  the name the topic goes by
 * @returns {PostponeTarget}
 */
function postponeTarget(project, workUnit, topic, goes) {
  const items = roadmapItems(project);
  const entries = Object.entries(items).filter(([, item]) => item && typeof item === 'object');
  const ours = (/** @type {{work_unit: string, topic?: string}|null} */ at) => at !== null && at.work_unit === workUnit && at.topic === topic;
  const joined = entries.find(([, item]) => ours(itemJoin(item)));
  if (joined) return { name: joined[0], item: joined[1], joined: true, archived: false, clash: false };
  const kept = entries.find(([, item]) => ours(archivedHold(item)));
  if (kept) return { name: kept[0], item: kept[1], joined: false, archived: true, clash: false };
  const item = items[goes];
  const archived = item !== undefined && itemArchived(item) !== null && archivedHold(item) === null && item.origin === `postpone:${workUnit}`;
  return { name: goes, item, joined: false, archived, clash: item !== undefined && !archived };
}

/**
 * The name clash a postpone's birth would overwrite, as one sentence naming
 * the topic and the item: the plan's lock reads the roadmap before the epic
 * manifest is written, and the landing reads it again under the project
 * lock, so both refusals say the same thing about the same item. An
 * archived item holds its name as a waiting one does (18.8.21), and either
 * is renamed on the roadmap, or the topic is, to let the postpone through.
 * @param {string} topic  the topic postponing
 * @param {string} name  the name the birth would take
 * @param {Record<string, any>} item  what already sits there
 * @returns {string}
 */
function postponeClashPhrase(topic, name, item) {
  const horizon = typeof item.horizon === 'string' ? ` (horizon "${item.horizon}")` : '';
  const where = itemArchived(item) === null ? horizon : ' (archived)';
  return `postponing "${topic}" is refused — a roadmap item named "${name}"${where} is not this topic's: rename it on the roadmap, or rename the topic, first`;
}

/**
 * @typedef {object} PostponedItem
 * @property {string} name          the item's own name — the topic's, or the name it waited under before the pull that made it a topic
 * @property {string|null} horizon  the bucket it sits in
 * @property {boolean} waiting      no join — the pull forward's return leg is open
 */
/**
 * The roadmap item a postponed topic waits as — the one whose
 * `postponed_from` names it — or null when no item does. The one join the
 * dashboard's postponed line, the receipt's horizon, and the pull-forward
 * row all read.
 * @param {object|null|undefined} project @param {string} workUnit @param {string} topic
 * @returns {PostponedItem|null}
 */
function postponedItem(project, workUnit, topic) {
  for (const [name, item] of Object.entries(roadmapItems(project))) {
    const from = item && typeof item === 'object' ? itemPostponedFrom(item) : null;
    if (from && from.work_unit === workUnit && from.topic === topic) {
      return {
        name,
        horizon: typeof item.horizon === 'string' ? item.horizon : null,
        waiting: itemJoin(item) === null,
      };
    }
  }
  return null;
}

/**
 * Whether a postponed topic's roadmap item still waits — the pull forward's
 * return leg open, which another epic's pull closes.
 * @param {string} cwd @param {string} workUnit @param {string} topic
 */
function postponedStillWaits(cwd, workUnit, topic) {
  const item = postponedItem(loadProjectManifest(cwd), workUnit, topic);
  return Boolean(item && item.waiting);
}

/**
 * @typedef {object} PostponePlan
 * @property {{phase: string, item: Record<string, any>}[]} items  the live phase items the postpone stashes
 * @property {{reason: string}[]} locks  what holds the postpone shut, in refusal order — empty when it is clear
 */

/**
 * What a postpone takes and what holds it shut — the one reading the gate,
 * the menu row, and the verb share. The experiment series is never touched:
 * a live record locks instead, because abandoning it is the destructive act
 * the postpone exists to avoid. Both roadmap-side inputs are read here, before
 * anything is written: a horizon the roadmap could not name would otherwise
 * refuse at the landing, with the epic already postponed and no item waiting.
 * A decided topic still goes while the spec is written, the split moving
 * whole decided topics (11.10.3), until ready to build's yes begins the
 * build and closes the map for good (18.4.19).
 * @param {object} manifest  the epic's manifest
 * @param {string} name
 * @param {object|null|undefined} project  the project manifest — the roadmap side of the clash lock
 * @param {string} [horizon]  the bucket the topic waits in — checked when the caller has one (the menu has not picked yet)
 * @returns {PostponePlan}
 */
function postponePlan(manifest, name, project, horizon) {
  /** @type {{reason: string}[]} */
  const locks = [];
  if (!discoveryUnitExists(manifest, name)) {
    locks.push({ reason: noTopicRefusal(manifest, name) });
    return { items: [], locks };
  }
  const { lifecycle } = computeTopicLifecycle(manifest, name);
  if (lifecycle === 'postponed') {
    locks.push({ reason: `"${name}" is already postponed — it waits on the roadmap` });
  }
  if (lifecycle === 'cancelled') {
    locks.push({ reason: `"${name}" is cancelled — ${mapWayOn(manifest.name, name, lifecycle)}` });
  }
  if (buildBegun(manifest)) {
    locks.push({ reason: `postponing "${name}" is refused — ${manifest.name}'s build has begun, so its map is closed: a decision that must change is settled in the build, and abandoning the work is the unit's cancel, through manage on the start menu` });
  }
  const records = openRecords(manifest, name);
  if (records.length > 0) {
    const open = openExperiments(records);
    locks.push({
      reason: `postponing "${name}" is refused while ${open.length === 1 ? 'an experiment is' : `${open.length} experiments are`} live (${open.join(', ')}) — conclude or abandon ${open.length === 1 ? 'it' : 'them'} first; a laboratory cannot run under a topic that has left the epic`,
    });
  }
  const illegalHorizon = horizon === undefined ? null : illegalNameReason('horizon', horizon);
  if (illegalHorizon) {
    locks.push({ reason: illegalHorizon });
  }
  const target = postponeTarget(project, manifest.name, name, goesBy(topicTitles(manifest), name));
  if (target.clash) {
    locks.push({ reason: postponeClashPhrase(name, target.name, /** @type {Record<string, any>} */ (target.item)) });
  }
  return { items: liveUnitItems(manifest, 'discovery', name), locks };
}

/**
 * One item's live evidence-wait ids (`awaiting_experiments` — the
 * engine-owned lock a spawn places on the spawning phase's own item) — empty
 * when the item or the field is absent.
 * @param {object} manifest @param {string} phase @param {string} topic
 * @returns {string[]}
 */
function awaitedExperiments(manifest, phase, topic) {
  const item = isTopicPhase(phase) ? itemOf(manifest, phase, topic) : undefined;
  return item && Array.isArray(item.awaiting_experiments) ? item.awaiting_experiments : [];
}

/**
 * @typedef {{kind: 'experiment', id: string}} Wait
 */

/**
 * Every wait holding one item's conclusion shut: one `experiment` wait per
 * live awaited id. Derived from the item's own state alone — never stored —
 * and work-type agnostic; an absent item holds nothing.
 * @param {object} manifest @param {import('../kernel/manifest-schema.cjs').TopicPhase} phase @param {string} topic
 * @returns {Wait[]}
 */
function waits(manifest, phase, topic) {
  /** @type {Wait[]} */
  const out = [];
  if (!itemOf(manifest, phase, topic)) return out;
  for (const id of awaitedExperiments(manifest, phase, topic)) out.push({ kind: 'experiment', id });
  return out;
}

/**
 * The topic's live waits across its conversation's items — every wait an
 * in-progress holder is blocked on, spawn-phase order. Only an in-progress
 * holder is trying to conclude: a parked or terminal holder waits on
 * nothing.
 * @param {object} manifest @param {string} topic
 * @returns {Wait[]}
 */
function topicWaits(manifest, topic) {
  return EXPERIMENT_SPAWN_PHASES.flatMap((phase) => {
    const item = itemOf(manifest, phase, topic);
    return item && item.status === 'in-progress' ? waits(manifest, phase, topic) : [];
  });
}

/**
 * Settle a derived item's status over its records — `phaseStatus` one level
 * down: `completed` only when every record is terminal; an empty series is
 * still open (the spawn opened it). Mutates the item; returns the status.
 * @param {{status?: string, experiments?: Record<string, {status?: string}>}} item
 * @returns {string}
 */
function settleItemStatus(item) {
  const records = Object.values(item.experiments || {});
  item.status = records.length > 0 && records.every((r) => EXPERIMENT_TERMINAL_STATUSES.includes(/** @type {string} */ (r.status)))
    ? 'completed'
    : 'in-progress';
  return item.status;
}

// In-progress items of one spawn phase holding a live evidence wait — the
// state that blocks their conclusion and routes the linear pipeline to the
// experiment. A decided one waits on nothing: the experiment it spawned
// runs on, and its report reaches the topic as mail.
/** @param {Record<string, any>} manifest @param {import('../kernel/manifest-schema.cjs').TopicPhase} phase */
function waitingItems(manifest, phase) {
  return phaseItems(manifest, phase)
    .filter((i) => i.status === 'in-progress'
      && Array.isArray(i.awaiting_experiments) && i.awaiting_experiments.length > 0);
}

/**
 * Where a build by its cut goes next, its standing read from its own
 * records (`buildPlaceStatus`): into the build until every phase of its cut
 * has closed; then into the review phase, its fix phases built there; and
 * once finish has completed the unit, an epic's its review, completed —
 * finish hands it to its menu by the epic alone, the menu's complete
 * variant (14.6.2) — and any other unit's nowhere, done (24.1.2).
 * @param {Record<string, any>} manifest @returns {{next_phase: string, phase_label: string}}
 */
function buildNext(manifest) {
  const review = buildPlaceStatus(manifest, 'review');
  if (review === 'completed') {
    return manifest.work_type === 'epic' ? { next_phase: 'review', phase_label: 'review completed' } : { next_phase: 'done', phase_label: 'pipeline complete' };
  }
  return review === 'in-progress'
    ? { next_phase: 'review', phase_label: 'review (in-progress)' }
    : { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
}

/**
 * Where the unit's work goes next, and the label the menus show for it,
 * `specWritten` saying whether its spec is written (phaseStatus).
 * @param {Record<string, any>} manifest @param {boolean} [specWritten]
 * @returns {{next_phase: string, phase_label: string}}
 */
function computeNextPhase(manifest, specWritten = false) {
  if (buildBegun(manifest)) return buildNext(manifest);
  const wt = manifest.work_type;

  const ps = (/** @type {string} */ phase) => phaseStatus(manifest, phase, specWritten);

  // A quick-fix's fixes, then its review only once the person asked for one
  // at its close (19.5.14).
  if (wt === 'quick-fix') {
    if (manifest.status === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
    if (reviewAsked(manifest)) return { next_phase: 'review', phase_label: 'review (in-progress)' };
    if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
    return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  }

  // The linear types' earliest in-flight phase owns the next action. Epics
  // are excluded — their next_phase is phase-coarse.
  if (wt !== 'epic') {
    const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (wt)] || [];
    for (const phase of pipeline) {
      // The earliest in-flight phase owns the next action. A discussion holding a live
      // evidence wait cannot act, and an in-flight experiment slot is
      // that wait's other side (a discussion's lock sits later in the
      // pipeline than the laboratory it waits on): both route to the
      // experiment. Linear types only — an epic's next_phase is
      // phase-coarse, and its topic-grain experiment rows carry the route
      // instead.
      if (ps(phase) === 'in-progress' && !(phase === 'discussion' && closedIntoSpec(manifest))) {
        const awaiting = DERIVED_PHASES.includes(phase)
          ? EXPERIMENT_SPAWN_PHASES.some((p) => waitingItems(manifest, p).length > 0)
          : isTopicPhase(phase) && EXPERIMENT_SPAWN_PHASES.includes(phase) && waitingItems(manifest, phase).length > 0;
        if (awaiting) {
          return { next_phase: 'experiment', phase_label: 'experiment (awaiting evidence)' };
        }
        // An experiment no conversation waits on runs beside the pipeline,
        // which walks on past it.
        if (DERIVED_PHASES.includes(phase)) continue;
        return { next_phase: phase, phase_label: `${phase} (in-progress)` };
      }
    }
  }

  if (ps('specification') === 'in-progress') {
    return {
      next_phase: 'specification',
      phase_label: 'specification (in-progress)',
    };
  }

  if (wt === 'bugfix') {
    if (ps('investigation') === 'completed') {
      return {
        next_phase: 'specification',
        phase_label: 'ready for specification',
      };
    }
    if (ps('investigation') === 'in-progress') {
      return {
        next_phase: 'investigation',
        phase_label: 'investigation (in-progress)',
      };
    }
    return { next_phase: 'investigation', phase_label: 'ready for investigation' };
  }

  if (ps('discussion') === 'completed' || closedIntoSpec(manifest)) {
    return { next_phase: 'specification', phase_label: 'ready for specification' };
  }
  if (ps('discussion') === 'in-progress') {
    return { next_phase: 'discussion', phase_label: 'discussion (in-progress)' };
  }

  if (ps('experiment') === 'in-progress') {
    return { next_phase: 'experiment', phase_label: 'experiment (in-progress)' };
  }

  return { next_phase: 'discussion', phase_label: 'ready for discussion' };
}

const TIER_RANK = { '✓': 0, '◐': 1, '○': 2, '⊘': 3, '⊖': 4 };

// Shared row comparator for the discovery map: tier rank first — decided
// leads, then in-flight, fresh, with cancelled/postponed trailing — then
// suggested execution order ascending (null orders sort last), then name as
// final fallback.
function compareMapRows(a, b) {
  const ra = TIER_RANK[a.tier] != null ? TIER_RANK[a.tier] : 99;
  const rb = TIER_RANK[b.tier] != null ? TIER_RANK[b.tier] : 99;
  if (ra !== rb) return ra - rb;
  const oa = a.order == null ? Infinity : a.order;
  const ob = b.order == null ? Infinity : b.order;
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name);
}

// An `unstarted` stub (messages waiting, no session yet) renders as `fresh`
// by fall-through. Whether mail waits is a fact about the mailbox on disk,
// never the manifest — `mailboxDepth` reads it.
function computeTopicLifecycle(manifest, topicName) {
  const discovery = phaseItems(manifest, 'discovery').find(i => i.name === topicName);
  const discussion = phaseItems(manifest, 'discussion').find(i => i.name === topicName);
  const ds = discussion ? discussion.status : null;

  // Stored markers win over name-matching, the cancel ahead of the postpone:
  // a cancelled topic is off the board whatever its items say, a postponed
  // one has left the epic for the roadmap. Read only the item's own fields —
  // never inspect siblings or provenance.
  if (discovery && discovery.cancelled === true) {
    return { lifecycle: 'cancelled', tier: '⊘', current_phase: null, discussion_state: ds };
  }
  if (discovery && discovery.postponed === true) {
    return { lifecycle: 'postponed', tier: '⊖', current_phase: null, discussion_state: ds };
  }

  if (ds === 'completed') {
    return { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', discussion_state: ds };
  }
  if (ds === 'in-progress') {
    return { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion', discussion_state: ds };
  }
  // A discussion cancelled or postponed on its own item reads as that
  // closure — the only reading a topic with no map row has. It must not
  // fall through to fresh: its item refuses a start, and the way back
  // is reactivate.
  if (ds === 'cancelled') {
    return { lifecycle: 'cancelled', tier: '⊘', current_phase: null, discussion_state: ds };
  }
  if (ds === 'postponed') {
    return { lifecycle: 'postponed', tier: '⊖', current_phase: null, discussion_state: ds };
  }
  return { lifecycle: 'fresh', tier: '○', current_phase: null, discussion_state: ds };
}

// The lifecycles a topic leaves the board under — no row, no action.
const CLOSED_LIFECYCLES = ['cancelled', 'postponed'];

// Why a lifecycle stands in the way of a move — the map ops' refusals and
// the phase-birth guard share it, so the engine and the epic menu's
// conversational rejections never drift.
/** @param {string} lifecycle */
function lifecyclePhrase(lifecycle) {
  switch (lifecycle) {
    case 'fresh': return 'nothing has started on it';
    case 'discussing': return 'discussion is in flight on it';
    case 'decided': return 'discussion has concluded';
    case 'postponed': return 'it is postponed and waits on the roadmap';
    default: return 'it is cancelled and stays on the map as record'; // cancelled
  }
}

// The way on past the door a topic's lifecycle closes, by the verb that
// changes the map in the epic's discovery (8.6.5): a decided topic reopened
// by a message, a postponed one pulled forward from the roadmap, a cancelled
// one reactivated, and any other cancelled instead.
/** @param {string} epic @param {string} topic @param {string} lifecycle @returns {string} */
function mapWayOn(epic, topic, lifecycle) {
  switch (lifecycle) {
    case 'decided': return 'a message to it carrying why reopens it';
    case 'postponed': return `pull it forward first: roadmap pull-forward ${topic} --into ${epic}`;
    case 'cancelled': return `reactivate it first: topic reactivate ${epic} discovery ${topic}`;
    default: return `cancel it instead: topic cancel ${epic} discovery ${topic}`;
  }
}

// The actions the map derives for its conversation, keyed by the phase it
// enters — the one vocabulary the epic menu's rows and the birth guard
// share.
const CONVERSATION_ACTIONS = {
  discussion: ['start_discussion', 'continue_discussion'],
};

/**
 * The map row's next action.
 * @param {string} lifecycle
 * @returns {string|null}
 */
function computeNextAction(lifecycle) {
  switch (lifecycle) {
    case 'fresh': return 'start_discussion';
    case 'discussing': return 'continue_discussion';
    default: return null;
  }
}

function computeMapSummary(items) {
  const counts = { total: items.length, decided: 0, in_flight: 0, fresh: 0, cancelled: 0, postponed: 0 };
  for (const it of items) {
    switch (it.tier) {
      case '✓': counts.decided++; break;
      case '◐': counts.in_flight++; break;
      case '○': counts.fresh++; break;
      case '⊘': counts.cancelled++; break;
      case '⊖': counts.postponed++; break;
    }
  }
  return counts;
}

// The conversations a topic's mail waits for, in the order a pipeline is
// searched: discussion, or a bugfix's investigation.
const MAIL_PHASES = /** @type {const} */ (['discussion', 'investigation']);

/**
 * The phase a unit's topics are talked through, where their mail is raised
 * (10.1.3): the first of `MAIL_PHASES` its work type's pipeline holds, null
 * for a quick-fix, which talks through none.
 * @param {string} workType @returns {typeof MAIL_PHASES[number]|null}
 */
function mailPhase(workType) {
  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (workType)] ?? [];
  return MAIL_PHASES.find((phase) => pipeline.includes(phase)) ?? null;
}

/**
 * A topic's own folder, state-relative — the one place the layout is
 * spelled (4.11.5).
 * @param {string} workUnit @param {string} topic
 * @returns {string}
 */
function topicDir(workUnit, topic) {
  return `${workUnit}/topics/${topic}`;
}

/**
 * A topic's mailbox, state-relative: one per topic, in the topic's own
 * folder, naming no phase (10.1.3).
 * @param {string} workUnit @param {string} topic
 * @returns {string}
 */
function mailboxDir(workUnit, topic) {
  return `${topicDir(workUnit, topic)}/mail`;
}

/**
 * A topic's brief, state-relative: discovery's brief for the topic, in its
 * own folder (8.7.1).
 * @param {string} workUnit @param {string} topic
 * @returns {string}
 */
function briefFile(workUnit, topic) {
  return `${topicDir(workUnit, topic)}/brief.md`;
}

/**
 * What a move sets aside in its one topic's folder, by what it was
 * (19.5.16, workunit-move.cjs): a quick-fix's build folder, its summary and
 * its review's folder, and a bugfix's investigation log.
 */
const EARLIER = Object.freeze({ build: 'build', summary: 'summary.md', review: 'review', investigationLog: 'investigation-log.md' });

/**
 * Where a moved unit's earlier material sits, state-relative: in its
 * topic's own folder, read at the topic's first opening as input it never
 * changes, and taken along with the topic by an absorb.
 * @param {string} workUnit @param {string} topic @param {string} name one of EARLIER's, or a path beneath one
 * @returns {string}
 */
function earlierFile(workUnit, topic, name) {
  return `${topicDir(workUnit, topic)}/earlier/${name}`;
}

/**
 * The names struck from an epic's map — each topic removed, and each
 * candidate the person struck — which nothing proposes again (8.10.11).
 * @param {object} manifest
 * @returns {string[]}
 */
function dismissedNames(manifest) {
  const discovery = /** @type {Record<string, any>} */ (manifest).phases?.discovery;
  return Array.isArray(discovery?.dismissed) ? discovery.dismissed : [];
}

/**
 * The titles a rename gave the unit's started topics, by key — each the name
 * the person renamed the topic to, its key keeping the name it started under
 * (8.8.17). A screen drawn without the manifest carries these.
 * @param {object} manifest
 * @returns {Record<string, string>}
 */
function topicTitles(manifest) {
  const items = /** @type {Record<string, any>} */ (manifest).phases?.discovery?.items ?? {};
  return Object.fromEntries(Object.entries(items).flatMap(([key, row]) => (row && typeof row.title === 'string' ? [[key, row.title]] : [])));
}

/**
 * The name a topic goes by: its title where a rename gave it one, else its
 * key. @param {Record<string, string>} titles the unit's `topicTitles` @param {string} topic
 */
function goesBy(titles, topic) {
  return Object.hasOwn(titles, topic) ? titles[topic] : topic;
}

/**
 * How every screen titles a topic of the unit — the one way a topic's name
 * reaches the person: the name it goes by, title-cased, each word `said`
 * writes in capitals kept so — a name is a slug, lower case throughout, so
 * `ai-content-engine`, its description naming AI, is `AI Content Engine`.
 * @param {Record<string, string>} titles the unit's `topicTitles` @param {string} topic
 * @param {string} [said] what the topic's own words say of it
 * @returns {string}
 */
function titled(titles, topic, said = '') {
  const words = goesBy(titles, topic).split('-').map((word) => acronymIn(said, word) ?? word);
  return titlecase(words.join(' '));
}

/**
 * `word` in capitals where `said` writes it so, as a whole word; else
 * null.
 * @param {string} said @param {string} word @returns {string|null}
 */
function acronymIn(said, word) {
  const capitals = word.toUpperCase();
  return /^[A-Z0-9]+$/.test(capitals) && new RegExp(`\\b${capitals}\\b`).test(said) ? capitals : null;
}

/**
 * The name an item of `phase` goes by: a topic the name it goes by, a
 * specification and what is built from it its own name, though it may share
 * a topic's key.
 * @param {Record<string, string>} titles the unit's `topicTitles` @param {string} phase @param {string} name
 * @returns {string}
 */
function itemName(titles, phase, name) {
  return TOPIC_PHASES.includes(phase) ? goesBy(titles, name) : name;
}

/**
 * How screens title an item of `phase`, read from the unit's manifest: a
 * topic as `topicTitle` titles it, a specification and what is built from
 * it by its own name, title-cased.
 * @param {object} manifest @param {string} phase @param {string} name
 * @returns {string}
 */
function itemTitle(manifest, phase, name) {
  return TOPIC_PHASES.includes(phase) ? topicTitle(manifest, name) : titlecase(name);
}

/**
 * `titled` read from the unit's manifest, the topic's summary and
 * description saying how its words are written.
 * @param {object} manifest @param {string} topic @returns {string}
 */
function topicTitle(manifest, topic) {
  const item = /** @type {Record<string, any>} */ (manifest).phases?.discovery?.items?.[topic];
  return titled(topicTitles(manifest), topic, [item?.summary, item?.description].filter((said) => typeof said === 'string').join('\n'));
}

/**
 * The key of the unit's topic that `said` names — the one way a topic the
 * person names reaches a verb, a render or the entry: a topic's key is its
 * own, and the title a rename gave a started topic (8.8.17) resolves to
 * that topic's key. Any other name comes back as said, for the caller to
 * take as new or refuse (`noTopicRefusal`).
 * @param {object} manifest @param {string} said
 * @returns {string}
 */
function topicKey(manifest, said) {
  if (itemOf(manifest, 'discovery', said)) return said;
  const titles = topicTitles(manifest);
  return Object.keys(titles).find((key) => titles[key] === said) ?? said;
}

/**
 * Why `said` names no topic of the unit: its live topics, each by the name
 * it goes by — the map's, and a discussion's the map never carried — or
 * that it has none. A cancelled or postponed topic is left out, since its
 * name takes a refusal of its own.
 * @param {object} manifest @param {string} said
 * @returns {string}
 */
function noTopicRefusal(manifest, said) {
  const phases = /** @type {Record<string, any>} */ (manifest).phases ?? {};
  const titles = topicTitles(manifest);
  const keys = new Set([...Object.keys(phases.discovery?.items ?? {}), ...Object.keys(phases.discussion?.items ?? {})]);
  const names = [...keys].filter((key) => !CLOSED_LIFECYCLES.includes(computeTopicLifecycle(manifest, key).lifecycle)).map((key) => goesBy(titles, key));
  return names.length === 0
    ? `no topic "${said}" — the map has no live topics`
    : `no topic "${said}" — the map's topics are ${names.join(', ')}`;
}

/**
 * A topic's messages: the mailbox's `.md` file names in the order they
 * landed, `[]` when no mailbox exists. The one reader of a mailbox's
 * contents.
 * @param {string} stateDir  the state root
 * @param {string} workUnit @param {string} topic
 * @returns {string[]}
 */
function mailboxFiles(stateDir, workUnit, topic) {
  /** @type {fs.Dirent[]} */
  let entries;
  try {
    entries = fs.readdirSync(path.join(stateDir, mailboxDir(workUnit, topic)), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort();
}

// A topic's mailbox depth. The cue means "messages wait here", and that is a
// fact about the mailbox directory, not the item's status: a landing on a
// decided topic sets it back in progress, and an answered message's file
// goes, so an empty directory is the released signal with nothing to clear.
/** @param {string} stateDir @param {string} workUnit @param {string} topic @returns {number} */
function mailboxDepth(stateDir, workUnit, topic) {
  return mailboxFiles(stateDir, workUnit, topic).length;
}

/**
 * The phase whose topic has mail waiting in a single-topic unit — its start
 * menu row's cue: the unit's mail phase, where mail waits for the unit's
 * own topic; none where none waits.
 * @param {string} stateDir  the state root @param {{name: string, work_type: string}} manifest @returns {string[]}
 */
function mailPhases(stateDir, manifest) {
  const phase = mailPhase(manifest.work_type);
  return phase !== null && mailboxDepth(stateDir, manifest.name, manifest.name) > 0 ? [phase] : [];
}

/**
 * @typedef {object} DiscoveryMapRow
 * @property {string} name
 * @property {string|null} summary            normalised — whitespace-only / non-string reads as null
 * @property {boolean} summary_present
 * @property {string|null} description        raw value, for surfaces that render it in full
 * @property {boolean} description_present     normalised presence
 * @property {string} title                   how screens title the topic (`topicTitle`)
 * @property {string} goes_by                 the name the topic goes by — its title, else its key
 * @property {string} source
 * @property {number|null} order
 * @property {string} lifecycle
 * @property {string} tier
 * @property {string|null} current_phase
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {boolean} mail_waiting       messages wait in the topic's mailbox, whatever its items' status
 * @property {number} mail_queued         how many messages wait in the topic's mailbox, counted from disk
 * @property {Wait[]} waits               the live waits of the topic's in-progress discussion (empty when none)
 */

/**
 * The discovery-map rows for one epic manifest: each discovery item joined to
 * its per-phase lifecycle, sorted by tier → order → name, with the map
 * summary. The single builder every discovery-map surface reads, so no two
 * can silently disagree.
 *
 * Each row carries the superset of fields any surface needs. `summary` and
 * `description_present` follow the normalised reading — a whitespace-only or
 * non-string value is treated as absent — so the presence booleans always
 * agree with the text; `description` carries the raw value for surfaces that
 * render it in full.
 * @param {object} manifest
 * @param {string} stateDir  the state root — the mailboxes are read from disk
 * @returns {{map: DiscoveryMapRow[], summary: object}}
 */
function buildDiscoveryMap(manifest, stateDir) {
  const discoveryItems = phaseItems(manifest, 'discovery');
  const map = discoveryItems.map((item) => {
    const { lifecycle, tier, current_phase, discussion_state } = computeTopicLifecycle(manifest, item.name);
    const mail_queued = mailboxDepth(stateDir, manifest.name, item.name);
    const summaryText = typeof item.summary === 'string' && item.summary.trim() ? item.summary : null;
    const descriptionText = typeof item.description === 'string' && item.description.trim() ? item.description : null;
    return {
      name: item.name,
      summary: summaryText,
      summary_present: summaryText !== null,
      description: item.description || null,
      description_present: descriptionText !== null,
      title: topicTitle(manifest, item.name),
      goes_by: goesBy(topicTitles(manifest), item.name),
      source: item.source || 'discovery',
      order: item.order ?? null,
      lifecycle,
      tier,
      current_phase,
      discussion_state,
      mail_waiting: mail_queued > 0,
      mail_queued,
      waits: topicWaits(manifest, item.name),
    };
  });
  map.sort(compareMapRows);
  return { map, summary: computeMapSummary(map) };
}

module.exports = {
  voidDecidedClose,
  closedIntoSpec,
  phaseData,
  phaseItems,
  startedOn,
  buildBegun,
  phaseKey,
  phaseBuilt,
  phaseStarted,
  phaseClosed,
  buildFinished,
  cutPhases,
  specJoined,
  joinedTopics,
  landedBefore,
  hasLanded,
  landedAnyBefore,
  builtSince,
  nothingBuiltSince,
  phaseAdopted,
  citedAreas,
  areaOfAddress,
  doneBeforeIn,
  areaBuilt,
  cutLength,
  isFixPhase,
  buildRefusal,
  FIXES_PHASE,
  quickFixBuild,
  fixesBegun,
  fixesUnderWay,
  investigationUnderWay,
  tasksBegun,
  reviewAsked,
  quickFixReviewRefusal,
  reviewBegun,
  buildLength,
  buildPlaceStatus,
  phaseStatus,
  UNIT_PHASES,
  unitItems,
  liveUnitItems,
  discoveryUnitExists,
  cancelPlan,
  postponePlan,
  openExperiments,
  openRecords,
  unitOpenRecords,
  roadmapItems,
  itemJoin,
  itemArchived,
  itemWaiting,
  bringBack,
  roadmapSeedRefusal,
  topicAddress,
  itemPostponedFrom,
  postponeTarget,
  postponeClashPhrase,
  postponedItem,
  postponedStillWaits,
  awaitedExperiments,
  waits,
  topicWaits,
  settleItemStatus,
  computeNextPhase,
  computeTopicLifecycle,
  computeNextAction,
  CONVERSATION_ACTIONS,
  CLOSED_LIFECYCLES,
  lifecyclePhrase,
  mapWayOn,
  itemOf,
  computeMapSummary,
  compareMapRows,
  buildDiscoveryMap,
  mailPhase,
  topicDir,
  mailboxDir,
  briefFile,
  EARLIER,
  earlierFile,
  dismissedNames,
  topicTitle,
  topicTitles,
  goesBy,
  titled,
  itemName,
  itemTitle,
  topicKey,
  noTopicRefusal,
  mailboxFiles,
  mailboxDepth,
  mailPhases,
  TIER_RANK,
};
