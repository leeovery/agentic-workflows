'use strict';

// ---------------------------------------------------------------------------
// The experiment suites' world (test-engine-experiment.cjs,
// test-engine-experiment-question.cjs): `lab`, an epic with timing's
// discussion open to spawn, its manifest read and written in place, a
// problem scratch for a spawn, and a record walked to a status through the
// legal steps.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const { commitAll, ok: engine } = require('./engine-harness.cjs');

function writeManifest(dir, wu, manifest) {
  const full = path.join(dir, '.leeway', wu, 'manifest.json');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(manifest, null, 2) + '\n');
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', wu, 'manifest.json'), 'utf8'));
}

/** An epic with timing's discussion open — the discussion spawns. */
function epicManifest() {
  return {
    name: 'lab',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          timing: { summary: 'Timing behaviour', order: 1 },
        },
      },
      discussion: {
        items: {
          timing: { status: 'in-progress' },
        },
      },
    },
  };
}

/** The lab's manifest, committed. */
function setup(dir) {
  writeManifest(dir, 'lab', epicManifest());
  commitAll(dir, 'init');
}

/** Write a problem scratch into the cache and return its project-relative path. */
function problemScratch(dir, slug) {
  const rel = `.leeway/.cache/lab/scratch/${slug}-problem.md`;
  fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), `# Problem — ${slug}\n`);
  return rel;
}

const SESSION = { CLAUDE_CODE_SESSION_ID: 'session-1' };
const MADE = { by: 'claude', who_moved_whom: 'none' };

/** Walk an id to `status` through the legal steps. */
function walkTo(dir, id, status) {
  const steps = { designed: 1, approved: 2, running: 3, concluded: 4 };
  const n = steps[status];
  if (n >= 1) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 2) engine(dir, ['experiment', 'approve', 'lab', 'timing', id]);
  if (n >= 3) engine(dir, ['experiment', 'advance', 'lab', 'timing', id]);
  if (n >= 4) engine(dir, ['experiment', 'conclude', 'lab', 'timing', id, '--verdict', 'rule held']);
}

module.exports = { writeManifest, readManifest, setup, problemScratch, SESSION, MADE, walkTo };
