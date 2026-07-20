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
  // maxRetries: teardown races concurrent suites' fs activity under parallel
  // load — a bare rm intermittently dies ENOTEMPTY.
  if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
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
      discovery: {
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
    seedLegacyEpic('beta', 'foo', { source: 'discovery' });
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
        discovery: { items: {
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
    seedLegacyEpic('substr', 'foo', { source: 'discovery,migration-seeded' });
    const r = runScriptJson(DETECT_CLI, 'substr');
    assert.deepStrictEqual(r.json.qualifying_sources, ['foo']);
  });

  it('surfaces an otherwise-qualifying source with an illegal (dotted) name as unsplittable', () => {
    seedLegacyEpic('dotted', 'api.v2');
    const r = runScriptJson(DETECT_CLI, 'dotted');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
    assert.strictEqual(r.json.unsplittable.length, 1);
    assert.strictEqual(r.json.unsplittable[0].name, 'api.v2');
    assert.ok(r.json.unsplittable[0].reason.length > 0);
  });

  it('does not surface non-candidate illegal names as unsplittable', () => {
    // Illegal name but not migration-seeded — it was never a split candidate.
    seedLegacyEpic('notcand', 'api.v2', { source: 'discovery' });
    const r = runScriptJson(DETECT_CLI, 'notcand');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
    assert.deepStrictEqual(r.json.unsplittable, []);
  });

  it('surfaces a set legacy_split_state as a stranded sentinel', () => {
    seedLegacyEpic('stranded', 'src', { legacy_split_state: 'in-progress' });
    const r = runScriptJson(DETECT_CLI, 'stranded');
    assert.deepStrictEqual(r.json.qualifying_sources, []);
    assert.deepStrictEqual(r.json.stranded_sentinels, ['src']);
  });

  it('a clean run reports empty unsplittable and stranded lists', () => {
    seedLegacyEpic('clean', 'exploration');
    const r = runScriptJson(DETECT_CLI, 'clean');
    assert.deepStrictEqual(r.json.qualifying_sources, ['exploration']);
    assert.deepStrictEqual(r.json.unsplittable, []);
    assert.deepStrictEqual(r.json.stranded_sentinels, []);
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
      themes: [{ kebab_name: 'auth', summary: 's', description: 'd' }],
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

  it('accepts a valid plan', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme() }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, true);
  });

  it('rejects collision with existing discovery item (not the source itself)', () => {
    writeManifest('wu', {
      name: 'wu',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: {
          items: {
            src: { routing: 'research', source: 'migration-seeded' },
            auth: { routing: 'discussion', source: 'discovery' },  // active collision target
          },
        },
      },
    });
    writeCachePlan('wu', 'src', [{ ...baseTheme() }]);  // baseTheme is kebab_name='auth'
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("collides with an existing discovery item")));
  });

  it('accepts a theme that reuses the source name (source-rename case)', () => {
    writeManifest('wu', {
      name: 'wu',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: {
          items: {
            auth: { routing: 'research', source: 'migration-seeded' },  // src is named 'auth'
          },
        },
      },
    });
    // src is 'auth'; the single theme is also 'auth'. This is the source-rename case.
    writeCachePlan('wu', 'auth', [{ ...baseTheme() }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'auth');
    assert.strictEqual(r.json.ok, true);
  });

  it('rejects a theme name containing a dot (engine dot-path hazard)', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), kebab_name: 'api-v2.0' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("theme 'api-v2.0' has an illegal name")));
  });

  it('rejects a theme name containing a slash (filesystem hazard)', () => {
    // Write plan.json directly — a slash in the name can't be a flat cache filename.
    const cacheDir = path.join(dir, '.workflows', '.cache', 'wu', 'legacy-split', 'src');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'plan.json'), JSON.stringify({
      themes: [{ kebab_name: 'api/v2', summary: 's', description: 'd' }],
    }));
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("theme 'api/v2' has an illegal name")));
  });

  it('rejects an uppercase / underscore theme name', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), kebab_name: 'API_Design' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("theme 'API_Design' has an illegal name")));
  });

  it('rejects a theme name with a leading dash', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), kebab_name: '-auth' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("theme '-auth' has an illegal name")));
  });

  it('accepts a clean kebab name with digits', () => {
    writeCachePlan('wu', 'src', [{ ...baseTheme(), kebab_name: 'api-v2' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, true);
  });

  it('rejects a theme that would overwrite an existing research file (no manifest item)', () => {
    // A research file on disk with NO discovery/research manifest item — the
    // discovery-collision check misses it, but apply's writeFileSync would clobber it.
    writeResearchFile('wu', 'orphan', '# Orphan research\n\nPre-existing.');
    writeCachePlan('wu', 'src', [{ ...baseTheme(), kebab_name: 'orphan' }]);
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'src');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.errors.some(e => e.includes("would overwrite existing research file orphan.md")));
  });

  it('allows a theme reusing the source name even though its file exists on disk', () => {
    // src is 'auth'; research/auth.md exists (the source). apply renames it away
    // before writing themes, so the disk-collision check exempts the source name.
    writeManifest('wu', {
      name: 'wu', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { auth: { routing: 'research', source: 'migration-seeded' } } } },
    });
    writeResearchFile('wu', 'auth', '# Broad Research\n\nContent.');
    writeCachePlan('wu', 'auth', [{ ...baseTheme() }]);  // baseTheme kebab_name === 'auth'
    const r = runScriptJson(VALIDATE_CLI, 'wu', 'auth');
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
      themes: [{ summary: 's', description: 'd' }],
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
      themes: [{ kebab_name: '   ', summary: 's', description: 'd' }],
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
        _content: 'auth content' },
      { kebab_name: 'caching', summary: 'Cache', description: 'cache desc',
        _content: 'cache content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e1', 'exploration');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { themes: 2 });

    // Source file renamed (not original path).
    assert.strictEqual(fileExists('e1', 'research/exploration.md'), false);
    const researchFiles = fs.readdirSync(path.join(dir, '.workflows', 'e1', 'research')).sort();
    assert.deepStrictEqual(
      researchFiles.filter(f => f.startsWith('exploration-superseded-')).length, 1
    );
    assert.ok(researchFiles.includes('auth.md'));
    assert.ok(researchFiles.includes('caching.md'));

    // Manifest: source discovery item deleted, source research item renamed superseded.
    const m = readManifest('e1');
    assert.strictEqual(m.phases.discovery.items.exploration, undefined);
    assert.strictEqual(m.phases.research.items.exploration, undefined);
    const supersededName = researchFiles.find(f => f.startsWith('exploration-superseded-')).replace(/\.md$/, '');
    assert.strictEqual(m.phases.research.items[supersededName].status, 'superseded');

    // New discovery + research items with correct metadata.
    assert.strictEqual(m.phases.discovery.items.auth.routing, 'research');
    assert.strictEqual(m.phases.discovery.items.caching.routing, 'research');
    assert.strictEqual(m.phases.discovery.items.auth.summary, 'Auth');
    assert.strictEqual(m.phases.discovery.items.auth.description, 'auth desc');
    assert.strictEqual(m.phases.discovery.items.auth.source, 'legacy-split:exploration');
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

  it('handles topic-name source: source name reused by a theme', () => {
    seedLegacyEpic('e2', 'auth');
    writeCachePlan('e2', 'auth', [
      { kebab_name: 'auth', summary: 'Auth core', description: 'auth desc',
        _content: 'auth-only content' },
      { kebab_name: 'caching', summary: 'Cache', description: 'cache desc',
        _content: 'cache content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e2', 'auth');
    assert.strictEqual(r.json.ok, true);

    // Source file renamed; new auth.md exists at original path.
    const researchFiles = fs.readdirSync(path.join(dir, '.workflows', 'e2', 'research'));
    assert.ok(researchFiles.includes('auth.md'));
    assert.ok(researchFiles.some(f => f.startsWith('auth-superseded-')));

    const m = readManifest('e2');
    // Source discovery item gone; new 'auth' is a fresh theme.
    assert.strictEqual(m.phases.discovery.items.auth.source, 'legacy-split:auth');
    assert.strictEqual(m.phases.discovery.items.auth.summary, 'Auth core');
  });

  it('single-theme split: source renamed, new file created at same name, full metadata', () => {
    seedLegacyEpic('e2b', 'auth');
    writeCachePlan('e2b', 'auth', [
      { kebab_name: 'auth', summary: 'Auth flow', description: 'Reflowed auth description.',
        _content: 'Re-flowed auth content for the new file.' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e2b', 'auth');
    assert.strictEqual(r.json.ok, true);
    assert.deepStrictEqual(r.json.applied, { themes: 1 });

    // Original file renamed, new file in its place.
    const researchFiles = fs.readdirSync(path.join(dir, '.workflows', 'e2b', 'research')).sort();
    assert.ok(researchFiles.includes('auth.md'));
    assert.ok(researchFiles.some(f => f.startsWith('auth-superseded-')));

    // New file is wrapped in the research template (title, summary, starting point, body).
    const newContent = fs.readFileSync(path.join(dir, '.workflows', 'e2b', 'research', 'auth.md'), 'utf8');
    assert.ok(newContent.startsWith('# Research: Auth\n'));
    assert.ok(newContent.includes('Auth flow'));  // summary
    assert.ok(newContent.includes('## Starting Point'));
    assert.ok(newContent.includes('Material extracted from legacy research file auth.md'));
    assert.ok(newContent.endsWith('Re-flowed auth content for the new file.'));

    // Discovery item now has proper metadata (was null on the migration-seeded source).
    const m = readManifest('e2b');
    assert.strictEqual(m.phases.discovery.items.auth.summary, 'Auth flow');
    assert.strictEqual(m.phases.discovery.items.auth.description, 'Reflowed auth description.');
    assert.strictEqual(m.phases.discovery.items.auth.routing, 'research');
    assert.strictEqual(m.phases.discovery.items.auth.source, 'legacy-split:auth');
  });

  it('on commit failure leaves mutations applied; detect skips via file/research rename', () => {
    seedLegacyEpic('e4', 'exploration');
    writeCachePlan('e4', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        _content: 'auth content' },
    ]);

    const hookDir = path.join(dir, '.git', 'hooks');
    fs.writeFileSync(path.join(hookDir, 'pre-commit'),
      '#!/bin/sh\necho "blocked"; exit 1\n');
    fs.chmodSync(path.join(hookDir, 'pre-commit'), 0o755);

    const r = runScriptJson(APPLY_CLI, 'e4', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'git_commit');
    assert.ok(r.json.recovery_hint.length > 0);

    // Source discovery item already deleted (happens before theme creation, before commit).
    const m = readManifest('e4');
    assert.strictEqual(m.phases.discovery.items.exploration, undefined);
    // Theme was created.
    assert.strictEqual(m.phases.discovery.items.auth.source, 'legacy-split:exploration');
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
        _content: 'auth content' },
    ]);

    // Make the source file unreadable by removing it before apply — fs.renameSync will
    // fail at the rename_source_file stage, simulating a mid-flight crash after sentinel.
    fs.unlinkSync(path.join(dir, '.workflows', 'e4b', 'research', 'exploration.md'));

    const r = runScriptJson(APPLY_CLI, 'e4b', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'rename_source_file');

    // Sentinel still set on source discovery item.
    const m = readManifest('e4b');
    assert.strictEqual(m.phases.discovery.items.exploration.legacy_split_state, 'in-progress');

    // Detect excludes due to sentinel (file also missing — both conditions skip).
    const d = runScriptJson(DETECT_CLI, 'e4b');
    assert.deepStrictEqual(d.json.qualifying_sources, []);
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
      { kebab_name: 'auth', summary: 'Auth', description: 'd',
        _content: 'auth content' },
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
    assert.strictEqual(m.phases.discovery.items.exploration.legacy_split_state, 'in-progress');
  });

  it('pulls dismissed name from list before re-adding theme', () => {
    seedLegacyEpic('e10', 'exploration');
    // Add 'auth' to the dismissed list — user previously removed it via refinement.
    const m = readManifest('e10');
    m.phases.discovery.dismissed = ['auth', 'unrelated-name'];
    fs.writeFileSync(
      path.join(dir, '.workflows', 'e10', 'manifest.json'),
      JSON.stringify(m, null, 2)
    );
    spawnSync('git', ['add', '.'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '-m', 'add-dismissed'], { cwd: dir });

    writeCachePlan('e10', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: 'auth desc',
        _content: 'auth content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e10', 'exploration');
    assert.strictEqual(r.json.ok, true);

    const m2 = readManifest('e10');
    // 'auth' pulled from dismissed; 'unrelated-name' still there.
    assert.deepStrictEqual(m2.phases.discovery.dismissed, ['unrelated-name']);
    // Theme created normally.
    assert.strictEqual(m2.phases.discovery.items.auth.source, 'legacy-split:exploration');
  });

  it('apply re-validates and reports cache errors at start', () => {
    seedLegacyEpic('e5', 'exploration');
    // Write a plan with empty description — validate will reject.
    writeCachePlan('e5', 'exploration', [
      { kebab_name: 'auth', summary: 'Auth', description: '',
        _content: 'auth content' },
    ]);

    const r = runScriptJson(APPLY_CLI, 'e5', 'exploration');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.json.stage, 'validate');
    assert.ok(Array.isArray(r.json.errors));

    // No mutations applied — source still in place, no sentinel.
    const m = readManifest('e5');
    assert.strictEqual(m.phases.discovery.items.exploration.legacy_split_state, undefined);
    assert.strictEqual(fileExists('e5', 'research/exploration.md'), true);
  });
});
