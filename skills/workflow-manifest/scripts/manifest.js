#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = path.resolve(process.cwd(), '.workflows');

const VALID_WORK_TYPES = ['epic', 'feature', 'bugfix'];

const VALID_PHASES = [
  'research', 'discussion', 'investigation',
  'specification', 'planning', 'implementation',
  'review'
];

const VALID_PHASE_STATUSES = {
  research:       ['in-progress', 'completed'],
  discussion:     ['in-progress', 'completed'],
  investigation:  ['in-progress', 'completed'],
  specification:  ['in-progress', 'completed', 'superseded'],
  planning:       ['in-progress', 'completed'],
  implementation: ['in-progress', 'completed'],
  review:         ['in-progress', 'completed'],
};

const VALID_GATE_MODES = ['gated', 'auto'];

const VALID_WORK_UNIT_STATUSES = ['in-progress', 'completed', 'cancelled'];

const LOCK_STALE_MS = 30000;
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

function manifestDir(name) {
  return path.join(WORKFLOWS_DIR, name);
}

function manifestPath(name) {
  return path.join(manifestDir(name), 'manifest.json');
}

function lockPath(name) {
  return path.join(manifestDir(name), '.lock');
}

function readManifest(name) {
  const p = manifestPath(name);
  if (!fs.existsSync(p)) die(`Work unit "${name}" not found`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeManifestAtomic(name, data) {
  const p = manifestPath(name);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p);
}

// ---------------------------------------------------------------------------
// File Locking
// ---------------------------------------------------------------------------

function acquireLock(name) {
  const lp = lockPath(name);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      const fd = fs.openSync(lp, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }

    // Check stale lock
    try {
      const stat = fs.statSync(lp);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        fs.unlinkSync(lp);
        continue;
      }
    } catch (_) {
      // Lock was removed between check and stat — retry
      continue;
    }

    if (Date.now() >= deadline) {
      die(`Timed out waiting for lock on "${name}"`);
    }

    // Busy wait (short)
    const end = Date.now() + LOCK_RETRY_MS;
    while (Date.now() < end) { /* spin */ }
  }
}

function releaseLock(name) {
  try { fs.unlinkSync(lockPath(name)); } catch (_) {}
}

function withLock(name, fn) {
  acquireLock(name);
  try {
    return fn();
  } finally {
    releaseLock(name);
  }
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

    // phases.<phase>.status
    if (segments.length === 3 && segments[2] === 'status') {
      validatePhaseStatus(phase, value);
      return;
    }

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
  process.stdout.write(`Created work unit "${name}" (${workType})\n`);
}

function cmdGet(args) {
  if (args.length < 1) die('Usage: get <path> [field.path]');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const manifest = readManifest(workUnit);

  if (!phase) {
    // Work-unit-level: get <wu> [field]
    if (args.length === 1) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      return;
    }
    const segments = args[1].split('.');
    const value = getByPath(manifest, segments);
    if (value === undefined) {
      die(`Path "${args[1]}" not found in "${workUnit}"`);
    }
    outputValue(value);
    return;
  }

  // Phase/topic level
  const fieldSegments = args.length > 1 ? args[1].split('.') : [];

  // Wildcard topic: collect values from all topics
  if (topic === '*') {
    const results = resolveWildcardTopic(manifest, phase, fieldSegments);
    if (results.length === 0) {
      die(`No items found in phase "${phase}" of "${workUnit}"`);
    }
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  const segments = resolvePhaseSegments(phase, topic, fieldSegments);
  const value = getByPath(manifest, segments);
  if (value === undefined) {
    die(`Path "${segments.join('.')}" not found in "${workUnit}"`);
  }
  outputValue(value);
}

function cmdSet(args) {
  if (args.length < 3) die('Usage: set <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  if (!fs.existsSync(manifestPath(workUnit))) {
    die(`Work unit "${workUnit}" not found`);
  }

  // Resolve segments: work-unit level uses field directly, phase/topic level prepends phase path
  const segments = phase
    ? resolvePhaseSegments(phase, topic, fieldSegments)
    : fieldSegments;

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
  if (args.length < 2) die('Usage: delete <path> <field.path>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');

  if (!fs.existsSync(manifestPath(workUnit))) {
    die(`Work unit "${workUnit}" not found`);
  }

  const segments = phase
    ? resolvePhaseSegments(phase, topic, fieldSegments)
    : fieldSegments;

  withLock(workUnit, () => {
    const manifest = readManifest(workUnit);
    if (!deleteByPath(manifest, segments)) {
      die(`Path "${segments.join('.')}" not found in "${workUnit}"`);
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

  const entries = fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    // Skip non-directories and dot-prefixed directories
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const mp = path.join(WORKFLOWS_DIR, entry.name, 'manifest.json');
    if (!fs.existsSync(mp)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(mp, 'utf8'));

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

  if (!fs.existsSync(manifestPath(workUnit))) {
    die(`Work unit "${workUnit}" not found`);
  }

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
  if (args.length < 3) die('Usage: push <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  if (!fs.existsSync(manifestPath(workUnit))) {
    die(`Work unit "${workUnit}" not found`);
  }

  const segments = phase
    ? resolvePhaseSegments(phase, topic, fieldSegments)
    : fieldSegments;

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

function cmdExists(args) {
  if (args.length < 1) die('Usage: exists <path> [field.path]');

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

  const manifest = JSON.parse(fs.readFileSync(mp, 'utf8'));

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

if (!command) {
  die('Usage: manifest.js <command> [args]\nCommands: init, get, set, delete, list, init-phase, push, exists');
}

switch (command) {
  case 'init':     cmdInit(args); break;
  case 'get':      cmdGet(args); break;
  case 'set':      cmdSet(args); break;
  case 'delete':   cmdDelete(args); break;
  case 'list':     cmdList(args); break;
  case 'init-phase': cmdInitPhase(args); break;
  case 'push':     cmdPush(args); break;
  case 'exists':   cmdExists(args); break;
  default:         die(`Unknown command "${command}"`);
}
