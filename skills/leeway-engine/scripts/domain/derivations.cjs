'use strict';

// ---------------------------------------------------------------------------
// Domain ring: shared derivations — phase joins, topic lifecycle, next-phase
// computation, map ordering, and analysis-cache status. Pure over loaded
// manifests: same input, same answer. Generic loads come from domain/reads —
// derivations may require reads; never the reverse.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { fileExists, filesChecksum, loadProjectManifest } = require('./reads.cjs');
const { titlecase } = require('./conventions.cjs');
const { RECORDS_DIR } = require('../kernel/knowledge/files.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { WORK_TYPE_PIPELINES, LEGACY_WORK_TYPES, DERIVED_PHASES, TOPIC_PHASES, TERMINAL_STATUSES, BUILD_PHASES, EXPERIMENT_SPAWN_PHASES, EXPERIMENT_TERMINAL_STATUSES, illegalNameReason, isParentExperimentId, compareExperimentIds } = require('../kernel/manifest-schema.cjs');

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

/** Whether the checklist of a phase's start or close has closed. @param {Record<string, any>} manifest @param {number} number @param {'start'|'close'} end */
function phaseEnded(manifest, number, end) {
  const record = isObject(manifest.checklists) ? manifest.checklists[phaseKey(number, end)] : undefined;
  return isObject(record) && record.closed !== undefined;
}

/** Whether a phase of the unit has started: its start's checklist closed (6.4.8). @param {Record<string, any>} manifest @param {number} number */
const phaseStarted = (manifest, number) => phaseEnded(manifest, number, 'start');

/** Whether a phase of the unit has closed: its close's checklist closed (6.4.9). @param {Record<string, any>} manifest @param {number} number */
const phaseClosed = (manifest, number) => phaseEnded(manifest, number, 'close');

/** The phases of the unit's cut, none where it has none. @param {Record<string, any>} manifest @returns {Array<{name?: string, sections: string[], scenarios: string[], relies_on: Array<number|string>}>} */
const cutPhases = (manifest) => (Array.isArray(manifest.cut?.phases) ? manifest.cut.phases : []);

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

/**
 * Whether the unit was built under the old plan: its old scoping's, spec's,
 * planning's or implementation's items standing on its manifest, which
 * 29.17's cut takes (P12).
 * @param {Record<string, any>} manifest
 */
function legacyBuild(manifest) {
  return ['scoping', 'specification', 'planning', 'implementation'].some((phase) => phaseItems(manifest, phase).length > 0);
}

/** A quick-fix's one phase, the fixes, each fix its own task (19.5.4, E4). */
const FIXES_PHASE = Object.freeze({ number: 1, name: 'the fixes' });

/**
 * Whether the unit is built as a quick-fix: its own tasks in its one phase,
 * with no cut, no ready to build and no position (19.5.4, E4) — a quick-fix
 * with nothing of the old plan standing. The one place a quick-fix's build
 * is told from a build by its cut, whose readers never see one.
 * @param {Record<string, any>} manifest
 */
function quickFixBuild(manifest) {
  return manifest.work_type === 'quick-fix' && !legacyBuild(manifest);
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
 * Why a unit of a type the reshape retires has no way into its work, or null
 * for any other: it is read until the reshape's 29.17 cut takes it (19.6.7).
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function retiredRefusal(manifest) {
  return Object.hasOwn(LEGACY_WORK_TYPES, manifest.work_type)
    ? `${manifest.name} is a ${manifest.work_type} unit, a type the reshape retires — it waits on the reshape's 29.17 migration, and nothing is done in it until then`
    : null;
}

/**
 * Whether the unit waits on the migration's cut: of a type the reshape
 * retires, or built under the old plan — a quick-fix today's scoping made
 * among them. Its menus show it waiting, with no route into its work (P12).
 * @param {Record<string, any>} manifest
 */
function awaitsCut(manifest) {
  return retiredRefusal(manifest) !== null || legacyBuild(manifest);
}

/**
 * Whether the unit's build runs by its cut: begun at ready to build's yes,
 * with nothing of the old plan standing.
 * @param {Record<string, any>} manifest
 */
function buildByCut(manifest) {
  return buildBegun(manifest) && !legacyBuild(manifest);
}

/**
 * Why the unit's build cannot be entered, nor its review phase or its
 * finish reached, with its way on, or null where it can: a unit of a
 * retired type, a unit built under the old plan, and a build by its cut not
 * begun — never a quick-fix, whose fixes are built at its own arm of the
 * build's entry and closed at finish (`quickFixBuild`).
 * @param {Record<string, any>} manifest @returns {string|null}
 */
function buildRefusal(manifest) {
  const unit = manifest.name;
  const retired = retiredRefusal(manifest);
  if (retired !== null) return retired;
  if (legacyBuild(manifest)) return `${unit} was built under the old plan, and its build is entered once the reshape's 29.17 migration has cut it`;
  if (quickFixBuild(manifest) || buildBegun(manifest)) return null;
  return `${unit}'s build has not begun — ready to build's yes begins it: render ready-to-build ${unit}`;
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
 * A phase's status over its live items. The one spec a unit writes keeps no
 * items: it reads completed once its build has begun, in progress while its
 * `spec.md` is written — the state's to say, so the caller says it
 * (spec-standing.cjs) — and none before. A build by the cut reads its build
 * and its review phase off its own records (`buildPlaceStatus`), and a
 * quick-fix its implementation off its own (`fixesStatus`). A unit
 * whose building began under the old spec keeps that spec's items, which
 * are read alone.
 * @param {Record<string, any>} manifest @param {string} phase @param {boolean} [specWritten]
 * @returns {string|null}
 */
function phaseStatus(manifest, phase, specWritten = false) {
  if (BUILD_PHASES.includes(phase) && buildByCut(manifest)) return buildPlaceStatus(manifest, /** @type {'implementation'|'review'} */ (phase));
  if (phase === 'implementation' && quickFixBuild(manifest)) return fixesStatus(manifest);
  const p = (manifest.phases || {})[phase] || {};
  const keys = p.items && typeof p.items === 'object' ? Object.keys(p.items) : [];
  if (keys.length > 0) {
    // Non-live statuses drop out of aggregation: cancelled/superseded/proposed,
    // promoted and postponed alike — a promoted spec continues in its
    // cross-cutting unit and a postponed topic waits on the roadmap, and
    // neither must mask the siblings' state (unfiltered, the label went
    // insertion-order-dependent). `unstarted` is pre-live: a stub holding
    // messages for a topic no session has started — it must not flip the
    // phase's aggregate label.
    const NON_LIVE = ['cancelled', 'superseded', 'proposed', 'promoted', 'unstarted', 'postponed'];
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
  if (phase !== 'specification') return null;
  if (buildBegun(manifest)) return 'completed';
  return specWritten ? 'in-progress' : null;
}

function phaseItems(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (!p.items || typeof p.items !== 'object') return [];
  return Object.entries(p.items).map(([name, data]) => ({ name, ...data }));
}

function phaseData(manifest, phase) {
  return (manifest.phases || {})[phase] || {};
}

/** @param {object} manifest @param {string} phase @param {string} topic @returns {Record<string, any>|undefined} */
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
    const item = itemOf(manifest, phase, name);
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
 * Whether a completed item's record has moved since it completed: its
 * reconcile flag. The one reading the linear route and the linear
 * dashboard's cue share, so the bridge can never route back to a phase the
 * display calls settled.
 * @param {{status?: string, reconcile_needed?: unknown}} item
 * @returns {boolean}
 */
function inputMoved(item) {
  return item.status === 'completed' && item.reconcile_needed !== undefined;
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
 * Why `names` cannot seed new work, or null where they can: each a roadmap
 * item, waiting — joined to no work — and named once. The one check a pull's
 * handoff into discovery and start this work share.
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
 * @property {string} name   the item the postpone writes — the joined item's own name, or the name the topic goes by
 * @property {Record<string, any>|undefined} item  what already sits there
 * @property {boolean} joined  the item is joined to this topic, so the postpone re-waits it
 */

/**
 * The roadmap item a postpone would write: the one joined to `{workUnit,
 * topic}` — re-waited, whatever its name — or, when none is joined, the name
 * a birth would take, the one the topic goes by (8.8.20), with whatever
 * already sits on it (the clash). The one join the plan's lock, the gate's
 * statement, and the verb all read.
 * @param {object|null|undefined} project @param {string} workUnit @param {string} topic
 * @param {string} goes  the name the topic goes by
 * @returns {PostponeTarget}
 */
function postponeTarget(project, workUnit, topic, goes) {
  const items = roadmapItems(project);
  for (const [name, item] of Object.entries(items)) {
    if (!item || typeof item !== 'object') continue;
    const join = itemJoin(item);
    if (join && join.work_unit === workUnit && join.topic === topic) return { name, item, joined: true };
  }
  return { name: goes, item: items[goes], joined: false };
}

/**
 * The name clash a postpone's birth would overwrite, as one sentence: the
 * plan's lock reads the roadmap before the epic manifest is written, and the
 * landing reads it again under the project lock, so both refusals say the
 * same thing about the same item.
 * @param {string} name  the name the birth would take
 * @param {Record<string, any>} item  what already sits there
 * @returns {string}
 */
function postponeClashPhrase(name, item) {
  const horizon = typeof item.horizon === 'string' ? item.horizon : '';
  return `a roadmap item named "${name}"${horizon ? ` (horizon "${horizon}")` : ''} is not this topic's — rename or remove it on the roadmap first`;
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
    locks.push({ reason: `"${name}" is cancelled — reactivate it from the epic menu first` });
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
  if (!target.joined && target.item !== undefined) {
    locks.push({ reason: postponeClashPhrase(target.name, target.item) });
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
  const item = itemOf(manifest, phase, topic);
  return item && Array.isArray(item.awaiting_experiments) ? item.awaiting_experiments : [];
}

/**
 * @typedef {{kind: 'experiment', id: string}} Wait
 */

/**
 * Every wait holding one item's conclusion shut: one `experiment` wait per
 * live awaited id. Derived from the item's own state alone — never stored —
 * and work-type agnostic; an absent item holds nothing.
 * @param {object} manifest @param {string} phase @param {string} topic
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
function waitingItems(manifest, phase) {
  return phaseItems(manifest, phase)
    .filter((i) => i.status === 'in-progress'
      && Array.isArray(i.awaiting_experiments) && i.awaiting_experiments.length > 0);
}

/**
 * Where a build by its cut goes next, its standing read from its own
 * records (`buildPlaceStatus`): into the build until every phase of its cut
 * has closed; then into the review phase, its fix phases built there; and
 * once finish has completed the unit, where finish sends it — an epic to
 * its menu, its review completed; any other unit nowhere, done (24.1.2).
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
 * Where a unit built under the old plan stands, read from its old spec's,
 * planning's, implementation's and review's items as before the build by
 * its cut, until 29.17's cut takes them (P12) — null where none of them
 * says. For an epic, one topic completing review never marks the whole
 * epic done: completion is the explicit status flip.
 * @param {Record<string, any>} manifest @returns {{next_phase: string, phase_label: string}|null}
 */
function legacyNext(manifest) {
  const ps = (/** @type {string} */ phase) => phaseStatus(manifest, phase);
  if (ps('review') === 'completed') {
    return manifest.work_type === 'epic'
      ? { next_phase: 'review', phase_label: 'review completed for current topics' }
      : { next_phase: 'done', phase_label: 'pipeline complete' };
  }
  if (ps('review') === 'in-progress') return { next_phase: 'review', phase_label: 'review (in-progress)' };
  if (ps('implementation') === 'completed') return { next_phase: 'review', phase_label: 'ready for review' };
  if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
  if (ps('planning') === 'completed') return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  if (ps('planning') === 'in-progress') return { next_phase: 'planning', phase_label: 'planning (in-progress)' };
  if (ps('specification') !== 'completed') return null;
  return { next_phase: 'planning', phase_label: 'ready for planning' };
}

/**
 * Where the unit's work goes next, and the label the menus show for it,
 * `specWritten` saying whether its spec is written (phaseStatus). A unit of
 * a retired type goes nowhere: it waits on the migration's cut.
 * @param {Record<string, any>} manifest @param {boolean} [specWritten]
 * @returns {{next_phase: string, phase_label: string}}
 */
function computeNextPhase(manifest, specWritten = false) {
  if (retiredRefusal(manifest) !== null) return { next_phase: 'done', phase_label: 'waiting on the migration\'s cut' };
  if (buildByCut(manifest)) return buildNext(manifest);
  const wt = manifest.work_type;

  const ps = (/** @type {string} */ phase) => phaseStatus(manifest, phase, specWritten);

  // A quick-fix's fixes, then its review only once the person asked for one
  // at its close (19.5.14); one built under the old plan waits on the cut.
  if (wt === 'quick-fix') {
    if (legacyBuild(manifest)) return { next_phase: 'done', phase_label: 'waiting on the migration\'s cut' };
    if (manifest.status === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
    if (reviewAsked(manifest)) return { next_phase: 'review', phase_label: 'review (in-progress)' };
    if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
    return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  }

  // A completed phase whose item carries a reconcile flag routes BACK to that
  // phase for the linear types — routing forward past known-stale input is
  // the bug this override closes, and it keeps the bridge off its terminal
  // `done` branch while a flag is live. The walk stops at the first in-flight
  // phase: an upstream mid-revision owns the next action, and its conclusion
  // re-runs this. Epics are excluded — their next_phase is phase-coarse;
  // flagged epic items get per-item cues instead.
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
          : EXPERIMENT_SPAWN_PHASES.includes(phase) && waitingItems(manifest, phase).length > 0;
        if (awaiting) {
          return { next_phase: 'experiment', phase_label: 'experiment (awaiting evidence)' };
        }
        // An experiment no conversation waits on runs beside the pipeline,
        // which walks on past it.
        if (DERIVED_PHASES.includes(phase)) continue;
        return { next_phase: phase, phase_label: `${phase} (in-progress)` };
      }
      // Walking past a completed item whose record has moved hands the next
      // phase input about to change — so the walk stops there instead.
      if (phaseItems(manifest, phase).some(inputMoved)) {
        return { next_phase: phase, phase_label: `${phase} (input moved — reconcile)` };
      }
    }
  }

  if (legacyBuild(manifest)) {
    const next = legacyNext(manifest);
    if (next !== null) return next;
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

// Pipeline phases whose aggregate status is in-progress, in pipeline order.
// Feeds the finalising derivation: computeNextPhase short-circuits on a
// completed review, so a reopened earlier phase (mid-revisit) would otherwise
// masquerade as a finished pipeline.
function computeInProgressPhases(manifest, pipeline, specWritten = false) {
  return pipeline.filter((phase) => phaseStatus(manifest, phase, specWritten) === 'in-progress');
}

/**
 * The active work unit's next-phase state with the finalising / mid-revisit
 * override applied. computeNextPhase short-circuits on a completed review, so a
 * finished pipeline reports `next_phase: done` (finalising — the unit sat
 * between the last topic completion and `workunit complete`). But a reopened
 * earlier phase means the unit is mid-revisit, not finalising: the phase in
 * flight is the next action, and completing the unit now would abandon the
 * revisit. A unit waiting on the migration's cut is never finalising: it
 * offers no way on but the migration (P12); a retired type's keeps its
 * waiting label, whatever its items have in flight. The one derivation both the start
 * dashboard and the single-topic work-unit detail read, so the two can never
 * disagree.
 * @param {object} manifest
 * @param {string[]} pipeline  the work type's pipeline phases, in order
 * @param {boolean} [specWritten]  the unit's spec is written (phaseStatus)
 * @returns {{next_phase: string, phase_label: string, finalising: boolean, in_progress_phases: string[]}}
 */
function computeUnitPhaseState(manifest, pipeline, specWritten = false) {
  const state = computeNextPhase(manifest, specWritten);
  const inProgress = computeInProgressPhases(manifest, pipeline, specWritten);
  let nextPhase = state.next_phase;
  let phaseLabel = state.phase_label;
  if (nextPhase === 'done' && inProgress.length > 0 && retiredRefusal(manifest) === null) {
    nextPhase = inProgress[0];
    phaseLabel = `${inProgress[0]} (in-progress)`;
  }
  return {
    next_phase: nextPhase,
    phase_label: phaseLabel,
    finalising: nextPhase === 'done' && !awaitsCut(manifest),
    in_progress_phases: inProgress,
  };
}

/**
 * The last phase, in the given pipeline order, with at least one completed
 * item — or null when nothing has completed. Single-topic phases carry one
 * item, so "an item completed" and "the phase aggregate is completed" coincide;
 * epics keep the per-item reading (one topic completing a phase is enough). A
 * phase keeping no items, the one spec, completes as `phaseStatus` reads it.
 * The one spelling every closed-unit surface reads (start dashboard,
 * single-topic detail, epic gateway) — each passes the pipeline its display
 * walks.
 * @param {object} manifest
 * @param {string[]} pipeline  phases to scan, in order
 * @returns {string|null}
 */
function lastCompletedPhase(manifest, pipeline) {
  let last = null;
  for (const phase of pipeline) {
    const items = phaseItems(manifest, phase);
    const completed = items.length > 0 ? items.some((i) => i.status === 'completed') : phaseStatus(manifest, phase) === 'completed';
    if (completed) last = phase;
  }
  return last;
}

/**
 * The sorted set of existing input files for an analysis kind — the record
 * copies of the decided discussions. The one collection both cache sides
 * checksum — the read (computeAnalysisCacheStatus) and the write (`engine
 * cache stamp`) — so they can never drift. Returns absolute paths, sorted.
 */
function collectAnalysisInputs(manifest, stateDir, kind) {
  if (!manifest || !manifest.name || !(kind in ANALYSIS_KINDS)) return [];
  return phaseItems(manifest, 'discussion')
    .filter((it) => it.status === 'completed')
    .map((it) => path.join(stateDir, RECORDS_DIR, manifest.name, `${it.name}.md`))
    .filter((p) => fileExists(p))
    .sort();
}

// Per-kind config for computeAnalysisCacheStatus: where the cache object
// lives, the field on it listing the cached file names where the stamp
// records them, and the two kind-specific reason strings. The body is
// otherwise one path for every kind — the same read the write side
// checksums (collectAnalysisInputs).
const ANALYSIS_KINDS = {
  'gap-analysis': {
    cacheOf: (manifest) => ((manifest.phases || {}).discovery || {}).gap_analysis_cache,
    filesField: 'input_files',
    reasonNoInputs: 'no decided discussion records',
    reasonStale: 'decided discussions have changed since gap analysis was generated',
  },
};

function computeAnalysisCacheStatus(manifest, stateDir, kind) {
  if (!manifest || !manifest.name) return { status: 'absent', stamped: false, generated: null, files: [] };

  const cfg = ANALYSIS_KINDS[kind];
  if (!cfg) return { status: 'absent', stamped: false, generated: null, files: [] };

  const cache = cfg.cacheOf(manifest);
  const inputPaths = collectAnalysisInputs(manifest, stateDir, kind);
  const cachedFiles = () => (cache && cfg.filesField && Array.isArray(cache[cfg.filesField])) ? cache[cfg.filesField] : [];

  if (!cache || !cache.checksum) {
    return inputPaths.length > 0
      ? { status: 'stale', stamped: false, generated: null, files: [], reason: 'no cache exists' }
      : { status: 'absent', stamped: false, generated: null, files: [] };
  }

  if (inputPaths.length === 0) {
    return { status: 'absent', stamped: true, generated: cache.generated || null, files: cachedFiles(), reason: cfg.reasonNoInputs };
  }

  const currentChecksum = filesChecksum(inputPaths);
  const status = cache.checksum === currentChecksum ? 'valid' : 'stale';
  return {
    status,
    stamped: true,
    generated: cache.generated || null,
    files: cachedFiles(),
    reason: status === 'valid' ? 'checksums match' : cfg.reasonStale,
  };
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

// The tiers a topic carries no suggested execution order under — off the
// board (cancelled) or waiting on the roadmap (postponed); each stashes its
// order and gets none back until it returns.
const UNORDERED_TIERS = ['⊘', '⊖'];

// True when any live map item lacks a suggested execution order.
// Programmatic detection — the assignment of order values stays with Claude.
function computeNeedsSequencing(mapItems) {
  return mapItems.some(it => !UNORDERED_TIERS.includes(it.tier) && it.order == null);
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

  // A promoted discussion concluded and moved on with its specification to a
  // cross-cutting unit — decided, as a concluded one is.
  if (ds === 'completed' || ds === 'promoted') {
    return { lifecycle: 'decided', tier: '✓', current_phase: 'discussion', discussion_state: ds };
  }
  if (ds === 'in-progress') {
    return { lifecycle: 'discussing', tier: '◐', current_phase: 'discussion', discussion_state: ds };
  }
  // A discussion cancelled or postponed on its own item reads as that
  // closure — the only reading a topic with no map row has. It must not
  // fall through to fresh: its item refuses `topic start`, and the way back
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

/**
 * The refusal every write over a promoted item makes — each hand transition
 * and the field surface: it left the epic for the cross-cutting unit it
 * names, and continues there.
 * @param {string} phase @param {string} topic @param {{promoted_to?: unknown}} item
 */
function promotedRefusal(phase, topic, item) {
  const to = 'promoted_to' in item ? ` (to "${item.promoted_to}")` : '';
  return `${phase} item "${topic}" is promoted${to} — promotion is terminal; continue it from the cross-cutting work unit`;
}

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

function computeSourceProvenance(source) {
  if (!source || source === 'discovery') return null;
  const parts = source.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const labels = parts.map(p => {
    const colonIdx = p.indexOf(':');
    return colonIdx > 0 ? p.slice(colonIdx + 1) : p;
  });
  return `from ${labels.join(' + ')}`;
}

// The conversations a topic's mail waits for, in the order a pipeline is
// searched: discussion, or a bugfix's investigation.
const MAIL_PHASES = ['discussion', 'investigation'];

/**
 * The phase a unit's topics are talked through, where their mail is raised
 * (10.1.3): the first of `MAIL_PHASES` its work type's pipeline holds, null
 * for a quick-fix, which talks through none.
 * @param {string} workType @returns {string|null}
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
 * reaches the person: the name it goes by, title-cased.
 * @param {Record<string, string>} titles the unit's `topicTitles` @param {string} topic
 * @returns {string}
 */
function titled(titles, topic) {
  return titlecase(goesBy(titles, topic));
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
 * How screens title an item of `phase`: `itemName`, title-cased.
 * @param {Record<string, string>} titles the unit's `topicTitles` @param {string} phase @param {string} name
 * @returns {string}
 */
function itemTitle(titles, phase, name) {
  return titlecase(itemName(titles, phase, name));
}

/** `titled` read from the unit's manifest. @param {object} manifest @param {string} topic @returns {string} */
function topicTitle(manifest, topic) {
  return titled(topicTitles(manifest), topic);
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
 * A single-topic unit's phase items where any carries a name other than the
 * unit's, and none where each carries the unit's — as every single-topic
 * unit's do but a promoted one's, whose moved discussions keep their epic
 * names.
 * @param {object} manifest @param {string} phase
 * @returns {{name: string, status?: string}[]}
 */
function ownNamedItems(manifest, phase) {
  const items = phaseItems(manifest, phase);
  return items.some((i) => i.name !== manifest.name) ? items : [];
}

/**
 * The phase whose topic has mail waiting in a single-topic unit — the start
 * rows' and the continue dashboard's cue: the unit's mail phase, where mail
 * waits for the unit's own topic or, where the phase's items carry names of
 * their own, for any of them; none where none waits.
 * @param {string} stateDir  the state root @param {{name: string, work_type: string}} manifest @returns {string[]}
 */
function mailPhases(stateDir, manifest) {
  const phase = mailPhase(manifest.work_type);
  if (phase === null) return [];
  const own = ownNamedItems(manifest, phase);
  const topics = own.length > 0 ? own.map((i) => i.name) : [manifest.name];
  return topics.some((topic) => mailboxDepth(stateDir, manifest.name, topic) > 0) ? [phase] : [];
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
 * @property {string|null} source_provenance
 * @property {number|null} order
 * @property {string} lifecycle
 * @property {string} tier
 * @property {string|null} current_phase
 * @property {string|null} discussion_state  the discussion item's raw status, null when none exists
 * @property {string|null} promoted_to       the cross-cutting unit a promoted discussion moved to, null otherwise
 * @property {boolean} mail_waiting       messages wait in the topic's mailbox, whatever its items' status
 * @property {number} mail_queued         how many messages wait in the topic's mailbox, counted from disk
 * @property {Wait[]} waits               the live waits of the topic's in-progress discussion (empty when none)
 * @property {string|null} next_action
 */

/**
 * The discovery-map rows for one epic manifest: each discovery item joined to
 * its per-phase lifecycle, sorted by tier → order → name, with the map summary
 * and the sequencing flag. The single builder every discovery-map surface
 * reads — the epic detail and the discovery-session gateway consume the same
 * rows, so the two can never silently disagree.
 *
 * Each row carries the superset of fields any surface needs. `summary` and
 * `description_present` follow the normalised reading — a whitespace-only or
 * non-string value is treated as absent — so the presence booleans always
 * agree with the text; `description` carries the raw value for surfaces that
 * render it in full.
 * @param {object} manifest
 * @param {string} stateDir  the state root — the mailboxes are read from disk
 * @returns {{map: DiscoveryMapRow[], summary: object, needs_sequencing: boolean}}
 */
function buildDiscoveryMap(manifest, stateDir) {
  const discoveryItems = phaseItems(manifest, 'discovery');
  const map = discoveryItems.map((item) => {
    const { lifecycle, tier, current_phase, discussion_state } = computeTopicLifecycle(manifest, item.name);
    const mail_queued = mailboxDepth(stateDir, manifest.name, item.name);
    const summaryText = typeof item.summary === 'string' && item.summary.trim() ? item.summary : null;
    const descriptionText = typeof item.description === 'string' && item.description.trim() ? item.description : null;
    const discussion = discussion_state === 'promoted' ? itemOf(manifest, 'discussion', item.name) : undefined;
    return {
      name: item.name,
      summary: summaryText,
      summary_present: summaryText !== null,
      description: item.description || null,
      description_present: descriptionText !== null,
      title: topicTitle(manifest, item.name),
      goes_by: goesBy(topicTitles(manifest), item.name),
      source: item.source || 'discovery',
      source_provenance: computeSourceProvenance(item.source),
      order: item.order ?? null,
      lifecycle,
      tier,
      current_phase,
      discussion_state,
      promoted_to: discussion && typeof discussion.promoted_to === 'string' ? discussion.promoted_to : null,
      mail_waiting: mail_queued > 0,
      mail_queued,
      waits: topicWaits(manifest, item.name),
      next_action: computeNextAction(lifecycle),
    };
  });
  map.sort(compareMapRows);
  return { map, summary: computeMapSummary(map), needs_sequencing: computeNeedsSequencing(map) };
}

module.exports = {
  decidedCloseStands,
  voidDecidedClose,
  closedIntoSpec,
  phaseData,
  phaseItems,
  startedOn,
  buildBegun,
  phaseKey,
  phaseStarted,
  phaseClosed,
  buildFinished,
  cutPhases,
  cutLength,
  isFixPhase,
  legacyBuild,
  awaitsCut,
  retiredRefusal,
  buildByCut,
  buildRefusal,
  FIXES_PHASE,
  quickFixBuild,
  fixesBegun,
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
  inputMoved,
  cancelPlan,
  postponePlan,
  openExperiments,
  openRecords,
  roadmapItems,
  itemJoin,
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
  computeInProgressPhases,
  computeUnitPhaseState,
  lastCompletedPhase,
  collectAnalysisInputs,
  computeAnalysisCacheStatus,
  computeTopicLifecycle,
  computeNextAction,
  CONVERSATION_ACTIONS,
  CLOSED_LIFECYCLES,
  lifecyclePhrase,
  promotedRefusal,
  itemOf,
  computeMapSummary,
  computeSourceProvenance,
  compareMapRows,
  computeNeedsSequencing,
  buildDiscoveryMap,
  ownNamedItems,
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
