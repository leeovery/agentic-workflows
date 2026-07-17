#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = path.resolve(process.cwd(), '.workflows');

const {
  VALID_WORK_TYPES,
  VALID_PHASES,
  VALID_PHASE_STATUSES,
  VALID_ROUTINGS,
  VALID_GATE_MODES,
  VALID_WORK_UNIT_STATUSES,
  RESERVED_WORK_UNIT_NAMES: RESERVED_NAMES,
} = require('../../workflow-shared/scripts/manifest-schema.cjs');

// Shared manifest IO (read/parse, locked atomic writes, lock discipline) —
// one implementation for this CLI and the engine, so the two writers can
// never drift. This CLI translates its thrown errors to the die/exit-code
// convention.
const io = require('../../workflow-shared/scripts/manifest-io.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Exit-code convention:
//   1 — unexpected error (corrupt JSON, bad args, I/O, validation failure)
//   2 — expected miss (work unit / path / value not found) — callers that
//       do best-effort lookups can distinguish this from real errors
//       without pattern-matching the stderr text.
function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function manifestDir(name) {
  return path.join(WORKFLOWS_DIR, name);
}

function manifestPath(name) {
  return io.workUnitManifestPath(WORKFLOWS_DIR, name);
}

function readManifest(name) {
  if (!fs.existsSync(manifestPath(name))) die(`Work unit "${name}" not found`, 2);
  try {
    return io.readWorkUnitManifest(WORKFLOWS_DIR, name);
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}

function writeManifestAtomic(name, data) {
  io.writeWorkUnitManifestAtomic(WORKFLOWS_DIR, name, data);
}

// ---------------------------------------------------------------------------
// File Locking
// ---------------------------------------------------------------------------

function withLock(name, fn) {
  try {
    return io.withWorkUnitLock(WORKFLOWS_DIR, name, fn);
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------
// Project Manifest
// ---------------------------------------------------------------------------

function readProjectManifest() {
  // Missing file is a legitimate first-write state ({}); corrupt JSON or any
  // other read error aborts loudly — a write against a silently-empty
  // document would erase every registered work unit.
  try {
    return io.readProjectManifest(WORKFLOWS_DIR);
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}

function writeProjectManifestAtomic(data) {
  io.writeProjectManifestAtomic(WORKFLOWS_DIR, data);
}

function withProjectLock(fn) {
  try {
    return io.withProjectLock(WORKFLOWS_DIR, fn);
  } catch (e) {
    die(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Check if a path argument targets the project manifest.
 * Returns { isProject: true, fieldSegments: [...] } or { isProject: false }.
 */
function parseProjectPath(pathArg) {
  if (pathArg === 'project') {
    return { isProject: true, fieldSegments: [] };
  }
  if (pathArg.startsWith('project.')) {
    const remainder = pathArg.slice('project.'.length);
    return { isProject: true, fieldSegments: remainder.split('.') };
  }
  return { isProject: false, fieldSegments: [] };
}

// ---------------------------------------------------------------------------
// Path Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a dot-path argument into work unit, phase, and topic.
 * Segment count determines the access level:
 *   1 segment  → work-unit level
 *   2 segments → phase level
 *   3 segments → topic level
 */
function parsePath(pathArg) {
  const parts = pathArg.split('.');
  if (parts.length === 1) return { workUnit: parts[0], phase: null, topic: null };
  if (parts.length === 2) {
    validatePhase(parts[1]);
    return { workUnit: parts[0], phase: parts[1], topic: null };
  }
  if (parts.length === 3) {
    validatePhase(parts[1]);
    return { workUnit: parts[0], phase: parts[1], topic: parts[2] };
  }
  die(`Invalid path "${pathArg}". Expected: <work-unit>[.<phase>[.<topic>]]`);
}

/**
 * Resolve the internal JSON path segments for a phase+topic operation.
 * All work types route through items when topic is provided.
 *
 * @param {string} phase - The phase name
 * @param {string|null} topic - The topic name (null = whole phase)
 * @param {string[]} fieldSegments - Additional field path segments
 * @returns {string[]} Full path segments from manifest root
 */
function resolvePhaseSegments(phase, topic, fieldSegments) {
  const base = ['phases', phase];
  if (!topic) return [...base, ...fieldSegments];
  return [...base, 'items', topic, ...fieldSegments];
}

/**
 * Resolve field segments to full manifest path.
 * At work-unit level (no phase), field maps directly to manifest root.
 * At phase/topic level, field is prepended with the phase path.
 */
function resolveSegments(phase, topic, fieldSegments) {
  return phase ? resolvePhaseSegments(phase, topic, fieldSegments) : fieldSegments;
}

function requireWorkUnit(workUnit) {
  if (!fs.existsSync(manifestPath(workUnit))) {
    die(`Work unit "${workUnit}" not found`, 2);
  }
}

/**
 * Resolve wildcard topic — collect field values from all topics in a phase.
 * All work types use items structure.
 *
 * @param {object} manifest - The full manifest object
 * @param {string} phase - The phase name
 * @param {string[]} fieldSegments - Field path within each topic
 * @returns {Array<{topic: string, value: *}>} Collected values
 */
function resolveWildcardTopic(manifest, phase, fieldSegments) {
  const phaseData = getByPath(manifest, ['phases', phase]);
  if (!phaseData) return [];

  const items = phaseData.items;
  if (!items || typeof items !== 'object') return [];

  return Object.keys(items).map(topic => ({
    topic,
    value: fieldSegments.length ? getByPath(items[topic], fieldSegments) : items[topic],
  })).filter(entry => entry.value !== undefined);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateWorkType(value) {
  if (!VALID_WORK_TYPES.includes(value)) {
    die(`Invalid work_type "${value}". Must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }
}

function validateWorkUnitStatus(value) {
  if (!VALID_WORK_UNIT_STATUSES.includes(value)) {
    die(`Invalid status "${value}". Must be one of: ${VALID_WORK_UNIT_STATUSES.join(', ')}`);
  }
}

function validatePhase(phase) {
  if (!VALID_PHASES.includes(phase)) {
    die(`Invalid phase "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`);
  }
}

function validateGateMode(value) {
  if (!VALID_GATE_MODES.includes(value)) {
    die(`Invalid gate mode "${value}". Must be one of: ${VALID_GATE_MODES.join(', ')}`);
  }
}

function validatePhaseStatus(phase, value) {
  const valid = VALID_PHASE_STATUSES[phase];
  if (valid && valid.length === 0) {
    die(`Phase "${phase}" items carry no status field — lifecycle is computed at render time`);
  }
  if (valid && !valid.includes(value)) {
    die(`Invalid status "${value}" for phase "${phase}". Must be one of: ${valid.join(', ')}`);
  }
}

/**
 * Validate a set operation based on the resolved internal path and value.
 * Segments are the full internal path from manifest root.
 */
function validateSet(segments, value) {
  // Top-level status
  if (segments.length === 1 && segments[0] === 'status') {
    validateWorkUnitStatus(value);
    return;
  }

  // Top-level work_type
  if (segments.length === 1 && segments[0] === 'work_type') {
    validateWorkType(value);
    return;
  }

  // Gate modes anywhere in the tree
  const last = segments[segments.length - 1];
  if (last.endsWith('_gate_mode') || last === 'gate_mode') {
    validateGateMode(value);
    return;
  }

  // phases.<phase> — validate phase name
  if (segments.length >= 2 && segments[0] === 'phases') {
    const phase = segments[1];
    validatePhase(phase);

    // phases.<phase>.items.<item>.status
    if (segments.length === 5 && segments[2] === 'items' && segments[4] === 'status') {
      validatePhaseStatus(phase, value);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Dot Path Utilities
// ---------------------------------------------------------------------------

function getByPath(obj, segments) {
  let current = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[seg];
  }
  return current;
}

function setByPath(obj, segments, value) {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] == null || typeof current[seg] !== 'object') {
      current[seg] = {};
    }
    current = current[seg];
  }
  current[segments[segments.length - 1]] = value;
}

function deleteByPath(obj, segments) {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current == null || typeof current !== 'object') return false;
    current = current[seg];
  }
  if (current == null || typeof current !== 'object') return false;
  const last = segments[segments.length - 1];
  if (!(last in current)) return false;
  delete current[last];
  return true;
}

function parseValue(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

// Deep equality used by `pull` so object-shaped array entries (e.g. imports[]
// records) can be matched by value, not by reference. Order-independent for
// object keys.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function findDeepIndex(arr, value) {
  for (let i = 0; i < arr.length; i++) {
    if (deepEqual(arr[i], value)) return i;
  }
  return -1;
}

function outputValue(value) {
  if (value !== null && typeof value === 'object') {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  } else {
    process.stdout.write(String(value) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdInit(args) {
  let name = null;
  let workType = null;
  let description = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--work-type' && i + 1 < args.length) {
      workType = args[++i];
    } else if (args[i] === '--description' && i + 1 < args.length) {
      description = args[++i];
    } else if (!name) {
      name = args[i];
    }
  }

  if (!name) die('Usage: init <name> --work-type <type> --description "..."');
  if (!workType) die('--work-type is required');
  if (name.includes('.')) die(`Work unit name "${name}" must not contain dots`);
  if (VALID_PHASES.includes(name)) die(`Work unit name "${name}" conflicts with a phase name`);
  if (RESERVED_NAMES.includes(name)) die(`Work unit name "${name}" is reserved`);

  validateWorkType(workType);

  const dir = manifestDir(name);
  const mp = manifestPath(name);

  if (fs.existsSync(mp)) {
    die(`Work unit "${name}" already exists`);
  }

  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    name,
    work_type: workType,
    status: 'in-progress',
    created: new Date().toISOString().slice(0, 10),
    description,
    phases: {},
  };

  writeManifestAtomic(name, manifest);

  // Register in project manifest
  withProjectLock(() => {
    const proj = readProjectManifest();
    if (!proj.work_units) proj.work_units = {};
    proj.work_units[name] = { work_type: workType };
    writeProjectManifestAtomic(proj);
  });

  process.stdout.write(`Created work unit "${name}" (${workType})\n`);
}

function cmdGet(args) {
  if (args.length < 1) die('Usage: get <path> [field.path]');

  // Project manifest routing
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    const manifest = readProjectManifest();
    if (proj.fieldSegments.length === 0) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      return;
    }
    const value = getByPath(manifest, proj.fieldSegments);
    if (value === undefined) return;
    outputValue(value);
    return;
  }

  const { workUnit, phase, topic } = parsePath(args[0]);
  if (!fs.existsSync(manifestPath(workUnit))) return;
  const manifest = readManifest(workUnit);

  if (!phase) {
    // Work-unit-level: get <wu> [field]
    if (args.length === 1) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      return;
    }
    const segments = args[1].split('.');
    const value = getByPath(manifest, segments);
    if (value === undefined) return;
    outputValue(value);
    return;
  }

  // Phase/topic level
  const fieldSegments = args.length > 1 ? args[1].split('.') : [];

  // Wildcard topic: collect values from all topics
  if (topic === '*') {
    const results = resolveWildcardTopic(manifest, phase, fieldSegments);
    if (results.length === 0) return;
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  const segments = resolvePhaseSegments(phase, topic, fieldSegments);
  const value = getByPath(manifest, segments);
  if (value === undefined) return;
  outputValue(value);
}

function cmdSet(args) {
  // Project manifest routing: set project.field.path <value>
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      die('Usage: set project.<field.path> <value>');
    }
    const value = parseValue(args[1]);
    withProjectLock(() => {
      const manifest = readProjectManifest();
      setByPath(manifest, proj.fieldSegments, value);
      writeProjectManifestAtomic(manifest);
    });
    return;
  }

  if (args.length < 3) die('Usage: set <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  requireWorkUnit(workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  if (typeof value === 'string') {
    validateSet(segments, value);
  }

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);
    setByPath(manifest, segments, value);
    writeManifestAtomic(workUnit, manifest);
  });
}

function cmdDelete(args) {
  // Project manifest routing: delete project.field.path
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0) {
      die('Usage: delete project.<field.path>');
    }
    withProjectLock(() => {
      const manifest = readProjectManifest();
      if (!deleteByPath(manifest, proj.fieldSegments)) {
        die(`Path "${proj.fieldSegments.join('.')}" not found in project manifest`, 2);
      }
      writeProjectManifestAtomic(manifest);
    });
    return;
  }

  if (args.length < 2) die('Usage: delete <path> <field.path>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');

  requireWorkUnit(workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);
    if (!deleteByPath(manifest, segments)) {
      die(`Path "${segments.join('.')}" not found in "${workUnit}"`, 2);
    }
    writeManifestAtomic(workUnit, manifest);
  });
}

function cmdList(args) {
  let filterStatus = null;
  let filterWorkType = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status' && i + 1 < args.length) {
      filterStatus = args[++i];
    } else if (args[i] === '--work-type' && i + 1 < args.length) {
      filterWorkType = args[++i];
    }
  }

  if (!fs.existsSync(WORKFLOWS_DIR)) {
    process.stdout.write('[]\n');
    return;
  }

  // Use project manifest for work unit names, fall back to filesystem scan
  const proj = readProjectManifest();
  let names;
  if (proj.work_units && Object.keys(proj.work_units).length > 0) {
    names = Object.keys(proj.work_units);
  } else {
    names = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);
  }

  const results = [];

  for (const name of names) {
    if (!fs.existsSync(manifestPath(name))) continue;

    try {
      const manifest = io.readWorkUnitManifest(WORKFLOWS_DIR, name);

      if (filterStatus && manifest.status !== filterStatus) continue;
      if (filterWorkType && manifest.work_type !== filterWorkType) continue;

      results.push(manifest);
    } catch (_) {
      // Skip malformed manifests
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}

function cmdInitPhase(args) {
  if (args.length !== 1) die('Usage: init-phase <work-unit>.<phase>.<topic>');

  const { workUnit, phase, topic } = parsePath(args[0]);

  if (!phase || !topic) {
    die('Usage: init-phase <work-unit>.<phase>.<topic>');
  }

  // Phases with an empty status vocabulary (discovery) hold map items, not
  // status-carrying phase items — init-phase would write a dead status field.
  const statuses = VALID_PHASE_STATUSES[phase];
  if (statuses && statuses.length === 0) {
    die(`Phase "${phase}" items carry no status field — use \`engine discovery-map add\` instead`);
  }

  requireWorkUnit(workUnit);

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);

    if (!manifest.phases) manifest.phases = {};
    if (!manifest.phases[phase]) manifest.phases[phase] = {};
    if (!manifest.phases[phase].items) manifest.phases[phase].items = {};

    if (manifest.phases[phase].items[topic]) {
      die(`Item "${topic}" already exists in phase "${phase}" of "${workUnit}"`);
    }

    manifest.phases[phase].items[topic] = { status: 'in-progress' };

    writeManifestAtomic(workUnit, manifest);
  });

  process.stdout.write(`Initialized ${phase} phase for "${topic}" in "${workUnit}"\n`);
}

function cmdPush(args) {
  // Project manifest routing: push project.field.path <value>
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      die('Usage: push project.<field.path> <value>');
    }
    const value = parseValue(args[1]);
    withProjectLock(() => {
      const manifest = readProjectManifest();
      const current = getByPath(manifest, proj.fieldSegments);

      if (current !== undefined && !Array.isArray(current)) {
        die(`Path "${proj.fieldSegments.join('.')}" is not an array in project manifest`);
      }

      if (current === undefined) {
        setByPath(manifest, proj.fieldSegments, [value]);
      } else {
        current.push(value);
      }

      writeProjectManifestAtomic(manifest);
    });
    return;
  }

  if (args.length < 3) die('Usage: push <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  requireWorkUnit(workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);
    const current = getByPath(manifest, segments);

    if (current !== undefined && !Array.isArray(current)) {
      die(`Path "${segments.join('.')}" is not an array`);
    }

    if (current === undefined) {
      setByPath(manifest, segments, [value]);
    } else {
      current.push(value);
    }

    writeManifestAtomic(workUnit, manifest);
  });
}

function cmdPull(args) {
  // Project manifest routing: pull project.field.path <value>
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      die('Usage: pull project.<field.path> <value>');
    }
    const value = parseValue(args[1]);
    withProjectLock(() => {
      const manifest = readProjectManifest();
      const current = getByPath(manifest, proj.fieldSegments);
      if (!Array.isArray(current)) return; // no-op
      const idx = findDeepIndex(current, value);
      if (idx === -1) return; // no-op
      current.splice(idx, 1);
      writeProjectManifestAtomic(manifest);
    });
    return;
  }

  if (args.length < 3) die('Usage: pull <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  requireWorkUnit(workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);
    const current = getByPath(manifest, segments);
    if (!Array.isArray(current)) return; // no-op
    const idx = findDeepIndex(current, value);
    if (idx === -1) return; // no-op
    current.splice(idx, 1);
    writeManifestAtomic(workUnit, manifest);
  });
}

function cmdExists(args) {
  if (args.length < 1) die('Usage: exists <path> [field.path]');

  // Project manifest routing: exists project[.field.path]
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    const manifest = readProjectManifest();
    if (proj.fieldSegments.length === 0) {
      // exists project — check if project manifest has any content
      process.stdout.write(Object.keys(manifest).length > 0 ? 'true\n' : 'false\n');
      return;
    }
    const value = getByPath(manifest, proj.fieldSegments);
    process.stdout.write(value !== undefined ? 'true\n' : 'false\n');
    return;
  }

  const { workUnit, phase, topic } = parsePath(args[0]);
  const mp = manifestPath(workUnit);

  // Work-unit level, no field path — just check if manifest file exists
  if (!phase && args.length === 1) {
    process.stdout.write(fs.existsSync(mp) ? 'true\n' : 'false\n');
    return;
  }

  // If manifest doesn't exist, any deeper path is false
  if (!fs.existsSync(mp)) {
    process.stdout.write('false\n');
    return;
  }

  const manifest = readManifest(workUnit);

  if (!phase) {
    // Work-unit level with field path
    const segments = args[1].split('.');
    const value = getByPath(manifest, segments);
    process.stdout.write(value !== undefined ? 'true\n' : 'false\n');
    return;
  }

  // Phase/topic level
  const fieldSegments = args.length > 1 ? args[1].split('.') : [];

  // Wildcard topic: check if any topic has the specified field
  if (topic === '*') {
    const results = resolveWildcardTopic(manifest, phase, fieldSegments);
    process.stdout.write(results.length > 0 ? 'true\n' : 'false\n');
    return;
  }

  const segments = resolvePhaseSegments(phase, topic, fieldSegments);
  const value = getByPath(manifest, segments);
  process.stdout.write(value !== undefined ? 'true\n' : 'false\n');
}

// Legacy convenience command — prefer project.* dot-path syntax via get/set/exists/delete/push.
// Retained for the --type filter on list which is not available via dot-path.
function cmdProject(args) {
  const sub = args[0];
  if (!sub) die('Usage: project <list|get> [args]');

  if (sub === 'list') {
    let filterType = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--type' && i + 1 < args.length) {
        filterType = args[++i];
      }
    }
    const units = readProjectManifest().work_units || {};
    const names = Object.keys(units).filter(n => !filterType || units[n].work_type === filterType);
    if (names.length > 0) {
      process.stdout.write(names.join('\n') + '\n');
    }
    return;
  }

  if (sub === 'get') {
    const name = args[1];
    if (!name) die('Usage: project get <name>');
    const entry = (readProjectManifest().work_units || {})[name];
    if (!entry) return;
    process.stdout.write(`work_type: ${entry.work_type}\n`);
    return;
  }

  die(`Unknown project subcommand "${sub}". Must be: list, get`);
}

function cmdKeyOf(args) {
  if (args.length < 3) die('Usage: key-of <path> <field.path> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const searchValue = args[2];

  const manifest = readManifest(workUnit);
  const segments = resolveSegments(phase, topic, fieldSegments);
  const obj = getByPath(manifest, segments);

  if (obj == null || typeof obj !== 'object') {
    die(`Path "${segments.join('.')}" is not an object in "${workUnit}"`);
  }

  const key = Object.keys(obj).find(k => String(obj[k]) === searchValue);

  if (key === undefined) {
    die(`Value "${searchValue}" not found in "${segments.join('.')}"`, 2);
  }

  process.stdout.write(key + '\n');
}

// ---------------------------------------------------------------------------
// Resolve — map work_unit.phase[.topic] to artifact file paths on disk.
// Used by the knowledge CLI for artifact discovery.
// ---------------------------------------------------------------------------

const INDEXED_PHASES = ['research', 'discussion', 'investigation', 'specification'];

function cmdResolve(args) {
  if (!args[0]) {
    die('Usage: manifest.cjs resolve <work_unit>.<phase>[.<topic>]\nResolves artifact file paths for indexed phases.');
  }

  const { workUnit, phase, topic } = parsePath(args[0]);

  if (!phase) {
    die('resolve requires at least 2 segments: <work_unit>.<phase>[.<topic>]');
  }

  if (!INDEXED_PHASES.includes(phase)) {
    die(`Phase "${phase}" is not indexed by the knowledge base. Indexed phases: ${INDEXED_PHASES.join(', ')}`);
  }

  // Validate that the work unit exists by reading its manifest.
  const manifest = readManifest(workUnit);
  const wuDir = path.join(WORKFLOWS_DIR, workUnit);

  if (phase === 'research') {
    if (topic) {
      // 3-segment: specific research item.
      const filePath = path.join(wuDir, 'research', topic + '.md');
      process.stdout.write(filePath + '\n');
    } else {
      // 2-segment: iterate phases.research.items from the manifest.
      const items = manifest.phases && manifest.phases.research && manifest.phases.research.items;
      if (!items || typeof items !== 'object') {
        // No research items tracked — output nothing, exit 0.
        return;
      }
      for (const itemName of Object.keys(items)) {
        const filePath = path.join(wuDir, 'research', itemName + '.md');
        process.stdout.write(filePath + '\n');
      }
    }
    return;
  }

  // For non-research phases, topic is required (3 segments).
  if (!topic) {
    die(`resolve for ${phase} requires 3 segments: <work_unit>.${phase}.<topic>`);
  }

  if (phase === 'discussion') {
    process.stdout.write(path.join(wuDir, 'discussion', topic + '.md') + '\n');
    return;
  }

  if (phase === 'investigation') {
    process.stdout.write(path.join(wuDir, 'investigation', topic + '.md') + '\n');
    return;
  }

  if (phase === 'specification') {
    process.stdout.write(path.join(wuDir, 'specification', topic, 'specification.md') + '\n');
    return;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

if (!command) {
  die('Usage: manifest.cjs <command> [args]\nCommands: init, get, set, delete, list, init-phase, push, pull, exists, key-of, project, resolve');
}

switch (command) {
  case 'init':     cmdInit(args); break;
  case 'get':      cmdGet(args); break;
  case 'set':      cmdSet(args); break;
  case 'delete':   cmdDelete(args); break;
  case 'list':     cmdList(args); break;
  case 'init-phase': cmdInitPhase(args); break;
  case 'push':     cmdPush(args); break;
  case 'pull':     cmdPull(args); break;
  case 'exists':   cmdExists(args); break;
  case 'key-of':   cmdKeyOf(args); break;
  case 'project':  cmdProject(args); break;
  case 'resolve':  cmdResolve(args); break;
  default:         die(`Unknown command "${command}"`);
}
