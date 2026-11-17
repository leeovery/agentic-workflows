'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the laboratory's row of the entry (enter.cjs) — `enter
// experiment <unit> [<topic>] [--record <id>]`, at the topic whose series
// holds the experiment (4.11.15). It refuses a topic with no series, and one
// whose every experiment has ended, a new one spawned from the topic's
// discussion; and a record named that is not one of the series' live
// top-level records, a split worked inside its parent's run. Where several
// are live and the call named none, it asks which first, nothing written:
// the register, then the pick, each row the entry again naming its record,
// its back the surface before it — the next experiment's gate where the
// conversation came from it, the pick drawn again keeping its back — else
// the unit's menu. It starts nothing and keeps no log: the spawn conceived
// the record.
//
// What it reads, of the record named or the one live: its id, its status
// and its folder; its problem, and its design and its report where written;
// and each of its splits, with its status and its folder. Until the person
// approved its design it reads the ground the design is built on as well:
// the spawning topic's record and its log, and what the topic stands on
// from discovery (`ground`, enter.cjs's). From the freeze the record's own
// documents are the ground.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { compareExperimentIds, isParentExperimentId, EXPERIMENT_TERMINAL_STATUSES } = require('../kernel/manifest-schema.cjs');
const { itemOf, topicTitle } = require('./derivations.cjs');
const { recordDir } = require('./experiment-paths.cjs');
const { topicLog, recordCall } = require('./topic-log.cjs');
const { topicStanding } = require('./topic-standing.cjs');
const { ontoMenu } = require('./topic-leave.cjs');
const { lastShown } = require('./gate.cjs');
const { experimentRegister, experimentPick } = require('./projections/experiment.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */
/** @typedef {import('./topic-standing.cjs').Standing} Standing */
/** @typedef {import('./projections/experiment.cjs').SeriesRow} SeriesRow */
/** @typedef {import('./projections/surfaces.cjs').Next} Next */

const PHASE = 'experiment';

/** The statuses of a record whose design the person approved. */
const FROZEN = Object.freeze(['approved', 'running']);

/**
 * A topic's series, its rows in register order — parents by number, each
 * parent's splits beneath it; none where the topic holds no series.
 * @param {Record<string, any>} manifest @param {string} topic
 * @returns {SeriesRow[]}
 */
function seriesRows(manifest, topic) {
  const experiments = itemOf(manifest, PHASE, topic)?.experiments;
  return Object.entries(isObject(experiments) ? experiments : {})
    .map(([id, r]) => /** @type {SeriesRow} */ ({ id, ...(isObject(r) ? r : {}) }))
    .sort((a, b) => compareExperimentIds(a.id, b.id));
}

/** The series' live top-level records, in register order. @param {SeriesRow[]} rows */
function liveRecords(rows) {
  return rows.filter((r) => isParentExperimentId(r.id) && !EXPERIMENT_TERMINAL_STATUSES.includes(r.status));
}

/**
 * Why the laboratory cannot be entered at the topic, or null where it can:
 * no series, or nothing in it live.
 * @param {Standing} at @returns {string|null}
 */
function labStanding({ topic = '', manifest }) {
  const rows = seriesRows(manifest, topic);
  if (rows.length === 0) return `the topic "${topic}" has no experiment — one is spawned from its discussion`;
  return liveRecords(rows).length === 0 ? `every experiment of the topic "${topic}" has ended — the next is spawned from its discussion` : null;
}

/**
 * Refuses a record that is not one of the series' live top-level records.
 * @param {Standing} at @param {string} record
 */
function checkRecord({ topic = '', manifest }, record) {
  const live = liveRecords(seriesRows(manifest, topic)).map(({ id }) => id);
  if (!live.includes(record)) {
    throw new Error(`"${record}" is not a live experiment of the topic "${topic}" — its live experiments are ${live.join(', ')}, a split worked inside its parent's run`);
  }
}

/**
 * Where the pick's back leads: the surface before it — the next
 * experiment's gate where the conversation came from it, the pick drawn
 * again keeping its back — else `leave`.
 * @param {string} dotpath @param {Next} leave @returns {Next}
 */
function pickerBack(dotpath, leave) {
  const session = handedSession();
  const before = session === null ? null : lastShown(session);
  if (before?.gate === 'experiment pick') return before.options.find((o) => o.key === 'b')?.next ?? leave;
  return before?.gate === 'experiment next gate' ? { kind: 'engine', argv: ['render', 'experiment-next-gate', dotpath] } : leave;
}

/**
 * The pick, where several records are live: the register, then the menu,
 * each row the entry again naming its record; none where one is live.
 * @param {Standing} at @param {(record: string) => string[]} again @returns {string|null}
 */
function pickQuestion({ unit, topic = '', manifest }, again) {
  const rows = seriesRows(manifest, topic);
  const live = liveRecords(rows);
  if (live.length === 1) return null;
  const back = pickerBack(`${unit}.${PHASE}.${topic}`, ontoMenu(unit, manifest.work_type));
  return experimentRegister(topicTitle(manifest, topic), rows) + experimentPick(live, { into: (id) => ({ kind: 'engine', argv: again(id) }), back });
}

/** A DATA line's key, put to each value. @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/** The paths that exist. @param {string[]} paths absolute */
const existing = (paths) => paths.filter((p) => fs.existsSync(p));

/**
 * What the laboratory reads (the header's), `ground` what the topic stands
 * on from discovery.
 * @param {(at: Entering) => Line[]} ground @returns {(at: Entering) => Line[]}
 */
function labReads(ground) {
  return (at) => {
    const { cwd, unit, topic = '', manifest, record } = at;
    const rows = seriesRows(manifest, topic);
    const own = /** @type {SeriesRow} */ (rows.find(({ id }) => id === (record ?? liveRecords(rows)[0].id)));
    const experiments = itemOf(manifest, PHASE, topic)?.experiments;
    const folder = (/** @type {string} */ id) => statePath(cwd, recordDir(unit, topic, id, experiments));
    const before = FROZEN.includes(own.status) ? [] : [
      as('topic record')(`\`${recordCall(unit, topic)}\``),
      ...existing([statePath(cwd, topicLog(unit, topic))]).map(as('topic log')),
      ...ground(at),
    ];
    return [
      as('experiment')(own.id),
      as('status')(own.status),
      as('folder')(folder(own.id)),
      ...['problem', 'design', 'report'].flatMap((doc) => existing([path.join(folder(own.id), `${doc}.md`)]).map(as(doc))),
      ...rows.filter(({ id }) => id.startsWith(`${own.id}.`)).map(({ id, status }) => as('split')(`${id} ${status} ${folder(id)}`)),
      ...before,
    ];
  };
}

/**
 * The laboratory's row, `ground` what the topic stands on from discovery.
 * @param {(at: Entering) => Line[]} ground @returns {Entry}
 */
function experimentRow(ground) {
  return Object.freeze({
    level: /** @type {const} */ ('topic'),
    standing: (/** @type {Standing} */ at) => topicStanding(at) ?? labStanding(at),
    unstarted: () => false,
    start: () => {},
    record: checkRecord,
    pick: pickQuestion,
    questions: () => [],
    reads: labReads(ground),
  });
}

module.exports = { experimentRow, seriesRows, liveRecords };
