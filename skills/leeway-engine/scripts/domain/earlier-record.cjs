'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a postponed topic's earlier record (18.8.17). A topic an epic
// postponed, pulled into other work, opens reading the record it left in
// that epic as input, never changing it: its brief, its ledger record, its
// log and its mail. Where it sits is the epic's map row's `prior` for an
// epic's topic, or for a one-topic unit the `postponed_from` of the roadmap
// item joined to the unit; a waiting roadmap item names it by its own
// `postponed_from`. A pull back into the epic that postponed it returns the
// topic as it was, and reads nothing here.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../kernel/state-root.cjs');
const { itemOf, roadmapItems, itemJoin, itemPostponedFrom, topicAddress, briefFile, mailboxDir } = require('./derivations.cjs');
const { topicLog, recordCall } = require('./topic-log.cjs');

/** @typedef {{work_unit: string, topic: string}} Address */

/**
 * What the earlier record is read by: its brief and log where they exist,
 * the call that reads its ledger record, and each message in its mailbox,
 * the paths absolute.
 * @typedef {{brief?: string, record: string, log?: string, mail: string[]}} EarlierReads
 */

/**
 * Where a topic of `unit` left its earlier record, or null where it left
 * none in another unit.
 * @param {object|null|undefined} project @param {Record<string, any>} manifest @param {string} unit @param {string} topic
 * @returns {Address|null}
 */
function earlierRecord(project, manifest, unit, topic) {
  if (manifest.work_type === 'epic') return topicAddress(itemOf(manifest, 'discovery', topic)?.prior);
  for (const item of Object.values(roadmapItems(project))) {
    if (!item || typeof item !== 'object') continue;
    const from = itemPostponedFrom(item);
    if (from && from.work_unit !== unit && itemJoin(item)?.work_unit === unit) return from;
  }
  return null;
}

/**
 * The reads of the record a topic left at `address`.
 * @param {string} cwd @param {Address} address
 * @returns {EarlierReads}
 */
function earlierReads(cwd, { work_unit: unit, topic }) {
  const brief = statePath(cwd, briefFile(unit, topic));
  const log = statePath(cwd, topicLog(unit, topic));
  const mailbox = statePath(cwd, mailboxDir(unit, topic));
  const mail = fs.existsSync(mailbox) ? fs.readdirSync(mailbox).sort().map((name) => statePath(cwd, mailboxDir(unit, topic), name)) : [];
  return {
    ...(fs.existsSync(brief) ? { brief } : {}),
    record: recordCall(unit, topic),
    ...(fs.existsSync(log) ? { log } : {}),
    mail,
  };
}

module.exports = { earlierRecord, earlierReads };
