'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the laboratory's row of the entry (enter.cjs) — `enter
// experiment <unit> [<topic>] [--record <id>]`, at the topic whose series
// holds the experiment (4.11.15). It refuses a topic with no series, and one
// whose every experiment has ended, a new one spawned from the topic's
// discussion; and a record named that is not one of the series' live
// top-level records, a split worked inside its parent's run. Where several
// are live and the call named none, it asks which first, nothing written:
// the register — unless the next experiment's gate drew it just above —
// then the pick, each row the entry again naming its record,
// its back the surface before it — the next experiment's gate where the
// conversation came from it, the pick drawn again keeping its back — else
// the unit's menu. It starts nothing and keeps no log: the spawn conceived
// the record.
//
// The record it works, the one named or the one live, is recorded on the
// conversation's position. What it reads of it: its id, its status and its
// folder; its problem, and its design and its report where written; and
// each of its splits, with its status and its folder. Until the person
// approved its design it reads the ground the design is built on as well:
// the spawning topic's record and its log, and what the topic stands on
// from discovery (`ground`, enter.cjs's). From the freeze the record's own
// documents are the ground. A compaction's note carries the same, from the
// record the position holds (`labRecovery`, position.cjs's), the topic's
// ground there its record and its log, as a discussion's note names them.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { compareExperimentIds, isParentExperimentId, EXPERIMENT_TERMINAL_STATUSES, EXPERIMENT_FROZEN_STATUSES } = require('../kernel/manifest-schema.cjs');
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
    throw new Error(`"${record}" is not a live experiment of the topic "${topic}" — its live experiments are ${live.join(', ')}; a split is worked inside its parent's run`);
  }
}

/**
 * Where the pick's back leads: the surface before it, `before` — the next
 * experiment's gate where the conversation came from it, the pick drawn
 * again keeping its back — else `leave`.
 * @param {import('./gate.cjs').ShownRecord|null} before @param {string} dotpath @param {Next} leave @returns {Next}
 */
function pickerBack(before, dotpath, leave) {
  if (before?.gate === 'experiment pick') return before.options.find((o) => o.key === 'b')?.next ?? leave;
  return before?.gate === 'experiment next gate' ? { kind: 'engine', argv: ['render', 'experiment-next-gate', dotpath] } : leave;
}

/**
 * The pick, where several records are live: the register, then the menu,
 * each row the entry again naming its record; none where one is live. From
 * the next experiment's gate, which drew the register just above, the menu
 * alone.
 * @param {Standing} at @param {(record: string) => string[]} again @returns {string|null}
 */
function pickQuestion({ unit, topic = '', manifest }, again) {
  const rows = seriesRows(manifest, topic);
  const live = liveRecords(rows);
  if (live.length === 1) return null;
  const session = handedSession();
  const before = session === null ? null : lastShown(session);
  const back = pickerBack(before, `${unit}.${PHASE}.${topic}`, ontoMenu(unit, manifest.work_type));
  const register = before?.gate === 'experiment next gate' ? '' : experimentRegister(topicTitle(manifest, topic), rows);
  return register + experimentPick(live, { into: (id) => ({ kind: 'engine', argv: again(id) }), back });
}

/** The record the entry works: the one named, else the series' one live. @param {Standing} at @param {string|null} record */
function workedRecord({ topic = '', manifest }, record) {
  return record ?? liveRecords(seriesRows(manifest, topic))[0].id;
}

/** A DATA line's key, put to each value. @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/** The paths that exist. @param {string[]} paths absolute */
const existing = (paths) => paths.filter((p) => fs.existsSync(p));

/** A record's documents, by their keys. */
const DOCUMENTS = Object.freeze(['problem', 'design', 'report']);

/**
 * @typedef {object} LabSources
 * @property {SeriesRow} own        the record worked
 * @property {string} folder        its folder, absolute
 * @property {Line[]} documents     its problem, design and report, those written
 * @property {SeriesRow[]} splits   its splits
 * @property {(id: string) => string} folderOf  a record's folder, absolute
 * @property {boolean} frozen       whether the person approved its design
 * @property {string} topicRecord   the spawning topic's record, its call
 * @property {string} topicLog      the spawning topic's log, absolute
 */

/**
 * What the laboratory reads of `record` (the header's), the entry's DATA
 * and a compaction's note alike; null where the series no longer holds it.
 * @param {string} cwd @param {string} unit @param {string} topic @param {Record<string, any>} manifest @param {string} record
 * @returns {LabSources|null}
 */
function labSources(cwd, unit, topic, manifest, record) {
  const rows = seriesRows(manifest, topic);
  const own = rows.find(({ id }) => id === record);
  if (own === undefined) return null;
  const experiments = itemOf(manifest, PHASE, topic)?.experiments;
  const folderOf = (/** @type {string} */ id) => statePath(cwd, recordDir(unit, topic, id, experiments));
  const folder = folderOf(own.id);
  return {
    own,
    folder,
    documents: DOCUMENTS.flatMap((doc) => existing([path.join(folder, `${doc}.md`)]).map(as(doc))),
    splits: rows.filter(({ id }) => id.startsWith(`${own.id}.`)),
    folderOf,
    frozen: EXPERIMENT_FROZEN_STATUSES.includes(own.status),
    topicRecord: recordCall(unit, topic),
    topicLog: statePath(cwd, topicLog(unit, topic)),
  };
}

/**
 * What the laboratory reads (the header's), `ground` what the topic stands
 * on from discovery.
 * @param {(at: Entering) => Line[]} ground @returns {(at: Entering) => Line[]}
 */
function labReads(ground) {
  return (at) => {
    const { cwd, unit, topic = '', manifest, record } = at;
    const lab = /** @type {LabSources} */ (labSources(cwd, unit, topic, manifest, /** @type {string} */ (record)));
    const before = lab.frozen ? [] : [
      as('topic record')(`\`${lab.topicRecord}\``),
      ...existing([lab.topicLog]).map(as('topic log')),
      ...ground(at),
    ];
    return [
      as('experiment')(lab.own.id),
      as('status')(lab.own.status),
      as('folder')(lab.folder),
      ...lab.documents,
      ...lab.splits.map(({ id, status }) => as('split')(`${id} ${status} ${lab.folderOf(id)}`)),
      ...before,
    ];
  };
}

/**
 * What a compaction in the laboratory carries the work on with, as its entry
 * reads it: the experiment worked, named in a line with where it stands and
 * its splits; its documents and its splits'; and until the approval the
 * spawning topic's record and its log, as a discussion's note names them
 * (24.2.1). Nothing where the series no longer holds the record.
 * @param {string} cwd @param {string} unit @param {string} topic @param {Record<string, any>} manifest @param {string} record
 * @returns {{calls: string[], documents: string[], lines: string[]}}
 */
function labRecovery(cwd, unit, topic, manifest, record) {
  const lab = labSources(cwd, unit, topic, manifest, record);
  if (lab === null) return { calls: [], documents: [], lines: [] };
  const splits = lab.splits.map(({ id, status }) => `${id} ${status}`);
  return {
    calls: lab.frozen ? [] : [lab.topicRecord],
    documents: [
      ...lab.documents.map(([, file]) => file),
      ...lab.splits.flatMap(({ id }) => DOCUMENTS.map((doc) => path.join(lab.folderOf(id), `${doc}.md`))),
      ...(lab.frozen ? [] : [lab.topicLog]),
    ],
    lines: [`The experiment worked here is ${lab.own.id}, ${lab.own.status}${splits.length === 0 ? '' : `; its splits ${splits.join(', ')}`}.`],
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
    worked: workedRecord,
    questions: () => [],
    reads: labReads(ground),
  });
}

module.exports = { experimentRow, labRecovery, seriesRows, liveRecords };
