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
// The knowledge base's root is the state root, and an artifact is named by
// its path from there — state-relative, so an identity never moves when the
// checkout does, and never carries the state directory's name.
//
// A log is never indexed (8.14.7, 9.2.2): discovery's sessions, the
// product's among them, are reached through the pointers into them.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest-io.cjs');
const { RECORDS_DIR } = require('../../kernel/knowledge/files.cjs');
const { TERMINAL_STATUSES } = require('../../kernel/manifest-schema.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { isIndexableImport, importArtifact } = require('../import-landing.cjs');

const ANALYSIS_PATH = /^([^/]+)\/\.state\/(.+)$/;
const PHASE_PATH = /^([^/]+)\/(investigation|specification|imports|seeds)\/(.+)$/;

/** The phase a record's chunks carry. */
const RECORD_PHASE = 'record';

/** The topic of the identity of a unit's own record. */
const UNIT_RECORD = '.unit';

/**
 * Phases whose completed artifact is indexed, with the artifact path per
 * topic — the per-topic manifest items. Imports, seeds and analysis caches
 * are file-based and found by their own traversals.
 * @type {Record<string, (wu: string, topic: string) => string>}
 */
const INDEXED_ARTIFACTS = {
  investigation: (wu, topic) => `${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `${wu}/specification/${topic}/specification.md`,
};

/** Every phase a chunk can carry — each has a chunking config. */
const INDEXED_PHASES = ['investigation', 'specification', 'imports', 'seeds', 'analysis', RECORD_PHASE];

// The indexable files under `{wu}/.state/`, each basename mapped
// to its topic — the directory also holds operational state that must never
// enter the store.
/** @type {Record<string, string>} */
const ANALYSIS_CACHE_FILES = {
  'discovery-gap-analysis': 'gap-analysis',
};

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

// A flat import carrying another extension — refused by name, with the
// policy as the reason; a subdirectory or a dotfile is still a bad shape.
/** @param {string} name */
function isNonMarkdownImport(name) {
  return !isIndexableImport(name) && /^[^./][^/]*\.[^/.]+$/.test(name);
}

/** @param {string} filePath */
function nonMarkdownImportError(filePath) {
  return new UserError(
    `Refusing to index ${filePath} — imports are tracked on the manifest; ` +
      'only markdown imports are indexed.'
  );
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
 * An analysis cache's identity: `{wu}/.state/{filename}.md`, the
 * whitelisted filenames alone.
 * @param {string} workUnit @param {string} rest
 * @returns {Identity}
 */
function analysisIdentity(workUnit, rest) {
  assertSegment('work unit', workUnit);
  const fileMatch = /^([^/]+)\.md$/.exec(rest);
  if (!fileMatch) {
    throw new UserError(
      `Unexpected .state path structure: ${rest}\n` +
        'Expected: {work_unit}/.state/{filename}.md'
    );
  }
  const basename = fileMatch[1];
  if (!Object.hasOwn(ANALYSIS_CACHE_FILES, basename)) {
    throw new UserError(
      `Refusing to index .state file "${basename}.md" — only analysis caches ` +
        `(${Object.keys(ANALYSIS_CACHE_FILES).join(', ')}) are indexable.`
    );
  }
  return { workUnit, phase: 'analysis', topic: ANALYSIS_CACHE_FILES[basename] };
}

/**
 * A phase artifact's topic from the path beneath its phase directory: a
 * specification's folder, or every other phase's flat `{topic}.md`.
 * @param {string} phase @param {string} rest @param {string} filePath
 * @returns {string}
 */
function phaseTopic(phase, rest, filePath) {
  if (phase === 'specification') {
    const specMatch = /^([^/]+)\/specification\.md$/.exec(rest);
    if (!specMatch) {
      throw new UserError(
        `Unexpected specification path structure: ${rest}\n` +
          'Expected: {work_unit}/specification/{topic}/specification.md'
      );
    }
    return specMatch[1];
  }
  const flatMatch = /^([^/]+)\.md$/.exec(rest);
  if (!flatMatch) {
    if (phase === 'imports' && isNonMarkdownImport(rest)) throw nonMarkdownImportError(filePath);
    throw new UserError(
      `Unexpected ${phase} path structure: ${rest}\n` +
        `Expected: {work_unit}/${phase}/{topic}.md`
    );
  }
  return flatMatch[1];
}

/**
 * An artifact's identity from its state-relative path, or a UserError naming
 * the shape the path should have.
 * @param {string} filePath
 * @returns {Identity}
 */
function deriveIdentity(filePath) {
  const norm = filePath.replace(/\\/g, '/');

  // The dotted directories first: they would otherwise fall into the `.state`
  // capture and read as an invalid work unit.
  if (norm.startsWith(`${RECORDS_DIR}/`)) return recordIdentity(norm.slice(RECORDS_DIR.length + 1));
  const stateMatch = ANALYSIS_PATH.exec(norm);
  if (stateMatch) return analysisIdentity(stateMatch[1], stateMatch[2]);

  const match = PHASE_PATH.exec(norm);
  if (!match) {
    throw new UserError(
      `Cannot derive identity from path: ${filePath}\n` +
        'Expected path matching: {work_unit}/{phase}/...'
    );
  }
  const [, workUnit, phase, rest] = match;
  assertSegment('work unit', workUnit);
  const topic = phaseTopic(phase, rest, filePath);
  assertSegment('topic', topic);
  return { workUnit, phase, topic };
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
 * A work unit's flat-file entries for a top-level array field (imports or
 * seeds): markdown alone, exactly `{field}/{filename}` — any other shape is a
 * manifest edit no lander makes, refused so it cannot poison the store — each
 * topic once, and only while its file exists.
 * @param {string} root @param {Record<string, any>} unit @param {string} field
 * @param {(workUnit: string, dest: string) => string} fileOf  the state-relative file an entry's filename lands at
 * @returns {Artifact[]}
 */
function flatEntries(root, unit, field, fileOf) {
  const entries = unit[field];
  if (!Array.isArray(entries)) return [];
  const shape = new RegExp(`^${field}/([^/]+)$`);
  const seen = new Set();
  /** @type {Artifact[]} */
  const out = [];
  for (const entry of entries) {
    const m = entry && typeof entry.path === 'string' ? shape.exec(entry.path) : null;
    if (!m || !isIndexableImport(m[1]) || m[1].includes('..') || m[1].startsWith('.')) continue;
    const topic = m[1].slice(0, -3);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    const file = fileOf(unit.name, m[1]);
    if (fs.existsSync(path.resolve(root, file))) out.push({ file, workUnit: unit.name, phase: field, topic });
  }
  return out;
}

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
 * A live work unit's artifacts: each completed per-topic item's file, its
 * imports and seeds, its analysis caches and its record copies.
 * @param {string} root @param {Record<string, any>} unit
 * @returns {Artifact[]}
 */
function unitArtifacts(root, unit) {
  const workUnit = unit.name;
  const exists = (/** @type {string} */ file) => fs.existsSync(path.resolve(root, file));
  /** @type {Artifact[]} */
  const items = [];
  for (const [phase, buildPath] of Object.entries(INDEXED_ARTIFACTS)) {
    const topics = (unit.phases && unit.phases[phase] && unit.phases[phase].items) || {};
    for (const [topic, item] of Object.entries(topics)) {
      if (!item || item.status !== 'completed') continue;
      const file = buildPath(workUnit, topic);
      if (exists(file)) items.push({ file, workUnit, phase, topic });
    }
  }
  items.push(
    ...flatEntries(root, unit, 'imports', importArtifact),
    ...flatEntries(root, unit, 'seeds', (wu, dest) => path.posix.join(wu, 'seeds', dest)),
    ...recordArtifacts(root, workUnit),
  );
  for (const [basename, topic] of Object.entries(ANALYSIS_CACHE_FILES)) {
    const file = path.posix.join(workUnit, '.state', `${basename}.md`);
    if (exists(file)) items.push({ file, workUnit, phase: 'analysis', topic });
  }
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
 * unit unregistered or cancelled, the per-topic item gone or terminal. A
 * work unit whose manifest could not be read is evidence of nothing.
 * @param {string} root @param {Identity & {file: string}} entry
 * @param {Map<string, Record<string, any>>} units  work-unit manifests by name
 * @param {Set<string>|null} registry
 * @returns {string|null}
 */
function retiredReason(root, entry, units, registry) {
  if (!fs.existsSync(path.join(root, entry.file))) return 'source deleted';
  if (registry && !registry.has(entry.workUnit)) return 'work unit not registered';
  const unit = units.get(entry.workUnit);
  if (!unit) return null;
  if (unit.status === 'cancelled') return 'work unit cancelled';
  if (!INDEXED_ARTIFACTS[entry.phase]) return null;
  const items = (unit.phases && unit.phases[entry.phase] && unit.phases[entry.phase].items) || {};
  const item = items[entry.topic];
  if (!item) return `no ${entry.phase} item`;
  return TERMINAL_STATUSES.includes(item.status) ? `${entry.phase} ${item.status}` : null;
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
  INDEXED_ARTIFACTS,
  INDEXED_PHASES,
  RECORD_PHASE,
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
