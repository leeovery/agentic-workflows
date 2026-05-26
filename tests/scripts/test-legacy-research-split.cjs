'use strict';

// Direct script tests for workflow-legacy-research-split scripts:
//   - detect.cjs   : qualifying-source filter (5 conditions × pass/fail + happy path)
//   - validate.cjs : cache-shape contract (each rejection path + happy path)
//   - apply.cjs    : transactional split (end-to-end + mid-flow failure + recovery)

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..', '..', 'skills', 'workflow-legacy-research-split', 'scripts');
const DETECT_CLI   = path.join(SKILL_DIR, 'detect.cjs');
const VALIDATE_CLI = path.join(SKILL_DIR, 'validate.cjs');
const APPLY_CLI    = path.join(SKILL_DIR, 'apply.cjs');
const MANIFEST_CLI = path.resolve(__dirname, '..', '..', 'skills', 'workflow-manifest', 'scripts', 'manifest.cjs');

let dir;

function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-split-test-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  // Init git so apply.cjs can commit.
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
}

function cleanup() {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
}

function writeProjectManifest(workUnit, workType) {
  const p = path.join(dir, '.workflows', 'manifest.json');
  let proj = {};
  if (fs.existsSync(p)) proj = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!proj.work_units) proj.work_units = {};
  proj.work_units[workUnit] = { work_type: workType || 'epic' };
  fs.writeFileSync(p, JSON.stringify(proj, null, 2));
}

function writeManifest(workUnit, data) {
  const wuDir = path.join(dir, '.workflows', workUnit);
  fs.mkdirSync(wuDir, { recursive: true });
  fs.writeFileSync(path.join(wuDir, 'manifest.json'), JSON.stringify(data, null, 2));
  writeProjectManifest(workUnit, data.work_type || 'epic');
}

function writeResearchFile(workUnit, topic, content) {
  const p = path.join(dir, '.workflows', workUnit, 'research', `${topic}.md`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function readManifest(workUnit) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.workflows', workUnit, 'manifest.json'), 'utf8'
  ));
}

function fileExists(workUnit, relPath) {
  return fs.existsSync(path.join(dir, '.workflows', workUnit, relPath));
}

function runScript(cli, ...args) {
  const r = spawnSync('node', [cli, ...args], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runScriptJson(cli, ...args) {
  const r = runScript(cli, ...args);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch {}
  return { ...r, json: parsed };
}

function seedLegacyEpic(workUnit, sourceTopic, opts = {}) {
  writeManifest(workUnit, {
    name: workUnit,
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      inception: {
        items: {
          [sourceTopic]: {
            routing: opts.routing || 'research',
            source: opts.source || 'migration-seeded',
            ...(opts.legacy_split_state ? { legacy_split_state: opts.legacy_split_state } : {}),
          },
        },
      },
      research: {
        items: {
          [sourceTopic]: { status: opts.researchStatus || 'in-progress' },
        },
      },
    },
  });
  if (opts.writeFile !== false) {
    writeResearchFile(workUnit, sourceTopic, opts.fileContent || '# Broad Research\n\nContent.');
  }
  // Initial commit so subsequent apply.cjs has a clean working tree.
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
}

function writeCachePlan(workUnit, currentSource, themes) {
  const cacheDir = path.join(dir, '.workflows', '.cache', workUnit, 'legacy-split', currentSource);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({ themes }, null, 2));
  for (const t of themes) {
    if (t.kebab_name && t._content !== undefined) {
      fs.writeFileSync(path.join(cacheDir, `${t.kebab_name}.md`), t._content);
    }
  }
}

// ----- detect.cjs -----

describe('detect.cjs: filter conditions', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('identifies a migration-seeded research item with backing file', () => {
    seedLegacyEpic('alpha', 'exploration');
    const r = runScriptJson(DETECT_CLI, 'alpha');
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(r.json.qualifying_sources, ['exploration']);
  });

  it('skips items without migration-seeded source', () => {
    seedLegacyEpic('beta', 'foo', { source: 'inception' });
    const r = runScriptJson(DETECT_CLI, 'beta');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
  });

  it('skips items with discussion routing', () => {
    seedLegacyEpic('gamma', 'foo', { routing: 'discussion' });
    const r = runScriptJson(DETECT_CLI, 'gamma');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
  });

  it('skips items whose research file is missing on disk', () => {
    seedLegacyEpic('delta', 'foo', { writeFile: false });
    const r = runScriptJson(DETECT_CLI, 'delta');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
  });

  it('skips items whose research item is completed (not in-progress)', () => {
    seedLegacyEpic('epsilon', 'foo', { researchStatus: 'completed' });
    const r = runScriptJson(DETECT_CLI, 'epsilon');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
  });

  it('skips items where legacy_split_state is set to in-progress', () => {
    seedLegacyEpic('zeta', 'src', { legacy_split_state: 'in-progress' });
    const r = runScriptJson(DETECT_CLI, 'zeta');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
  });

  it('returns multiple qualifying sources sorted', () => {
    writeManifest('multi', {
      name: 'multi',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        inception: { items: {
          architecture: { routing: 'research', source: 'migration-seeded' },
          exploration:  { routing: 'research', source: 'migration-seeded' },
        }},
        research: { items: {
          architecture: { status: 'in-progress' },
          exploration:  { status: 'in-progress' },
        }},
      },
    });
    writeResearchFile('multi', 'architecture', 'arch');
    writeResearchFile('multi', 'exploration', 'explore');
    const r = runScriptJson(DETECT_CLI, 'multi');
    assert.deepStrictEqual(r.json.qualifying_sources, ['architecture', 'exploration']);
  });

  it('multi-source source field with migration-seeded substring qualifies', () => {
    seedLegacyEpic('substr', 'foo', { source: 'inception,migration-seeded' });
    const r = runScriptJson(DETECT_CLI, 'substr');
    assert.deepStrictEqual(r.json.qualifying_sources, ['foo']);
  });
});

// ----- validate.cjs -----

describe('validate.cjs: cache shape contract', () => {
  beforeEach(setup);
  afterEach(cleanup);

  const baseTheme = () => ({
    kebab_name: 'auth',
    summary: 'Auth flow',
    description: 'Auth description.',
    routing: 'discussion',
    classification: 'creates',
    _content: 'auth content',
  });

  it('rejects when plan.json is missing', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors[0].includes('plan.json not found'));
  });

  it('rejects when cache file missing for a theme', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({
      themes: [{ kebab_name: 'auth', summary: 's', description: 'd', routing: 'discussion', classification: 'creates' }],
    }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('no cache file')));
  });

  it('rejects when cache file is empty', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), _content: '   \n   ' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('cache file is empty')));
  });

  it('rejects duplicate kebab_name', () => {
    writeCachePlan('wu', 'src', [
      { ...baseTheme() },
      { ...baseTheme() },
    ]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("share kebab_name 'auth'")));
  });

  it('rejects whitespace-only summary', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), summary: '   ' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('empty summary')));
  });

  it('rejects empty description', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), description: '' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('empty description')));
  });

  it('rejects invalid routing', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), routing: 'foo' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('invalid routing')));
  });

  it('rejects invalid classification', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), classification: 'bogus' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('invalid classification')));
  });

  it('rejects merges without target_name', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), classification: 'merges' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('missing target_name')));
  });

  it('accepts a valid creates plan', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme() }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, true);
  });

  it('accepts a valid merges plan', () => {
    writeCachePlan('wu', 'src', [
      { ...baseTheme(), classification: 'merges', target_name: 'existing' },
    ]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, true);
  });

  it('rejects malformed JSON in plan.json', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), '{ "themes": [');  // truncated
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors[0].includes('not valid JSON'));
  });

  it('rejects when themes is not an array', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({ themes: { foo: 'bar' } }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors[0].includes('themes'));
  });

  it('rejects empty themes array', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({ themes: [] }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors[0].includes('no themes'));
  });

  it('rejects theme with missing kebab_name', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({
      themes: [{ summary: 's', description: 'd', routing: 'discussion', classification: 'creates' }],
    }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('empty or missing kebab_name')));
  });

  it('rejects theme that is not an object', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({
      themes: ['just-a-string'],
    }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('not an object')));
  });

  it('rejects whitespace-only kebab_name', () => {
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({
      themes: [{ kebab_name: '   ', summary: 's', description: 'd', routing: 'discussion', classification: 'creates' }],
    }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes('empty or missing kebab_name')));
  });
});

// ----- apply.cjs -----

describe('apply.cjs: end-to-end', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('renames source, creates new files + manifest items, single commit', () => {
    seedLegacyEpic('e1', 'exploration');
    writeCachePlan('e1', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        routing: 'discussion', classification: 'creates', _content: 'auth content' },
      { kebab_name: 'caching', summary: 'Cache', description: 'cache desc',
        routing: 'research', classification: 'creates', _content: 'cache content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e1', 'exploration');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { creates: 2, merges: 0 });

    // Source file renamed (not original path).
    assert.strictEqual(fileExists('e1', 'research/exploration.md'), false);
    const researchFiles = fs.readdirSync(path.join(dir, '.workflows', 'e1', 'research')).sort();
    assert.deepStrictEqual(
      researchFiles.filter(f => f.startsWith('exploration-superseded-')).length, 1
    );
    assert.ok(researchFiles.includes('auth.md'));
    assert.ok(researchFiles.includes('caching.md'));

    // Manifest: source inception item deleted, source research item renamed superseded.
    const m = readManifest('e1');
    assert.strictEqual(m.phases.inception.items.exploration, undefined);
    assert.strictEqual(m.phases.research.items.exploration, undefined);
    const supersededName = researchFiles.find(f => f.startsWith('exploration-superseded-')).replace(/\.md$/, '');
    assert.strictEqual(m.phases.research.items[supersededName].status, 'superseded');

    // New inception + research items with correct metadata.
    assert.strictEqual(m.phases.inception.items.auth.routing, 'discussion');
    assert.strictEqual(m.phases.inception.items.auth.summary, 'Auth');
    assert.strictEqual(m.phases.inception.items.auth.description, 'auth desc');
    assert.strictEqual(m.phases.inception.items.auth.source, 'legacy-split:exploration');
    assert.strictEqual(m.phases.research.items.auth.status, 'in-progress');

    // Single git commit.
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' }).stdout;
    const lines = log.trim().split('\n');
    assert.strictEqual(lines.length, 2);  // seed + legacy-split
    assert.ok(lines[0].includes('legacy-split exploration'));

    // Cache dir cleaned up.
    assert.strictEqual(
      fs.existsSync(path.join(dir, '.workflows', '.cache', 'e1', 'legacy-split', 'exploration')),
      false
    );
  });

  it('handles topic-name source: source name reused as creates theme', () => {
    seedLegacyEpic('e2', 'auth');
    writeCachePlan('e2', 'auth', [
      { kebab_name: 'auth', summary: 'Auth core', description: 'auth desc',
        routing: 'discussion', classification: 'creates', _content: 'auth-only content' },
      { kebab_name: 'caching', summary: 'Cache', description: 'cache desc',
        routing: 'research', classification: 'creates', _content: 'cache content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e2', 'auth');
    assert.strictEqual(r.json.ok, true);

    // Source file renamed; new auth.md exists at original path.
    const researchFiles = fs.readdirSync(path.join(dir, '.workflows', 'e2', 'research'));
    assert.ok(researchFiles.includes('auth.md'));
    assert.ok(researchFiles.some(f => f.startsWith('auth-superseded-')));

    const m = readManifest('e2');
    // Source inception item gone; new 'auth' is a fresh creates theme.
    assert.strictEqual(m.phases.inception.items.auth.source, 'legacy-split:auth');
    assert.strictEqual(m.phases.inception.items.auth.summary, 'Auth core');
  });

  it('appends to merge target and extends source field', () => {
    seedLegacyEpic('e3', 'exploration');
    // Pre-create an existing target topic.
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e3.research.existing'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e3.inception.existing'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'set', 'e3.inception.existing', 'source', 'inception'], { cwd: dir });
    writeResearchFile('e3', 'existing', '# Existing\n\nExisting content.\n');
    spawnSync('git', ['add', '.'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '-m', 'add-existing'], { cwd: dir });

    writeCachePlan('e3', 'exploration', [
      { kebab_name: 'merge-into-existing', summary: 'Append', description: 'append desc',
        routing: 'discussion', classification: 'merges', target_name: 'existing',
        _content: 'merged-in content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e3', 'exploration');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { creates: 0, merges: 1 });

    const existing = fs.readFileSync(path.join(dir, '.workflows', 'e3', 'research', 'existing.md'), 'utf8');
    assert.ok(existing.includes('Existing content.'));
    assert.ok(existing.includes('merged-in content'));
    assert.ok(existing.includes('\n---\n'));

    const m = readManifest('e3');
    assert.strictEqual(m.phases.inception.items.existing.source, 'inception,legacy-split:exploration');
    // Idempotent: re-running won't be possible (source deleted), but the source-field append must not duplicate the tag.
    assert.strictEqual(
      m.phases.inception.items.existing.source.split('legacy-split:exploration').length - 1,
      1
    );
  });

  it('on commit failure leaves mutations applied; detect skips via file/research rename', () => {
    seedLegacyEpic('e4', 'exploration');
    writeCachePlan('e4', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        routing: 'discussion', classification: 'creates', _content: 'auth content' },
    ]);

    const hookDir = path.join(dir, '.git', 'hooks');
    fs.writeFileSync(path.join(hookDir, 'pre-commit'),
      '#!/bin/sh\necho "blocked"; exit 1\n');
    fs.chmodSync(path.join(hookDir, 'pre-commit'), 0o755);

    const r = runScriptJson(APPLY_CLI, 'e4', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'git_commit');
    assert.ok(r.json.recovery_hint.length > 0);

    // Source inception item already deleted (happens before theme creation, before commit).
    const m = readManifest('e4');
    assert.strictEqual(m.phases.inception.items.exploration, undefined);
    // Theme was created.
    assert.strictEqual(m.phases.inception.items.auth.source, 'legacy-split:exploration');
    // Source file/research renamed.
    assert.strictEqual(fileExists('e4', 'research/exploration.md'), false);

    // Detect now excludes by file/research absence (sentinel survival is irrelevant here).
    const d = runScriptJson(DETECT_CLI, 'e4');
    assert.deepStrictEqual(d.json.qualifying_sources, []);
  });

  it('on sentinel-stage failure (file rename), sentinel remains and detect excludes', () => {
    seedLegacyEpic('e4b', 'exploration');
    writeCachePlan('e4b', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        routing: 'discussion', classification: 'creates', _content: 'auth content' },
    ]);

    // Make the source file unreadable by removing it before apply — fs.renameSync will
    // fail at the rename_source_file stage, simulating a mid-flight crash after sentinel.
    fs.unlinkSync(path.join(dir, '.workflows', 'e4b', 'research', 'exploration.md'));

    const r = runScriptJson(APPLY_CLI, 'e4b', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'rename_source_file');

    // Sentinel still set on source inception item.
    const m = readManifest('e4b');
    assert.strictEqual(m.phases.inception.items.exploration.legacy_split_state, 'in-progress');

    // Detect excludes due to sentinel (file also missing — both conditions skip).
    const d = runScriptJson(DETECT_CLI, 'e4b');
    assert.deepStrictEqual(d.json.qualifying_sources, []);
  });

  it('rejects merge into nonexistent target file', () => {
    seedLegacyEpic('e6', 'exploration');
    writeCachePlan('e6', 'exploration', [
      { kebab_name: 'merge-into-missing', summary: 's', description: 'd',
        routing: 'discussion', classification: 'merges', target_name: 'no-such-target',
        _content: 'orphan content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e6', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'apply_themes');
    assert.ok(r.json.error.includes('does not exist'));
  });

  it('multiple merges into same target append cleanly; source field stays idempotent', () => {
    seedLegacyEpic('e7', 'exploration');
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e7.research.shared'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e7.inception.shared'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'set', 'e7.inception.shared', 'source', 'inception'], { cwd: dir });
    writeResearchFile('e7', 'shared', '# Shared\n\nBase.\n');
    spawnSync('git', ['add', '.'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '-m', 'add-shared'], { cwd: dir });

    writeCachePlan('e7', 'exploration', [
      { kebab_name: 'piece-one', summary: 's', description: 'd', routing: 'discussion',
        classification: 'merges', target_name: 'shared', _content: 'piece-one body' },
      { kebab_name: 'piece-two', summary: 's', description: 'd', routing: 'discussion',
        classification: 'merges', target_name: 'shared', _content: 'piece-two body' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e7', 'exploration');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { creates: 0, merges: 2 });

    const merged = fs.readFileSync(path.join(dir, '.workflows', 'e7', 'research', 'shared.md'), 'utf8');
    assert.ok(merged.includes('Base.'));
    assert.ok(merged.includes('piece-one body'));
    assert.ok(merged.includes('piece-two body'));

    // Source-field tag must appear exactly once, despite two merges.
    const m = readManifest('e7');
    const occurrences = m.phases.inception.items.shared.source.split('legacy-split:exploration').length - 1;
    assert.strictEqual(occurrences, 1);
  });

  it('mixed creates and merges in one plan', () => {
    seedLegacyEpic('e8', 'exploration');
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e8.research.existing'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'init-phase', 'e8.inception.existing'], { cwd: dir });
    spawnSync('node', [MANIFEST_CLI, 'set', 'e8.inception.existing', 'source', 'inception'], { cwd: dir });
    writeResearchFile('e8', 'existing', '# Existing\n\nBase.\n');
    spawnSync('git', ['add', '.'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '-m', 'add-existing'], { cwd: dir });

    writeCachePlan('e8', 'exploration', [
      { kebab_name: 'new-topic', summary: 'New', description: 'new desc', routing: 'research',
        classification: 'creates', _content: 'new content' },
      { kebab_name: 'append-bit', summary: 'A', description: 'a', routing: 'discussion',
        classification: 'merges', target_name: 'existing', _content: 'append-content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e8', 'exploration');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { creates: 1, merges: 1 });

    const m = readManifest('e8');
    assert.strictEqual(m.phases.inception.items['new-topic'].source, 'legacy-split:exploration');
    assert.ok(m.phases.inception.items.existing.source.includes('legacy-split:exploration'));
  });

  it('fails fast on nonexistent work-unit', () => {
    setup();  // reset to a clean dir without any work unit
    const r = runScriptJson(APPLY_CLI, 'no-such-wu', 'no-such-source');
    assert.strictEqual(r.json.ok, false);
    // Validate is first stage; expect a validate-or-earlier failure rather than corruption.
    assert.ok(['validate', 'set_sentinel'].includes(r.json.stage));
  });

  it('partial-state retry: source file already renamed externally', () => {
    seedLegacyEpic('e9', 'exploration');
    // Simulate a previous run that renamed the source file out from under us.
    const orig = path.join(dir, '.workflows', 'e9', 'research', 'exploration.md');
    const renamed = path.join(dir, '.workflows', 'e9', 'research', 'exploration-superseded-2026-01-01T00-00-00.md');
    fs.renameSync(orig, renamed);

    writeCachePlan('e9', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'd', routing: 'discussion',
        classification: 'creates', _content: 'auth content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e9', 'exploration');
    // Apply should fail at the rename stage (original file is gone) — predictable, not corrupting.
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'rename_source_file');

    // Cache dir intact (no partial write); sentinel set (apply's first mutation).
    assert.strictEqual(
      fs.existsSync(path.join(dir, '.workflows', '.cache', 'e9', 'legacy-split', 'exploration', 'plan.json')),
      true
    );
    const m = readManifest('e9');
    assert.strictEqual(m.phases.inception.items.exploration.legacy_split_state, 'in-progress');
  });

  it('apply re-validates and reports cache errors at start', () => {
    seedLegacyEpic('e5', 'exploration');
    // Write a plan with invalid routing — validate will reject.
    writeCachePlan('e5', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        routing: 'wrong', classification: 'creates', _content: 'auth content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e5', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'validate');
    assert.ok(Array.isArray(r.json.errors));

    // No mutations applied — source still in place, no sentinel.
    const m = readManifest('e5');
    assert.strictEqual(m.phases.inception.items.exploration.legacy_split_state, undefined);
    assert.strictEqual(fileExists('e5', 'research/exploration.md'), true);
  });
});
