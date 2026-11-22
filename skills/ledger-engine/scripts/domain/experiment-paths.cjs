'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a topic's experiment records sit in the state (4.11.15)
// — the series in the topic's own folder, `{wu}/topics/{topic}/experiments/`,
// one folder per record, `E{n}-{slug}/`, a sub-experiment's `E{n}.{m}-{slug}/`
// nested in its parent's. A leaf module: every reader of a record's path —
// the experiment verbs, the recovery note, the commit door's topic scope and
// a feature's absorb — takes it from here.
// ---------------------------------------------------------------------------

const { isParentExperimentId } = require('../kernel/manifest-schema.cjs');

/** A topic's series on disk, state-relative: the folder holding its records. @param {string} workUnit @param {string} topic */
function seriesDir(workUnit, topic) {
  return `${workUnit}/topics/${topic}/experiments`;
}

/**
 * The record's on-disk home, state-relative. A sub-experiment's record
 * nests inside its parent's — the split is the laboratory's internal method,
 * so the parent directory holds the whole tree.
 * @param {string} workUnit @param {string} topic @param {string} id
 * @param {Record<string, {slug: string}>} experiments
 */
function recordDir(workUnit, topic, id, experiments) {
  const base = seriesDir(workUnit, topic);
  if (isParentExperimentId(id)) return `${base}/${id}-${experiments[id].slug}`;
  const parentId = id.slice(0, id.indexOf('.'));
  return `${base}/${parentId}-${experiments[parentId].slug}/${id}-${experiments[id].slug}`;
}

module.exports = { seriesDir, recordDir };
