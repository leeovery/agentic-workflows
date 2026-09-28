'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the knowledge base indexes, and where — each artifact's
// identity (work unit, phase, topic) derived from its path, the artifacts the
// manifests say belong in the store, and why an indexed identity no longer
// does.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { readProjectManifest, listWorkUnitManifests } = require('../../kernel/manifest.cjs');
const { TERMINAL_STATUSES, PROJECT_IDENTITIES } = require('../../kernel/manifest-schema.cjs');
const { UserError } = require('../../kernel/knowledge/retry.cjs');

/**
 * Phases whose completed artifact is indexed, with the artifact path per
 * topic — the per-topic manifest items. Imports, seeds, analysis caches and
 * discovery sessions are file-based and found by their own traversals.
 * @type {Record<string, (wu: string, topic: string) => string>}
 */
const INDEXED_ARTIFACTS = {
  research: (wu, topic) => `.workflows/${wu}/research/${topic}.md`,
  discussion: (wu, topic) => `.workflows/${wu}/discussion/${topic}.md`,
  investigation: (wu, topic) => `.workflows/${wu}/investigation/${topic}.md`,
  specification: (wu, topic) => `.workflows/${wu}/specification/${topic}/specification.md`,
};

/** Every phase a chunk can carry — each has a chunking config. */
const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification', 'imports', 'seeds', 'analysis', 'discovery', 'baseline', 'roadmap'];

// The project-level places carry their own name as both work unit and work
// type: the engine reserves each, so no work unit collides with it.
const [BASELINE_IDENTITY, ROADMAP_IDENTITY] = PROJECT_IDENTITIES;
const RESERVED_IDENTITIES = new Set(PROJECT_IDENTITIES);

// Phases whose artifact is a flat `{phase}/{basename}.md` file, the topic its
// basename.
const FLAT_PHASES = new Set(['research', 'discussion', 'investigation', 'imports', 'seeds']);

// The indexable files under `.workflows/{wu}/.state/`, each basename mapped
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
 * @typedef {Identity & {file: string}} Artifact  `file` relative to the project root
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

// Markdown alone is embedded; any other import is reference material tracked
// on the manifest.
/** @param {string} name */
function isIndexableImportPath(name) {
  return name.endsWith('.md');
}

// A flat import carrying another extension — refused by name, with the
// policy as the reason; a subdirectory or a dotfile is still a bad shape.
/** @param {string} name */
function isNonMarkdownImport(name) {
  return !isIndexableImportPath(name) && /^[^./][^/]*\.[^/.]+$/.test(name);
}

/** @param {string} filePath */
function nonMarkdownImportError(filePath) {
  return new UserError(
    `Refusing to index ${filePath} — imports are tracked on the manifest; ` +
      'only markdown imports are indexed.'
  );
}

/**
 * A baseline doc's identity: `.workflows/.baseline/{topic}.md`, flat — the
 * session state nested beneath is refused.
 * @param {string} rest
 * @returns {Identity}
 */
function baselineIdentity(rest) {
  const fileMatch = /^([^/]+)\.md$/.exec(rest);
  if (!fileMatch) {
    throw new UserError(
      `Unexpected baseline path structure: ${rest}\n` +
        'Expected: .workflows/.baseline/{topic}.md'
    );
  }
  assertSegment('topic', fileMatch[1]);
  return { workUnit: BASELINE_IDENTITY, phase: 'baseline', topic: fileMatch[1] };
}

/**
 * A roadmap file's identity: a session log (topic its basename, so sessions
 * coexist) or an import (topic its filename).
 * @param {string} rest @param {string} filePath
 * @returns {Identity}
 */
function roadmapIdentity(rest, filePath) {
  const sessMatch = /^sessions\/(session-\d+)\.md$/.exec(rest);
  if (sessMatch) return { workUnit: ROADMAP_IDENTITY, phase: 'roadmap', topic: sessMatch[1] };
  const importMatch = /^imports\/([^/]+)\.md$/.exec(rest);
  if (importMatch) {
    assertSegment('topic', importMatch[1]);
    return { workUnit: ROADMAP_IDENTITY, phase: 'imports', topic: importMatch[1] };
  }
  const otherImport = /^imports\/(.+)$/.exec(rest);
  if (otherImport && isNonMarkdownImport(otherImport[1])) throw nonMarkdownImportError(filePath);
  throw new UserError(
    `Unexpected roadmap path structure: ${rest}\n` +
      'Expected: .workflows/.roadmap/sessions/session-NNN.md or .workflows/.roadmap/imports/{name}.md'
  );
}

/**
 * An analysis cache's identity: `.workflows/{wu}/.state/{filename}.md`, the
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
        'Expected: .workflows/{work_unit}/.state/{filename}.md'
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
 * A phase artifact's topic from the path beneath its phase directory.
 * @param {string} phase @param {string} rest @param {string} filePath
 * @returns {string}
 */
function phaseTopic(phase, rest, filePath) {
  if (phase === 'specification') {
    const specMatch = /^([^/]+)\/specification\.md$/.exec(rest);
    if (!specMatch) {
      throw new UserError(
        `Unexpected specification path structure: ${rest}\n` +
          'Expected: .workflows/{work_unit}/specification/{topic}/specification.md'
      );
    }
    return specMatch[1];
  }
  if (FLAT_PHASES.has(phase)) {
    const flatMatch = /^([^/]+)\.md$/.exec(rest);
    if (!flatMatch) {
      if (phase === 'imports' && isNonMarkdownImport(rest)) throw nonMarkdownImportError(filePath);
      throw new UserError(
        `Unexpected ${phase} path structure: ${rest}\n` +
          `Expected: .workflows/{work_unit}/${phase}/{topic}.md`
      );
    }
    return flatMatch[1];
  }
  const discMatch = /^sessions\/(session-\d+)\.md$/.exec(rest);
  if (!discMatch) {
    throw new UserError(
      `Unexpected discovery path structure: ${rest}\n` +
        'Expected: .workflows/{work_unit}/discovery/sessions/session-NNN.md'
    );
  }
  return discMatch[1];
}

/**
 * An artifact's identity from its path, or a UserError naming the shape the
 * path should have.
 * @param {string} filePath
 * @returns {Identity}
 */
function deriveIdentity(filePath) {
  const norm = filePath.replace(/\\/g, '/');

  // The dotted directories first: they would otherwise fall into the `.state`
  // capture and read as an invalid work unit.
  const baselineMatch = /\.workflows\/\.baseline\/(.+)$/.exec(norm);
  if (baselineMatch) return baselineIdentity(baselineMatch[1]);
  const roadmapMatch = /\.workflows\/\.roadmap\/(.+)$/.exec(norm);
  if (roadmapMatch) return roadmapIdentity(roadmapMatch[1], filePath);
  const stateMatch = /\.workflows\/([^/]+)\/\.state\/(.+)$/.exec(norm);
  if (stateMatch) return analysisIdentity(stateMatch[1], stateMatch[2]);

  const match = /\.workflows\/([^/]+)\/(research|discussion|investigation|specification|imports|seeds|discovery)\/(.+)$/.exec(norm);
  if (!match) {
    throw new UserError(
      `Cannot derive identity from path: ${filePath}\n` +
        'Expected path matching: .workflows/{work_unit}/{phase}/...'
    );
  }
  const [, workUnit, phase, rest] = match;
  assertSegment('work unit', workUnit);
  const topic = phaseTopic(phase, rest, filePath);
  assertSegment('topic', topic);
  return { workUnit, phase, topic };
}

/**
 * The work type a chunk of the artifact carries: the work unit's, or the
 * project-level place's own name.
 * @param {string} root @param {Identity} identity
 * @returns {string}
 */
function workTypeOf(root, { workUnit, phase }) {
  if (phase === 'baseline') return BASELINE_IDENTITY;
  if (workUnit === ROADMAP_IDENTITY) return ROADMAP_IDENTITY;
  const manifestFile = path.join(root, '.workflows', workUnit, 'manifest.json');
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
 * @property {string|null} roadmapSession  the live roadmap session's number
 */

/** @type {Manifests} */
const NO_MANIFESTS = { workUnits: [], registry: null, roadmapSession: null };

/**
 * The session number a manifest node marks live, or null.
 * @param {any} node  an epic's `phases.discovery`, or the project's `roadmap`
 * @returns {string|null}
 */
function activeSession(node) {
  const session = node && node.active_session;
  return typeof session === 'string' && session !== '' ? session : null;
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
      workUnits: listWorkUnitManifests(root),
      registry: registered.length > 0 ? new Set(registered) : null,
      roadmapSession: activeSession(project.roadmap),
    };
  } catch (err) {
    throw new Error(`manifest read failed: ${err instanceof Error ? err.message : String(err)}`);
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
    warn(`Warning: manifest read failed in ${context}: ${err instanceof Error ? err.message : String(err)}\n`);
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
    warn(`Warning: ${err instanceof Error ? err.message : String(err)} (${context})\n`);
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
 * @returns {Artifact[]}
 */
function flatEntries(root, unit, field) {
  const entries = unit[field];
  if (!Array.isArray(entries)) return [];
  const shape = new RegExp(`^${field}/([^/]+)$`);
  const seen = new Set();
  /** @type {Artifact[]} */
  const out = [];
  for (const entry of entries) {
    const m = entry && typeof entry.path === 'string' ? shape.exec(entry.path) : null;
    if (!m || !isIndexableImportPath(m[1]) || m[1].includes('..') || m[1].startsWith('.')) continue;
    const topic = m[1].slice(0, -3);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    const file = path.posix.join('.workflows', unit.name, entry.path);
    if (fs.existsSync(path.resolve(root, file))) out.push({ file, workUnit: unit.name, phase: field, topic });
  }
  return out;
}

/**
 * The session logs in a sessions directory, bar the live session's — a live
 * log is indexed when its session closes.
 * @param {string} root @param {string} dir  project-relative @param {string|null} liveSession
 * @returns {string[]} the log filenames
 */
function closedSessionLogs(root, dir, liveSession) {
  let files;
  try {
    files = fs.readdirSync(path.resolve(root, dir));
  } catch {
    return [];
  }
  return files.filter((f) => /^session-\d+\.md$/.test(f) && (liveSession === null || f !== `session-${liveSession}.md`));
}

/**
 * The markdown files directly in a project-level directory, their stems dot-free.
 * @param {string} root @param {string} dir @returns {string[]}
 */
function flatMarkdown(root, dir) {
  try {
    return fs.readdirSync(path.resolve(root, dir)).filter((f) => isIndexableImportPath(f) && /^[^./]+$/.test(f.slice(0, -3)));
  } catch {
    return [];
  }
}

/**
 * The project-level artifacts: baseline docs, and the roadmap's closed
 * session logs and imports. They exist before the first work unit, so
 * nothing about them waits on a manifest.
 * @param {string} root @param {string|null} roadmapSession
 * @returns {Artifact[]}
 */
function projectArtifacts(root, roadmapSession) {
  const baselineDir = '.workflows/.baseline';
  const sessionsDir = '.workflows/.roadmap/sessions';
  const importsDir = '.workflows/.roadmap/imports';
  /** @param {string} dir @param {string} workUnit @param {string} phase @returns {(f: string) => Artifact} */
  const artifact = (dir, workUnit, phase) => (f) => ({ file: path.posix.join(dir, f), workUnit, phase, topic: f.slice(0, -3) });
  return [
    ...flatMarkdown(root, baselineDir).map(artifact(baselineDir, BASELINE_IDENTITY, 'baseline')),
    ...closedSessionLogs(root, sessionsDir, roadmapSession).map(artifact(sessionsDir, ROADMAP_IDENTITY, 'roadmap')),
    ...flatMarkdown(root, importsDir).map(artifact(importsDir, ROADMAP_IDENTITY, 'imports')),
  ];
}

/**
 * A live work unit's artifacts: each completed per-topic item's file, its
 * imports and seeds, its analysis caches, and an epic's closed discovery
 * session logs.
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
  items.push(...flatEntries(root, unit, 'imports'), ...flatEntries(root, unit, 'seeds'));
  for (const [basename, topic] of Object.entries(ANALYSIS_CACHE_FILES)) {
    const file = path.posix.join('.workflows', workUnit, '.state', `${basename}.md`);
    if (exists(file)) items.push({ file, workUnit, phase: 'analysis', topic });
  }
  if (unit.work_type === 'epic') {
    const sessionsDir = path.posix.join('.workflows', workUnit, 'discovery', 'sessions');
    for (const f of closedSessionLogs(root, sessionsDir, activeSession(unit.phases && unit.phases.discovery))) {
      items.push({ file: path.posix.join(sessionsDir, f), workUnit, phase: 'discovery', topic: f.slice(0, -3) });
    }
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
  return [
    ...projectArtifacts(root, manifests.roadmapSession),
    ...live.flatMap((unit) => unitArtifacts(root, unit)),
  ];
}

// ---------------------------------------------------------------------------
// Retirement — why an indexed identity no longer belongs in the store
// ---------------------------------------------------------------------------

/**
 * Whether a recorded source path lands outside this project — a chunk indexed
 * by absolute path from another checkout.
 * @param {string} root @param {string} file
 */
function outsideProject(root, file) {
  const rel = path.relative(root, path.resolve(root, file));
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

/**
 * Why an indexed identity no longer belongs in the store, or null while it
 * may. Only positive knowledge retires: the source gone from disk, the work
 * unit unregistered or cancelled, the per-topic item gone or terminal. A
 * source outside the project is no evidence it was deleted, a work unit
 * whose manifest could not be read is evidence of nothing, and the
 * project-level identities answer to their files alone.
 * @param {string} root @param {Identity & {file: string}} entry
 * @param {Map<string, Record<string, any>>} units  work-unit manifests by name
 * @param {Set<string>|null} registry
 * @returns {string|null}
 */
function retiredReason(root, entry, units, registry) {
  if (!outsideProject(root, entry.file) && !fs.existsSync(path.resolve(root, entry.file))) return 'source deleted';
  if (RESERVED_IDENTITIES.has(entry.workUnit)) return null;
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
  const units = new Map(manifests.workUnits.filter((u) => u && u.name).map((u) => [u.name, u]));
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
  RESERVED_IDENTITIES,
  identityKey,
  deriveIdentity,
  workTypeOf,
  readManifests,
  readManifestsOr,
  workUnitsOr,
  discoverArtifacts,
  retirements,
};
