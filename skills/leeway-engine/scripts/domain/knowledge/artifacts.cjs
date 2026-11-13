'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the knowledge base indexes, and where — each artifact's
// identity (work unit, phase, topic) derived from its path, the artifacts the
// manifests say belong in the store, and why an indexed identity no longer
// does.
//
// A record is indexed through its rendered copy (22.6.2): a topic's at
// `.knowledge/records/{unit}/{topic}.md`, and the record of a unit's own
// level, whose entries carry no topic, at `.knowledge/records/{unit}.md`,
// its identity's topic `.unit` — a name no topic's identity can take, as a
// dotted one is refused. A live unit's copies on disk are what belongs: the
// ledger's render writes each record that holds something and removes the
// rest.
//
// A quick-fix's short record after the work, its `{unit}/summary.md`
// (22.6.9, 19.5.6), is indexed as its unit's own, its identity's topic
// `.unit`, each fix's record under its own heading a chunk of its own, so a
// query for one fix finds that fix's record (19.5.17). It is no phase's
// item, so only its file gone, or its unit cancelled or unregistered,
// retires it.
//
// The knowledge base's root is the state root, and an artifact is named by
// its path from there — state-relative, so an identity never moves when the
// checkout does, and never carries the state directory's name.
//
// A log is never indexed (8.14.7, 9.2.2): discovery's sessions, the
// product's among them, are reached through the pointers into them. Nor is
// the spec (11.1.2): the records it is drawn from are indexed in its place.
// Nor is anything of a unit's build (22.6.3): its log, its notes for later,
// and each task's account and reports. Nor is a seed, an asset, an inbox item
// or the product record's rendered file (22.6.12): an asset is reached
// through the entry that links it, in its record.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest-io.cjs');
const { RECORDS_DIR } = require('../../kernel/knowledge/files.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { isIndexableImport } = require('../import-landing.cjs');

const SUMMARY_PATH = /^([^/]+)\/summary\.md$/;

/** The phase a record's chunks carry. */
const RECORD_PHASE = 'record';

/** The phase a quick-fix's short record's chunks carry. */
const SUMMARY_PHASE = 'summary';

/** The topic of the identity of a unit's own record, and of its short record. */
const UNIT_RECORD = '.unit';

/** A quick-fix's short record after the work, state-relative (4.11.6). @param {string} unit */
const summaryFile = (unit) => `${unit}/summary.md`;

/** Every phase a chunk can carry — each has a chunking config. */
const INDEXED_PHASES = [RECORD_PHASE, SUMMARY_PHASE];

/**
 * @typedef {object} Identity
 * @property {string} workUnit
 * @property {string} phase
 * @property {string} topic
 */

/**
 * @typedef {Identity & {file: string}} Artifact  `file` state-relative
 */

/** @param {string} workUnit @param {string} phase @param {string} topic */
function identityKey(workUnit, phase, topic) {
  return `${workUnit}/${phase}/${topic}`;
}

/** @param {string} name */
function isHiddenName(name) {
  return name === '.' || name === '..' || name.startsWith('.');
}

// A dotted work-unit or topic name is indexable once and unreachable after:
// discovery, status and remove all address it as a dot-path segment.
/** @param {string} kind @param {string} name */
function rejectDottedSegment(kind, name) {
  if (name.includes('.')) {
    throw new UserError(
      `Invalid ${kind} name "${name}": dots are not allowed. Work-unit and topic ` +
        'names double as manifest dot-path and knowledge-identity segments, so a ' +
        'dot leaves the artifact indexable but unreachable by status, remove, and discovery.'
    );
  }
}

/** @param {string} kind @param {string} name */
function assertSegment(kind, name) {
  if (isHiddenName(name)) throw new UserError(`Invalid ${kind} name: "${name}"`);
  rejectDottedSegment(kind, name);
}

/**
 * A record's rendered copy, state-relative: a topic's, or with no topic the
 * record of the unit's own level.
 * @param {string} unit @param {string|null} topic
 */
function recordFile(unit, topic) {
  return topic === null ? `${RECORDS_DIR}/${unit}.md` : `${RECORDS_DIR}/${unit}/${topic}.md`;
}

/**
 * The identity a record copy's path names, its segments unchecked: `{unit}.md`,
 * the unit's own record, or `{unit}/{topic}.md` — null for another shape.
 * @param {string} rest the path beneath the records' folder
 * @returns {Identity|null}
 */
function recordNamed(rest) {
  const match = /^([^/]+?)(?:\/([^/]+))?\.md$/.exec(rest);
  if (!match) return null;
  const [, workUnit, topic = UNIT_RECORD] = match;
  return { workUnit, phase: RECORD_PHASE, topic };
}

/**
 * The scope of the chunks of the record copy at a state-relative path.
 * @param {string} file
 * @returns {Identity}
 */
function recordScope(file) {
  return /** @type {Identity} */ (recordNamed(file.slice(RECORDS_DIR.length + 1)));
}

/**
 * A record copy's identity.
 * @param {string} rest the path beneath the records' folder
 * @returns {Identity}
 */
function recordIdentity(rest) {
  const named = recordNamed(rest);
  if (!named) {
    throw new UserError(
      `Unexpected record path structure: ${rest}\n` +
        `Expected: ${RECORDS_DIR}/{work_unit}.md or ${RECORDS_DIR}/{work_unit}/{topic}.md`
    );
  }
  assertSegment('work unit', named.workUnit);
  if (named.topic !== UNIT_RECORD) assertSegment('topic', named.topic);
  return named;
}

/**
 * An artifact's identity from its state-relative path, or a UserError naming
 * the shape the path should have.
 * @param {string} filePath
 * @returns {Identity}
 */
function deriveIdentity(filePath) {
  const norm = filePath.replace(/\\/g, '/');

  if (norm.startsWith(`${RECORDS_DIR}/`)) return recordIdentity(norm.slice(RECORDS_DIR.length + 1));
  const summaryMatch = SUMMARY_PATH.exec(norm);
  if (!summaryMatch) {
    throw new UserError(
      `Cannot derive identity from path: ${filePath}\n` +
        `Expected path matching: ${RECORDS_DIR}/... or {work_unit}/summary.md`
    );
  }
  assertSegment('work unit', summaryMatch[1]);
  return { workUnit: summaryMatch[1], phase: SUMMARY_PHASE, topic: UNIT_RECORD };
}

/**
 * The work type a chunk of the artifact carries: the work unit's — from the
 * manifests already read where they hold it.
 * @param {string} root @param {Identity} identity @param {Array<Record<string, any>>} [workUnits]
 * @returns {string}
 */
function workTypeOf(root, { workUnit }, workUnits = []) {
  const read = workUnits.find((unit) => unit.name === workUnit);
  if (read && read.work_type) return read.work_type;
  const manifestFile = path.join(root, workUnit, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new UserError(`Work unit manifest not found: ${manifestFile}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!manifest.work_type) throw new UserError(`Work unit manifest missing work_type field: ${manifestFile}`);
  return manifest.work_type;
}

// ---------------------------------------------------------------------------
// The manifests the store answers to
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Manifests
 * @property {Array<Record<string, any>>} workUnits  every work unit's manifest
 * @property {Set<string>|null} registry  the registered names — null while none
 *   are, the work units then listed by directory, so an empty registry says
 *   nothing about which units exist
 */

/** @type {Manifests} */
const NO_MANIFESTS = { workUnits: [], registry: null };

/**
 * Work-unit manifests by name — one without a name left out.
 * @param {Array<Record<string, any>>} workUnits
 * @returns {Map<string, Record<string, any>>}
 */
function unitsByName(workUnits) {
  return new Map(workUnits.filter((u) => u && u.name).map((u) => [u.name, u]));
}

/**
 * The manifests the store is brought in line with. A failed read throws —
 * it is not evidence that anything is gone.
 * @param {string} root
 * @returns {Manifests}
 */
function readManifests(root) {
  try {
    const project = readProjectManifest(root);
    const registered = Object.keys(project.work_units || {});
    return {
      workUnits: listWorkUnitManifests(root, project),
      registry: registered.length > 0 ? new Set(registered) : null,
    };
  } catch (err) {
    throw new Error(`manifest read failed: ${messageOf(err)}`);
  }
}

/**
 * Every work unit's manifest, for a caller that degrades on a failed read:
 * none, and the failure said on `warn`.
 * @param {string} root @param {(text: string) => void} warn @param {string} context
 * @returns {Array<Record<string, any>>}
 */
function workUnitsOr(root, warn, context) {
  try {
    return listWorkUnitManifests(root);
  } catch (err) {
    warn(`Warning: manifest read failed in ${context}: ${messageOf(err)}\n`);
    return [];
  }
}

/**
 * readManifests for a caller that degrades on a failed read: no work units,
 * and the failure said on `warn`.
 * @param {string} root @param {(text: string) => void} warn @param {string} context
 * @returns {Manifests}
 */
function readManifestsOr(root, warn, context) {
  try {
    return readManifests(root);
  } catch (err) {
    warn(`Warning: ${messageOf(err)} (${context})\n`);
    return NO_MANIFESTS;
  }
}

// ---------------------------------------------------------------------------
// Discovery — every artifact the manifests say belongs in the store
// ---------------------------------------------------------------------------

/**
 * The markdown files directly in a directory, their stems dot-free.
 * @param {string} root @param {string} dir @returns {string[]}
 */
function flatMarkdown(root, dir) {
  try {
    return fs.readdirSync(path.resolve(root, dir)).filter((f) => isIndexableImport(f) && /^[^./]+$/.test(f.slice(0, -3)));
  } catch {
    return [];
  }
}

/**
 * A unit's record copies on disk: its own level's, and each topic's whose
 * name is dot-free.
 * @param {string} root @param {string} workUnit
 * @returns {Artifact[]}
 */
function recordArtifacts(root, workUnit) {
  const own = recordFile(workUnit, null);
  return [
    ...(fs.existsSync(path.resolve(root, own)) ? [{ file: own, workUnit, phase: RECORD_PHASE, topic: UNIT_RECORD }] : []),
    ...flatMarkdown(root, `${RECORDS_DIR}/${workUnit}`).map((f) => {
      const topic = f.slice(0, -3);
      return { file: recordFile(workUnit, topic), workUnit, phase: RECORD_PHASE, topic };
    }),
  ];
}

/**
 * A live work unit's artifacts: its record copies and its short record.
 * @param {string} root @param {Record<string, any>} unit
 * @returns {Artifact[]}
 */
function unitArtifacts(root, unit) {
  const workUnit = unit.name;
  const exists = (/** @type {string} */ file) => fs.existsSync(path.resolve(root, file));
  /** @type {Artifact[]} */
  const items = recordArtifacts(root, workUnit);
  if (exists(summaryFile(workUnit))) items.push({ file: summaryFile(workUnit), workUnit, phase: SUMMARY_PHASE, topic: UNIT_RECORD });
  return items;
}

/**
 * Every artifact the manifests say belongs in the store.
 * @param {string} root @param {Manifests} manifests
 * @returns {Artifact[]}
 */
function discoverArtifacts(root, manifests) {
  const live = manifests.workUnits.filter((unit) => unit.name && unit.status !== 'cancelled');
  return live.flatMap((unit) => unitArtifacts(root, unit));
}

// ---------------------------------------------------------------------------
// Retirement — why an indexed identity no longer belongs in the store
// ---------------------------------------------------------------------------

/**
 * Why an indexed identity no longer belongs in the store, or null while it
 * may. Only positive knowledge retires: the source gone from disk, the work
 * unit unregistered or cancelled. A work unit whose manifest could not be
 * read is evidence of nothing.
 * @param {string} root @param {Identity & {file: string}} entry
 * @param {Map<string, Record<string, any>>} units  work-unit manifests by name
 * @param {Set<string>|null} registry
 * @returns {string|null}
 */
function retiredReason(root, entry, units, registry) {
  if (!fs.existsSync(path.join(root, entry.file))) return 'source deleted';
  if (registry && !registry.has(entry.workUnit)) return 'work unit not registered';
  const unit = units.get(entry.workUnit);
  return unit?.status === 'cancelled' ? 'work unit cancelled' : null;
}

/**
 * The entries that no longer belong in the store, each with its reason. A
 * scope confines them to one work unit.
 * @template {Identity & {file: string}} T
 * @param {string} root @param {Iterable<T>} entries @param {Manifests} manifests @param {string|null} scope
 * @returns {Array<T & {reason: string}>}
 */
function retirements(root, entries, manifests, scope) {
  const units = unitsByName(manifests.workUnits);
  /** @type {Array<T & {reason: string}>} */
  const retired = [];
  for (const entry of entries) {
    if (scope && entry.workUnit !== scope) continue;
    const reason = retiredReason(root, entry, units, manifests.registry);
    if (reason) retired.push({ ...entry, reason });
  }
  return retired;
}

module.exports = {
  INDEXED_PHASES,
  RECORD_PHASE,
  SUMMARY_PHASE,
  summaryFile,
  recordFile,
  recordScope,
  identityKey,
  deriveIdentity,
  workTypeOf,
  readManifests,
  readManifestsOr,
  workUnitsOr,
  unitsByName,
  discoverArtifacts,
  retirements,
};
