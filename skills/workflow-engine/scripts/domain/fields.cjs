'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the manifest field surface — `engine manifest <command>`.
//
// Dot-path addressing (`wu[.phase[.topic]]`, segment count = level, reserved
// `project` prefix routes to the project manifest), schema validation from
// kernel/manifest-schema, IO and locking from kernel/manifest-io.
//
// Output contract, deliberately split:
//   Reads (get, exists, list, key-of, resolve) print bare stdout — they are
//   prose substitution surfaces. Their errors keep the `Error: …` stderr
//   convention (exit 1 = real error, exit 2 = expected miss) via the
//   `exitCode` carried on the throw.
//   Mutations (set, push, pull, delete) return a decision-ready object for
//   the engine's one-line JSON response; their failures are the engine's
//   `{ok:false}` stderr exit 1 like every other verb.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const io = require('../kernel/manifest-io.cjs');
const { INDEXED_ARTIFACTS } = require('./kb.cjs');
const {
  VALID_WORK_TYPES,
  VALID_PHASES,
  VALID_PHASE_STATUSES,
  VALID_GATE_MODES,
  VALID_WORK_UNIT_STATUSES,
} = require('../kernel/manifest-schema.cjs');

// Phases whose artifacts the knowledge base indexes — `resolve`'s scope.
// Derived from kb's INDEXED_ARTIFACTS, the one table declaring what the KB
// indexes and where, so the resolve scope can never drift from it.
const INDEXED_PHASES = Object.keys(INDEXED_ARTIFACTS);

/**
 * @param {string} msg
 * @param {number} [code] 1 = real error, 2 = expected miss
 * @returns {never}
 */
function fail(msg, code = 1) {
  const err = /** @type {Error & {exitCode: number}} */ (new Error(msg));
  err.exitCode = code;
  throw err;
}

/** @param {string} cwd */
function workflowsDir(cwd) {
  return path.join(cwd, '.workflows');
}

/** @param {string} cwd @param {string} name */
function manifestPath(cwd, name) {
  return io.workUnitManifestPath(workflowsDir(cwd), name);
}

/** @param {string} cwd @param {string} name */
function readManifest(cwd, name) {
  if (!fs.existsSync(manifestPath(cwd, name))) fail(`Work unit "${name}" not found`, 2);
  return io.readWorkUnitManifest(workflowsDir(cwd), name);
}

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------

/**
 * Check if a path argument targets the project manifest.
 * @param {string} pathArg
 * @returns {{isProject: boolean, fieldSegments: string[]}}
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

/**
 * Parse a dot-path argument into work unit, phase, and topic.
 * Segment count determines the access level:
 *   1 segment  → work-unit level
 *   2 segments → phase level
 *   3 segments → topic level
 * @param {string} pathArg
 * @returns {{workUnit: string, phase: string|null, topic: string|null}}
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
  fail(`Invalid path "${pathArg}". Expected: <work-unit>[.<phase>[.<topic>]]`);
}

/**
 * Resolve the internal JSON path segments for a phase+topic operation.
 * All work types route through items when topic is provided.
 * @param {string} phase @param {string|null} topic @param {string[]} fieldSegments
 * @returns {string[]}
 */
function resolvePhaseSegments(phase, topic, fieldSegments) {
  const base = ['phases', phase];
  if (!topic) return [...base, ...fieldSegments];
  return [...base, 'items', topic, ...fieldSegments];
}

/**
 * Resolve field segments to the full manifest path: work-unit level maps to
 * the manifest root, phase/topic level is prefixed with the phase path.
 * @param {string|null} phase @param {string|null} topic @param {string[]} fieldSegments
 */
function resolveSegments(phase, topic, fieldSegments) {
  return phase ? resolvePhaseSegments(phase, topic, fieldSegments) : fieldSegments;
}

/** @param {string} cwd @param {string} workUnit */
function requireWorkUnit(cwd, workUnit) {
  if (!fs.existsSync(manifestPath(cwd, workUnit))) {
    fail(`Work unit "${workUnit}" not found`, 2);
  }
}

/**
 * Resolve wildcard topic — collect field values from all topics in a phase.
 * @param {object} manifest @param {string} phase @param {string[]} fieldSegments
 * @returns {Array<{topic: string, value: *}>}
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

// The guarded validators accept a value of ANY type: a typed field's schema
// declares a string vocabulary, so a non-string (number, boolean, ~→null,
// object) is refused exactly as a bad string is. `JSON.stringify` renders the
// offending value cleanly for every type and is byte-identical to the old
// `"${value}"` for strings (`"foo"` either way).
/** @param {*} value */
function validateWorkType(value) {
  if (typeof value !== 'string' || !VALID_WORK_TYPES.includes(value)) {
    fail(`Invalid work_type ${JSON.stringify(value)}. Must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }
}

/** @param {*} value */
function validateWorkUnitStatus(value) {
  if (typeof value !== 'string' || !VALID_WORK_UNIT_STATUSES.includes(value)) {
    fail(`Invalid status ${JSON.stringify(value)}. Must be one of: ${VALID_WORK_UNIT_STATUSES.join(', ')}`);
  }
}

/** @param {string} phase */
function validatePhase(phase) {
  if (!VALID_PHASES.includes(phase)) {
    fail(`Invalid phase "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`);
  }
}

/** @param {*} value */
function validateGateMode(value) {
  if (typeof value !== 'string' || !VALID_GATE_MODES.includes(value)) {
    fail(`Invalid gate mode ${JSON.stringify(value)}. Must be one of: ${VALID_GATE_MODES.join(', ')}`);
  }
}

/** @param {string} phase @param {*} value */
function validatePhaseStatus(phase, value) {
  const valid = VALID_PHASE_STATUSES[phase];
  if (valid && valid.length === 0) {
    fail(`Phase "${phase}" items carry no status field — lifecycle is computed at render time; create map items with \`engine discovery-map add\``);
  }
  if (valid && (typeof value !== 'string' || !valid.includes(value))) {
    fail(`Invalid status ${JSON.stringify(value)} for phase "${phase}". Must be one of: ${valid.join(', ')}`);
  }
}

/**
 * Validate a set operation from the resolved internal path and value. Every
 * planned write runs through here regardless of value type: a field whose
 * schema declares a vocabulary is enforced against it even when the JSON-parsed
 * value is a number, boolean, ~→null, array, or object — those are refused, not
 * waved through. Untyped fields (counters, nullable pointers, task maps) match
 * no guarded branch and pass, so legitimate non-string writes are unaffected.
 * @param {string[]} segments @param {*} value
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
// Dot-path utilities
// ---------------------------------------------------------------------------

/** @param {any} obj @param {string[]} segments */
function getByPath(obj, segments) {
  let current = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[seg];
  }
  return current;
}

// A named field assigned into an array is silently dropped by
// JSON.stringify — the write would falsely succeed. Numeric indexes are fine.
/** @param {any} container @param {string} seg @param {string} pathSoFar */
function refuseNamedArrayWrite(container, seg, pathSoFar) {
  if (Array.isArray(container) && !/^(0|[1-9][0-9]*)$/.test(seg)) {
    fail(`Path "${pathSoFar}" is an array — cannot set field "${seg}" in it`);
  }
}

/** @param {any} obj @param {string[]} segments @param {*} value */
function setByPath(obj, segments, value) {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    refuseNamedArrayWrite(current, seg, segments.slice(0, i).join('.') || '(root)');
    if (current[seg] == null) {
      current[seg] = {};
    } else if (typeof current[seg] !== 'object') {
      // Descending through a scalar would silently destroy it — refuse.
      fail(`Path "${segments.slice(0, i + 1).join('.')}" is not an object — refusing to overwrite it with a container`);
    }
    current = current[seg];
  }
  const last = segments[segments.length - 1];
  refuseNamedArrayWrite(current, last, segments.slice(0, -1).join('.') || '(root)');
  current[last] = value;
}

/** @param {any} obj @param {string[]} segments */
function deleteByPath(obj, segments) {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current == null || typeof current !== 'object') return false;
    current = current[seg];
  }
  if (current == null || typeof current !== 'object') return false;
  const last = segments[segments.length - 1];
  // Deleting an array index with `delete` leaves a literal null hole; splice
  // instead so the element is truly removed and the array closes up. A
  // non-numeric (or out-of-range) segment on an array is a miss, not a hole.
  if (Array.isArray(current)) {
    if (!/^(0|[1-9][0-9]*)$/.test(last)) return false;
    const idx = Number(last);
    if (idx >= current.length) return false;
    current.splice(idx, 1);
    return true;
  }
  if (!(last in current)) return false;
  delete current[last];
  return true;
}

/**
 * JSON first (arrays, objects, numbers, booleans), string fallback. A bare
 * `~` is null (YAML convention), matching `task complete --next-task '~'` —
 * one sentinel spelling across the whole surface.
 * @param {string} raw
 */
function parseValue(raw) {
  if (raw === '~') return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

// Deep equality used by `pull` so object-shaped array entries (e.g. imports[]
// records) can be matched by value, not by reference. Order-independent for
// object keys.
/** @param {*} a @param {*} b @returns {boolean} */
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

/** @param {any[]} arr @param {*} value */
function findDeepIndex(arr, value) {
  for (let i = 0; i < arr.length; i++) {
    if (deepEqual(arr[i], value)) return i;
  }
  return -1;
}

/** @param {*} value */
function outputValue(value) {
  if (value !== null && typeof value === 'object') {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  } else {
    process.stdout.write(String(value) + '\n');
  }
}

/**
 * Parse the batch tail of a mutation: `<field>=<value>` pairs, split on the
 * FIRST `=` only so values may contain `=` themselves.
 * @param {string[]} pairs
 * @returns {Array<{field: string, value: *, raw: string}>}
 */
function parseFieldValuePairs(pairs) {
  return pairs.map((pair) => {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      fail(`bad assignment "${pair}" (expected <field>=<value>)`);
    }
    const raw = pair.slice(eq + 1);
    return { field: pair.slice(0, eq), value: parseValue(raw), raw };
  });
}

// ---------------------------------------------------------------------------
// Reads — bare stdout, byte-compatible with the absorbed CLI
// ---------------------------------------------------------------------------

/** @param {string} cwd @param {string[]} args */
function cmdGet(cwd, args) {
  if (args.length < 1) fail('Usage: engine manifest get <path> [field.path]');

  // Project manifest routing
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    const manifest = io.readProjectManifest(workflowsDir(cwd));
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
  if (!fs.existsSync(manifestPath(cwd, workUnit))) return;
  const manifest = readManifest(cwd, workUnit);

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

/** @param {string} cwd @param {string[]} args */
function cmdExists(cwd, args) {
  if (args.length < 1) fail('Usage: engine manifest exists <path> [field.path]');

  // Project manifest routing: exists project[.field.path]
  const proj = parseProjectPath(args[0]);
  if (proj.isProject) {
    const manifest = io.readProjectManifest(workflowsDir(cwd));
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
  const mp = manifestPath(cwd, workUnit);

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

  const manifest = readManifest(cwd, workUnit);

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

/** @param {string} cwd @param {string[]} args */
function cmdList(cwd, args) {
  /** @type {string|null} */ let filterStatus = null;
  /** @type {string|null} */ let filterWorkType = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status' && i + 1 < args.length) {
      filterStatus = args[++i];
    } else if (args[i] === '--work-type' && i + 1 < args.length) {
      filterWorkType = args[++i];
    }
  }

  const wfDir = workflowsDir(cwd);
  if (!fs.existsSync(wfDir)) {
    process.stdout.write('[]\n');
    return;
  }

  // Use project manifest for work unit names, fall back to filesystem scan
  const proj = io.readProjectManifest(wfDir);
  let names;
  if (proj.work_units && Object.keys(proj.work_units).length > 0) {
    names = Object.keys(proj.work_units);
  } else {
    names = fs.readdirSync(wfDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name);
  }

  const results = [];

  for (const name of names) {
    if (!fs.existsSync(manifestPath(cwd, name))) continue;

    try {
      const manifest = io.readWorkUnitManifest(wfDir, name);

      if (filterStatus && manifest.status !== filterStatus) continue;
      if (filterWorkType && manifest.work_type !== filterWorkType) continue;

      results.push(manifest);
    } catch (_) {
      // Skip malformed manifests
    }
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}

/** @param {string} cwd @param {string[]} args */
function cmdKeyOf(cwd, args) {
  if (args.length < 3) fail('Usage: engine manifest key-of <path> <field.path> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const searchValue = args[2];

  const manifest = readManifest(cwd, workUnit);
  const segments = resolveSegments(phase, topic, fieldSegments);
  const obj = getByPath(manifest, segments);

  if (obj == null || typeof obj !== 'object') {
    fail(`Path "${segments.join('.')}" is not an object in "${workUnit}"`);
  }

  const key = Object.keys(obj).find(k => String(obj[k]) === searchValue);

  if (key === undefined) {
    fail(`Value "${searchValue}" not found in "${segments.join('.')}"`, 2);
  }

  process.stdout.write(key + '\n');
}

/**
 * Map `wu.phase[.topic]` to artifact file paths on disk — the knowledge
 * CLI's artifact discovery.
 * @param {string} cwd @param {string[]} args
 */
function cmdResolve(cwd, args) {
  if (!args[0]) {
    fail('Usage: engine manifest resolve <work_unit>.<phase>[.<topic>]\nResolves artifact file paths for indexed phases.');
  }

  const { workUnit, phase, topic } = parsePath(args[0]);

  if (!phase) {
    fail('resolve requires at least 2 segments: <work_unit>.<phase>[.<topic>]');
  }

  if (!INDEXED_PHASES.includes(phase)) {
    fail(`Phase "${phase}" is not indexed by the knowledge base. Indexed phases: ${INDEXED_PHASES.join(', ')}`);
  }

  // Validate that the work unit exists by reading its manifest.
  const manifest = readManifest(cwd, workUnit);
  const wuDir = path.join(workflowsDir(cwd), workUnit);

  if (phase === 'research') {
    if (topic) {
      // 3-segment: specific research item.
      process.stdout.write(path.join(wuDir, 'research', topic + '.md') + '\n');
    } else {
      // 2-segment: iterate phases.research.items from the manifest.
      const items = manifest.phases && manifest.phases.research && manifest.phases.research.items;
      if (!items || typeof items !== 'object') {
        // No research items tracked — output nothing, exit 0.
        return;
      }
      for (const itemName of Object.keys(items)) {
        process.stdout.write(path.join(wuDir, 'research', itemName + '.md') + '\n');
      }
    }
    return;
  }

  // For non-research phases, topic is required (3 segments).
  if (!topic) {
    fail(`resolve for ${phase} requires 3 segments: <work_unit>.${phase}.<topic>`);
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
// Mutations — one lock, one write, one decision-ready response object
// ---------------------------------------------------------------------------

/**
 * The write target for a mutation — the project manifest or a work unit's,
 * chosen by whether the path arg was `project`-prefixed. `transact(fn)` runs
 * `fn(manifest, save)` under the matching lock with the loaded manifest and a
 * `save()` that writes it atomically, returning fn's value. The one
 * project-vs-work-unit branch the four mutations share, so the lock / read /
 * write plumbing lives in a single place. Callers still own usage validation,
 * path parsing, and the `save()` call, so nothing reorders — a `fail()` inside
 * `fn` throws out of the lock exactly as before, and a no-op path that never
 * calls `save()` writes nothing.
 * @param {string} cwd @param {boolean} isProject @param {string} [workUnit]
 * @returns {{transact: <T>(fn: (manifest: any, save: () => void) => T) => T}}
 */
function manifestTarget(cwd, isProject, workUnit) {
  const wfDir = workflowsDir(cwd);
  if (isProject) {
    return {
      transact: (fn) => io.withProjectLock(wfDir, () => {
        const manifest = io.readProjectManifest(wfDir);
        return fn(manifest, () => io.writeProjectManifestAtomic(wfDir, manifest));
      }),
    };
  }
  const wu = /** @type {string} */ (workUnit);
  return {
    transact: (fn) => io.withWorkUnitLock(wfDir, wu, () => {
      const manifest = readManifest(cwd, wu);
      return fn(manifest, () => io.writeWorkUnitManifestAtomic(wfDir, wu, manifest));
    }),
  };
}

/**
 * `set <path> <field> <value> [<field>=<value> …]` — batched writes land in
 * one lock/read/write. Project paths embed the first field in the dot-path:
 * `set project.<field.path> <value> [<field.path>=<value> …]`.
 * @param {string} cwd @param {string[]} args
 * @returns {object}
 */
function cmdSet(cwd, args) {
  // Project manifest routing
  const proj = parseProjectPath(args[0] || '');
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      fail('Usage: engine manifest set project.<field.path> <value> [<field.path>=<value> …]');
    }
    const writes = [
      { field: proj.fieldSegments.join('.'), value: parseValue(args[1]) },
      ...parseFieldValuePairs(args.slice(2)),
    ];
    manifestTarget(cwd, true).transact((manifest, save) => {
      for (const write of writes) {
        setByPath(manifest, write.field.split('.'), write.value);
      }
      save();
    });
    return { path: 'project', set: Object.fromEntries(writes.map(w => [w.field, w.value])) };
  }

  if (args.length < 3) fail('Usage: engine manifest set <path> <field> <value> [<field>=<value> …]');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const writes = [
    { field: args[1], value: parseValue(args[2]) },
    ...parseFieldValuePairs(args.slice(3)),
  ];

  requireWorkUnit(cwd, workUnit);

  // Validate every field before any write — a refused value fails the batch.
  // Unconditional: the value is already JSON-parsed, so a guarded field must be
  // checked whatever type that parse produced (a bare number/boolean/~ would
  // otherwise slip past a string-only guard and corrupt a typed field).
  const planned = writes.map((write) => {
    const segments = resolveSegments(phase, topic, write.field.split('.'));
    validateSet(segments, write.value);
    return { segments, value: write.value };
  });

  manifestTarget(cwd, false, workUnit).transact((manifest, save) => {
    for (const write of planned) {
      setByPath(manifest, write.segments, write.value);
    }
    save();
  });

  return { path: args[0], set: Object.fromEntries(writes.map(w => [w.field, w.value])) };
}

/** @param {string} cwd @param {string[]} args @returns {object} */
function cmdPush(cwd, args) {
  // Project manifest routing: push project.field.path <value>
  const proj = parseProjectPath(args[0] || '');
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      fail('Usage: engine manifest push project.<field.path> <value>');
    }
    const value = parseValue(args[1]);
    const length = manifestTarget(cwd, true).transact((manifest, save) => {
      const current = getByPath(manifest, proj.fieldSegments);

      if (current !== undefined && !Array.isArray(current)) {
        fail(`Path "${proj.fieldSegments.join('.')}" is not an array in project manifest`);
      }

      let next;
      if (current === undefined) {
        setByPath(manifest, proj.fieldSegments, [value]);
        next = 1;
      } else {
        current.push(value);
        next = current.length;
      }

      save();
      return next;
    });
    return { path: 'project', field: proj.fieldSegments.join('.'), pushed: value, length };
  }

  if (args.length < 3) fail('Usage: engine manifest push <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  requireWorkUnit(cwd, workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  const length = manifestTarget(cwd, false, workUnit).transact((manifest, save) => {
    const current = getByPath(manifest, segments);

    if (current !== undefined && !Array.isArray(current)) {
      fail(`Path "${segments.join('.')}" is not an array`);
    }

    let next;
    if (current === undefined) {
      setByPath(manifest, segments, [value]);
      next = 1;
    } else {
      current.push(value);
      next = current.length;
    }

    save();
    return next;
  });

  return { path: args[0], field: args[1], pushed: value, length };
}

/** @param {string} cwd @param {string[]} args @returns {object} */
function cmdPull(cwd, args) {
  // Project manifest routing: pull project.field.path <value>
  const proj = parseProjectPath(args[0] || '');
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0 || args.length < 2) {
      fail('Usage: engine manifest pull project.<field.path> <value>');
    }
    const value = parseValue(args[1]);
    const result = manifestTarget(cwd, true).transact((manifest, save) => {
      const current = getByPath(manifest, proj.fieldSegments);
      if (!Array.isArray(current)) return { removed: false, length: null }; // no-op
      const idx = findDeepIndex(current, value);
      if (idx === -1) return { removed: false, length: current.length }; // no-op
      current.splice(idx, 1);
      save();
      return { removed: true, length: current.length };
    });
    return { path: 'project', field: proj.fieldSegments.join('.'), ...result };
  }

  if (args.length < 3) fail('Usage: engine manifest pull <path> <field> <value>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');
  const value = parseValue(args[2]);

  requireWorkUnit(cwd, workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  const result = manifestTarget(cwd, false, workUnit).transact((manifest, save) => {
    const current = getByPath(manifest, segments);
    if (!Array.isArray(current)) return { removed: false, length: null }; // no-op
    const idx = findDeepIndex(current, value);
    if (idx === -1) return { removed: false, length: current.length }; // no-op
    current.splice(idx, 1);
    save();
    return { removed: true, length: current.length };
  });

  return { path: args[0], field: args[1], ...result };
}

/** @param {string} cwd @param {string[]} args @returns {object} */
function cmdDelete(cwd, args) {
  // Project manifest routing: delete project.field.path
  const proj = parseProjectPath(args[0] || '');
  if (proj.isProject) {
    if (proj.fieldSegments.length === 0) {
      fail('Usage: engine manifest delete project.<field.path>');
    }
    manifestTarget(cwd, true).transact((manifest, save) => {
      if (!deleteByPath(manifest, proj.fieldSegments)) {
        fail(`Path "${proj.fieldSegments.join('.')}" not found in project manifest`);
      }
      save();
    });
    return { path: 'project', field: proj.fieldSegments.join('.'), deleted: true };
  }

  if (args.length < 2) fail('Usage: engine manifest delete <path> <field.path>');

  const { workUnit, phase, topic } = parsePath(args[0]);
  const fieldSegments = args[1].split('.');

  requireWorkUnit(cwd, workUnit);

  const segments = resolveSegments(phase, topic, fieldSegments);

  manifestTarget(cwd, false, workUnit).transact((manifest, save) => {
    if (!deleteByPath(manifest, segments)) {
      fail(`Path "${segments.join('.')}" not found in "${workUnit}"`);
    }
    save();
  });

  return { path: args[0], field: args[1], deleted: true };
}

/**
 * `apply <work-unit> --file <ops.json>` — the batch form of set/delete across
 * one work unit (D7: one task, one call). Ops:
 *   {"op": "set",    "path": "<wu>[.<phase>[.<topic>]]", "fields": {"<field.path>": <value>, …}}
 *   {"op": "delete", "path": "<wu>[.<phase>[.<topic>]]", "field": "<field.path>"}
 * Every op is validated before anything is written — the same per-field
 * guards as `set`, every path inside <work-unit> (one lock, one manifest,
 * one atomic write; the project manifest is outside a work-unit batch) —
 * and a delete whose target is missing fails the whole batch before the
 * save, so a failing entry means nothing persisted. Values are native JSON
 * (no shell parsing — `null` is `null`, not `'~'`). No git commit — the
 * calling flow's commit covers the batch.
 * @param {string} cwd @param {string[]} args
 * @returns {object}
 */
function cmdApply(cwd, args) {
  const positional = args.filter((a) => !a.startsWith('--'));
  const fileIdx = args.indexOf('--file');
  const file = fileIdx !== -1 ? args[fileIdx + 1] : undefined;
  const workUnit = positional[0];
  if (!workUnit || !file) fail('Usage: engine manifest apply <work-unit> --file <ops.json>');
  requireWorkUnit(cwd, workUnit);

  let ops;
  try {
    ops = JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  } catch (err) {
    fail(`apply: cannot read payload: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(ops) || ops.length === 0) {
    fail('apply: payload must be a non-empty array of {op, path, …} operations');
  }

  const planned = ops.map((op, i) => {
    const at = `op ${i + 1}`;
    if (!op || typeof op !== 'object' || Array.isArray(op)) fail(`apply: ${at} must be an object`);
    if (op.op !== 'set' && op.op !== 'delete') {
      fail(`apply: ${at} — "op" must be "set" or "delete", got ${JSON.stringify(op.op ?? null)}`);
    }
    if (typeof op.path !== 'string' || parseProjectPath(op.path).isProject) {
      fail(`apply: ${at} — "path" must be a <work-unit>[.<phase>[.<topic>]] dot-path (the project manifest is outside a work-unit batch)`);
    }
    const { workUnit: wu, phase, topic } = parsePath(op.path);
    if (wu !== workUnit) {
      fail(`apply: ${at} — path "${op.path}" is outside work unit "${workUnit}" — one batch, one manifest`);
    }
    if (op.op === 'set') {
      const fields = op.fields && typeof op.fields === 'object' && !Array.isArray(op.fields) ? op.fields : null;
      const entries = fields ? Object.entries(fields) : [];
      if (entries.length === 0) {
        fail(`apply: ${at} — "fields" must be a non-empty object of {"<field.path>": value}`);
      }
      const writes = entries.map(([field, value]) => {
        const segments = resolveSegments(phase, topic, field.split('.'));
        validateSet(segments, value);
        return { segments, value };
      });
      return { kind: /** @type {const} */ ('set'), path: op.path, fields, writes };
    }
    if (typeof op.field !== 'string' || op.field === '') {
      fail(`apply: ${at} — "field" must be a non-empty field path`);
    }
    return { kind: /** @type {const} */ ('delete'), path: op.path, field: op.field, segments: resolveSegments(phase, topic, op.field.split('.')) };
  });

  manifestTarget(cwd, false, workUnit).transact((manifest, save) => {
    for (const op of planned) {
      if (op.kind === 'set') {
        for (const write of /** @type {{segments: string[], value: unknown}[]} */ (op.writes)) {
          setByPath(manifest, write.segments, write.value);
        }
      } else if (!deleteByPath(manifest, /** @type {string[]} */ (op.segments))) {
        fail(`apply: delete "${op.path}" ${op.field} — path not found in "${workUnit}" — nothing was applied`);
      }
    }
    save();
  });

  return {
    work_unit: workUnit,
    applied: planned.length,
    ops: planned.map((op) => (op.kind === 'set' ? { path: op.path, set: op.fields } : { path: op.path, deleted: op.field })),
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const READS = { get: cmdGet, exists: cmdExists, list: cmdList, 'key-of': cmdKeyOf, resolve: cmdResolve };
const MUTATIONS = { set: cmdSet, push: cmdPush, pull: cmdPull, delete: cmdDelete, apply: cmdApply };

const USAGE =
  'Usage: engine manifest <get|set|push|pull|delete|apply|exists|list|key-of|resolve> …\n' +
  'Dot-path addressing: <work-unit>[.<phase>[.<topic>]]; the `project` prefix routes to the project manifest.';

/** @param {string} command */
function isRead(command) {
  return Object.prototype.hasOwnProperty.call(READS, command);
}

/**
 * Execute one field command. Reads print their own bare stdout and return
 * undefined; mutations return the response object for the engine's JSON
 * line. Unknown commands and all failures throw (reads carry `exitCode`).
 * @param {string} cwd @param {string} command @param {string[]} args
 * @returns {object|undefined}
 */
function runFieldCommand(cwd, command, args) {
  if (isRead(command)) {
    READS[/** @type {keyof typeof READS} */ (command)](cwd, args);
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(MUTATIONS, command)) {
    return MUTATIONS[/** @type {keyof typeof MUTATIONS} */ (command)](cwd, args);
  }
  fail(USAGE);
}

module.exports = { runFieldCommand, isRead, INDEXED_PHASES };
