'use strict';

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  git, stateGit, commitAll, setupFixtureAt, okSections, refuses, output, keywordOnlyKnowledge, unreadableKnowledge, indexedFiles,
} = require('./engine-harness.cjs');
const store = require('../../skills/leeway-engine/scripts/kernel/knowledge/store.cjs');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** A feature manifest with completed artifacts, an import, and a seed. */
function featureManifest(overrides = {}) {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [{ path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z' }],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-01T09:00:00Z' }],
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
    },
    ...overrides,
  };
}

/** A project, its state committed, carrying the feature. */
function setupFixture(manifest = featureManifest()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-pivot-'));
  const project = setupFixtureAt(path.join(root, 'project'));
  keywordOnlyKnowledge(project);
  writeFile(project, '.leeway/manifest.json', JSON.stringify({
    work_units: { 'auth-flow': { work_type: 'feature' }, payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.leeway/auth-flow/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  writeFile(project, '.leeway/auth-flow/topics/auth-flow/log.md', '# Discussion — the conversation, never indexed\n');
  writeFile(project, '.leeway/.knowledge/records/auth-flow/auth-flow.md', '# Auth Flow — the decided record\n');
  writeFile(project, '.leeway/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(project, '.leeway/auth-flow/seeds/seed.md', '# Seed\n');
  commitAll(project, 'init');

  return { root, project, codeHead: git(project, ['rev-parse', 'HEAD']).trim() };
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(fix, args, env = {}) {
  const { res, sections } = okSections(fix.project, args, { env });
  engine.lastSections = sections;
  return res;
}
engine.lastSections = '';

/** Run the engine expecting failure; returns the parsed stderr JSON. */
const engineFails = (fix, args, env = {}) => refuses(fix.project, args, { env });

/** The feature's artifacts the knowledge base holds, state-relative. */
const UNIT_FILES = [
  '.knowledge/records/auth-flow/auth-flow.md',
  'auth-flow/imports/notes.md',
  'auth-flow/seeds/seed.md',
];

/** Index each of the feature's artifacts. */
function indexUnit(fix) {
  for (const file of UNIT_FILES) output(fix.project, ['knowledge', 'index', path.join(fix.project, '.leeway', file)]);
}

/** The distinct work types the store's chunks carry. */
function chunkWorkTypes(fix) {
  const chunks = store.allChunks(store.loadStore(path.join(fix.project, '.leeway/.knowledge/store.bin')));
  return [...new Set(chunks.map((chunk) => chunk.work_type))];
}

function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway', wu, 'manifest.json'), 'utf8'));
}

function readProjectManifest(fix) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway/manifest.json'), 'utf8'));
}

function shortHead(fix) {
  return stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** Snapshot of everything pivot may touch, for nothing-touched assertions. */
function snapshot(fix) {
  return {
    manifest: fs.readFileSync(path.join(fix.project, '.leeway/auth-flow/manifest.json'), 'utf8'),
    project: fs.readFileSync(path.join(fix.project, '.leeway/manifest.json'), 'utf8'),
    commits: stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim(),
    status: git(fix.project, ['status', '--porcelain']) + stateGit(fix.project, ['status', '--porcelain']),
  };
}

describe('engine workunit pivot — happy path', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('flips work_type in BOTH manifests, registers the backfill map item, re-indexes, commits', () => {
    fix = setupFixture();
    indexUnit(fix);
    assert.deepStrictEqual(chunkWorkTypes(fix), ['feature']);
    writeFile(fix.project, 'unrelated.txt', 'outside the scope\n');
    const res = engine(fix, ['workunit', 'pivot', 'auth-flow']);

    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'auth-flow',
      work_type: 'epic',
      committed: shortHead(fix),
      warnings: [],
    });
    // The transaction is pure JSON; the continuation menu and the kb
    // advisory are receipt surfaces fetched only by flows with a use for them.
    assert.strictEqual(engine.lastSections, '', 'pivot answers with pure JSON');
    const menu = output(fix.project, ['render', 'pivot-continuation', 'auth-flow']);
    assert.ok(menu.includes("=== MENU: pivot continuation (emit verbatim as markdown (not a code block), then STOP for the user's response) ==="), menu);
    assert.ok(menu.includes('**Auth Flow** converted from feature to epic.'), menu);
    const advisory = output(fix.project, ['render', 'workunit-receipt', 'auth-flow', '--verb', 'pivot', '--warn']);
    assert.match(advisory, /=== DISPLAY: kb warning \(emit verbatim as a text code block \(```text fence\) — do not stop; continue as the workflow instructs\) ===\n  ⚑ Knowledge indexing warning\n    The pivot is complete\. The next start retries the indexing\./);
    assert.strictEqual(
      output(fix.project, ['render', 'workunit-receipt', 'auth-flow', '--verb', 'pivot']),
      '', 'no --warn, no advisory — an empty receipt');

    const m = readManifest(fix, 'auth-flow');
    assert.strictEqual(m.work_type, 'epic');
    // Backfill map item: source only — no summary/description
    // (summary-backfill drafts them), never a status field.
    assert.deepStrictEqual(m.phases.discovery.items, {
      'auth-flow': { source: 'discovery' },
    });
    // The project-manifest registration flips too; siblings untouched.
    assert.deepStrictEqual(readProjectManifest(fix).work_units, {
      'auth-flow': { work_type: 'epic' },
      payments: { work_type: 'epic' },
    });

    // One state commit, engine-owned message, scoped to the two manifests;
    // the default branch takes none.
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'workflow(auth-flow): pivot to epic');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--skip=1', '--pretty=%s']).trim(), 'init');
    const staged = stateGit(fix.project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged.sort(), ['auth-flow/manifest.json', 'manifest.json']);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), fix.codeHead);
    assert.match(git(fix.project, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    // Chunk metadata carries work_type — pivot clears the unit's chunks then
    // re-indexes the unit's artifacts (decided records, imports, seeds, …),
    // every chunk now the epic's.
    assert.deepStrictEqual(indexedFiles(fix.project), UNIT_FILES);
    assert.deepStrictEqual(chunkWorkTypes(fix), ['epic']);
  });

  it('registers an unregistered legacy unit rather than skipping it', () => {
    fix = setupFixture();
    writeFile(fix.project, '.leeway/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'epic' } } }, null, 2) + '\n');
    commitAll(fix.project, 'drop registration');

    engine(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.deepStrictEqual(readProjectManifest(fix).work_units['auth-flow'], { work_type: 'epic' });
  });

  it('KB failures are warnings, never blocks — the pivot still lands', () => {
    fix = setupFixture();
    unreadableKnowledge(fix.project);
    const res = engine(fix, ['workunit', 'pivot', 'auth-flow']);

    assert.strictEqual(res.work_type, 'epic');
    assert.strictEqual(res.warnings.length, 2, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge remove failed: loadStore: corrupted store file at /);
    assert.match(res.warnings[1], /^knowledge index failed: loadStore: corrupted store file at /);
    assert.strictEqual(readManifest(fix, 'auth-flow').work_type, 'epic');
    assert.strictEqual(res.committed, shortHead(fix));
  });
});

describe('engine workunit pivot — guards refuse loudly, nothing touched', () => {
  let fix;
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('refuses a non-feature work unit', () => {
    fix = setupFixture(featureManifest({ work_type: 'epic' }));
    const before = snapshot(fix);
    const err = engineFails(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.match(err.error, /not a feature \(work_type: epic\) — only features pivot to epics/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a completed or cancelled feature', () => {
    fix = setupFixture(featureManifest({ status: 'completed' }));
    const before = snapshot(fix);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow']).error, /not in-progress \(status: completed\) — reactivate it first/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a re-run: the topic is already on the discovery map', () => {
    const m = featureManifest();
    m.phases.discovery = { items: { 'auth-flow': { source: 'discovery' } } };
    fix = setupFixture(m);
    const before = snapshot(fix);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow']).error, /already on the discovery map/);
    assert.deepStrictEqual(snapshot(fix), before);
  });

  it('refuses a corrupt project manifest before flipping anything', () => {
    fix = setupFixture();
    indexUnit(fix);
    const storeFile = path.join(fix.project, '.leeway/.knowledge/store.bin');
    const before = fs.readFileSync(storeFile);
    writeFile(fix.project, '.leeway/manifest.json', '{ corrupt\n');
    const err = engineFails(fix, ['workunit', 'pivot', 'auth-flow']);
    assert.match(err.error, /not valid JSON/);
    assert.strictEqual(readManifest(fix, 'auth-flow').work_type, 'feature');
    assert.deepStrictEqual(fs.readFileSync(storeFile), before, 'the store is as it stood — no chunk cleared or restamped');
    assert.deepStrictEqual(indexedFiles(fix.project), UNIT_FILES);
  });

  it('rejects unknown and missing work units, and extra args', () => {
    fix = setupFixture();
    assert.match(engineFails(fix, ['workunit', 'pivot', 'ghost']).error, /manifest not found/);
    assert.match(engineFails(fix, ['workunit', 'pivot']).error, /Usage: engine workunit pivot/);
    assert.match(engineFails(fix, ['workunit', 'pivot', 'auth-flow', 'extra']).error, /Usage: engine workunit pivot/);
  });
});
