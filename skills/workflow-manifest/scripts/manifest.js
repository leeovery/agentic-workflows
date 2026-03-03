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
  'specification', 'planning', 'implementation', 'review'
];

const VALID_PHASE_STATUSES = {
  research:       ['in-progress', 'concluded'],
  discussion:     ['in-progress', 'concluded'],
  investigation:  ['in-progress', 'concluded'],
  specification:  ['in-progress', 'concluded', 'superseded'],
  planning:       ['in-progress', 'concluded'],
  implementation: ['in-progress', 'completed'],
  review:         ['in-progress', 'completed'],
};

const VALID_GATE_MODES = ['gated', 'auto'];

const VALID_WORK_UNIT_STATUSES = ['active', 'archived'];

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
// Flag Parsing
// ---------------------------------------------------------------------------

/**
 * Extract --phase and --topic flags from args.
 * Returns { phase, topic, positional } where positional is remaining args.
 */
function parseFlags(args) {
  let phase = null;
  let topic = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && i + 1 < args.length) {
      phase = args[++i];
    } else if (args[i] === '--topic' && i + 1 < args.length) {
      topic = args[++i];
    } else {
      positional.push(args[i]);
    }
  }

  return { phase, topic, positional };
}

/**
 * Resolve the internal JSON path segments for a phase+topic operation.
 * Routes based on work_type: feature/bugfix → flat, epic → items.
 *
 * @param {string} workType - The work unit's work_type
 * @param {string} phase - The phase name
 * @param {string|null} topic - The topic name (null = whole phase)
 * @param {string[]} fieldSegments - Additional field path segments
 * @returns {string[]} Full path segments from manifest root
 */
function resolvePhaseSegments(workType, phase, topic, fieldSegments) {
  const base = ['phases', phase];

  if (!topic) {
    // No topic — return the whole phase object (+ any field path)
    return [...base, ...fieldSegments];
  }

  if (workType === 'epic') {
    // Epic: phases.<phase>.items.<topic>[.field.path]
    return [...base, 'items', topic, ...fieldSegments];
  }

  // Feature/bugfix: phases.<phase>[.field.path] (flat — topic is implicit)
  return [...base, ...fieldSegments];
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
    status: 'active',
    created: new Date().toISOString().slice(0, 10),
    description,
    phases: {},
  };

  writeManifestAtomic(name, manifest);
  process.stdout.write(`Created work unit "${name}" (${workType})\n`);
}

function cmdGet(args) {
  const { phase, topic, positional } = parseFlags(args);

  if (positional.length < 1) die('Usage: get <name> [--phase <phase>] [--topic <topic>] [field.path]');

  const name = positional[0];
  const manifest = readManifest(name);

  if (!phase) {
    // Work-unit-level: get <name> [field]
    if (positional.length === 1) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      return;
    }

    const segments = positional[1].split('.');
    const value = getByPath(manifest, segments);
    if (value === undefined) {
      die(`Path "${positional[1]}" not found in "${name}"`);
    }
    outputValue(value);
    return;
  }

  // Phase-level: get <name> --phase <phase> [--topic <topic>] [field.path]
  validatePhase(phase);

  const fieldSegments = positional.length > 1 ? positional[1].split('.') : [];
  const segments = resolvePhaseSegments(manifest.work_type, phase, topic, fieldSegments);

  const value = getByPath(manifest, segments);
  if (value === undefined) {
    die(`Path "${segments.join('.')}" not found in "${name}"`);
  }
  outputValue(value);
}

function cmdSet(args) {
  const { phase, topic, positional } = parseFlags(args);

  if (!phase) {
    // Work-unit-level: set <name> <field> <value>
    if (positional.length !== 3) die('Usage: set <name> <field> <value>');

    const name = positional[0];
    const segments = positional[1].split('.');
    const value = parseValue(positional[2]);

    if (typeof value === 'string') {
      validateSet(segments, value);
    }

    if (!fs.existsSync(manifestPath(name))) {
      die(`Work unit "${name}" not found`);
    }

    withLock(name, () => {
      const manifest = readManifest(name);
      setByPath(manifest, segments, value);
      writeManifestAtomic(name, manifest);
    });
    return;
  }

  // Phase-level: set <name> --phase <phase> --topic <topic> <field.path> <value>
  if (positional.length !== 3) die('Usage: set <name> --phase <phase> --topic <topic> <field.path> <value>');

  const name = positional[0];
  validatePhase(phase);
  if (!topic) die('--topic is required for phase-level set');

  const fieldSegments = positional[1].split('.');
  const value = parseValue(positional[2]);

  if (!fs.existsSync(manifestPath(name))) {
    die(`Work unit "${name}" not found`);
  }

  const manifest = readManifest(name);
  const segments = resolvePhaseSegments(manifest.work_type, phase, topic, fieldSegments);

  if (typeof value === 'string') {
    validateSet(segments, value);
  }

  withLock(name, () => {
    const fresh = readManifest(name);
    setByPath(fresh, segments, value);
    writeManifestAtomic(name, fresh);
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

function cmdAddItem(args) {
  const { phase, topic, positional } = parseFlags(args);

  if (positional.length !== 1 || !phase || !topic) {
    die('Usage: add-item <name> --phase <phase> --topic <topic>');
  }

  const name = positional[0];
  validatePhase(phase);

  if (!fs.existsSync(manifestPath(name))) {
    die(`Work unit "${name}" not found`);
  }

  withLock(name, () => {
    const manifest = readManifest(name);

    if (!manifest.phases) manifest.phases = {};

    if (manifest.work_type === 'epic') {
      // Epic: create phases.<phase>.items.<topic> = { status: "in-progress" }
      if (!manifest.phases[phase]) manifest.phases[phase] = {};
      if (!manifest.phases[phase].items) manifest.phases[phase].items = {};

      if (manifest.phases[phase].items[topic]) {
        die(`Item "${topic}" already exists in phase "${phase}" of "${name}"`);
      }

      manifest.phases[phase].items[topic] = { status: 'in-progress' };
    } else {
      // Feature/bugfix: create phases.<phase> = { status: "in-progress" }
      if (manifest.phases[phase] && manifest.phases[phase].status) {
        die(`Phase "${phase}" already exists in "${name}"`);
      }

      if (!manifest.phases[phase]) manifest.phases[phase] = {};
      manifest.phases[phase].status = 'in-progress';
    }

    writeManifestAtomic(name, manifest);
  });

  process.stdout.write(`Added "${topic}" to ${phase} phase of "${name}"\n`);
}

function cmdArchive(args) {
  if (args.length !== 1) die('Usage: archive <name>');

  const name = args[0];
  const dir = manifestDir(name);

  if (!fs.existsSync(dir)) {
    die(`Work unit "${name}" not found`);
  }

  const archiveBase = path.join(WORKFLOWS_DIR, '.archive');
  const archiveDest = path.join(archiveBase, name);

  if (fs.existsSync(archiveDest)) {
    die(`Archive destination already exists for "${name}"`);
  }

  withLock(name, () => {
    // Update status before moving
    const manifest = readManifest(name);
    manifest.status = 'archived';
    writeManifestAtomic(name, manifest);

    // Move to archive
    fs.mkdirSync(archiveBase, { recursive: true });
    fs.renameSync(dir, archiveDest);
  });

  process.stdout.write(`Archived work unit "${name}"\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

if (!command) {
  die('Usage: manifest.js <command> [args]\nCommands: init, get, set, list, add-item, archive');
}

switch (command) {
  case 'init':     cmdInit(args); break;
  case 'get':      cmdGet(args); break;
  case 'set':      cmdSet(args); break;
  case 'list':     cmdList(args); break;
  case 'add-item': cmdAddItem(args); break;
  case 'archive':  cmdArchive(args); break;
  default:         die(`Unknown command "${command}"`);
}
