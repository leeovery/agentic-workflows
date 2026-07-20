'use strict';

// Pins the bulk-discovery artifact SET on a rich fixture. discoverArtifacts()
// must yield exactly the completed artifacts the pre-refactor walk produced —
// this is the equivalence guard for the perf change that dropped the per-topic
// `engine manifest resolve` spawns and derives phase-artifact paths locally.
//
// File paths are compared project-root-relative: the old engine-resolve path
// returned ABSOLUTE paths for the four phase artifacts (research, discussion,
// investigation, specification) while imports/seeds/analysis/discovery were
// already relative; the local derivation returns relative for all. Same on-disk
// target either way, so normalising to `.workflows/…` proves set-equivalence.
//
// The golden set below was captured from the pre-refactor discoverArtifacts()
// on this exact fixture (absolute phase paths relativised) and is unchanged by
// the refactor.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { discoverArtifacts } = require('../../src/knowledge/index');

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// A fixture exercising every discovery branch and every exclusion rule.
function buildFixture(root) {
  const wf = path.join(root, '.workflows');
  const proj = { work_units: {} };

  // Epic: multi-topic phases (mixed statuses), imports (with dup + bad shapes),
  // seeds (with an escape), analysis caches, discovery sessions.
  proj.work_units['payments'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'payments', 'manifest.json'), {
    name: 'payments', work_type: 'epic', status: 'in-progress', created: '2026-01-01',
    phases: {
      research: { items: {
        ledger: { status: 'completed' },
        fees: { status: 'in-progress' },        // not completed → excluded
        'fx-rates': { status: 'completed' },
      } },
      discussion: { items: {
        ledger: { status: 'completed' },
        refunds: { status: 'completed' },
        chargebacks: { status: 'pending' },      // not completed → excluded
      } },
      specification: { items: {
        ledger: { status: 'completed' },
        refunds: { status: 'in-progress' },       // not completed → excluded
      } },
    },
    imports: [
      { path: 'imports/oauth-notes.md' },
      { path: 'imports/oauth-notes.md' },         // duplicate topic → deduped
      { path: 'imports/bad/nested.md' },          // subdirectory → excluded
      { path: 'imports/.hidden.md' },             // dotfile → excluded
    ],
    seeds: [
      { path: 'seeds/original-idea.md', source: 'inbox:idea' },
      { path: 'seeds/../escape.md' },             // path escape → excluded
    ],
  });
  writeFile(path.join(wf, 'payments', 'research', 'ledger.md'), '# Ledger\n');
  writeFile(path.join(wf, 'payments', 'research', 'fx-rates.md'), '# FX\n');
  writeFile(path.join(wf, 'payments', 'research', 'fees.md'), '# Fees\n');
  writeFile(path.join(wf, 'payments', 'discussion', 'ledger.md'), '# Ledger\n');
  writeFile(path.join(wf, 'payments', 'discussion', 'refunds.md'), '# Refunds\n');
  writeFile(path.join(wf, 'payments', 'specification', 'ledger', 'specification.md'), '# Spec\n');
  writeFile(path.join(wf, 'payments', 'imports', 'oauth-notes.md'), '# OAuth\n');
  writeFile(path.join(wf, 'payments', 'seeds', 'original-idea.md'), '# Idea\n');
  writeFile(path.join(wf, 'payments', '.state', 'research-analysis.md'), '# RA\n');
  writeFile(path.join(wf, 'payments', '.state', 'discovery-gap-analysis.md'), '# GA\n');
  writeFile(path.join(wf, 'payments', '.state', 'environment-setup.md'), '# not indexable\n');
  writeFile(path.join(wf, 'payments', 'discovery', 'sessions', 'session-001.md'), '# S1\n');
  writeFile(path.join(wf, 'payments', 'discovery', 'sessions', 'session-002.md'), '# S2\n');
  writeFile(path.join(wf, 'payments', 'discovery', 'sessions', 'notes.md'), '# not a session\n');

  // Feature: single topic; discovery sessions on disk must NOT be indexed
  // (session discovery is epic-only).
  proj.work_units['auth-flow'] = { work_type: 'feature' };
  writeJson(path.join(wf, 'auth-flow', 'manifest.json'), {
    name: 'auth-flow', work_type: 'feature', status: 'in-progress', created: '2026-01-02',
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
      specification: { items: { 'auth-flow': { status: 'completed' } } },
    },
    imports: [{ path: 'imports/prior-art.md' }],
  });
  writeFile(path.join(wf, 'auth-flow', 'discussion', 'auth-flow.md'), '# D\n');
  writeFile(path.join(wf, 'auth-flow', 'specification', 'auth-flow', 'specification.md'), '# S\n');
  writeFile(path.join(wf, 'auth-flow', 'imports', 'prior-art.md'), '# PA\n');
  writeFile(path.join(wf, 'auth-flow', 'discovery', 'sessions', 'session-001.md'), '# skip\n');

  // Bugfix: investigation flat file.
  proj.work_units['login-timeout'] = { work_type: 'bugfix' };
  writeJson(path.join(wf, 'login-timeout', 'manifest.json'), {
    name: 'login-timeout', work_type: 'bugfix', status: 'in-progress', created: '2026-01-03',
    phases: { investigation: { items: { 'login-timeout': { status: 'completed' } } } },
    seeds: [{ path: 'seeds/bug-report.md', source: 'inbox:bug' }],
  });
  writeFile(path.join(wf, 'login-timeout', 'investigation', 'login-timeout.md'), '# I\n');
  writeFile(path.join(wf, 'login-timeout', 'seeds', 'bug-report.md'), '# BR\n');

  // Cancelled epic: entirely excluded.
  proj.work_units['old-epic'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'old-epic', 'manifest.json'), {
    name: 'old-epic', work_type: 'epic', status: 'cancelled', created: '2025-06-01',
    phases: { discussion: { items: { 'topic-x': { status: 'completed' } } } },
  });
  writeFile(path.join(wf, 'old-epic', 'discussion', 'topic-x.md'), '# skip (cancelled)\n');

  // Completed topic whose file is MISSING on disk → excluded by existence check.
  proj.work_units['ghost'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'ghost', 'manifest.json'), {
    name: 'ghost', work_type: 'epic', status: 'in-progress', created: '2026-01-04',
    phases: { research: { items: { phantom: { status: 'completed' } } } },
  });
  // (no research/phantom.md written)

  writeJson(path.join(wf, 'manifest.json'), proj);
}

// Golden set — captured from the pre-refactor discoverArtifacts(), normalised to
// project-root-relative paths, sorted by JSON string.
const EXPECTED = [
  { workUnit: 'auth-flow', phase: 'discussion', topic: 'auth-flow', file: '.workflows/auth-flow/discussion/auth-flow.md' },
  { workUnit: 'auth-flow', phase: 'imports', topic: 'prior-art', file: '.workflows/auth-flow/imports/prior-art.md' },
  { workUnit: 'auth-flow', phase: 'specification', topic: 'auth-flow', file: '.workflows/auth-flow/specification/auth-flow/specification.md' },
  { workUnit: 'login-timeout', phase: 'investigation', topic: 'login-timeout', file: '.workflows/login-timeout/investigation/login-timeout.md' },
  { workUnit: 'login-timeout', phase: 'seeds', topic: 'bug-report', file: '.workflows/login-timeout/seeds/bug-report.md' },
  { workUnit: 'payments', phase: 'analysis', topic: 'gap-analysis', file: '.workflows/payments/.state/discovery-gap-analysis.md' },
  { workUnit: 'payments', phase: 'analysis', topic: 'research-analysis', file: '.workflows/payments/.state/research-analysis.md' },
  { workUnit: 'payments', phase: 'discovery', topic: 'session-001', file: '.workflows/payments/discovery/sessions/session-001.md' },
  { workUnit: 'payments', phase: 'discovery', topic: 'session-002', file: '.workflows/payments/discovery/sessions/session-002.md' },
  { workUnit: 'payments', phase: 'discussion', topic: 'ledger', file: '.workflows/payments/discussion/ledger.md' },
  { workUnit: 'payments', phase: 'discussion', topic: 'refunds', file: '.workflows/payments/discussion/refunds.md' },
  { workUnit: 'payments', phase: 'imports', topic: 'oauth-notes', file: '.workflows/payments/imports/oauth-notes.md' },
  { workUnit: 'payments', phase: 'research', topic: 'fx-rates', file: '.workflows/payments/research/fx-rates.md' },
  { workUnit: 'payments', phase: 'research', topic: 'ledger', file: '.workflows/payments/research/ledger.md' },
  { workUnit: 'payments', phase: 'seeds', topic: 'original-idea', file: '.workflows/payments/seeds/original-idea.md' },
  { workUnit: 'payments', phase: 'specification', topic: 'ledger', file: '.workflows/payments/specification/ledger/specification.md' },
];

function normalise(items) {
  return items
    .map((it) => {
      const f = it.file.replace(/\\/g, '/');
      const at = f.indexOf('.workflows/');
      return {
        workUnit: it.workUnit,
        phase: it.phase,
        topic: it.topic,
        file: at >= 0 ? f.slice(at) : f, // project-root-relative, symlink-independent
      };
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

describe('knowledge bulk discovery — artifact-set equivalence', () => {
  let root;
  let cwd0;

  before(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-discover-')));
    buildFixture(root);
    cwd0 = process.cwd();
    process.chdir(root);
  });

  after(() => {
    process.chdir(cwd0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('discovers exactly the expected identity + target set', () => {
    assert.deepStrictEqual(normalise(discoverArtifacts()), EXPECTED);
  });

  it('accepts a pre-fetched manifest list and yields the identical set', () => {
    // cmdStatus passes the shared `manifest list` payload in; the result must
    // match the self-fetching path exactly.
    const { execFileSync } = require('child_process');
    const engineJs = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
    const units = JSON.parse(execFileSync('node', [engineJs, 'manifest', 'list'], { cwd: root, encoding: 'utf8' }));
    assert.deepStrictEqual(normalise(discoverArtifacts(units)), EXPECTED);
  });
});
