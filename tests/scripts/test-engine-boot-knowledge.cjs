'use strict';

// ---------------------------------------------------------------------------
// Boot's knowledge base (workflow-engine/scripts/domain/boot.cjs with
// kernel/knowledge/): a ready store brought in line and compacted, never
// committed; a set-up checkout with no store built by the keyword side; a
// store not ready left to the person's choice; a mistake in the knowledge
// config or a file the index cannot take a warning, never a block; and the
// system config deciding the provider, the vector fill launched, never
// waited on.
//
// Layer: verb. World: the project fixture (boot-world.cjs), a git repository
// with its state worktree and the workflows' hooks, made once per process and
// copied; boot runs from a copy of the engine beside a stand-in migration
// runner whose behaviour the test picks through the environment.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { git, stateGit, commitAll } = harness;
const REAL_SCRIPTS = path.dirname(harness.ENGINE);
const store = require(path.join(REAL_SCRIPTS, 'kernel/knowledge/store.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { KNOWLEDGE_DIR, STORE_FILES, stubbed, recordStubbedLaunches, readyKnowledge, completedDiscussion, bootProject, runEngine } = require('./boot-world.cjs');

describe('engine boot', () => {
  let fix;
  beforeEach(() => { fix = bootProject(); });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('happy path: no pending migrations, knowledge ready — the store brought in line, then compacted', () => {
    readyKnowledge(fix.project);
    // TMUX pinned so the label-state leg is deterministic whatever terminal
    // runs the suite; no project manifest makes it `prompt`.
    const res = runEngine(stubbed, fix.project, ['boot'], { TMUX: '/fake/sock,123,7' });

    assert.deepStrictEqual(res, {
      ok: true,
      state: 'ready',
      migrations: { changed: false, ran: 0, output: '[SKIP] No changes needed', verify: [], notices: [] },
      knowledge: 'ready',
      indexed: true,
      compacted: true,
      migrations_committed: null,
      warnings: [],
      tmux_labels: 'prompt',
      label_repaired: false,
      session_hooks_installed: false,
      gate_surface: 'unavailable',
      baseline: 'none',
      walkthrough: 'none',
      github_rule_offer: false,
      github_squash_offer: false,
      // The fixture's first code commit, its `.gitignore` naming the state,
      // is the setup's own, in the second the state arrived: no history
      // came before the workflows.
      baseline_signal: {
        root_date: '2026-01-01', workflows_date: '2026-01-01', commits_total: 2, commits_before: 0,
        history_before: [], files_at_arrival: 0, tree_at_arrival: [],
      },
    });
  });

  it('knowledge not-ready is terminal: no init, no commit, setup stays a human choice', () => {
    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge')), 'nothing set up');
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });

  it('a ready store is never committed — the index is the checkout\'s own', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md']);
    assert.strictEqual(git(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'init');
    assert.strictEqual(stateGit(fix.project, ['ls-files', '--', '.knowledge']).trim(), '');
  });

  it('buildable: a set-up checkout with no store has it built by the keyword side, then compacted', () => {
    createFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    completedDiscussion(fix.project, '# Payments\n\nCards ship first.\n');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!('system_config' in res), 'a store that stood needs no setup');
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md']);
  });

  it('buildable: a build that did not stand is not-ready — no compact, the gate\'s report attached', () => {
    createFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    createFile(fix.project, '.leeway/manifest.json', '{ not json');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge index failed: manifest read failed: project manifest at .* is not valid JSON/);
    assert.ok('system_config' in res);
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge/store.bin')));
  });

  it('buildable: a store that stood with a file failing is ready, the failure a warning the next start retries', () => {
    createFile(fix.project, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    completedDiscussion(fix.project, '');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.warnings.length, 1);
    const file = path.join(fix.project, '.leeway/payments/discussion/payments.md');
    assert.ok(res.warnings[0].startsWith(`knowledge index failed: Failed to index ${file}: No chunks produced from ${file}.`), res.warnings[0]);
  });

  it('a check that cannot read the knowledge config is not-ready — never a crash', () => {
    fs.mkdirSync(path.join(fix.project, '.leeway/.knowledge/config.json'), { recursive: true });

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
  });

  it('a mistake in the knowledge config is named, never a block — compact prunes at the default floor in its place', () => {
    // S0 0.05: 'buried', two completions behind, sits at R ≈ 0.015 — below the
    // default floor 0.05 — and 'recent', one behind, at R ≈ 0.12, above it.
    const completions = [['buried', '2024-01-01'], ['recent', '2024-06-01'], ['frontier', '2024-12-01']];
    createFile(fix.project, '.leeway/manifest.json', JSON.stringify({
      work_units: Object.fromEntries(completions.map(([name]) => [name, { work_type: 'feature' }])),
    }, null, 2) + '\n');
    for (const [name, completedAt] of completions) {
      createFile(fix.project, `.leeway/${name}/manifest.json`, JSON.stringify({
        name, work_type: 'feature', status: 'completed', created: '2024-01-01', completed_at: completedAt,
        phases: name === 'frontier' ? {} : { discussion: { items: { [name]: { status: 'completed' } } } },
      }, null, 2) + '\n');
      if (name !== 'frontier') createFile(fix.project, `.leeway/${name}/discussion/${name}.md`, `# ${name}\n\nCards ship first.\n`);
    }
    readyKnowledge(fix.project, { decay_prune_below: false, decay_base_stability: 0.05 });
    runEngine(stubbed, fix.project, ['boot']);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['buried/discussion/buried.md', 'recent/discussion/recent.md']);

    const configFile = path.join(fix.project, '.leeway/.knowledge/config.json');
    createFile(fix.project, '.leeway/.knowledge/config.json', JSON.stringify({
      knowledge: { provider: null, decay_prune_below: 7, decay_base_stability: 0.05, strategy: 'hybrid' },
    }) + '\n');
    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, [
      `knowledge config: decay_prune_below in ${configFile} is ignored: 7 is not false or a number from 0 to 1`,
      `knowledge config: strategy in ${configFile} is ignored: not a knowledge setting`,
    ]);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['recent/discussion/recent.md']);
  });

  it('a file the index cannot take is its own warning — compact still runs', () => {
    readyKnowledge(fix.project);
    completedDiscussion(fix.project, '');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, true);
    assert.strictEqual(res.warnings.length, 1);
    const file = path.join(fix.project, '.leeway/payments/discussion/payments.md');
    assert.ok(res.warnings[0].startsWith(`knowledge index failed: Failed to index ${file}: No chunks produced from ${file}.`), res.warnings[0]);
  });

  it('a failing index and a failing compact are two warnings, never a block', () => {
    readyKnowledge(fix.project);
    createFile(fix.project, '.leeway/manifest.json', '{ not json');

    const res = runEngine(stubbed, fix.project, ['boot']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, false);
    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.warnings.length, 2);
    assert.match(res.warnings[0], /^knowledge index failed: manifest read failed: /);
    assert.match(res.warnings[1], /^knowledge compact failed: /);
  });
});

describe('engine boot: a set-up checkout with no store', () => {
  let fix;
  let sysDir;
  beforeEach(() => {
    fix = bootProject();
    sysDir = path.join(fix.root, 'system-config');
    fs.mkdirSync(sysDir, { recursive: true });
    // A feature with one completed discussion — something for a build to index.
    createFile(fix.project, '.leeway/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'feature' } } }, null, 2) + '\n');
    createFile(fix.project, '.leeway/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'feature', status: 'in-progress', created: '2026-01-01',
      phases: { discussion: { items: { payments: { status: 'completed' } } } },
    }, null, 2) + '\n');
    createFile(fix.project, '.leeway/payments/discussion/payments.md', '# Payments\n\n## Card first\n\nCards ship first; wallets follow.\n');
    commitAll(fix.project, 'the project');
    // This checkout is set up — its local knowledge config — with no store.
    createFile(fix.project, CONFIG, '{ "knowledge": {} }\n');
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const bootWith = (systemConfig, extra = {}) => {
    if (systemConfig !== null) createFile(sysDir, 'config.json', JSON.stringify(systemConfig));
    return runEngine(stubbed, fix.project, ['boot'], { WORKFLOWS_CONFIG_DIR: sysDir, ...extra });
  };
  const CONFIG = STORE_FILES[2];
  const storePath = () => path.join(fix.project, STORE_FILES[0]);
  const metadata = () => JSON.parse(fs.readFileSync(path.join(fix.project, STORE_FILES[1]), 'utf8'));

  it('a provider whose key resolves builds the store by keyword, out of git, and hands its vectors to the fill', (t) => {
    const launched = recordStubbedLaunches(t);
    const head = git(fix.project, ['rev-parse', 'HEAD']).trim();

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.strictEqual(res.compacted, true);
    assert.deepStrictEqual(res.warnings, []);
    assert.ok(!('system_config' in res));
    const meta = metadata();
    assert.strictEqual(meta.provider, 'stub');
    assert.strictEqual(meta.dimensions, 8);
    assert.ok(meta.last_indexed, 'the discussion was indexed into it');
    assert.strictEqual(store.chunksWithoutVector(store.loadStore(storePath())).length, 1, 'its vector awaits the fill');
    assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway')]);
    assert.strictEqual(git(fix.project, ['rev-parse', 'HEAD']).trim(), head, 'the build commits nothing');
    assert.strictEqual(stateGit(fix.project, ['log', '-1', '--pretty=%s']).trim(), 'the project', 'on either side');
    assert.strictEqual(stateGit(fix.project, ['ls-files', '--', '.knowledge']).trim(), '');
  });

  it('boot never waits on embedding: an endpoint that never answers is never asked', async (t) => {
    const launched = recordStubbedLaunches(t);
    let requests = 0;
    const silent = require('http').createServer(() => { requests += 1; });
    await new Promise((resolve) => silent.listen(0, '127.0.0.1', () => resolve(undefined)));
    const { port } = /** @type {import('net').AddressInfo} */ (silent.address());
    try {
      const res = bootWith({ knowledge: { provider: 'openai-compatible', base_url: `http://127.0.0.1:${port}/v1`, model: 'm', dimensions: 8 } });

      assert.strictEqual(res.knowledge, 'ready');
      assert.strictEqual(res.indexed, true);
      assert.deepStrictEqual(res.warnings, []);
      assert.strictEqual(requests, 0);
      assert.strictEqual(metadata().provider, 'openai-compatible', 'the store is built, its vectors awaited');
      assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway')]);
    } finally {
      silent.closeAllConnections();
      await new Promise((resolve) => silent.close(() => resolve(undefined)));
    }
  });

  it('a store whose provider key does not resolve warns naming the key, and launches no fill', (t) => {
    const launched = recordStubbedLaunches(t);
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 8 };
    store.saveStore(store.createStore(), storePath());
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...openai, last_indexed: null });
    createFile(fix.project, CONFIG, JSON.stringify({ knowledge: openai }));

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(res.indexed, true);
    assert.deepStrictEqual(res.warnings, [
      'knowledge vectors wait: the openai API key could not be resolved; export OPENAI_API_KEY, or run node .claude/skills/workflow-engine/scripts/engine.cjs knowledge setup --key-only',
    ]);
    assert.deepStrictEqual(harness.indexedFiles(fix.project), ['payments/discussion/payments.md'], 'the keyword side still lands');
    assert.deepStrictEqual(launched, []);
  });

  it('a vector fill that fell short is the next start\'s warning — and the fill goes again', (t) => {
    const launched = recordStubbedLaunches(t);
    bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...metadata(), fill_failure: 'payments/discussion/payments.md: out of quota' });

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.deepStrictEqual(res.warnings, ['knowledge vector fill fell short: payments/discussion/payments.md: out of quota']);
    assert.deepStrictEqual(launched, [path.join(fix.project, '.leeway'), path.join(fix.project, '.leeway')]);
  });

  it('a fill\'s shortfall stays quiet once nothing awaits a vector — its chunks since retired', (t) => {
    recordStubbedLaunches(t);
    createFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');
    bootWith(null);
    store.writeMetadata(path.join(fix.project, STORE_FILES[1]), { ...metadata(), fill_failure: 'payments/discussion/payments.md: out of quota' });
    const unit = path.join(fix.project, '.leeway/payments/manifest.json');
    fs.writeFileSync(unit, JSON.stringify({ ...JSON.parse(fs.readFileSync(unit, 'utf8')), status: 'cancelled' }));

    const res = bootWith(null);

    assert.deepStrictEqual(res.warnings, []);
    assert.doesNotMatch(harness.output(fix.project, ['knowledge', 'status']), /fell short/);
  });

  it('a metadata file that does not parse is a warning, never a block', () => {
    createFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');
    bootWith(null);
    createFile(fix.project, STORE_FILES[1], '{ not json');

    const res = bootWith(null);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(res.warnings.length > 0);
    for (const warning of res.warnings) assert.match(warning, /^knowledge .* failed: readMetadata: invalid JSON at /);
  });

  it('a keyword-only store launches no fill', (t) => {
    const launched = recordStubbedLaunches(t);
    createFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.deepStrictEqual(launched, []);
  });

  it('keyword-only chosen outright in the system config builds a keyword-only store', () => {
    const res = bootWith({ knowledge: {} });

    assert.strictEqual(res.knowledge, 'ready');
    assert.deepStrictEqual(res.warnings, []);
    assert.strictEqual(metadata().provider, null);
    assert.ok(metadata().last_indexed);
  });

  it('keyword-only pinned by the project config builds keyword-only, whatever the machine lacks', () => {
    createFile(fix.project, CONFIG, '{ "knowledge": { "provider": null } }\n');

    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'ready');
    assert.strictEqual(metadata().provider, null);
  });

  it('no system config is not-ready — nothing built, the gate runs as for any unready store', () => {
    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.indexed, false);
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
    assert.ok(!fs.existsSync(storePath()));
  });

  it('an invalid system config is not-ready — nothing built', () => {
    createFile(sysDir, 'config.json', 'not json');
    const res = bootWith(null);

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.system_config.status, 'invalid');
    assert.ok(!fs.existsSync(storePath()));
  });

  it('a provider whose key cannot be resolved is not-ready — never a keyword-only store in its place', () => {
    const res = bootWith({ knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 } });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(res.system_config, { status: 'valid', provider: 'openai', model: 'text-embedding-3-small' });
    assert.ok(!fs.existsSync(storePath()));
  });

  it('a checkout never set up is not-ready whatever the machine says — boot sets nothing up', () => {
    fs.rmSync(path.join(fix.project, KNOWLEDGE_DIR), { recursive: true, force: true });

    const res = bootWith({ knowledge: { provider: 'stub', dimensions: 8 } });

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.strictEqual(res.system_config.status, 'valid');
    assert.ok(!fs.existsSync(path.join(fix.project, '.leeway/.knowledge')));
  });
});
