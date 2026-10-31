'use strict';

// Pins the bulk-discovery artifact SET on a rich fixture: discoverArtifacts()
// yields exactly the completed artifacts below, every path state-relative.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { discoverArtifacts, readManifests, deriveIdentity } = require('../../skills/leeway-engine/scripts/domain/knowledge/artifacts.cjs');
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

// A fixture exercising every discovery branch and every exclusion rule.
function buildFixture(root) {
  const wf = statePath(root);
  const proj = { work_units: {} };

  // Epic: multi-topic phases (mixed statuses), each discussion's log beside
  // its record copy, imports (with dup + bad shapes), seeds (with an
  // escape), analysis caches, discovery sessions.
  proj.work_units['payments'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'payments', 'manifest.json'), {
    name: 'payments', work_type: 'epic', status: 'in-progress', created: '2026-01-01',
    phases: {
      discussion: { items: {
        ledger: { status: 'completed' },
        refunds: { status: 'completed' },
        chargebacks: { status: 'pending' },      // not completed → excluded
      } },
      specification: { items: {
        ledger: { status: 'completed' },
        refunds: { status: 'in-progress' },       // not completed → excluded
      } },
      planning: { items: {
        ledger: { status: 'completed' },          // completed, but not an indexed phase → excluded
      } },
    },
    imports: [
      { path: 'imports/oauth-notes.md' },
      { path: 'imports/oauth-notes.md' },         // duplicate topic → deduped
      { path: 'imports/bad/nested.md' },          // subdirectory → excluded
      { path: 'imports/.hidden.md' },             // dotfile → excluded
      { path: 'imports/dockset-05.jpeg', origin: 'discussion/ledger' }, // binary → tracked, never indexed
    ],
    seeds: [
      { path: 'seeds/original-idea.md', source: 'inbox:idea' },
      { path: 'seeds/../escape.md' },             // path escape → excluded
    ],
  });
  for (const topic of ['ledger', 'refunds', 'chargebacks']) {
    writeFile(path.join(wf, 'payments', 'topics', topic, 'log.md'), `# ${topic} — the conversation, never indexed\n`);
  }
  writeFile(path.join(wf, '.knowledge', 'records', 'payments', 'ledger.md'), '# Ledger\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'payments', 'refunds.md'), '# Refunds\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'payments.md'), '# Payments\n');
  writeFile(path.join(wf, 'payments', 'specification', 'ledger', 'specification.md'), '# Spec\n');
  writeFile(path.join(wf, 'payments', 'planning', 'ledger', 'planning.md'), '# Plan — unindexed phase, never discovered\n');
  writeFile(path.join(wf, 'payments', 'imports', 'oauth-notes.md'), '# OAuth\n');
  writeFile(path.join(wf, 'payments', 'imports', 'dockset-05.jpeg'), 'binary-ish\n');
  writeFile(path.join(wf, 'payments', 'seeds', 'original-idea.md'), '# Idea\n');
  writeFile(path.join(wf, 'payments', '.state', 'discovery-gap-analysis.md'), '# GA\n');
  writeFile(path.join(wf, 'payments', '.state', 'environment-setup.md'), '# not indexable\n');
  writeFile(path.join(wf, 'payments', '.state', 'coherence-analysis.md'), '# legacy cache — not indexable\n');
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
  writeFile(path.join(wf, 'auth-flow', 'topics', 'auth-flow', 'log.md'), '# the conversation, never indexed\n');
  writeFile(path.join(wf, '.knowledge', 'records', 'auth-flow', 'auth-flow.md'), '# D\n');
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
  writeFile(path.join(wf, '.knowledge', 'records', 'old-epic', 'topic-x.md'), '# skip (cancelled)\n');

  // Completed topic whose file is MISSING on disk → excluded by existence check.
  proj.work_units['ghost'] = { work_type: 'epic' };
  writeJson(path.join(wf, 'ghost', 'manifest.json'), {
    name: 'ghost', work_type: 'epic', status: 'in-progress', created: '2026-01-04',
    phases: { investigation: { items: { phantom: { status: 'completed' } } } },
  });
  // (no investigation/phantom.md written)

  // Project baseline — flat {topic}.md docs only; session state and dotted
  // names excluded.
  writeFile(path.join(wf, '.baseline', 'overview.md'), '# Overview\n');
  writeFile(path.join(wf, '.baseline', 'glossary.md'), '# Glossary\n');
  writeFile(path.join(wf, '.baseline', '.state', 'agenda.md'), '# session state — not indexable\n');
  writeFile(path.join(wf, '.baseline', 'dotted.name.md'), '# dotted topic → excluded\n');
  writeFile(path.join(wf, '.baseline', 'notes.txt'), 'not markdown\n');

  // Product roadmap — session logs and imports; anything else excluded.
  writeFile(path.join(wf, '.roadmap', 'sessions', 'session-001.md'), '# genesis\n');
  writeFile(path.join(wf, '.roadmap', 'sessions', 'session-002.md'), '# catch-up\n');
  writeFile(path.join(wf, '.roadmap', 'sessions', 'notes.txt'), 'not a session\n');
  writeFile(path.join(wf, '.roadmap', 'imports', 'app-idea.md'), '# the Claude-app bridge doc\n');
  writeFile(path.join(wf, '.roadmap', 'imports', 'dotted.name.md'), '# dotted → excluded\n');
  writeFile(path.join(wf, '.roadmap', 'imports', 'diagram.png'), 'binary-ish\n');

  writeJson(path.join(wf, 'manifest.json'), proj);
}

// Golden set — its paths state-relative, sorted by JSON string.
const EXPECTED = [
  { workUnit: 'auth-flow', phase: 'imports', topic: 'prior-art', file: 'auth-flow/imports/prior-art.md' },
  { workUnit: 'auth-flow', phase: 'record', topic: 'auth-flow', file: '.knowledge/records/auth-flow/auth-flow.md' },
  { workUnit: 'auth-flow', phase: 'specification', topic: 'auth-flow', file: 'auth-flow/specification/auth-flow/specification.md' },
  { workUnit: 'baseline', phase: 'baseline', topic: 'glossary', file: '.baseline/glossary.md' },
  { workUnit: 'baseline', phase: 'baseline', topic: 'overview', file: '.baseline/overview.md' },
  { workUnit: 'login-timeout', phase: 'investigation', topic: 'login-timeout', file: 'login-timeout/investigation/login-timeout.md' },
  { workUnit: 'login-timeout', phase: 'seeds', topic: 'bug-report', file: 'login-timeout/seeds/bug-report.md' },
  { workUnit: 'payments', phase: 'analysis', topic: 'gap-analysis', file: 'payments/.state/discovery-gap-analysis.md' },
  { workUnit: 'payments', phase: 'discovery', topic: 'session-001', file: 'payments/discovery/sessions/session-001.md' },
  { workUnit: 'payments', phase: 'discovery', topic: 'session-002', file: 'payments/discovery/sessions/session-002.md' },
  { workUnit: 'payments', phase: 'imports', topic: 'oauth-notes', file: 'payments/imports/oauth-notes.md' },
  { workUnit: 'payments', phase: 'record', topic: '.unit', file: '.knowledge/records/payments.md' },
  { workUnit: 'payments', phase: 'record', topic: 'ledger', file: '.knowledge/records/payments/ledger.md' },
  { workUnit: 'payments', phase: 'record', topic: 'refunds', file: '.knowledge/records/payments/refunds.md' },
  { workUnit: 'payments', phase: 'seeds', topic: 'original-idea', file: 'payments/seeds/original-idea.md' },
  { workUnit: 'payments', phase: 'specification', topic: 'ledger', file: 'payments/specification/ledger/specification.md' },
  { workUnit: 'roadmap', phase: 'imports', topic: 'app-idea', file: '.roadmap/imports/app-idea.md' },
  { workUnit: 'roadmap', phase: 'roadmap', topic: 'session-001', file: '.roadmap/sessions/session-001.md' },
  { workUnit: 'roadmap', phase: 'roadmap', topic: 'session-002', file: '.roadmap/sessions/session-002.md' },
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

  it('discovers exactly the expected identity + target set', () => {
    assert.deepStrictEqual(normalise(discover(root)), EXPECTED);
  });

  it('discovers each discussion by its record copy and never by its log', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.deepStrictEqual(files.filter((f) => f.startsWith('.knowledge/records/')), [
      '.knowledge/records/auth-flow/auth-flow.md', '.knowledge/records/payments.md',
      '.knowledge/records/payments/ledger.md', '.knowledge/records/payments/refunds.md',
    ].sort());
    assert.deepStrictEqual(files.filter((f) => f.includes('/topics/') || f.includes('/discussion/')), []);
  });

  it('leaves non-markdown imports undiscovered — manifest-tracked, never indexed', () => {
    const files = normalise(discover(root)).map((it) => it.file);
    assert.ok(!files.includes('payments/imports/dockset-05.jpeg'));
    assert.ok(!files.includes('.roadmap/imports/diagram.png'));
  });

  it('yields the identical set over the manifests however they were read', () => {
    const workUnits = JSON.parse(output(root, ['manifest', 'list']));
    assert.deepStrictEqual(normalise(discoverArtifacts(statePath(root), { workUnits, registry: null, roadmapSession: null })), EXPECTED);
  });
});

describe('knowledge bulk discovery — live session logs', () => {
  // A live session's log is indexed when the session closes, never while it
  // is being written: the epic's `phases.discovery.active_session` and the
  // project's `roadmap.active_session` name the live one.
  let root;

  before(() => {
    root = setupFixture('kb-discover-live-');
    const wf = statePath(root);
    writeJson(path.join(wf, 'manifest.json'), {
      work_units: { payments: { work_type: 'epic' } },
      roadmap: { active_session: '002' },
    });
    writeJson(path.join(wf, 'payments', 'manifest.json'), {
      name: 'payments', work_type: 'epic', status: 'in-progress', created: '2026-01-01',
      phases: { discovery: { active_session: '002' } },
    });
    for (const dir of [path.join(wf, 'payments', 'discovery', 'sessions'), path.join(wf, '.roadmap', 'sessions')]) {
      writeFile(path.join(dir, 'session-001.md'), '# closed\n');
      writeFile(path.join(dir, 'session-002.md'), '# live\n');
    }
  });

  after(() => cleanupFixture(root));

  it("leaves the epic's live discovery session log undiscovered", () => {
    const sessions = normalise(discover(root)).filter((it) => it.phase === 'discovery').map((it) => it.topic);
    assert.deepStrictEqual(sessions, ['session-001']);
  });

  it("leaves the roadmap's live session log undiscovered", () => {
    const sessions = normalise(discover(root)).filter((it) => it.phase === 'roadmap').map((it) => it.topic);
    assert.deepStrictEqual(sessions, ['session-001']);
  });
});

describe('knowledge bulk discovery — baseline without work units', () => {
  // The brownfield install moment: baseline docs exist before the first work
  // unit. Discovery must yield them with no project manifest and no registry
  // to walk.
  let root;

  before(() => {
    root = setupFixture('kb-discover-baseline-');
    writeFile(statePath(root, '.baseline', 'overview.md'), '# Overview\n');
    writeFile(statePath(root, '.baseline', '.state', 'dossier-core.md'), '# session state\n');
  });

  after(() => cleanupFixture(root));

  it('discovers the baseline docs alone', () => {
    assert.deepStrictEqual(normalise(discover(root)), [
      { workUnit: 'baseline', phase: 'baseline', topic: 'overview', file: '.baseline/overview.md' },
    ]);
  });
});

describe('deriveIdentity: the roadmap carve-out', () => {
  it('derives session and import identities under the reserved pseudo work-unit', () => {
    assert.deepStrictEqual(deriveIdentity('.roadmap/sessions/session-001.md'),
      { workUnit: 'roadmap', phase: 'roadmap', topic: 'session-001' });
    assert.deepStrictEqual(deriveIdentity('.roadmap/imports/app-idea.md'),
      { workUnit: 'roadmap', phase: 'imports', topic: 'app-idea' });
  });

  it('refuses unexpected structure and dotted import names loudly', () => {
    assert.throws(() => deriveIdentity('.roadmap/notes.md'),
      (err) => err instanceof UserError && /Unexpected roadmap path structure/.test(err.message));
    assert.throws(() => deriveIdentity('.roadmap/sessions/nested/session-001.md'),
      (err) => err instanceof UserError && /Unexpected roadmap path structure/.test(err.message));
    assert.throws(() => deriveIdentity('.roadmap/imports/.hidden.md'),
      (err) => err instanceof UserError && /Invalid topic name/.test(err.message));
  });

  it('never captures a lookalike directory — .roadmapX is an ordinary bad path', () => {
    assert.throws(() => deriveIdentity('.roadmapX/sessions/session-001.md'),
      (err) => err instanceof UserError && !/roadmap path structure/.test(err.message));
  });
});

describe('deriveIdentity: non-markdown imports', () => {
  const POLICY = /imports are tracked on the manifest; only markdown imports are indexed/;
  const refusedBy = (pattern) => (err) => err instanceof UserError && pattern.test(err.message);

  it('refuses a binary import by name, with the policy as the reason', () => {
    for (const p of ['payments/imports/diagram.png', '.roadmap/imports/diagram.png']) {
      assert.throws(() => deriveIdentity(p), refusedBy(POLICY));
      assert.throws(() => deriveIdentity(p), refusedBy(new RegExp(p.replace(/[.]/g, '\\.'))));
    }
  });

  it('leaves a structurally wrong path on the structure message', () => {
    const cases = [
      ['payments/imports/sub/diagram.png', /Unexpected imports path structure/],
      ['payments/imports/.hidden.png', /Unexpected imports path structure/],
      ['.roadmap/imports/sub/diagram.png', /Unexpected roadmap path structure/],
      ['.roadmap/imports/.hidden.png', /Unexpected roadmap path structure/],
    ];
    for (const [p, structure] of cases) {
      assert.throws(() => deriveIdentity(p), refusedBy(structure));
      assert.throws(() => deriveIdentity(p), (err) => !POLICY.test(err.message));
    }
  });

  it('derives a markdown import at its flat identity and refuses a dotted stem', () => {
    assert.deepStrictEqual(deriveIdentity('payments/imports/oauth-notes.md'),
      { workUnit: 'payments', phase: 'imports', topic: 'oauth-notes' });
    assert.throws(() => deriveIdentity('payments/imports/dotted.name.md'),
      refusedBy(/Invalid topic name/));
  });
});
