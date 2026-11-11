'use strict';

// Pins the bulk-discovery artifact SET on a rich fixture: discoverArtifacts()
// yields exactly the artifacts below, every path state-relative — and never
// a log, discovery's or the product's, nor a file the product's conversation
// keeps (8.14.7, 9.2.2), nor a spec (11.1.2), nor anything of a unit's build
// (22.6.3), nor an older version's investigation file or shared import, nor
// a seed, an asset, an inbox item or the product record's rendered file
// (22.6.12) — a quick-fix's short record among them, at its unit's own
// identity, retired only by its file gone or its unit cancelled (22.6.9).
//
// Layer: verb.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { discoverArtifacts, readManifests, deriveIdentity, retirements } = require('../../skills/leeway-engine/scripts/domain/knowledge/artifacts.cjs');
const { UserError } = require('../../skills/leeway-engine/scripts/kernel/knowledge/retry.cjs');
const { setupGitFixture: setupFixture, cleanupFixture, statePath, output } = require('./engine-harness.cjs');

/** Every artifact the project's manifests name. @param {string} root */
function discover(root) {
  const state = statePath(root);
  return discoverArtifacts(state, readManifests(state));
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/** What the project holds that is never indexed (22.6.12): seeds, an asset of a unit's and of the product's, inbox items, the product record's rendered file. */
const NEVER = Object.freeze([
  'payments/seeds/original-idea.md', 'login-timeout/seeds/bug-report.md', 'payments/assets/ledger-sketch.md', '.product/assets/app-idea.md',
  '.inbox/ideas/2026-01-06--offline-ledger.md', '.inbox/bugs/2026-01-06--login-loops.md', '.knowledge/product.md',
]);

/** A unit's build: its log, its notes for later, a task's account and a round's report. */
const BUILD = Object.freeze(['payments/build/log.md', 'payments/build/notes.md', 'payments/build/tasks/1.1.md', 'payments/build/tasks/1.1/round-1-a.md']);

// A fixture exercising every discovery branch and every exclusion rule.
function buildFixture(root) {
  const wf = statePath(root);
  const proj = { work_units: {} };

  // Epic: multi-topic phases (mixed statuses), each discussion's log beside
  // its record copy, an older version's import, seeds, an asset, analysis
  // caches, discovery's logs, the open one among them.
  proj.work_units['payments'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'payments', 'manifest.json'), {
    name: 'payments', work_type: 'epic', status: 'in-progress', created: '2026-01-01',
    phases: {
      discovery: { active_session: '002' },
      discussion: { items: {
        ledger: { status: 'completed' },
        refunds: { status: 'completed' },
        chargebacks: { status: 'pending' },      // not completed → excluded
      } },
      specification: { items: {
        ledger: { status: 'completed' },          // completed, but never indexed (11.1.2)
      } },
      planning: { items: {
        ledger: { status: 'completed' },          // completed, but not an indexed phase → excluded
      } },
    },
    imports: [{ path: 'imports/oauth-notes.md', origin: 'discovery' }], // an older version's → never indexed
    seeds: [{ path: 'seeds/original-idea.md', source: 'inbox:idea' }],
  });
  for (const topic of ['ledger', 'refunds', 'chargebacks']) {
    writeFile(path.join(wf, 'payments', 'topics', topic, 'log.md'), `# ${topic} — the conversation, never indexed\n`);
  }
  writeFile(path.join(wf, '.knowledge', 'records', 'payments', 'ledger.md'), '# Ledger\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'payments', 'refunds.md'), '# Refunds\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'payments.md'), '# Payments\n');
  writeFile(path.join(wf, 'payments', 'specification', 'ledger', 'specification.md'), '# Spec — never indexed\n');
  writeFile(path.join(wf, 'payments', 'spec.md'), '# The unit\'s spec — never indexed\n');
  writeFile(path.join(wf, 'payments', 'planning', 'ledger', 'planning.md'), '# Plan — unindexed phase, never discovered\n');
  writeFile(path.join(wf, 'payments', 'imports', 'oauth-notes.md'), '# OAuth — an older version\'s, never indexed\n');
  writeFile(path.join(wf, 'payments', '.state', 'discovery-gap-analysis.md'), '# GA\n');
  writeFile(path.join(wf, 'payments', '.state', 'environment-setup.md'), '# not indexable\n');
  writeFile(path.join(wf, 'payments', '.state', 'coherence-analysis.md'), '# legacy cache — not indexable\n');
  writeFile(path.join(wf, 'payments', 'discovery', 'session-001.md'), '# S1 — a log, never indexed\n');
  writeFile(path.join(wf, 'payments', 'discovery', 'session-002.md'), '# S2 — a log, never indexed\n');
  for (const rel of BUILD) writeFile(path.join(wf, rel), '# the build\'s — never indexed\n');

  // Feature: single topic, its first discovery log never indexed.
  proj.work_units['auth-flow'] = { work_type: 'feature' };
  writeJson(path.join(wf, 'auth-flow', 'manifest.json'), {
    name: 'auth-flow', work_type: 'feature', status: 'in-progress', created: '2026-01-02',
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
      specification: { items: { 'auth-flow': { status: 'completed' } } },
    },
  });
  writeFile(path.join(wf, 'auth-flow', 'topics', 'auth-flow', 'log.md'), '# the conversation, never indexed\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'auth-flow', 'auth-flow.md'), '# D\n');
  writeFile(path.join(wf, 'auth-flow', 'specification', 'auth-flow', 'specification.md'), '# S — never indexed\n');
  writeFile(path.join(wf, 'auth-flow', 'discovery', 'session-001.md'), '# a log, never indexed\n');

  // Quick-fix, completed: its short record, no phase's item, beside its build's log.
  proj.work_units['typo'] = { work_type: 'quick-fix' };
  writeJson(path.join(wf, 'typo', 'manifest.json'), {
    name: 'typo', work_type: 'quick-fix', status: 'completed', created: '2026-01-05', phases: {}, fixes: { began: '2026-01-05T09:00:00Z' },
  });
  writeFile(path.join(wf, 'typo', 'summary.md'), '## Spell the flag\n\n- What changed: The flag.\n');
  writeFile(path.join(wf, 'typo', 'build', 'log.md'), '# the build\'s — never indexed\n');

  // Bugfix: an older version's investigation file beside its seed.
  proj.work_units['login-timeout'] = { work_type: 'bugfix' };
  writeJson(path.join(wf, 'login-timeout', 'manifest.json'), {
    name: 'login-timeout', work_type: 'bugfix', status: 'in-progress', created: '2026-01-03',
    phases: { investigation: { items: { 'login-timeout': { status: 'completed' } } } },
    seeds: [{ path: 'seeds/bug-report.md', source: 'inbox:bug' }],
  });
  writeFile(path.join(wf, 'login-timeout', 'investigation', 'login-timeout.md'), '# I — an older version\'s, never indexed\n');

  // Cancelled epic: entirely excluded.
  proj.work_units['old-epic'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'old-epic', 'manifest.json'), {
    name: 'old-epic', work_type: 'epic', status: 'cancelled', created: '2025-06-01',
    phases: { discussion: { items: { 'topic-x': { status: 'completed' } } } },
  });
  writeFile(path.join(wf, '.knowledge', 'records', 'old-epic', 'topic-x.md'), '# skip (cancelled)\n');

  // The product's conversation: its logs, the open one among them, and the
  // files it keeps — none indexed.
  writeFile(path.join(wf, '.product', 'sessions', 'session-001.md'), '# genesis — a log, never indexed\n');
  writeFile(path.join(wf, '.product', 'sessions', 'session-002.md'), '# catch-up — a log, never indexed\n');
  writeFile(path.join(wf, '.product', 'spikes', '001-pricing', 'notes.md'), '# a spike\n');
  for (const rel of NEVER) writeFile(path.join(wf, rel), '# never indexed\n');

  writeJson(path.join(wf, 'manifest.json'), { ...proj, product_session: '002' });
}

// Golden set — its paths state-relative, sorted by JSON string.
const EXPECTED = [
  { workUnit: 'auth-flow', phase: 'record', topic: 'auth-flow', file: '.knowledge/records/auth-flow/auth-flow.md' },
  { workUnit: 'payments', phase: 'analysis', topic: 'gap-analysis', file: 'payments/.state/discovery-gap-analysis.md' },
  { workUnit: 'payments', phase: 'record', topic: '.unit', file: '.knowledge/records/payments.md' },
  { workUnit: 'payments', phase: 'record', topic: 'ledger', file: '.knowledge/records/payments/ledger.md' },
  { workUnit: 'payments', phase: 'record', topic: 'refunds', file: '.knowledge/records/payments/refunds.md' },
  { workUnit: 'typo', phase: 'summary', topic: '.unit', file: 'typo/summary.md' },
];

function normalise(items) {
  return items
    .map((it) => ({ workUnit: it.workUnit, phase: it.phase, topic: it.topic, file: it.file }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

describe('knowledge bulk discovery — artifact-set equivalence', () => {
  let root;

  before(() => {
    root = setupFixture('kb-discover-');
    buildFixture(root);
  });

  after(() => cleanupFixture(root));

  it('discovers exactly the expected identity + target set — no seed, asset, inbox item or the product record\'s rendered file among them (9.S54)', () => {
    assert.deepStrictEqual(normalise(discover(root)), EXPECTED);
  });

  it('8.14.7: discovers no log — a unit\'s discovery sessions or the product\'s, closed or open — and nothing the product\'s conversation keeps', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.deepStrictEqual(files.filter((f) => f.includes('/discovery/') || f.startsWith('.product/')), []);
  });

  it('discovers each discussion by its record copy and never by its log', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.deepStrictEqual(files.filter((f) => f.startsWith('.knowledge/records/')), [
      '.knowledge/records/auth-flow/auth-flow.md', '.knowledge/records/payments.md',
      '.knowledge/records/payments/ledger.md', '.knowledge/records/payments/refunds.md',
    ].sort());
    assert.deepStrictEqual(files.filter((f) => f.includes('/topics/') || f.includes('/discussion/')), []);
  });

  it('22.S17: discovers nothing of a unit\'s build — its log, its notes, a task\'s account and reports — and the one-file door refuses each', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.deepStrictEqual(files.filter((f) => f.includes('/build/')), []);
    for (const rel of BUILD) assert.throws(() => deriveIdentity(rel), (err) => err instanceof UserError && /Cannot derive identity/.test(err.message), rel);
  });

  it('discovers no older version\'s investigation file or shared import, and the one-file door refuses each', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.deepStrictEqual(files.filter((f) => f.includes('/investigation/') || f.includes('/imports/')), []);
    for (const rel of ['login-timeout/investigation/login-timeout.md', 'payments/imports/oauth-notes.md']) {
      assert.throws(() => deriveIdentity(rel), (err) => err instanceof UserError && /Cannot derive identity/.test(err.message), rel);
    }
  });

  it('yields the identical set over the manifests however they were read', () => {
    const workUnits = JSON.parse(output(root, ['manifest', 'list']));
    assert.deepStrictEqual(normalise(discoverArtifacts(statePath(root), { workUnits, registry: null })), EXPECTED);
  });

  it('22.6.9: retires a quick-fix\'s short record, no phase\'s item, only once its file is gone or its unit cancelled', () => {
    const state = statePath(root);
    const indexed = { workUnit: 'typo', phase: 'summary', topic: '.unit', file: 'typo/summary.md' };
    const standing = retirements(state, [indexed], readManifests(state), null);
    fs.rmSync(path.join(state, 'typo', 'summary.md'));
    const gone = retirements(state, [indexed], readManifests(state), null).map(({ reason }) => reason);
    writeFile(path.join(state, 'typo', 'summary.md'), '## Spell the flag\n');
    const manifests = readManifests(state);
    const cancelled = { ...manifests, workUnits: manifests.workUnits.map((unit) => (unit.name === 'typo' ? { ...unit, status: 'cancelled' } : unit)) };

    assert.deepStrictEqual([standing, gone, retirements(state, [indexed], cancelled, null).map(({ reason }) => reason)], [[], ['source deleted'], ['work unit cancelled']]);
  });
});

describe('deriveIdentity: a quick-fix\'s short record (22.6.9)', () => {
  it('is named at its unit\'s own identity, a dotted unit refused', () => {
    assert.deepStrictEqual(deriveIdentity('typo/summary.md'), { workUnit: 'typo', phase: 'summary', topic: '.unit' });
    assert.throws(() => deriveIdentity('ty.po/summary.md'), (err) => err instanceof UserError && /Invalid work unit name/.test(err.message));
  });
});
