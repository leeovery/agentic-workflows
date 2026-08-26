#!/usr/bin/env node
'use strict';

// Thin child host for the engine's in-process read surface (phase-0 §2).
// The bridge spawns this with the target project's OWN engine install so
// version skew lives in the child, never in the bridge. JSON-lines protocol:
//   → {id, method, args}
//   ← {id, ok: true, result} | {id, ok: false, error}
// WORKFLOWS_DISPLAY_WIDTH is pinned by the parent's env at spawn.

const readline = require('node:readline');

const [, , libPath, projectRoot] = process.argv;
if (!libPath || !projectRoot) {
  process.stderr.write('usage: engine-host.cjs <lib.cjs path> <project root>\n');
  process.exit(2);
}

let engine;
try {
  engine = require(libPath);
} catch (err) {
  process.stdout.write(JSON.stringify({ id: null, ok: false, fatal: true, error: `engine load failed: ${err.message}` }) + '\n');
  process.exit(1);
}

// Null prototype: a method name like "hasOwnProperty" must resolve to
// undefined, never an inherited Object.prototype member.
const methods = Object.assign(Object.create(null), {
  ping: () => ({ pong: true }),
  loadAllManifests: () => engine.reads.loadAllManifests(projectRoot),
  loadActiveManifests: () => engine.reads.loadActiveManifests(projectRoot),
  loadManifest: ({ name }) => engine.reads.loadManifest(projectRoot, name),
  startDetail: () => engine.detail.startDetail(projectRoot),
  workUnitIndex: () => engine.detail.workUnitIndex(projectRoot),
  scanPresence: ({ workUnit }) => engine.presence.scanPresence(projectRoot, workUnit),
  // Derived views for spec-blocked / dep-blocked (EVENTS.md: "computed via the
  // engine's own lib.cjs derivations"). Accepts an explicit manifest object so
  // the spine can run it against historical manifests read from git blobs.
  epicDetailFor: ({ manifest }) => engine.detail.epicDetail(projectRoot, manifest),
  schema: () => engine.schema,
});

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify({ id: null, ok: false, error: 'bad request json' }) + '\n');
    return;
  }
  const fn = methods[req.method];
  if (!fn) {
    process.stdout.write(JSON.stringify({ id: req.id, ok: false, error: `unknown method ${req.method}` }) + '\n');
    return;
  }
  try {
    const result = fn(req.args || {});
    process.stdout.write(JSON.stringify({ id: req.id, ok: true, result }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ id: req.id, ok: false, error: String(err && err.message || err) }) + '\n');
  }
});
rl.on('close', () => process.exit(0));
